import {
  collection,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  increment,
  deleteDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import CryptoJS from "crypto-js";
import {
  PostStatus,
  PostPriority,
  AssignmentType,
  PostActivityType,
  UserRole,
  NotificationType,
} from "../utils/constants";

// Secret key for anonymous encryption (should be in environment variables in production)
const ANONYMOUS_SECRET = import.meta.env.VITE_ANONYMOUS_SECRET || "default-secret-key-change-in-production";

// ============================================
// ANONYMOUS AUTHOR ENCRYPTION
// ============================================

/**
 * Encrypt anonymous author ID
 * @param {string} authorId - The actual user ID
 * @returns {string} - Encrypted author ID
 */
export const encryptAuthorId = (authorId) => {
  try {
    return CryptoJS.AES.encrypt(authorId, ANONYMOUS_SECRET).toString();
  } catch (error) {
    console.error("Error encrypting author ID:", error);
    throw error;
  }
};

/**
 * Decrypt anonymous author ID (admin only)
 * @param {string} encryptedId - The encrypted author ID
 * @returns {string} - Decrypted author ID
 */
export const decryptAuthorId = (encryptedId) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedId, ANONYMOUS_SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Error decrypting author ID:", error);
    return null;
  }
};

// ============================================
// RATE LIMITING
// ============================================

/**
 * Check if user has exceeded post creation rate limit
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Promise<{allowed: boolean, remaining: number, resetTime: Date}>}
 */
export const checkRateLimit = async (userId, companyId) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Query posts created by user in the last hour
    const postsRef = collection(db, "posts");
    const q = query(
      postsRef,
      where("authorId", "==", userId),
      where("companyId", "==", companyId),
      where("createdAt", ">=", oneHourAgo),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    const postCount = snapshot.size;

    // Rate limit: 10 posts per hour
    const RATE_LIMIT = 10;
    const allowed = postCount < RATE_LIMIT;
    const remaining = Math.max(0, RATE_LIMIT - postCount);

    // Calculate reset time (1 hour from now)
    const resetTime = new Date(now.getTime() + 60 * 60 * 1000);

    return {
      allowed,
      remaining,
      resetTime,
      currentCount: postCount,
      limit: RATE_LIMIT,
    };
  } catch (error) {
    console.error("Error checking rate limit:", error);
    // Allow post creation if rate limit check fails (fail open)
    return { allowed: true, remaining: 10, resetTime: new Date() };
  }
};

// ============================================
// POST STATUS MANAGEMENT
// ============================================

/**
 * Update post status
 * @param {string} postId - Post ID
 * @param {string} newStatus - New status from PostStatus enum
 * @param {object} adminUser - Admin user performing the action
 * @param {string} comment - Optional comment explaining the status change
 * @returns {Promise<void>}
 */
