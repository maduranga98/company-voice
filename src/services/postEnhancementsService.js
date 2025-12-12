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
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { PostStatus, PostActivityType, UserRole } from "../utils/constants";
import { logPostActivity } from "./postManagementService";

// ============================================
// DRAFT POSTS
// ============================================

/**
 * Save post as draft
 * @param {object} postData - Post data
 * @returns {Promise<string>} - Draft post ID
 */
export const saveDraft = async (postData) => {
  try {
    const draftData = {
      ...postData,
      isDraft: true,
      isScheduled: false,
      status: "draft",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "posts"), draftData);

    return { success: true, draftId: docRef.id };
  } catch (error) {
    console.error("Error saving draft:", error);
    throw error;
  }
};

/**
 * Update existing draft
 * @param {string} draftId - Draft ID
 * @param {object} updateData - Updated data
 * @returns {Promise<void>}
 */
export const updateDraft = async (draftId, updateData) => {
  try {
    const draftRef = doc(db, "posts", draftId);

    await updateDoc(draftRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating draft:", error);
    throw error;
  }
};

/**
 * Publish draft post
 * @param {string} draftId - Draft ID
 * @param {object} adminUser - User publishing the draft
 * @returns {Promise<void>}
 */
export const publishDraft = async (draftId, adminUser) => {
  try {
    const draftRef = doc(db, "posts", draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) {
      throw new Error("Draft not found");
    }

    await updateDoc(draftRef, {
      isDraft: false,
      status: "open",
      publishedAt: serverTimestamp(),
      publishedBy: adminUser.displayName,
      publishedById: adminUser.id,
      updatedAt: serverTimestamp(),
    });

    await logPostActivity(draftId, PostActivityType.CREATED, {
      adminId: adminUser.id,
      adminName: adminUser.displayName,
      companyId: draftSnap.data().companyId,
    });

    return { success: true };
  } catch (error) {
    console.error("Error publishing draft:", error);
    throw error;
  }
};

/**
 * Get user's draft posts
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>}
 */
export const getUserDrafts = async (userId, companyId) => {
  try {
    const postsRef = collection(db, "posts");
    const q = query(
      postsRef,
      where("authorId", "==", userId),
      where("companyId", "==", companyId),
      where("isDraft", "==", true),
      orderBy("updatedAt", "desc"),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const drafts = [];

    snapshot.forEach((doc) => {
      drafts.push({ id: doc.id, ...doc.data() });
    });

    return drafts;
  } catch (error) {
    console.error("Error fetching drafts:", error);
    return [];
  }
};

/**
 * Delete draft
 * @param {string} draftId - Draft ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<void>}
 */
export const deleteDraft = async (draftId, userId) => {
  try {
    const draftRef = doc(db, "posts", draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) {
      throw new Error("Draft not found");
    }

    if (draftSnap.data().authorId !== userId) {
      throw new Error("Unauthorized to delete this draft");
    }

    await deleteDoc(draftRef);

    return { success: true };
  } catch (error) {
    console.error("Error deleting draft:", error);
    throw error;
  }
};

// ============================================
// EDIT HISTORY TRACKING
// ============================================

/**
 * Save post edit to history
 * @param {string} postId - Post ID
 * @param {object} oldData - Previous post data
 * @param {object} newData - New post data
 * @param {object} editor - User who made the edit
 * @returns {Promise<void>}
 */
export const saveEditHistory = async (postId, oldData, newData, editor) => {
  try {
    const changes = {};

    // Track which fields changed
    if (oldData.title !== newData.title) {
      changes.title = { old: oldData.title, new: newData.title };
    }
    if (oldData.content !== newData.content) {
      changes.content = { old: oldData.content, new: newData.content };
    }
    if (oldData.category !== newData.category) {
      changes.category = { old: oldData.category, new: newData.category };
    }
    if (JSON.stringify(oldData.tags) !== JSON.stringify(newData.tags)) {
      changes.tags = { old: oldData.tags, new: newData.tags };
    }

    const historyData = {
      postId,
      editorId: editor.id,
      editorName: editor.displayName,
      changes,
      editedAt: serverTimestamp(),
      companyId: oldData.companyId,
    };

    await addDoc(collection(db, "postEditHistory"), historyData);

    // Update post with edit timestamp and editor
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
      lastEditedAt: serverTimestamp(),
      lastEditedBy: editor.displayName,
      lastEditedById: editor.id,
      editCount: (oldData.editCount || 0) + 1,
    });

    return { success: true };
  } catch (error) {
    console.error("Error saving edit history:", error);
    throw error;
  }
};

