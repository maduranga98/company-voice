import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";

const CommentsSection = ({
  postId,
  initialCommentCount = 0,
  postAuthorId,
  postAuthorName,
  postTitle,
}) => {
  const { userData } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (!showComments || !postId) return;

    // Real-time listener for comments
    const commentsRef = collection(db, "comments");
    const q = query(
      commentsRef,
      where("postId", "==", postId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, [postId, showComments]);

  const getTimeAgo = (date) => {
    if (!date) return "Just now";

    // Convert Firestore timestamp to JS Date if needed
    let dateObj = date;
    if (date.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } else if (!(date instanceof Date)) {
      dateObj = new Date(date);
    }

    const seconds = Math.floor((new Date() - dateObj) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    return dateObj.toLocaleDateString();
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();

    if (!newComment.trim() || loading) return;

    setLoading(true);

    try {
      const commentData = {
        postId,
        text: newComment.trim(),
        authorId: userData.id,
        authorName: isAnonymous ? "Anonymous" : userData.displayName,
        isAnonymous: isAnonymous,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "comments"), commentData);

      // Update post comment count
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        comments: increment(1),
      });

      // Create notification for post author (only if not commenting on own post)
      if (postAuthorId && postAuthorId !== userData.id && !isAnonymous) {
        try {
          await addDoc(collection(db, "notifications"), {
            userId: postAuthorId,
            type: "comment",
            title: "New Comment",
            message: `${userData.displayName} commented on your post "${postTitle}"`,
            postId: postId,
            read: false,
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          console.error("Error creating notification:", error);
        }
      }

      setNewComment("");
      setIsAnonymous(false); // Reset to non-anonymous after posting
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Comment Button */}
      <button
        onClick={() => setShowComments(!showComments)}
        className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg font-medium transition-all ${
          showComments
            ? "text-blue-600 bg-blue-50"
            : "text-slate-600 hover:text-blue-500 hover:bg-blue-50"
        }`}
      >
        <svg
          className="w-4 h-4 sm:w-5 sm:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="text-xs sm:text-sm">
          {comments.length || initialCommentCount}
        </span>
      </button>

      {/* Comments Section - Expands Below Action Bar */}
      {showComments && (
        <div className="absolute left-0 right-0 bg-white border-t border-slate-100 shadow-lg z-10">
          {/* Header with Close Button */}
          <div className="px-3 sm:px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Comments ({comments.length || initialCommentCount})
            </h3>
            <button
              onClick={() => setShowComments(false)}
              className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-200 rounded"
              aria-label="Close comments"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-3">
            {/* Add Comment Form */}
            <form onSubmit={handleSubmitComment} className="mb-3 sm:mb-4">
              <div className="flex gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-medium flex-shrink-0">
                  {isAnonymous
                    ? "?"
                    : userData?.displayName?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={
                      isAnonymous
                        ? "Write an anonymous comment..."
                        : "Write a comment..."
                    }
                    rows="2"
                    className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                  />
                  <div className="flex justify-between items-center mt-1.5 sm:mt-2">
                    {/* Anonymous Toggle */}
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                      />
                      <span className="text-xs text-slate-600 group-hover:text-slate-900 transition flex items-center gap-1">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Comment anonymously
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={!newComment.trim() || loading}
                      className="px-3 sm:px-4 py-1 sm:py-1.5 bg-slate-900 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Posting..." : "Comment"}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-center text-xs sm:text-sm text-slate-500 py-3 sm:py-4">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2">
                    <div
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 ${
                        comment.isAnonymous ? "bg-slate-400" : "bg-slate-900"
                      }`}
                    >
                      {comment.isAnonymous
                        ? "?"
                        : comment.authorName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-slate-50 rounded-lg p-2 sm:p-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs sm:text-sm font-medium text-slate-900">
                            {comment.authorName || "Anonymous"}
                          </p>
                          {comment.isAnonymous && (
                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">
                              Anonymous
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            {getTimeAgo(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap">
                          {comment.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CommentsSection;
