import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Voting Service
 * Handles upvote/downvote functionality for posts
 */

/**
 * Cast or change a vote on a post
 * @param {string} postId - The post ID
 * @param {string} userId - The user ID
 * @param {string} voteType - 'upvote' or 'downvote'
 * @returns {Promise<{upvotes: number, downvotes: number, userVote: string|null}>}
 */
export async function castVote(postId, userId, voteType) {
  if (!postId || !userId || !["upvote", "downvote"].includes(voteType)) {
    throw new Error("Invalid vote parameters");
  }

  try {
    const postRef = doc(db, "posts", postId);
    const postDoc = await getDoc(postRef);

    if (!postDoc.exists()) {
      throw new Error("Post not found");
    }

    const postData = postDoc.data();
    const currentUpvotes = postData.upvotes || [];
    const currentDownvotes = postData.downvotes || [];

    let updateData = {
      updatedAt: serverTimestamp(),
    };

    // Check if user has already voted
    const hasUpvoted = currentUpvotes.includes(userId);
    const hasDownvoted = currentDownvotes.includes(userId);

    if (voteType === "upvote") {
      if (hasUpvoted) {
        // Remove upvote (toggle off)
        updateData.upvotes = arrayRemove(userId);
      } else {
        // Add upvote
        updateData.upvotes = arrayUnion(userId);
        // Remove downvote if it exists
        if (hasDownvoted) {
          updateData.downvotes = arrayRemove(userId);
        }
      }
    } else if (voteType === "downvote") {
      if (hasDownvoted) {
        // Remove downvote (toggle off)
        updateData.downvotes = arrayRemove(userId);
      } else {
        // Add downvote
        updateData.downvotes = arrayUnion(userId);
        // Remove upvote if it exists
        if (hasUpvoted) {
          updateData.upvotes = arrayRemove(userId);
        }
      }
    }

    await updateDoc(postRef, updateData);

    // Fetch updated data
    const updatedDoc = await getDoc(postRef);
    const updatedData = updatedDoc.data();

    return {
      upvotes: (updatedData.upvotes || []).length,
      downvotes: (updatedData.downvotes || []).length,
      userVote: getUserVote(updatedData.upvotes || [], updatedData.downvotes || [], userId),
    };
  } catch (error) {
    console.error("Error casting vote:", error);
    throw error;
  }
}

/**
 * Get user's current vote on a post
 * @param {Array} upvotes - Array of user IDs who upvoted
 * @param {Array} downvotes - Array of user IDs who downvoted
 * @param {string} userId - The user ID
 * @returns {string|null} 'upvote', 'downvote', or null
 */
function getUserVote(upvotes, downvotes, userId) {
  if (upvotes.includes(userId)) return "upvote";
  if (downvotes.includes(userId)) return "downvote";
  return null;
}

/**
 * Get vote statistics for a post
 * @param {string} postId - The post ID
 * @param {string} userId - The user ID (optional)
 * @returns {Promise<{upvotes: number, downvotes: number, score: number, userVote: string|null}>}
 */
export async function getVoteStats(postId, userId = null) {
  try {
    const postRef = doc(db, "posts", postId);
    const postDoc = await getDoc(postRef);

    if (!postDoc.exists()) {
      throw new Error("Post not found");
    }

    const data = postDoc.data();
    const upvotes = (data.upvotes || []).length;
    const downvotes = (data.downvotes || []).length;
    const score = upvotes - downvotes;

    return {
      upvotes,
      downvotes,
      score,
      userVote: userId
        ? getUserVote(data.upvotes || [], data.downvotes || [], userId)
        : null,
    };
  } catch (error) {
    console.error("Error getting vote stats:", error);
    throw error;
  }
}
