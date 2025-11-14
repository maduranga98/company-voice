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
 * Poll Service
 * Handles poll creation and voting functionality
 */

/**
 * Vote on a poll option
 * @param {string} postId - The post ID containing the poll
 * @param {number} optionIndex - Index of the option to vote for
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Updated poll data
 */
export async function votePoll(postId, optionIndex, userId) {
  if (!postId || optionIndex === undefined || !userId) {
    throw new Error("Invalid poll vote parameters");
  }

  try {
    const postRef = doc(db, "posts", postId);
    const postDoc = await getDoc(postRef);

    if (!postDoc.exists()) {
      throw new Error("Post not found");
    }

    const postData = postDoc.data();
    const poll = postData.poll;

    if (!poll || !poll.options) {
      throw new Error("Poll not found in post");
    }

    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      throw new Error("Invalid poll option index");
    }

    // Check if poll has ended
    if (poll.endDate) {
      const endDate = poll.endDate.toDate
        ? poll.endDate.toDate()
        : new Date(poll.endDate);
      if (new Date() > endDate) {
        throw new Error("This poll has ended");
      }
    }

    // Initialize votes array if not exists
    const updatedOptions = poll.options.map((option, index) => ({
      ...option,
      votes: option.votes || [],
    }));

    // Check if user has already voted
    let previousVoteIndex = -1;
    updatedOptions.forEach((option, index) => {
      if (option.votes.includes(userId)) {
        previousVoteIndex = index;
      }
    });

    // Handle voting logic
    if (poll.multipleChoice) {
      // Multiple choice: toggle the vote
      if (updatedOptions[optionIndex].votes.includes(userId)) {
        // Remove vote
        updatedOptions[optionIndex].votes = updatedOptions[optionIndex].votes.filter(
          (id) => id !== userId
        );
      } else {
        // Add vote
        updatedOptions[optionIndex].votes.push(userId);
      }
    } else {
      // Single choice: remove previous vote and add new one
      if (previousVoteIndex !== -1) {
        updatedOptions[previousVoteIndex].votes = updatedOptions[
          previousVoteIndex
        ].votes.filter((id) => id !== userId);
      }

      if (previousVoteIndex !== optionIndex) {
        updatedOptions[optionIndex].votes.push(userId);
      }
    }

    // Update the post with new poll data
    await updateDoc(postRef, {
      "poll.options": updatedOptions,
      "poll.totalVotes": updatedOptions.reduce(
        (sum, option) => sum + option.votes.length,
        0
      ),
      "poll.voters": arrayUnion(userId),
      updatedAt: serverTimestamp(),
    });

    // Return updated poll data
    const updatedDoc = await getDoc(postRef);
    return updatedDoc.data().poll;
  } catch (error) {
    console.error("Error voting on poll:", error);
    throw error;
  }
}

/**
 * Check if a user has voted on a poll
 * @param {Object} poll - The poll object
 * @param {string} userId - The user ID
 * @returns {boolean} True if user has voted
 */
export function hasUserVoted(poll, userId) {
  if (!poll || !poll.options || !userId) return false;

  return poll.options.some((option) =>
    (option.votes || []).includes(userId)
  );
}

/**
 * Get user's votes on a poll
 * @param {Object} poll - The poll object
 * @param {string} userId - The user ID
 * @returns {Array<number>} Array of option indices the user voted for
 */
export function getUserVotes(poll, userId) {
  if (!poll || !poll.options || !userId) return [];

  const votes = [];
  poll.options.forEach((option, index) => {
    if ((option.votes || []).includes(userId)) {
      votes.push(index);
    }
  });

  return votes;
}

/**
 * Calculate poll statistics
 * @param {Object} poll - The poll object
 * @returns {Object} Poll statistics
 */
export function getPollStats(poll) {
  if (!poll || !poll.options) {
    return {
      totalVotes: 0,
      options: [],
      hasEnded: false,
    };
  }

  const totalVotes = poll.options.reduce(
    (sum, option) => sum + (option.votes?.length || 0),
    0
  );

  const options = poll.options.map((option) => {
    const votes = option.votes?.length || 0;
    const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;

    return {
      text: option.text,
      votes,
      percentage: percentage.toFixed(1),
    };
  });

  let hasEnded = false;
  if (poll.endDate) {
    const endDate = poll.endDate.toDate
      ? poll.endDate.toDate()
      : new Date(poll.endDate);
    hasEnded = new Date() > endDate;
  }

  return {
    totalVotes,
    options,
    hasEnded,
    endDate: poll.endDate,
    multipleChoice: poll.multipleChoice || false,
  };
}

/**
 * Validate poll data
 * @param {Object} pollData - Poll data to validate
 * @returns {Object} Validation result
 */
export function validatePollData(pollData) {
  const errors = [];

  if (!pollData.question || pollData.question.trim().length === 0) {
    errors.push("Poll question is required");
  }

  if (!pollData.options || pollData.options.length < 2) {
    errors.push("Poll must have at least 2 options");
  }

  if (pollData.options && pollData.options.length > 10) {
    errors.push("Poll cannot have more than 10 options");
  }

  if (pollData.options) {
    const emptyOptions = pollData.options.filter(
      (opt) => !opt.text || opt.text.trim().length === 0
    );
    if (emptyOptions.length > 0) {
      errors.push("All poll options must have text");
    }
  }

  if (pollData.endDate) {
    const endDate = new Date(pollData.endDate);
    if (endDate <= new Date()) {
      errors.push("Poll end date must be in the future");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