/**
 * Get post edit history
 * @param {string} postId - Post ID
 * @returns {Promise<Array>}
 */
export const getPostEditHistory = async (postId) => {
  try {
    const historyRef = collection(db, "postEditHistory");
    const q = query(
      historyRef,
      where("postId", "==", postId),
      orderBy("editedAt", "desc"),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const history = [];

    snapshot.forEach((doc) => {
      history.push({ id: doc.id, ...doc.data() });
    });

    return history;
  } catch (error) {
    console.error("Error fetching edit history:", error);
    return [];
  }
};

/**
 * Edit post
 * @param {string} postId - Post ID
 * @param {object} updateData - Updated fields
 * @param {object} editor - User making the edit
 * @returns {Promise<void>}
 */
export const editPost = async (postId, updateData, editor) => {
  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    const oldData = postSnap.data();

    // Verify editor is the author (or admin/HR/super admin)
    const isAuthor = oldData.authorId === editor.id || oldData.authorId === editor.uid;
    const isAdmin = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR].includes(editor.role);

    if (!isAuthor && !isAdmin) {
      throw new Error("Unauthorized to edit this post");
    }

    // Save edit history
    await saveEditHistory(postId, oldData, updateData, editor);

    // Update post
    await updateDoc(postRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error editing post:", error);
    throw error;
  }
};

// ============================================
// POST SCHEDULING
// ============================================

/**
 * Schedule post for future publishing
 * @param {object} postData - Post data
 * @param {Date} scheduledDate - When to publish
 * @returns {Promise<string>} - Scheduled post ID
 */
export const schedulePost = async (postData, scheduledDate) => {
  try {
    const scheduledData = {
      ...postData,
      isDraft: false,
      isScheduled: true,
      scheduledPublishDate: scheduledDate,
      status: "scheduled",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "posts"), scheduledData);

    return { success: true, postId: docRef.id };
  } catch (error) {
    console.error("Error scheduling post:", error);
    throw error;
  }
};

/**
 * Get scheduled posts
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>}
 */
export const getScheduledPosts = async (companyId) => {
  try {
    const postsRef = collection(db, "posts");
    const q = query(
      postsRef,
      where("companyId", "==", companyId),
      where("isScheduled", "==", true),
      orderBy("scheduledPublishDate", "asc"),
      limit(100)
    );

    const snapshot = await getDocs(q);
    const scheduled = [];

    snapshot.forEach((doc) => {
      scheduled.push({ id: doc.id, ...doc.data() });
    });

    return scheduled;
  } catch (error) {
    console.error("Error fetching scheduled posts:", error);
    return [];
  }
};

/**
 * Publish scheduled post (called by cron/cloud function)
 * @param {string} postId - Post ID
 * @returns {Promise<void>}
 *
 * Note: This function preserves all existing post data including:
 * - privacyLevel: Privacy settings (company_public, department_only, hr_only)
 * - departmentId: Department restriction if privacy is department_only
 * - All other post metadata
 */
