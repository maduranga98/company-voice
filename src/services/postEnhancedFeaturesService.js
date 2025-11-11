import {
  doc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { logPostActivity } from "./auditService";
import { PostActivityType } from "../utils/constants";

// ============================================
// EDIT HISTORY TRACKING
// ============================================

/**
 * Save post edit to history
 * @param {string} postId - Post ID
 * @param {object} changes - Changes made to the post
 * @param {string} editedBy - User ID who made the edit
 * @param {string} editedByName - User name who made the edit
 * @returns {Promise<void>}
 */
export const saveEditHistory = async (postId, changes, editedBy, editedByName) => {
  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    const editHistoryEntry = {
      timestamp: serverTimestamp(),
      editedBy,
      editedByName,
      changes,
      previousValues: {},
    };

    // Store previous values for each changed field
    const postData = postSnap.data();
    Object.keys(changes).forEach((key) => {
      editHistoryEntry.previousValues[key] = postData[key];
    });

    // Update post with edit history
    await updateDoc(postRef, {
      editHistory: arrayUnion(editHistoryEntry),
      lastEditedAt: serverTimestamp(),
      lastEditedBy: editedBy,
      ...changes,
    });

    // Log activity
    await logPostActivity(
      postId,
      PostActivityType.EDITED,
      editedBy,
      editedByName,
      { changes: Object.keys(changes) }
    );

    return editHistoryEntry;
  } catch (error) {
    console.error("Error saving edit history:", error);
    throw new Error("Failed to save edit history");
  }
};

/**
 * Get post edit history
 * @param {string} postId - Post ID
 * @returns {Promise<Array>}
 */
export const getEditHistory = async (postId) => {
  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    return postSnap.data().editHistory || [];
  } catch (error) {
    console.error("Error getting edit history:", error);
    throw new Error("Failed to get edit history");
  }
};

// ============================================
// PIN POSTS
// ============================================

/**
 * Pin a post (admin only)
 * @param {string} postId - Post ID
 * @param {string} userId - User ID performing the action
 * @param {string} userName - User name performing the action
 * @param {string} companyId - Company ID
 * @returns {Promise<void>}
 */
export const pinPost = async (postId, userId, userName, companyId) => {
  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    await updateDoc(postRef, {
      isPinned: true,
      pinnedAt: serverTimestamp(),
      pinnedBy: userId,
      pinnedByName: userName,
      updatedAt: serverTimestamp(),
    });

    // Log activity
    await logPostActivity(
      postId,
      PostActivityType.PINNED,
      userId,
      userName,
      { companyId }
    );
  } catch (error) {
    console.error("Error pinning post:", error);
    throw new Error("Failed to pin post");
  }
};

/**
 * Unpin a post (admin only)
 * @param {string} postId - Post ID
 * @param {string} userId - User ID performing the action
 * @param {string} userName - User name performing the action
 * @returns {Promise<void>}
 */
export const unpinPost = async (postId, userId, userName) => {
  try {
    const postRef = doc(db, "posts", postId);

    await updateDoc(postRef, {
      isPinned: false,
      unpinnedAt: serverTimestamp(),
      unpinnedBy: userId,
      updatedAt: serverTimestamp(),
    });

    // Log activity
    await logPostActivity(
      postId,
      PostActivityType.UNPINNED,
      userId,
      userName
    );
  } catch (error) {
    console.error("Error unpinning post:", error);
    throw new Error("Failed to unpin post");
  }
};

/**
 * Get pinned posts for a company
 * @param {string} companyId - Company ID
 * @param {string} feedType - Feed type (optional)
 * @returns {Promise<Array>}
 */
