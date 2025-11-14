import { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { MessageCircle, Send, CornerDownRight, Heart, Reply } from "lucide-react";
import {
  addCommentReply,
  buildCommentTree,
  getTotalCommentCount,
} from "../services/commentThreadingService";
import {
  searchUsersForMention,
  createMentionNotifications,
  highlightMentions,
} from "../services/mentionsService";

/**
 * Threaded Comment Component
 * Displays a single comment with its nested replies
 */
const ThreadedComment = ({ comment, postId, postTitle, depth = 0, maxDepth = 3 }) => {
  const { userData } = useAuth();
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const handleReply = async () => {
    if (!replyText.trim() || loading) return;

    setLoading(true);

    try {
      const replyData = {
        text: replyText.trim(),
        authorId: userData.id,
        authorName: isAnonymous ? "Anonymous" : userData.displayName,
        authorRole: userData.role,
        isAnonymous,
      };

      await addCommentReply(postId, comment.id, replyData, userData.companyId);

      // Create mention notifications
      await createMentionNotifications(replyText, userData.companyId, {
        postId,
        postTitle,
        authorId: userData.id,
        authorName: isAnonymous ? "Anonymous" : userData.displayName,
        commentId: comment.id,
      });

      setReplyText("");
      setShowReplyBox(false);
      setIsAnonymous(false);
    } catch (error) {
      console.error("Error adding reply:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderCommentWithMentions = (text) => {
    const segments = highlightMentions(text);
    return segments.map((segment, index) => {
      if (segment.isMention) {
        return (
          <span
            key={index}
            className="text-blue-600 font-medium hover:underline cursor-pointer"
          >
            {segment.text}
          </span>
        );
      }
      return <span key={index}>{segment.text}</span>;
    });
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    const now = new Date();
    const postDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffInSeconds = Math.floor((now - postDate) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return postDate.toLocaleDateString();
  };

  const indentClass = depth > 0 ? "ml-6 sm:ml-8 md:ml-10" : "";
  const showNestedReplyButton = depth < maxDepth;

  return (
    <div className={`${indentClass} ${depth > 0 ? "border-l-2 border-slate-200 pl-3" : ""}`}>
      <div className="flex gap-2 sm:gap-3 mb-2">
        {/* Avatar */}
        <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
          {comment.authorName?.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Comment Content */}
          <div className="bg-slate-50 rounded-lg p-2.5 sm:p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-medium text-slate-900 text-sm">
                {comment.authorName}
                {comment.isAdminComment && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                    Admin
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-500 flex-shrink-0">
                {getTimeAgo(comment.createdAt)}
              </span>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
              {renderCommentWithMentions(comment.text)}
            </p>
          </div>

          {/* Comment Actions */}
          <div className="flex items-center gap-3 mt-1 ml-1">
            {showNestedReplyButton && (
              <button
                onClick={() => setShowReplyBox(!showReplyBox)}
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 transition"
              >
                <Reply className="w-3 h-3" />
                Reply
              </button>
            )}
            {comment.replies && comment.replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {showReplies ? "Hide" : "Show"} {comment.replies.length}{" "}
                {comment.replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>

          {/* Reply Box */}
          {showReplyBox && (
            <div className="mt-2 flex gap-2">
              <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {userData?.displayName?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  rows="2"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center justify-between mt-1">
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-3 h-3 rounded"
                    />
                    Reply anonymously
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowReplyBox(false)}
                      className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReply}
                      disabled={!replyText.trim() || loading}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {showReplies && comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map((reply) => (
            <ThreadedComment
              key={reply.id}
              comment={reply}
              postId={postId}
              postTitle={postTitle}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * CommentsThreaded Component
 * Displays threaded comments with reply functionality
 */
const CommentsThreaded = ({
  postId,
  initialCommentCount,
  postAuthorId,
  postAuthorName,
  postTitle,
}) => {
  const { userData } = useAuth();
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(initialCommentCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Real-time comments listener
  useEffect(() => {
    if (!showComments || !postId) return;

    const commentsRef = collection(db, "comments");
    const q = query(
      commentsRef,
      where("postId", "==", postId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedComments = [];
        snapshot.forEach((doc) => {
          fetchedComments.push({ id: doc.id, ...doc.data() });
        });

        // Build threaded structure
        const threadedComments = buildCommentTree(fetchedComments);
        setComments(threadedComments);

        // Update count (total including replies)
        const totalCount = getTotalCommentCount(threadedComments);
        setCommentCount(totalCount);
      },
      (error) => {
        console.error("Error fetching comments:", error);
        setError("Failed to load comments. Please try again.");
      }
    );

    return () => unsubscribe();
  }, [postId, showComments]);

  const handleAddComment = async () => {
    if (!newComment.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      if (!userData?.id) {
        throw new Error("Please log in to comment");
      }

      const commentData = {
        postId,
        text: newComment.trim(),
        authorId: userData.id,
        authorName: isAnonymous ? "Anonymous" : userData.displayName,
        authorRole: userData.role,
        isAnonymous,
        createdAt: serverTimestamp(),
        likes: 0,
        companyId: userData.companyId,
        replyCount: 0,
      };

      await addDoc(collection(db, "comments"), commentData);

      // Update post comment count
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        comments: increment(1),
        updatedAt: serverTimestamp(),
      });

      // Create mention notifications
      await createMentionNotifications(newComment, userData.companyId, {
        postId,
        postTitle,
        authorId: userData.id,
        authorName: isAnonymous ? "Anonymous" : userData.displayName,
        commentId: null,
      });

      setNewComment("");
      setIsAnonymous(false);
    } catch (error) {
      console.error("Error adding comment:", error);
      setError("Failed to add comment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Comment Button */}
      <button
        onClick={() => setShowComments(!showComments)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm"
      >
        <MessageCircle className="w-4 h-4" />
        <span>{commentCount}</span>
        <span className="hidden sm:inline">
          {commentCount === 1 ? "Comment" : "Comments"}
        </span>
      </button>

      {/* Comments Section */}
      {showComments && (
        <div className="px-3 sm:px-4 pb-4 border-t border-slate-100 mt-3 bg-white">
          {/* Comments List */}
          <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                {commentCount > 0
                  ? "Loading comments..."
                  : "No comments yet. Be the first to comment!"}
              </p>
            ) : (
              comments.map((comment) => (
                <ThreadedComment
                  key={comment.id}
                  comment={comment}
                  postId={postId}
                  postTitle={postTitle}
                />
              ))
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Add Comment */}
          <div className="mt-4">
            <div className="flex gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {userData?.displayName?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.ctrlKey) {
                      handleAddComment();
                    }
                  }}
                  placeholder="Write a comment... (Use @ to mention someone)"
                  rows="2"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-3 h-3 rounded"
                    />
                    Comment anonymously
                  </label>
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || loading}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3 h-3" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CommentsThreaded;
