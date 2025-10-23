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

  const handleSubmitComment = async (e) => {
    e.preventDefault();

    if (!newComment.trim() || loading) return;

    setLoading(true);

    try {
      const commentData = {
        postId,
        text: newComment.trim(),
        authorId: userData.id,
        authorName: userData.displayName,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "comments"), commentData);

      // Update post comment count
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        comments: increment(1),
      });

      // Create notification for post author (only if not commenting on own post)
      if (postAuthorId && postAuthorId !== userData.id) {
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
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date) => {
    if (!date) return "Just now";

    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      {/* Comment Button */}
      <button
        onClick={() => setShowComments(!showComments)}
        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-slate-600 hover:text-blue-500 hover:bg-blue-50 rounded-lg font-medium transition-all"
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

      {/* Comments Section */}
      {showComments && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-3 border-t border-slate-100">
          {/* Add Comment Form */}
          <form onSubmit={handleSubmitComment} className="mb-3 sm:mb-4">
            <div className="flex gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-medium flex-shrink-0">
                {userData?.displayName?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  rows="2"
                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                />
                <div className="flex justify-end mt-1.5 sm:mt-2">
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
          <div className="space-y-2 sm:space-y-3">
            {comments.length === 0 ? (
              <p className="text-center text-xs sm:text-sm text-slate-500 py-3 sm:py-4">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-medium flex-shrink-0">
                    {comment.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-slate-50 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="font-medium text-xs sm:text-sm text-slate-900 truncate">
                          {comment.authorName}
                        </span>
                        <span className="text-xs text-slate-500 flex-shrink-0">
                          {getTimeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap break-words">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default CommentsSection;