export const updatePostStatus = async (postId, newStatus, adminUser, comment = "") => {
  try {
    // Verify permission: admin OR assigned user
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    const postData = postSnap.data();
    const isAssigned = postData.assignedTo?.id === adminUser.id;

    if (!isAdmin(adminUser.role) && !isAssigned) {
      throw new Error("Only admins or assigned users can update post status");
    }

    const oldStatus = postData.status;

    // Update post status
    await updateDoc(postRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
      lastUpdatedBy: adminUser.displayName,
      lastUpdatedById: adminUser.id,
    });

    // Log activity
    await logPostActivity(postId, PostActivityType.STATUS_CHANGED, {
      adminId: adminUser.id,
      adminName: adminUser.displayName,
      oldStatus,
      newStatus,
      comment,
    });

    // Notify post author
    await notifyAuthor(postId, postSnap.data(), NotificationType.STATUS_CHANGED, {
      status: newStatus,
      adminName: adminUser.displayName,
      comment,
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating post status:", error);
    throw error;
  }
};

// ============================================
// POST PRIORITY MANAGEMENT
// ============================================

/**
 * Update post priority
 * @param {string} postId - Post ID
 * @param {string} newPriority - New priority from PostPriority enum
 * @param {object} adminUser - Admin user performing the action
 * @returns {Promise<void>}
 */
export const updatePostPriority = async (postId, newPriority, adminUser) => {
  try {
    if (!isAdmin(adminUser.role)) {
      throw new Error("Only admins can update post priority");
    }

    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    const oldPriority = postSnap.data().priority || PostPriority.MEDIUM;

    await updateDoc(postRef, {
      priority: newPriority,
      updatedAt: serverTimestamp(),
      lastUpdatedBy: adminUser.displayName,
      lastUpdatedById: adminUser.id,
    });

    await logPostActivity(postId, PostActivityType.PRIORITY_CHANGED, {
      adminId: adminUser.id,
      adminName: adminUser.displayName,
      oldPriority,
      newPriority,
    });

    // Notify author if priority is elevated to critical or high
    if (newPriority === PostPriority.CRITICAL || newPriority === PostPriority.HIGH) {
      await notifyAuthor(postId, postSnap.data(), NotificationType.PRIORITY_CHANGED, {
        priority: newPriority,
        adminName: adminUser.displayName,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating post priority:", error);
    throw error;
  }
};

// ============================================
// POST ASSIGNMENT
// ============================================

/**
 * Assign post to user or department
 * @param {string} postId - Post ID
 * @param {object} assignment - Assignment object {type, id, name, dueDate}
 * @param {object} adminUser - Admin user performing the action
 * @returns {Promise<void>}
 */
export const assignPost = async (postId, assignment, adminUser) => {
  try {
    if (!isAdmin(adminUser.role)) {
      throw new Error("Only admins can assign posts");
    }

    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    const postData = postSnap.data();

    await updateDoc(postRef, {
      assignedTo: {
        type: assignment.type,
        id: assignment.id,
        name: assignment.name,
        assignedAt: serverTimestamp(),
        assignedBy: adminUser.displayName,
        assignedById: adminUser.id,
      },
      dueDate: assignment.dueDate || null,
      updatedAt: serverTimestamp(),
      lastUpdatedBy: adminUser.displayName,
      lastUpdatedById: adminUser.id,
    });

    await logPostActivity(postId, PostActivityType.ASSIGNED, {
      adminId: adminUser.id,
      adminName: adminUser.displayName,
      assignmentType: assignment.type,
      assignedToId: assignment.id,
      assignedToName: assignment.name,
      dueDate: assignment.dueDate,
    });

    // Notify assignee if it's a user
    if (assignment.type === AssignmentType.USER) {
      await createNotification({
        userId: assignment.id,
        type: NotificationType.ASSIGNED,
        title: "New assignment",
        message: `You've been assigned to: ${postData.title}`,
        postId: postId,
        companyId: postData.companyId,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error assigning post:", error);
    throw error;
  }
};

/**
 * Unassign post
 * @param {string} postId - Post ID
 * @param {object} adminUser - Admin user performing the action
 * @returns {Promise<void>}
 */
export const unassignPost = async (postId, adminUser) => {
  try {
    if (!isAdmin(adminUser.role)) {
      throw new Error("Only admins can unassign posts");
    }

    const postRef = doc(db, "posts", postId);

    await updateDoc(postRef, {
      assignedTo: null,
      dueDate: null,
      updatedAt: serverTimestamp(),
      lastUpdatedBy: adminUser.displayName,
      lastUpdatedById: adminUser.id,
    });

    await logPostActivity(postId, PostActivityType.UNASSIGNED, {
      adminId: adminUser.id,
      adminName: adminUser.displayName,
    });

    return { success: true };
  } catch (error) {
    console.error("Error unassigning post:", error);
    throw error;
  }
};

// ============================================
// DUE DATE MANAGEMENT
// ============================================

/**
 * Set or update due date for a post
 * @param {string} postId - Post ID
 * @param {Date} dueDate - Due date
 * @param {object} adminUser - Admin user performing the action
 * @returns {Promise<void>}
 */
export const setDueDate = async (postId, dueDate, adminUser) => {
  try {
    if (!isAdmin(adminUser.role)) {
      throw new Error("Only admins can set due dates");
    }

    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    const oldDueDate = postSnap.data().dueDate;
    const activityType = oldDueDate
      ? PostActivityType.DUE_DATE_CHANGED
      : PostActivityType.DUE_DATE_SET;

    await updateDoc(postRef, {
      dueDate: dueDate,
      updatedAt: serverTimestamp(),
      lastUpdatedBy: adminUser.displayName,
      lastUpdatedById: adminUser.id,
    });

    await logPostActivity(postId, activityType, {
      adminId: adminUser.id,
      adminName: adminUser.displayName,
      oldDueDate,
      newDueDate: dueDate,
    });

    return { success: true };
  } catch (error) {
    console.error("Error setting due date:", error);
    throw error;
  }
};

// ============================================
// ADMIN COMMENTS
// ============================================

/**
 * Add admin comment to post (public, visible to all)
 * @param {string} postId - Post ID
 * @param {string} commentText - Comment text
 * @param {object} adminUser - Admin user adding the comment
 * @returns {Promise<void>}
 */
export const addAdminComment = async (postId, commentText, adminUser) => {
  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    const postData = postSnap.data();
    const isAssigned = postData.assignedTo?.id === adminUser.id;

    if (!isAdmin(adminUser.role) && !isAssigned) {
      throw new Error("Only admins or assigned users can add comments");
    }

    // Add comment to comments collection
    const commentData = {
      postId,
      text: commentText,
      authorId: adminUser.id,
      authorName: adminUser.displayName,
      authorRole: adminUser.role,
      isAdminComment: true, // Flag to distinguish admin comments
      companyId: postData.companyId,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "comments"), commentData);

    // Increment comment count
    await updateDoc(postRef, {
      comments: increment(1),
      updatedAt: serverTimestamp(),
      lastUpdatedBy: adminUser.displayName,
      lastUpdatedById: adminUser.id,
    });

    // Log activity
    await logPostActivity(postId, PostActivityType.ADMIN_COMMENT, {
      adminId: adminUser.id,
      adminName: adminUser.displayName,
      comment: commentText,
      companyId: postData.companyId,
    });

    // Notify post author
    await notifyAuthor(postId, postData, NotificationType.ADMIN_COMMENT, {
      adminName: adminUser.displayName,
      comment: commentText,
    });

    return { success: true };
  } catch (error) {
    console.error("Error adding admin comment:", error);
    throw error;
  }
};

// ============================================
// POST ACTIVITY TIMELINE
// ============================================

/**
 * Log post activity to timeline
 * @param {string} postId - Post ID
 * @param {string} activityType - Activity type from PostActivityType enum
 * @param {object} metadata - Additional activity metadata
 * @returns {Promise<void>}
 */
export const logPostActivity = async (postId, activityType, metadata = {}) => {
  try {
    // Get post to retrieve companyId for better audit querying
    let companyId = metadata.companyId;
    if (!companyId) {
      try {
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          companyId = postSnap.data().companyId;
        }
      } catch (err) {
        console.warn("Could not fetch companyId for activity log:", err);
      }
    }

    const activityData = {
      postId,
      type: activityType,
      companyId: companyId || null,
      metadata: {
        ...metadata,
      },
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "postActivities"), activityData);
    return { success: true };
  } catch (error) {
    console.error("Error logging post activity:", error);
    // Don't throw - activity logging should not break the main operation
    return { success: false };
  }
};

/**
 * Get post activity timeline
 * @param {string} postId - Post ID
 * @param {number} limitCount - Number of activities to fetch
 * @returns {Promise<Array>}
 */
export const getPostActivityTimeline = async (postId, companyId = null, limitCount = 50) => {
  try {
    const activitiesRef = collection(db, "postActivities");
    const constraints = [
      where("postId", "==", postId),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    ];
    if (companyId) {
      constraints.unshift(where("companyId", "==", companyId));
    }
    const q = query(activitiesRef, ...constraints);

    const snapshot = await getDocs(q);
    const activities = [];

    snapshot.forEach((doc) => {
      activities.push({ id: doc.id, ...doc.data() });
    });

    return activities;
  } catch (error) {
    console.error("Error fetching post activity timeline:", error);
    return [];
  }
};

// ============================================
// MY POSTS - UNREAD UPDATES TRACKING
// ============================================

/**
 * Mark post as viewed by author
 * @param {string} postId - Post ID
 * @param {string} authorId - Author user ID
 * @returns {Promise<void>}
 */
export const markPostAsViewed = async (postId, authorId, companyId) => {
  try {
    const viewRef = doc(db, "postViews", `${postId}_${authorId}`);

    await updateDoc(viewRef, {
      lastViewedAt: serverTimestamp(),
    }).catch(async () => {
      // Document doesn't exist, create it
      const postRef = doc(db, "posts", postId);
      const postSnap = await getDoc(postRef);

      if (postSnap.exists()) {
        const postCompanyId = companyId || postSnap.data().companyId;
        await setDoc(viewRef, {
          postId,
          authorId,
          companyId: postCompanyId,
          lastViewedAt: serverTimestamp(),
        });
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error marking post as viewed:", error);
    return { success: false };
  }
};

/**
 * Check if post has unread updates for author
 * @param {object} post - Post object
 * @param {string} authorId - Author user ID
 * @returns {Promise<boolean>}
 */
export const hasUnreadUpdates = async (post, authorId) => {
  try {
    const viewRef = collection(db, "postViews");
    const q = query(
      viewRef,
      where("postId", "==", post.id),
      where("authorId", "==", authorId),
      where("companyId", "==", post.companyId),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Never viewed, check if there are any updates
      return post.updatedAt && post.updatedAt > post.createdAt;
    }

    const viewData = snapshot.docs[0].data();
    const lastViewedAt = viewData.lastViewedAt?.toDate();
    const updatedAt = post.updatedAt?.toDate();

    if (!lastViewedAt || !updatedAt) {
      return false;
    }

    return updatedAt > lastViewedAt;
  } catch (error) {
    console.error("Error checking unread updates:", error);
    return false;
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if user is admin (company admin, HR, or super admin)
 * @param {string} role - User role
 * @returns {boolean}
 */
export const isAdmin = (role) => {
  return [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR].includes(role);
};

/**
 * Create notification for user
 * @param {object} notificationData - Notification data
 * @returns {Promise<void>}
 */
const createNotification = async (notificationData) => {
  try {
    await addDoc(collection(db, "notifications"), {
      ...notificationData,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

/**
 * Notify post author about updates (respects anonymous privacy)
 * @param {object} postData - Post data
 * @param {string} notificationType - Type of notification
 * @param {object} metadata - Additional notification data
 * @returns {Promise<void>}
 */
const notifyAuthor = async (postId, postData, notificationType, metadata) => {
  try {
    // For anonymous posts, don't create direct notifications
    // Author will see updates only in "My Posts" dashboard
    if (postData.isAnonymous) {
      return;
    }

    // For named posts, create notification
    const authorId = postData.authorId;

    if (!authorId) {
      return;
    }

    let title = "";
    let message = "";

    switch (notificationType) {
      case NotificationType.STATUS_CHANGED:
        title = "Post status updated";
        message = `Your post status changed to: ${metadata.status}`;
        break;
      case NotificationType.PRIORITY_CHANGED:
        title = "Post priority updated";
        message = `Your post priority changed to: ${metadata.priority}`;
        break;
      case NotificationType.ADMIN_COMMENT:
        title = "Admin commented on your post";
        message = `${metadata.adminName}: ${metadata.comment}`;
        break;
      default:
        title = "Post updated";
        message = "Your post has been updated";
    }

    await createNotification({
      userId: authorId,
      type: notificationType,
      title,
      message,
      postId,
      companyId: postData.companyId,
    });
  } catch (error) {
    console.error("Error notifying author:", error);
  }
};

/**
 * Get user's own posts (both anonymous and named)
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @param {string} postType - Optional post type filter
 * @returns {Promise<Array>}
 */
export const getUserPosts = async (userId, companyId, postType = null) => {
  try {
    const postsRef = collection(db, "posts");
    const buildConstraints = (authorId) => {
      const cs = [where("authorId", "==", authorId), where("companyId", "==", companyId)];
      if (postType) cs.push(where("type", "==", postType));
      cs.push(orderBy("createdAt", "desc"), limit(100));
      return cs;
    };

    // Fetch by plain authorId (non-anonymous posts)
    const snapshot = await getDocs(query(postsRef, ...buildConstraints(userId)));
    // Also fetch by creatorId to catch anonymous posts (which have encrypted authorId).
    // No orderBy here to avoid requiring a composite index — results are sorted client-side below.
    let creatorDocs = [];
    try {
      const creatorSnap = await getDocs(
        query(postsRef, where("creatorId", "==", userId), where("companyId", "==", companyId), limit(100))
      );
      creatorDocs = creatorSnap.docs;
    } catch {
      // creatorId index not yet available — fall back to authorId results only
    }

    // Merge, deduplicating by post ID
    const seenIds = new Set();
    const allDocs = [...snapshot.docs, ...creatorDocs].filter(d => {
      if (seenIds.has(d.id)) return false;
      seenIds.add(d.id);
      return true;
    });

    const posts = [];
    for (const docSnap of allDocs) {
      const postData = { id: docSnap.id, ...docSnap.data() };
      postData.hasUnreadUpdates = await hasUnreadUpdates(postData, userId);
      posts.push(postData);
    }

    // Sort by createdAt desc
    posts.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    return posts;
  } catch (error) {
    console.error("Error fetching user posts:", error);
    return [];
  }
};

// ============================================
// DEPARTMENT MANAGEMENT
// ============================================

/**
 * Get departments for a company
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>}
 */
export const getCompanyDepartments = async (companyId) => {
  try {
    const deptRef = collection(db, "departments");
    const q = query(deptRef, where("companyId", "==", companyId), orderBy("name", "asc"));

    const snapshot = await getDocs(q);
    const departments = [];

    snapshot.forEach((doc) => {
      departments.push({ id: doc.id, ...doc.data() });
    });

    return departments;
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
};

/**
 * Create default departments for a company
 * @param {string} companyId - Company ID
 * @param {Array} departments - Array of department objects
 * @returns {Promise<void>}
 */
export const createDefaultDepartments = async (companyId, departments) => {
  try {
    const batch = [];

    for (const dept of departments) {
      const deptData = {
        companyId,
        name: dept.name,
        icon: dept.icon || "📁",
        isActive: true,
        createdAt: serverTimestamp(),
      };

      batch.push(addDoc(collection(db, "departments"), deptData));
    }

    await Promise.all(batch);
    return { success: true };
  } catch (error) {
    console.error("Error creating default departments:", error);
    throw error;
  }
};

// ============================================
// PRIVACY FILTERING
// ============================================

/**
 * Get posts with privacy filtering based on user role and department
 * @param {string} companyId - Company ID
 * @param {string} feedType - Type of feed (problem_report, idea_suggestion, etc.)
 * @param {object} user - Current user object with role, departmentId
 * @returns {Promise<Array>} Filtered posts array
 */
export const getPostsWithPrivacyFilter = async (companyId, feedType, user) => {
  try {
    if (!companyId || !user) {
      return [];
    }

    // Fetch all posts for the company and feed type.
    // Firestore rules enforce company-level isolation; privacy filtering
    // (department_only, hr_only) is applied client-side below.
    const postsRef = collection(db, "posts");
    const q = query(
      postsRef,
      where("companyId", "==", companyId),
      where("type", "==", feedType),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    const allPosts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    }));

    // Apply privacy filtering based on user role
    const userId = user.id || user.uid;
    const filteredPosts = allPosts.filter((post) => {
      if (post.isArchived) return false;
      if (post.isDraft) return false;

      // Super admin and company admin can see all posts
      if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.COMPANY_ADMIN) {
        return true;
      }

      // Authors can always see their own posts
      if (userId && post.authorId === userId) return true;

      // Users can see posts assigned to them
      if (userId && post.assignedTo?.id === userId) return true;

      const privacyLevel = post.privacyLevel || "company_public";

      if (privacyLevel === "company_public") return true;

      // HR-only posts
      if (privacyLevel === "hr_only") {
        return user.role === UserRole.HR;
      }

      // Department-only posts
      if (privacyLevel === "department_only") {
        if (user.role === UserRole.HR) return true;
        if (user.departmentId && post.departmentId) {
          return user.departmentId === post.departmentId;
        }
        return false;
      }

      return true;
    });

    return filteredPosts;
  } catch (error) {
    console.error("Error getting posts with privacy filter:", error);
    return [];
  }
};

// ============================================
// DELETE POST WITH CASCADE CLEANUP
// ============================================

/**
 * Delete a post with proper cascade cleanup
 * Removes: post document, comments, likes, edit history, activities, views, and reactions
 * @param {string} postId - Post ID to delete
 * @param {object} user - User performing the deletion
 * @returns {Promise<{success: boolean}>}
 */
export const deletePost = async (postId, user) => {
  try {
    if (!postId || !user) {
      throw new Error("Post ID and user are required");
    }

    // Get post document to verify ownership/permissions
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    const postData = postSnap.data();

    // Check authorization: author or admin
    const isAuthor = postData.authorId === user.id || postData.authorId === user.uid;
    const isAdmin = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR].includes(user.role);

    if (!isAuthor && !isAdmin) {
      throw new Error("Unauthorized: You can only delete your own posts");
    }

    // Check company isolation (non-super admins only)
    if (user.role !== UserRole.SUPER_ADMIN && postData.companyId !== user.companyId) {
      throw new Error("Unauthorized: Post belongs to a different company");
    }

    // SOFT DELETE: Move post to deletedPosts collection instead of deleting
    const deletedPostRef = doc(db, "deletedPosts", postId);

    // Create deleted post document with metadata
    const deletedPostData = {
      ...postData,
      originalPostId: postId,
      deletedBy: {
        id: user.id || user.uid,
        name: user.displayName || user.username,
        role: user.role,
      },
      deletedAt: serverTimestamp(),
    };

    // 1. Create deletedPosts parent document FIRST so subcollection rules can
    //    reference it via get() for company isolation checks
    await setDoc(deletedPostRef, deletedPostData);

    // Use batch for subcollection deletions from original post
    const deleteBatch = writeBatch(db);

    // 2. Copy all comments to deletedPosts subcollection
    const commentsQuery = query(collection(db, `posts/${postId}/comments`));
    const commentsSnap = await getDocs(commentsQuery);
    const commentsCopyBatch = writeBatch(db);
    commentsSnap.forEach((commentDoc) => {
      const commentData = commentDoc.data();
      const deletedCommentRef = doc(db, `deletedPosts/${postId}/comments`, commentDoc.id);
      commentsCopyBatch.set(deletedCommentRef, { ...commentData, companyId: postData.companyId });
      deleteBatch.delete(doc(db, `posts/${postId}/comments`, commentDoc.id));
    });
    await commentsCopyBatch.commit();

    // 3. Copy all likes and delete originals
    const likesQuery = query(collection(db, `posts/${postId}/likes`));
    const likesSnap = await getDocs(likesQuery);
    const likesCopyBatch = writeBatch(db);
    likesSnap.forEach((likeDoc) => {
      const likeData = likeDoc.data();
      const deletedLikeRef = doc(db, `deletedPosts/${postId}/likes`, likeDoc.id);
      likesCopyBatch.set(deletedLikeRef, { ...likeData, companyId: postData.companyId });
      deleteBatch.delete(doc(db, `posts/${postId}/likes`, likeDoc.id));
    });
    await likesCopyBatch.commit();

    // 4. Copy all reactions and delete originals
    const reactionsQuery = query(collection(db, `posts/${postId}/reactions`));
    const reactionsSnap = await getDocs(reactionsQuery);
    const reactionsCopyBatch = writeBatch(db);
    reactionsSnap.forEach((reactionDoc) => {
      const reactionData = reactionDoc.data();
      const deletedReactionRef = doc(db, `deletedPosts/${postId}/reactions`, reactionDoc.id);
      reactionsCopyBatch.set(deletedReactionRef, { ...reactionData, companyId: postData.companyId });
      deleteBatch.delete(doc(db, `posts/${postId}/reactions`, reactionDoc.id));
    });
    await reactionsCopyBatch.commit();

    // Commit subcollection deletions from original post
    await deleteBatch.commit();

    // 5. Move edit history
    const editHistoryQuery = query(
      collection(db, "postEditHistory"),
      where("postId", "==", postId),
      where("companyId", "==", postData.companyId)
    );
    const editHistorySnap = await getDocs(editHistoryQuery);
    if (!editHistorySnap.empty) {
      const historyMoveBatch = writeBatch(db);
      const historyBatch = writeBatch(db);
      editHistorySnap.forEach((historyDoc) => {
        const historyData = historyDoc.data();
        const deletedHistoryRef = doc(db, "deletedPostEditHistory", historyDoc.id);
        historyMoveBatch.set(deletedHistoryRef, historyData);
        historyBatch.delete(doc(db, "postEditHistory", historyDoc.id));
      });
      await historyMoveBatch.commit();
      await historyBatch.commit();
    }

    // 6. Move post activities
    const activitiesQuery = query(
      collection(db, "postActivities"),
      where("postId", "==", postId),
      where("companyId", "==", postData.companyId)
    );
    const activitiesSnap = await getDocs(activitiesQuery);
    if (!activitiesSnap.empty) {
      const activitiesMoveBatch = writeBatch(db);
      const activitiesBatch = writeBatch(db);
      activitiesSnap.forEach((activityDoc) => {
        const activityData = activityDoc.data();
        const deletedActivityRef = doc(db, "deletedPostActivities", activityDoc.id);
        activitiesMoveBatch.set(deletedActivityRef, activityData);
        activitiesBatch.delete(doc(db, "postActivities", activityDoc.id));
      });
      await activitiesMoveBatch.commit();
      await activitiesBatch.commit();
    }

    // 7. Move post views
    const viewsQuery = query(
      collection(db, "postViews"),
      where("postId", "==", postId),
      where("companyId", "==", postData.companyId)
    );
    const viewsSnap = await getDocs(viewsQuery);
    if (!viewsSnap.empty) {
      const viewsMoveBatch = writeBatch(db);
      const viewsBatch = writeBatch(db);
      viewsSnap.forEach((viewDoc) => {
        const viewData = viewDoc.data();
        const deletedViewRef = doc(db, "deletedPostViews", viewDoc.id);
        viewsMoveBatch.set(deletedViewRef, viewData);
        viewsBatch.delete(doc(db, "postViews", viewDoc.id));
      });
      await viewsMoveBatch.commit();
      await viewsBatch.commit();
    }

    // 8. Finally, delete the original post document
    await deleteDoc(postRef);

    return {
      success: true,
      message: "Post and all related data deleted successfully"
    };
  } catch (error) {
    console.error("Error deleting post:", error);
    throw error;
  }
};
