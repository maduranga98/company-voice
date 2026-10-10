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
 * Add an internal note to a post (staff only; stored as an admin comment)
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

    // Log activity
    await logPostActivity(postId, PostActivityType.ADMIN_COMMENT, {
      adminId: adminUser.id,
      adminName: adminUser.displayName,
      companyId: postData.companyId,
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