export const getPinnedPosts = async (companyId, feedType = null) => {
  try {
    let q = query(
      collection(db, "posts"),
      where("companyId", "==", companyId),
      where("isPinned", "==", true),
      orderBy("pinnedAt", "desc")
    );

    if (feedType) {
      q = query(q, where("type", "==", feedType));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting pinned posts:", error);
    return [];
  }
};

// ============================================
// ARCHIVE POSTS
// ============================================

/**
 * Archive a post
 * @param {string} postId - Post ID
 * @param {string} userId - User ID performing the action
 * @param {string} userName - User name performing the action
 * @param {string} reason - Reason for archiving (optional)
 * @returns {Promise<void>}
 */
export const archivePost = async (postId, userId, userName, reason = "") => {
  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    await updateDoc(postRef, {
      isArchived: true,
      archivedAt: serverTimestamp(),
      archivedBy: userId,
      archivedByName: userName,
      archiveReason: reason,
      updatedAt: serverTimestamp(),
    });

    // Log activity
    await logPostActivity(
      postId,
      PostActivityType.ARCHIVED,
      userId,
      userName,
      { reason }
    );
  } catch (error) {
    console.error("Error archiving post:", error);
    throw new Error("Failed to archive post");
  }
};

/**
 * Unarchive a post
 * @param {string} postId - Post ID
 * @param {string} userId - User ID performing the action
 * @param {string} userName - User name performing the action
 * @returns {Promise<void>}
 */
export const unarchivePost = async (postId, userId, userName) => {
  try {
    const postRef = doc(db, "posts", postId);

    await updateDoc(postRef, {
      isArchived: false,
      unarchivedAt: serverTimestamp(),
      unarchivedBy: userId,
      updatedAt: serverTimestamp(),
    });

    // Log activity
    await logPostActivity(
      postId,
      PostActivityType.UNARCHIVED,
      userId,
      userName
    );
  } catch (error) {
    console.error("Error unarchiving post:", error);
    throw new Error("Failed to unarchive post");
  }
};

/**
 * Get archived posts for a company
 * @param {string} companyId - Company ID
 * @param {number} limit - Maximum number of posts to return
 * @returns {Promise<Array>}
 */
export const getArchivedPosts = async (companyId, limit = 50) => {
  try {
    const q = query(
      collection(db, "posts"),
      where("companyId", "==", companyId),
      where("isArchived", "==", true),
      orderBy("archivedAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting archived posts:", error);
    return [];
  }
};

/**
 * Auto-archive old resolved posts (run periodically)
 * @param {string} companyId - Company ID
 * @param {number} daysOld - Number of days after which to archive (default: 90)
 * @returns {Promise<number>} - Number of posts archived
 */
export const autoArchiveOldPosts = async (companyId, daysOld = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const q = query(
      collection(db, "posts"),
      where("companyId", "==", companyId),
      where("status", "in", ["resolved", "closed"]),
      where("isArchived", "==", false),
      where("updatedAt", "<", cutoffDate)
    );

    const snapshot = await getDocs(q);
    let archivedCount = 0;

    for (const docSnap of snapshot.docs) {
      await archivePost(
        docSnap.id,
        "system",
        "System",
        `Auto-archived after ${daysOld} days of inactivity`
      );
      archivedCount++;
    }

    return archivedCount;
  } catch (error) {
    console.error("Error auto-archiving posts:", error);
    return 0;
  }
};

// ============================================
// BULK POST OPERATIONS
// ============================================

/**
 * Bulk archive posts
 * @param {Array<string>} postIds - Array of post IDs
 * @param {string} userId - User ID performing the action
 * @param {string} userName - User name performing the action
 * @param {string} reason - Reason for archiving
 * @returns {Promise<{success: number, failed: number}>}
 */
export const bulkArchivePosts = async (postIds, userId, userName, reason = "") => {
  let success = 0;
  let failed = 0;

  for (const postId of postIds) {
    try {
      await archivePost(postId, userId, userName, reason);
      success++;
    } catch (error) {
      console.error(`Failed to archive post ${postId}:`, error);
      failed++;
    }
  }

  return { success, failed };
};

/**
 * Bulk pin posts
 * @param {Array<string>} postIds - Array of post IDs
 * @param {string} userId - User ID performing the action
 * @param {string} userName - User name performing the action
 * @param {string} companyId - Company ID
 * @returns {Promise<{success: number, failed: number}>}
 */
export const bulkPinPosts = async (postIds, userId, userName, companyId) => {
  let success = 0;
  let failed = 0;

  for (const postId of postIds) {
    try {
      await pinPost(postId, userId, userName, companyId);
      success++;
    } catch (error) {
      console.error(`Failed to pin post ${postId}:`, error);
      failed++;
    }
  }

  return { success, failed };
};