export const publishScheduledPost = async (postId) => {
  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    const postData = postSnap.data();

    // Validate that department-only posts have a departmentId
    if (postData.privacyLevel === "department_only" && !postData.departmentId) {
      console.error("Scheduled post has department_only privacy but no departmentId", postId);
      throw new Error("Cannot publish department-only post without departmentId");
    }

    // Only update scheduling-related fields, preserving all other data
    await updateDoc(postRef, {
      isScheduled: false,
      status: "open",
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Note: privacyLevel, departmentId, and all other fields are preserved
    });

    await logPostActivity(postId, PostActivityType.CREATED, {
      companyId: postData.companyId,
      scheduledPublish: true,
      privacyLevel: postData.privacyLevel,
      departmentId: postData.departmentId || null,
    });

    return { success: true };
  } catch (error) {
    console.error("Error publishing scheduled post:", error);
    throw error;
  }
};

/**
 * Cancel scheduled post
 * @param {string} postId - Post ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const cancelScheduledPost = async (postId, userId) => {
  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    if (postSnap.data().authorId !== userId) {
      throw new Error("Unauthorized to cancel this scheduled post");
    }

    await updateDoc(postRef, {
      isScheduled: false,
      scheduledPublishDate: null,
      status: "draft",
      isDraft: true,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error canceling scheduled post:", error);
    throw error;
  }
};

// ============================================
// PIN / ARCHIVE POSTS
// ============================================

/**
 * Pin post (admin only)
 * @param {string} postId - Post ID
 * @param {object} adminUser - Admin user
 * @returns {Promise<void>}
 */
export const pinPost = async (postId, adminUser) => {
  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    await updateDoc(postRef, {
      isPinned: true,
      pinnedAt: serverTimestamp(),
      pinnedBy: adminUser.displayName,
      pinnedById: adminUser.id,
      updatedAt: serverTimestamp(),
    });

    await logPostActivity(postId, "pinned", {
      adminId: adminUser.id,
      adminName: adminUser.displayName,
      companyId: postSnap.data().companyId,
    });

    return { success: true };
  } catch (error) {
    console.error("Error pinning post:", error);
    throw error;
  }
};

/**
 * Unpin post (admin only)
 * @param {string} postId - Post ID
 * @param {object} adminUser - Admin user
 * @returns {Promise<void>}
 */
export const unpinPost = async (postId, adminUser) => {
  try {
    const postRef = doc(db, "posts", postId);

    await updateDoc(postRef, {
      isPinned: false,
      pinnedAt: null,
      pinnedBy: null,
      pinnedById: null,
      updatedAt: serverTimestamp(),
    });

    await logPostActivity(postId, "unpinned", {
      adminId: adminUser.id,
      adminName: adminUser.displayName,
    });

    return { success: true };
  } catch (error) {
    console.error("Error unpinning post:", error);
    throw error;
  }
};

/**
 * Archive post
 * @param {string} postId - Post ID
 * @param {object} user - User archiving
 * @returns {Promise<void>}
 */
export const archivePost = async (postId, user) => {
  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error("Post not found");
    }

    await updateDoc(postRef, {
      isArchived: true,
      archivedAt: serverTimestamp(),
      archivedBy: user.displayName,
      archivedById: user.id,
      updatedAt: serverTimestamp(),
    });

    await logPostActivity(postId, "archived", {
      userId: user.id,
      userName: user.displayName,
      companyId: postSnap.data().companyId,
    });

    return { success: true };
  } catch (error) {
    console.error("Error archiving post:", error);
    throw error;
  }
};

/**
 * Unarchive post
 * @param {string} postId - Post ID
 * @param {object} user - User unarchiving
 * @returns {Promise<void>}
 */
export const unarchivePost = async (postId, user) => {
  try {
    const postRef = doc(db, "posts", postId);

    await updateDoc(postRef, {
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      archivedById: null,
      updatedAt: serverTimestamp(),
    });

    await logPostActivity(postId, "unarchived", {
      userId: user.id,
      userName: user.displayName,
    });

    return { success: true };
  } catch (error) {
    console.error("Error unarchiving post:", error);
    throw error;
  }
};

/**
 * Get archived posts
 * @param {string} companyId - Company ID
 * @param {number} limitCount - Number of posts to fetch
 * @returns {Promise<Array>}
 */
