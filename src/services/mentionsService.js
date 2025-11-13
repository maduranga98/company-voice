import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { NotificationType } from "../utils/constants";

// ============================================
// @MENTIONS FUNCTIONALITY
// ============================================

/**
 * Parse text for @mentions
 * @param {string} text - Text to parse
 * @returns {Array<object>} - Array of mentions {username, startIndex, endIndex}
 */
export const parseMentions = (text) => {
  if (!text) return [];

  // Match @username pattern (alphanumeric, underscore, dot, hyphen)
  const mentionRegex = /@([\w.-]+)/g;
  const mentions = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      username: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      fullMatch: match[0],
    });
  }

  return mentions;
};

/**
 * Extract unique mentioned usernames from text
 * @param {string} text - Text to parse
 * @returns {Array<string>} - Array of unique usernames
 */
export const extractMentionedUsernames = (text) => {
  const mentions = parseMentions(text);
  return [...new Set(mentions.map((m) => m.username))];
};

/**
 * Search users for @mention autocomplete
 * @param {string} searchTerm - Search term (partial username)
 * @param {string} companyId - Company ID
 * @param {number} limitCount - Max results
 * @returns {Promise<Array>}
 */
export const searchUsersForMention = async (
  searchTerm,
  companyId,
  limitCount = 10
) => {
  try {
    const usersRef = collection(db, "users");

    // Search by username (case-insensitive)
    const searchLower = searchTerm.toLowerCase();

    const q = query(
      usersRef,
      where("companyId", "==", companyId),
      where("status", "==", "active"),
      orderBy("username", "asc"),
      limit(50) // Get more, filter in memory
    );

    const snapshot = await getDocs(q);
    const users = [];

    snapshot.forEach((doc) => {
      const user = doc.data();
      if (
        (user.username || '').toLowerCase().includes(searchLower) ||
        (user.displayName || '').toLowerCase().includes(searchLower)
      ) {
        users.push({
          id: doc.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.photoURL,
          role: user.role,
          department: user.department,
        });
      }
    });

    return users.slice(0, limitCount);
  } catch (error) {
    console.error("Error searching users for mention:", error);
    return [];
  }
};

/**
 * Get user by username
 * @param {string} username - Username to find
 * @param {string} companyId - Company ID
 * @returns {Promise<object|null>}
 */
export const getUserByUsername = async (username, companyId) => {
  try {
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("companyId", "==", companyId),
      where("username", "==", username),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const userDoc = snapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    console.error("Error getting user by username:", error);
    return null;
  }
};

/**
 * Create mention notifications
 * @param {string} text - Text containing mentions
 * @param {string} companyId - Company ID
 * @param {object} context - Context (postId, commentId, authorName, etc.)
 * @returns {Promise<void>}
 */
export const createMentionNotifications = async (text, companyId, context) => {
  try {
    const usernames = extractMentionedUsernames(text);

    if (usernames.length === 0) {
      return { success: true, count: 0 };
    }

    const notificationPromises = [];

    for (const username of usernames) {
      const user = await getUserByUsername(username, companyId);

      if (user && user.id !== context.authorId) {
        // Don't notify self
        const notification = {
          userId: user.id,
          type: NotificationType.MENTION,
          title: `${context.authorName} mentioned you`,
          message: context.commentId
            ? `Mentioned you in a comment on "${context.postTitle}"`
            : `Mentioned you in "${context.postTitle}"`,
          postId: context.postId,
          commentId: context.commentId || null,
          mentionedBy: context.authorName,
          mentionedById: context.authorId,
          read: false,
          createdAt: serverTimestamp(),
        };

        notificationPromises.push(
          addDoc(collection(db, "notifications"), notification)
        );
      }
    }

    await Promise.all(notificationPromises);

    return { success: true, count: notificationPromises.length };
  } catch (error) {
    console.error("Error creating mention notifications:", error);
    // Don't throw - notifications are non-critical
    return { success: false, count: 0 };
  }
};

/**
 * Highlight mentions in text for display
 * @param {string} text - Text containing mentions
 * @returns {Array<object>} - Array of text segments with mention flags
 */
export const highlightMentions = (text) => {
  if (!text) return [{ text: "", isMention: false }];

  const mentions = parseMentions(text);

  if (mentions.length === 0) {
    return [{ text, isMention: false }];
  }

  const segments = [];
  let lastIndex = 0;

  mentions.forEach((mention) => {
    // Add text before mention
    if (mention.startIndex > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, mention.startIndex),
        isMention: false,
      });
    }

    // Add mention
    segments.push({
      text: mention.fullMatch,
      isMention: true,
      username: mention.username,
    });

    lastIndex = mention.endIndex;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      isMention: false,
    });
  }

  return segments;
};

/**
 * Get user's mentions (notifications where they were mentioned)
 * @param {string} userId - User ID
 * @param {number} limitCount - Max results
 * @returns {Promise<Array>}
 */
export const getUserMentions = async (userId, limitCount = 50) => {
  try {
    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", userId),
      where("type", "==", NotificationType.MENTION),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const mentions = [];

    snapshot.forEach((doc) => {
      mentions.push({ id: doc.id, ...doc.data() });
    });

    return mentions;
  } catch (error) {
    console.error("Error fetching user mentions:", error);
    return [];
  }
};

/**
 * Validate mention format
 * @param {string} username - Username to validate
 * @returns {boolean}
 */
export const isValidMentionFormat = (username) => {
  // Username must be alphanumeric with optional underscore, dot, or hyphen
  const usernameRegex = /^[\w.-]+$/;
  return (
    usernameRegex.test(username) && username.length >= 3 && username.length <= 30
  );
};

/**
 * Format text with clickable mentions (for display)
 * @param {string} text - Text containing mentions
 * @param {Function} onMentionClick - Callback when mention is clicked
 * @returns {JSX} - Formatted text with clickable mentions
 */
export const renderTextWithMentions = (text, onMentionClick) => {
  const segments = highlightMentions(text);

  return segments.map((segment, index) => {
    if (segment.isMention) {
      return {
        type: "mention",
        text: segment.text,
        username: segment.username,
        onClick: () => onMentionClick && onMentionClick(segment.username),
        key: index,
      };
    }
    return {
      type: "text",
      text: segment.text,
      key: index,
    };
  });
};
