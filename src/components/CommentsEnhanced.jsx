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
  deleteDoc,
  doc,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { MessageCircle, Send, AtSign, X, Edit2, Trash2, Reply } from "lucide-react";
import {
  searchUsersForMention,
  parseMentions,
  createMentionNotifications,
  highlightMentions,
} from "../services/mentionsService";

const CommentsEnhanced = ({
  postId,
  initialCommentCount,
  postAuthorId,
  postAuthorName,
  postTitle,
  reactionButton,
  reportButton,
}) => {
  const { userData } = useAuth();
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(initialCommentCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Edit/Delete/Reply state
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState("");
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState("");

  // Mention autocomplete state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);

  const textareaRef = useRef(null);

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
        setComments(fetchedComments);
        setCommentCount(fetchedComments.length);
      },
      (error) => {
        console.error("Error fetching comments:", error);
        setError("Failed to load comments. Please try again.");
      }
    );

    return () => unsubscribe();
  }, [postId, showComments]);

  // Handle mention trigger (@)
  const handleTextChange = async (e) => {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;
    setNewComment(text);
    setCursorPosition(cursorPos);

    // Check if we're typing a mention
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);

      // Only show mentions if @ is recent and no space after it
      if (!textAfterAt.includes(" ") && textAfterAt.length <= 20) {
        setMentionSearch(textAfterAt);
        setShowMentions(true);

        // Search for users
        if (userData?.companyId) {
          const users = await searchUsersForMention(
            textAfterAt,
            userData.companyId,
            5
          );
          setMentionSuggestions(users);
        }

        // Calculate position for dropdown
        if (textareaRef.current) {
          const { offsetTop, offsetLeft } = textareaRef.current;
          setMentionPosition({
            top: offsetTop + 30,
            left: offsetLeft + 10,
          });
        }
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  // Insert mention
  const insertMention = (user) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const textAfterCursor = newComment.substring(cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");

    const newText =
      textBeforeCursor.substring(0, lastAtSymbol) +
      `@${user.username} ` +
      textAfterCursor;

    setNewComment(newText);
    setShowMentions(false);

    // Focus back on textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

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
        commentId: null, // Will be updated after comment is created
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

  // Edit comment
  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditText(comment.text);
  };

  const handleSaveEdit = async (commentId) => {
    if (!editText.trim()) return;

    try {
      const commentRef = doc(db, "comments", commentId);
      await updateDoc(commentRef, {
        text: editText.trim(),
        edited: true,
        editedAt: serverTimestamp(),
      });

      setEditingCommentId(null);
      setEditText("");
    } catch (error) {
      console.error("Error editing comment:", error);
      setError("Failed to edit comment. Please try again.");
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditText("");
  };

  // Delete comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "comments", commentId));

      // Decrement comment count on post
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        comments: increment(-1),
      });
    } catch (error) {
      console.error("Error deleting comment:", error);
      setError("Failed to delete comment. Please try again.");
    }
  };

  // Reply to comment
  const handleReplyToComment = (comment) => {
    setReplyingToId(comment.id);
    setReplyText(`@${comment.authorName} `);
  };

  const handleSaveReply = async (parentCommentId) => {
    if (!replyText.trim()) return;

    try {
      const replyData = {
        postId,
        text: replyText.trim(),
        authorId: userData.id,
        authorName: userData.displayName,
        parentCommentId: parentCommentId,
        isAnonymous: false,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "comments"), replyData);

      // Update post comment count
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        comments: increment(1),
      });

      setReplyingToId(null);
      setReplyText("");
    } catch (error) {
      console.error("Error adding reply:", error);
      setError("Failed to add reply. Please try again.");
    }
  };

  const handleCancelReply = () => {
    setReplyingToId(null);
    setReplyText("");
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

  return (
    <>
      {/* Action Bar */}
      <div className="px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-1 bg-white">
        {reactionButton}
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
        {reportButton}
      </div>

      {/* Comments Section - Separate from action bar */}
      {showComments && (
        <div className="w-full px-3 sm:px-4 pb-4 pt-2 border-t border-slate-100 bg-white">
          {/* Close Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowComments(false)}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-1.5 transition"
              title="Close comments"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Comments List */}
          <div className="mt-2 space-y-3 max-h-96 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                {commentCount > 0 ? "Loading comments..." : "No comments yet. Be the first to comment!"}
              </p>
            ) : (
              comments.map((comment) => {
                const isOwnComment = userData && userData.id === comment.authorId;
                const isEditing = editingCommentId === comment.id;
                const isReplying = replyingToId === comment.id;

                // Group replies
                const replies = comments.filter(c => c.parentCommentId === comment.id);
                const isReply = !!comment.parentCommentId;

                // Don't render if this is a reply (will be rendered under parent)
                if (isReply) return null;

                return (
                  <div key={comment.id} className="space-y-2">
                    <div className="flex gap-2 sm:gap-3">
                      <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                        {comment.authorName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-slate-50 rounded-lg p-2.5 sm:p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-medium text-slate-900 text-sm">
                              {comment.authorName}
                              {comment.isAdminComment && (
                                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                  Admin
                                </span>
                              )}
                              {comment.edited && (
                                <span className="ml-2 text-xs text-slate-400">(edited)</span>
                              )}
                            </span>
                            <span className="text-xs text-slate-500 flex-shrink-0">
                              {getTimeAgo(comment.createdAt)}
                            </span>
                          </div>

                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows="2"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveEdit(comment.id)}
                                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                              {renderCommentWithMentions(comment.text)}
                            </p>
                          )}
                        </div>

                        {/* Comment Actions */}
                        {!isEditing && (
                          <div className="flex items-center gap-3 mt-1 ml-1">
                            <button
                              onClick={() => handleReplyToComment(comment)}
                              className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
                            >
                              <Reply className="w-3 h-3" />
                              Reply
                            </button>
                            {isOwnComment && (
                              <>
                                <button
                                  onClick={() => handleEditComment(comment)}
                                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Reply Form */}
                        {isReplying && (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows="2"
                              placeholder="Write a reply..."
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveReply(comment.id)}
                                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                              >
                                Reply
                              </button>
                              <button
                                onClick={handleCancelReply}
                                className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Nested Replies */}
                        {replies.length > 0 && (
                          <div className="mt-3 ml-4 space-y-2 border-l-2 border-slate-200 pl-3">
                            {replies.map((reply) => {
                              const isOwnReply = userData && userData.id === reply.authorId;
                              const isEditingReply = editingCommentId === reply.id;

                              return (
                                <div key={reply.id} className="flex gap-2">
                                  <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                    {reply.authorName?.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="bg-slate-100 rounded-lg p-2">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className="font-medium text-slate-900 text-xs">
                                          {reply.authorName}
                                          {reply.edited && (
                                            <span className="ml-1 text-xs text-slate-400">(edited)</span>
                                          )}
                                        </span>
                                        <span className="text-xs text-slate-500 flex-shrink-0">
                                          {getTimeAgo(reply.createdAt)}
                                        </span>
                                      </div>

                                      {isEditingReply ? (
                                        <div className="space-y-2">
                                          <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows="2"
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => handleSaveEdit(reply.id)}
                                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={handleCancelEdit}
                                              className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">
                                          {renderCommentWithMentions(reply.text)}
                                        </p>
                                      )}
                                    </div>

                                    {/* Reply Actions */}
                                    {!isEditingReply && isOwnReply && (
                                      <div className="flex items-center gap-3 mt-1 ml-1">
                                        <button
                                          onClick={() => handleEditComment(reply)}
                                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteComment(reply.id)}
                                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Add Comment */}
          <div className="mt-4 relative">
            <div className="flex gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {userData?.displayName?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 relative">
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={newComment}
                    onChange={handleTextChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.ctrlKey) {
                        handleAddComment();
                      }
                    }}
                    placeholder="Write a comment... (Use @ to mention someone)"
                    rows="2"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Mention Autocomplete Dropdown */}
                  {showMentions && mentionSuggestions.length > 0 && (
                    <div
                      className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto"
                      style={{
                        minWidth: "200px",
                      }}
                    >
                      {mentionSuggestions.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => insertMention(user)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left"
                        >
                          <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            {user.displayName?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {user.displayName}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              @{user.username}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      <AtSign className="w-3 h-3 inline" /> to mention
                    </span>
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
        </div>
      )}
    </>
  );
};

export default CommentsEnhanced;
