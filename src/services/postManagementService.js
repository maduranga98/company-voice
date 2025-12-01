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
    // Verify admin permission
    if (!isAdmin(adminUser.role)) {
      throw new Error("Only admins can update post status");
    }

    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    const oldStatus = postSnap.data().status;

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
    await notifyAuthor(postSnap.data(), NotificationType.STATUS_CHANGED, {
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
      await notifyAuthor(postSnap.data(), NotificationType.PRIORITY_CHANGED, {
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

    // Validate assignment based on post anonymity
    if (postData.isAnonymous && assignment.type === AssignmentType.USER) {
      throw new Error("Anonymous posts can only be assigned to departments");
    }

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
    if (!isAdmin(adminUser.role)) {
      throw new Error("Only admins can add admin comments");
    }

    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    // Add comment to comments collection
    const commentData = {
      postId,
      text: commentText,
      authorId: adminUser.id,
      authorName: adminUser.displayName,
      authorRole: adminUser.role,
      isAdminComment: true, // Flag to distinguish admin comments
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
    });

    // Notify post author
    const postData = postSnap.data();
    await notifyAuthor(postData, NotificationType.ADMIN_COMMENT, {
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
      metadata: {
        ...metadata,
        companyId, // Add companyId for easier filtering
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
export const getPostActivityTimeline = async (postId, limitCount = 50) => {
  try {
    const activitiesRef = collection(db, "postActivities");
    const q = query(
      activitiesRef,
      where("postId", "==", postId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

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
export const markPostAsViewed = async (postId, authorId) => {
  try {
    const viewRef = doc(db, "postViews", `${postId}_${authorId}`);

    await updateDoc(viewRef, {
      lastViewedAt: serverTimestamp(),
    }).catch(async () => {
      // Document doesn't exist, create it
      const postRef = doc(db, "posts", postId);
      const postSnap = await getDoc(postRef);

      if (postSnap.exists()) {
        await addDoc(collection(db, "postViews"), {
          postId,
          authorId,
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
const notifyAuthor = async (postData, notificationType, metadata) => {
  try {
    // For anonymous posts, don't create direct notifications
    // Author will see updates only in "My Posts" dashboard
    if (postData.isAnonymous) {
      return;
    }

    // For named posts, create notification
    const authorId = postData.isAnonymous
      ? decryptAuthorId(postData.authorId)
      : postData.authorId;

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
      postId: postData.id || postData.postId,
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
    let q;

    if (postType) {
      q = query(
        postsRef,
        where("authorId", "==", userId),
        where("companyId", "==", companyId),
        where("type", "==", postType),
        orderBy("createdAt", "desc"),
        limit(100)
      );
    } else {
      q = query(
        postsRef,
        where("authorId", "==", userId),
        where("companyId", "==", companyId),
        orderBy("createdAt", "desc"),
        limit(100)
      );
    }

    const snapshot = await getDocs(q);
    const posts = [];

    for (const docSnap of snapshot.docs) {
      const postData = { id: docSnap.id, ...docSnap.data() };

      // Check for unread updates
      postData.hasUnreadUpdates = await hasUnreadUpdates(postData, userId);

      posts.push(postData);
    }

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

    // Fetch all posts for the company and feed type
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

    // Filter posts based on user role and privacy level
    const filteredPosts = allPosts.filter((post) => {
      // Skip archived posts
      if (post.isArchived) {
        return false;
      }

      // Super admin and company admin can see all posts
      if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.COMPANY_ADMIN) {
        return true;
      }

      const privacyLevel = post.privacyLevel || "company_public";

      // Public posts - everyone can see
      if (privacyLevel === "company_public") {
        return true;
      }

      // HR-only posts - only HR, company_admin, and super_admin can see
      if (privacyLevel === "hr_only") {
        return user.role === UserRole.HR || user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.SUPER_ADMIN;
      }

      // Department-only posts - only users in the same department can see
      if (privacyLevel === "department_only") {
        // HR can see all department posts
        if (user.role === UserRole.HR) {
          return true;
        }

        // Check if user is in the same department
        if (user.departmentId && post.departmentId) {
          return user.departmentId === post.departmentId;
        }

        // If post has no department or user has no department, hide it
        return false;
      }

      // Default: show the post
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

    // Log deletion activity before deleting
    await logPostActivity(postId, PostActivityType.POST_DELETED, {
      deletedBy: {
        id: user.id || user.uid,
        name: user.displayName || user.username,
        role: user.role,
      },
      postTitle: postData.title || "Untitled",
      postType: postData.type,
      deletedAt: new Date().toISOString(),
    });

    // Use batch for atomic deletion of related documents
    const batch = writeBatch(db);

    // 1. Delete all comments
    const commentsQuery = query(collection(db, `posts/${postId}/comments`));
    const commentsSnap = await getDocs(commentsQuery);
    commentsSnap.forEach((commentDoc) => {
      batch.delete(doc(db, `posts/${postId}/comments`, commentDoc.id));
    });

    // 2. Delete all likes
    const likesQuery = query(collection(db, `posts/${postId}/likes`));
    const likesSnap = await getDocs(likesQuery);
    likesSnap.forEach((likeDoc) => {
      batch.delete(doc(db, `posts/${postId}/likes`, likeDoc.id));
    });

    // 3. Delete all reactions (if separate collection)
    const reactionsQuery = query(collection(db, `posts/${postId}/reactions`));
    const reactionsSnap = await getDocs(reactionsQuery);
    reactionsSnap.forEach((reactionDoc) => {
      batch.delete(doc(db, `posts/${postId}/reactions`, reactionDoc.id));
    });

    // Commit the batch for subcollections
    await batch.commit();

    // 4. Delete edit history (separate collection)
    const editHistoryQuery = query(
      collection(db, "postEditHistory"),
      where("postId", "==", postId)
    );
    const editHistorySnap = await getDocs(editHistoryQuery);
    const historyBatch = writeBatch(db);
    editHistorySnap.forEach((historyDoc) => {
      historyBatch.delete(doc(db, "postEditHistory", historyDoc.id));
    });
    await historyBatch.commit();

    // 5. Delete post activities (separate collection) - keep last one we just created for audit
    const activitiesQuery = query(
      collection(db, "postActivities"),
      where("postId", "==", postId)
    );
    const activitiesSnap = await getDocs(activitiesQuery);
    const activitiesBatch = writeBatch(db);
    // Skip the last activity (deletion log) for audit trail
    const activityDocs = activitiesSnap.docs.slice(0, -1);
    activityDocs.forEach((activityDoc) => {
      activitiesBatch.delete(doc(db, "postActivities", activityDoc.id));
    });
    await activitiesBatch.commit();

    // 6. Delete post views (separate collection)
    const viewsQuery = query(
      collection(db, "postViews"),
      where("postId", "==", postId)
    );
    const viewsSnap = await getDocs(viewsQuery);
    const viewsBatch = writeBatch(db);
    viewsSnap.forEach((viewDoc) => {
      viewsBatch.delete(doc(db, "postViews", viewDoc.id));
    });
    await viewsBatch.commit();

    // 7. Finally, delete the post document itself
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
