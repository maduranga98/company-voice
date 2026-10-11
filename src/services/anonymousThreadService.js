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
import { ThreadSender } from "../utils/constants";

// Thread messages are stored as plain text in `content`. Messages written before
// encryption was removed only have `encryptedContent`; they are flagged `legacy`
// (never decrypted) so the UI can label them instead of showing a broken bubble.
export const normalizeThreadMessage = ({ encryptedContent, ...msg }) => ({
  ...msg,
  content: typeof msg.content === "string" ? msg.content : "",
  legacy: typeof msg.content !== "string" && Boolean(encryptedContent),
});

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
export const createThread = async (postId, companyId, reporterId = null) => {
  try {
    const threadRef = doc(db, "anonymousThreads", postId);
    const existing = await getDoc(threadRef);

    if (existing.exists()) {
      // Backfill reporterId if thread was created by HR before the reporter opened it
      if (reporterId && !existing.data().reporterId) {
        try {
          await updateDoc(threadRef, { reporterId });
        } catch {
          // Best-effort; may fail if caller lacks write permission before reporterId is set
        }
      }
      return { success: true, existed: true };
    }

    await setDoc(threadRef, {
      postId,
      companyId,
      ...(reporterId ? { reporterId } : {}),
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
 * @param {string} messageText - Plain-text message content
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

    const message = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sender: senderRole,
      content: messageText,
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
 * Fetch all messages in a thread.
 * @param {string} postId - The post ID
 * @param {string} companyId - Company ID (used for validation context)
 * @returns {Promise<object|null>} Thread data with normalized messages, or null if not found
 */
export const getThread = async (postId, companyId) => {
  try {
    const threadRef = doc(db, "anonymousThreads", postId);
    const snap = await getDoc(threadRef);

    if (!snap.exists()) {
      return null;
    }

    const data = snap.data();

    return {
      ...data,
      messages: (data.messages || []).map(normalizeThreadMessage),
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

      // Last message preview
      let lastMessagePreview = "";
      let lastMessageSender = "";
      if (data.messages.length > 0) {
        const lastMsg = data.messages[data.messages.length - 1];
        const text = typeof lastMsg.content === "string" ? lastMsg.content : "";
        lastMessagePreview = text.length > 60 ? text.substring(0, 60) + "..." : text;
        lastMessageSender = lastMsg.sender;
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
