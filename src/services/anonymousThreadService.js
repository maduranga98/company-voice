import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import CryptoJS from "crypto-js";
import { ThreadSender } from "../utils/constants";

const ANONYMOUS_SECRET =
  import.meta.env.VITE_ANONYMOUS_SECRET || "default-secret-key-change-in-production";

// ============================================
// ENCRYPTION HELPERS
// ============================================

const encryptMessage = (text) => {
  return CryptoJS.AES.encrypt(text, ANONYMOUS_SECRET).toString();
};

const decryptMessage = (encryptedText) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ANONYMOUS_SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Error decrypting message:", error);
    return "[Decryption failed]";
  }
};

// ============================================
// THREAD MANAGEMENT
// ============================================

/**
 * Create a new anonymous thread for a post.
 * Idempotent — if the thread already exists, it returns without overwriting.
 * @param {string} postId - The post ID (used as the thread document ID)
 * @param {string} companyId - The company ID for access scoping
 * @returns {Promise<{success: boolean, existed: boolean}>}
 */
export const createThread = async (postId, companyId) => {
  try {
    const threadRef = doc(db, "anonymousThreads", postId);
    const existing = await getDoc(threadRef);

    if (existing.exists()) {
      return { success: true, existed: true };
    }

    await setDoc(threadRef, {
      postId,
      companyId,
      messages: [],
      lastReporterActivity: null,
      lastInvestigatorActivity: null,
      lastReadBy: {},
      createdAt: serverTimestamp(),
    });

    return { success: true, existed: false };
  } catch (error) {
    console.error("Error creating thread:", error);
    throw error;
  }
};

/**
 * Add an encrypted message to a thread.
 * Creates the thread first if it doesn't exist.
 * @param {string} postId - The post ID
 * @param {string} senderRole - ThreadSender.REPORTER or ThreadSender.INVESTIGATOR
 * @param {string} messageText - Plain-text message content to encrypt
 * @param {string} companyId - Company ID for thread creation if needed
 * @returns {Promise<{success: boolean}>}
 */
export const addMessage = async (postId, senderRole, messageText, companyId) => {
  try {
    const threadRef = doc(db, "anonymousThreads", postId);
    const existing = await getDoc(threadRef);

    if (!existing.exists()) {
      await createThread(postId, companyId);
    }

    const encryptedContent = encryptMessage(messageText);

    const message = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sender: senderRole,
      encryptedContent,
      timestamp: new Date().toISOString(),
      read: false,
    };

    const activityField =
      senderRole === ThreadSender.REPORTER
        ? "lastReporterActivity"
        : "lastInvestigatorActivity";

    await updateDoc(threadRef, {
      messages: arrayUnion(message),
      [activityField]: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error adding message:", error);
    throw error;
  }
};

/**
 * Fetch and decrypt all messages in a thread.
 * @param {string} postId - The post ID
 * @param {string} companyId - Company ID (used for validation context)
 * @returns {Promise<object|null>} Thread data with decrypted messages, or null if not found
 */
export const getThread = async (postId, companyId) => {
  try {
    const threadRef = doc(db, "anonymousThreads", postId);
    const snap = await getDoc(threadRef);

    if (!snap.exists()) {
      return null;
    }

    const data = snap.data();

    const decryptedMessages = (data.messages || []).map((msg) => ({
      ...msg,
      content: decryptMessage(msg.encryptedContent),
    }));

    return {
      ...data,
      messages: decryptedMessages,
    };
  } catch (error) {
    console.error("Error fetching thread:", error);
    return null;
  }
};

/**
 * Mark a thread as read for a given role.
 * Updates lastReadBy.{readerRole} to the current server timestamp.
 * @param {string} postId - The post ID
 * @param {string} readerRole - ThreadSender.REPORTER or ThreadSender.INVESTIGATOR
 * @returns {Promise<{success: boolean}>}
 */
export const markThreadRead = async (postId, readerRole) => {
  try {
    const threadRef = doc(db, "anonymousThreads", postId);
    await updateDoc(threadRef, {
      [`lastReadBy.${readerRole}`]: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error marking thread read:", error);
    return { success: false };
  }
};

/**
 * Get all anonymous threads for a company, enriched with post title.
 * Used by HR inbox to see all active conversations in one place.
 * Uses onSnapshot for real-time updates.
 *
 * TODO: getDoc per thread should be batched in future when thread counts grow large.
 *
 * @param {string} companyId - Company ID
 * @param {function} onUpdate - Callback called with enriched threads array on every update
 * @returns {function} Unsubscribe function
 */
export const subscribeToCompanyThreads = (companyId, onUpdate) => {
  const threadsQuery = query(
    collection(db, "anonymousThreads"),
    where("companyId", "==", companyId)
  );

  const unsubscribe = onSnapshot(threadsQuery, async (snapshot) => {
    const threads = [];

    for (const threadDoc of snapshot.docs) {
      const data = threadDoc.data();

      // Skip threads with no messages
      if (!data.messages || data.messages.length === 0) continue;

      // Fetch the associated post to get its title
      let postTitle = "Unknown Post";
      let postType = "problem_report";
      try {
        const postRef = doc(db, "posts", threadDoc.id);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          postTitle = postSnap.data().title || "Untitled Post";
          postType = postSnap.data().type || "problem_report";
        }
      } catch (e) {
        // Post fetch failed — use fallback title
      }

      // Decrypt the last message for preview
      let lastMessagePreview = "";
      let lastMessageSender = "";
      if (data.messages.length > 0) {
        const lastMsg = data.messages[data.messages.length - 1];
        try {
          const bytes = CryptoJS.AES.decrypt(lastMsg.encryptedContent, ANONYMOUS_SECRET);
          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
          lastMessagePreview = decrypted.length > 60
            ? decrypted.substring(0, 60) + "..."
            : decrypted;
          lastMessageSender = lastMsg.sender; // 'reporter' or 'investigator'
        } catch {
          lastMessagePreview = "[Encrypted message]";
        }
      }

      // Count unread messages from reporter (messages HR hasn't read yet)
      const lastReadRaw = data.lastReadBy?.["investigator"];
      const lastReadDate = lastReadRaw?.toDate ? lastReadRaw.toDate() : null;
      const unreadCount = data.messages.filter((msg) => {
        if (msg.sender !== "reporter") return false;
        if (!lastReadDate) return true;
        return new Date(msg.timestamp) > lastReadDate;
      }).length;

      // Determine last activity timestamp (most recent message)
      const lastMsg = data.messages[data.messages.length - 1];
      const lastActivity = lastMsg?.timestamp ? new Date(lastMsg.timestamp) : null;

      threads.push({
        postId: threadDoc.id,
        companyId: data.companyId,
        postTitle,
        postType,
        messageCount: data.messages.length,
        lastMessagePreview,
        lastMessageSender,
        unreadCount,
        lastActivity,
        lastReporterActivity: data.lastReporterActivity,
        lastInvestigatorActivity: data.lastInvestigatorActivity,
      });
    }

    // Sort by last activity descending (most recent first)
    threads.sort((a, b) => {
      if (!a.lastActivity && !b.lastActivity) return 0;
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return b.lastActivity - a.lastActivity;
    });

    onUpdate(threads);
  });

  return unsubscribe;
};
