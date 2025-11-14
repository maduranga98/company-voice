import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Comment Threading Service
 * Handles nested comment replies and threading
 */

/**
 * Add a reply to a comment
 * @param {string} postId - The post ID
 * @param {string} parentCommentId - The parent comment ID
 * @param {Object} replyData - Reply data (text, authorId, authorName, isAnonymous)
 * @param {string} companyId - The company ID
 * @returns {Promise<string>} The new reply ID
 */
export async function addCommentReply(postId, parentCommentId, replyData, companyId) {
  if (!postId || !parentCommentId || !replyData.text) {
    throw new Error("Missing required reply data");
  }

  try {
    // Create the reply comment
    const replyRef = await addDoc(collection(db, "comments"), {
      postId,
      parentCommentId,
      text: replyData.text,
      authorId: replyData.authorId,
      authorName: replyData.authorName || "Anonymous",
      authorRole: replyData.authorRole,
      isAnonymous: replyData.isAnonymous || false,
      createdAt: serverTimestamp(),
      likes: 0,
      companyId,
      replyCount: 0, // Replies can also have replies
    });

    // Update parent comment's reply count
    const parentCommentRef = doc(db, "comments", parentCommentId);
    await updateDoc(parentCommentRef, {
      replyCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    return replyRef.id;
  } catch (error) {
    console.error("Error adding comment reply:", error);
    throw error;
  }
}

/**
 * Get replies for a comment
 * @param {string} commentId - The parent comment ID
 * @returns {Promise<Array>} Array of reply comments
 */
export async function getCommentReplies(commentId) {
  if (!commentId) {
    throw new Error("Comment ID is required");
  }

  try {
    const repliesQuery = query(
      collection(db, "comments"),
      where("parentCommentId", "==", commentId),
      orderBy("createdAt", "asc")
    );

    const snapshot = await getDocs(repliesQuery);
    const replies = [];

    snapshot.forEach((doc) => {
      replies.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return replies;
  } catch (error) {
    console.error("Error getting comment replies:", error);
    throw error;
  }
}

/**
 * Build a threaded comment structure
 * @param {Array} comments - Flat array of comments
 * @returns {Array} Hierarchical array of comments with replies
 */
export function buildCommentTree(comments) {
  if (!comments || comments.length === 0) {
    return [];
  }

  // Separate top-level comments and replies
  const topLevelComments = [];
  const repliesMap = new Map();

  comments.forEach((comment) => {
    if (!comment.parentCommentId) {
      // Top-level comment
      topLevelComments.push({
        ...comment,
        replies: [],
      });
    } else {
      // Reply to a comment
      if (!repliesMap.has(comment.parentCommentId)) {
        repliesMap.set(comment.parentCommentId, []);
      }
      repliesMap.get(comment.parentCommentId).push({
        ...comment,
        replies: [],
      });
    }
  });

  // Attach replies to their parent comments
  const attachReplies = (comment) => {
    if (repliesMap.has(comment.id)) {
      comment.replies = repliesMap.get(comment.id);
      // Recursively attach replies to nested comments
      comment.replies.forEach((reply) => attachReplies(reply));
    }
    return comment;
  };

  return topLevelComments.map((comment) => attachReplies(comment));
}

/**
 * Get total comment count including all nested replies
 * @param {Array} threadedComments - Hierarchical array of comments
 * @returns {number} Total count
 */
export function getTotalCommentCount(threadedComments) {
  let count = 0;

  const countRecursive = (comments) => {
    comments.forEach((comment) => {
      count++;
      if (comment.replies && comment.replies.length > 0) {
        countRecursive(comment.replies);
      }
    });
  };

  countRecursive(threadedComments);
  return count;
}

/**
 * Like/Unlike a comment
 * @param {string} commentId - The comment ID
 * @param {string} userId - The user ID
 * @param {boolean} isLiked - Current like status
 * @returns {Promise<number>} New like count
 */
export async function toggleCommentLike(commentId, userId, isLiked) {
  if (!commentId || !userId) {
    throw new Error("Comment ID and User ID are required");
  }

  try {
    const commentRef = doc(db, "comments", commentId);

    await updateDoc(commentRef, {
      likes: increment(isLiked ? -1 : 1),
      updatedAt: serverTimestamp(),
    });

    // Get updated like count
    const commentDoc = await getDocs(commentRef);
    if (commentDoc.exists()) {
      return commentDoc.data().likes || 0;
    }

    return 0;
  } catch (error) {
    console.error("Error toggling comment like:", error);
    throw error;
  }
}