export const getArchivedPosts = async (companyId, limitCount = 50) => {
  try {
    const postsRef = collection(db, "posts");
    const q = query(
      postsRef,
      where("companyId", "==", companyId),
      where("isArchived", "==", true),
      orderBy("archivedAt", "desc"),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const archived = [];

    snapshot.forEach((doc) => {
      archived.push({ id: doc.id, ...doc.data() });
    });

    return archived;
  } catch (error) {
    console.error("Error fetching archived posts:", error);
    return [];
  }
};

// ============================================
// BULK ACTIONS (ADMIN)
// ============================================

/**
 * Bulk update post status
 * @param {Array<string>} postIds - Array of post IDs
 * @param {string} newStatus - New status
 * @param {object} adminUser - Admin user
 * @returns {Promise<void>}
 */
export const bulkUpdateStatus = async (postIds, newStatus, adminUser) => {
  try {
    const batch = writeBatch(db);

    for (const postId of postIds) {
      const postRef = doc(db, "posts", postId);
      batch.update(postRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: adminUser.displayName,
        lastUpdatedById: adminUser.id,
      });

      // Log activity for each post
      await logPostActivity(postId, PostActivityType.STATUS_CHANGED, {
        adminId: adminUser.id,
        adminName: adminUser.displayName,
        newStatus,
        bulkAction: true,
      });
    }

    await batch.commit();

    return { success: true, count: postIds.length };
  } catch (error) {
    console.error("Error bulk updating status:", error);
    throw error;
  }
};

/**
 * Bulk archive posts
 * @param {Array<string>} postIds - Array of post IDs
 * @param {object} adminUser - Admin user
 * @returns {Promise<void>}
 */
export const bulkArchivePosts = async (postIds, adminUser) => {
  try {
    const batch = writeBatch(db);

    for (const postId of postIds) {
      const postRef = doc(db, "posts", postId);
      batch.update(postRef, {
        isArchived: true,
        archivedAt: serverTimestamp(),
        archivedBy: adminUser.displayName,
        archivedById: adminUser.id,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    return { success: true, count: postIds.length };
  } catch (error) {
    console.error("Error bulk archiving posts:", error);
    throw error;
  }
};

/**
 * Bulk assign posts
 * @param {Array<string>} postIds - Array of post IDs
 * @param {object} assignment - Assignment object
 * @param {object} adminUser - Admin user
 * @returns {Promise<void>}
 */
export const bulkAssignPosts = async (postIds, assignment, adminUser) => {
  try {
    const batch = writeBatch(db);

    for (const postId of postIds) {
      const postRef = doc(db, "posts", postId);
      batch.update(postRef, {
        assignedTo: {
          type: assignment.type,
          id: assignment.id,
          name: assignment.name,
          assignedAt: serverTimestamp(),
          assignedBy: adminUser.displayName,
          assignedById: adminUser.id,
        },
        updatedAt: serverTimestamp(),
        lastUpdatedBy: adminUser.displayName,
        lastUpdatedById: adminUser.id,
      });
    }

    await batch.commit();

    return { success: true, count: postIds.length };
  } catch (error) {
    console.error("Error bulk assigning posts:", error);
    throw error;
  }
};

/**
 * Bulk delete drafts
 * @param {Array<string>} draftIds - Array of draft IDs
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<void>}
 */
export const bulkDeleteDrafts = async (draftIds, userId) => {
  try {
    const batch = writeBatch(db);

    for (const draftId of draftIds) {
      const draftRef = doc(db, "posts", draftId);
      const draftSnap = await getDoc(draftRef);

      if (draftSnap.exists() && draftSnap.data().authorId === userId) {
        batch.delete(draftRef);
      }
    }

    await batch.commit();

    return { success: true, count: draftIds.length };
  } catch (error) {
    console.error("Error bulk deleting drafts:", error);
    throw error;
  }
};
