import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";

const BOOKMARKS_COLLECTION = "bookmarks";

/**
 * Add a bookmark for a post
 */
export const addBookmark = async (userId, postId, companyId) => {
  const existing = await getDocs(
    query(
      collection(db, BOOKMARKS_COLLECTION),
      where("userId", "==", userId),
      where("postId", "==", postId)
    )
  );
  if (!existing.empty) return; // already bookmarked
  await addDoc(collection(db, BOOKMARKS_COLLECTION), {
    userId,
    postId,
    companyId,
    createdAt: serverTimestamp(),
  });
};

/**
 * Remove a bookmark for a post
 */
export const removeBookmark = async (userId, postId) => {
  const snap = await getDocs(
    query(
      collection(db, BOOKMARKS_COLLECTION),
      where("userId", "==", userId),
      where("postId", "==", postId)
    )
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
};

/**
 * Toggle a bookmark (add if not bookmarked, remove if already bookmarked)
 * Returns whether the post is now bookmarked
 */
export const toggleBookmark = async (userId, postId, companyId) => {
  const snap = await getDocs(
    query(
      collection(db, BOOKMARKS_COLLECTION),
      where("userId", "==", userId),
      where("postId", "==", postId)
    )
  );
  if (snap.empty) {
    await addDoc(collection(db, BOOKMARKS_COLLECTION), {
      userId,
      postId,
      companyId,
      createdAt: serverTimestamp(),
    });
    return true; // now bookmarked
  } else {
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    return false; // removed bookmark
  }
};

/**
 * Check if a post is bookmarked by the user
 */
export const isPostBookmarked = async (userId, postId) => {
  const snap = await getDocs(
    query(
      collection(db, BOOKMARKS_COLLECTION),
      where("userId", "==", userId),
      where("postId", "==", postId)
    )
  );
  return !snap.empty;
};

/**
 * Subscribe to bookmark status changes for a post
 * Returns unsubscribe function
 */
export const subscribeToBookmark = (userId, postId, callback) => {
  const q = query(
    collection(db, BOOKMARKS_COLLECTION),
    where("userId", "==", userId),
    where("postId", "==", postId)
  );
  return onSnapshot(q, (snap) => callback(!snap.empty), () => {});
};

/**
 * Get all bookmarked post IDs for a user
 */
export const getUserBookmarks = async (userId, companyId) => {
  const snap = await getDocs(
    query(
      collection(db, BOOKMARKS_COLLECTION),
      where("userId", "==", userId),
      where("companyId", "==", companyId)
    )
  );
  return snap.docs.map((d) => d.data().postId);
};
