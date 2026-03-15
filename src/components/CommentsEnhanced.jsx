import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
import { MessageCircle, Send, AtSign, X, Edit2, Trash2, Reply, Flag, ShieldCheck } from "lucide-react";
import {
  searchUsersForMention,
  parseMentions,
  createMentionNotifications,
  highlightMentions,
} from "../services/mentionsService";
import ReportContentModal from "./ReportContentModal";
import { ReportableContentType } from "../utils/constants";

const CommentsEnhanced = ({
  postId,
  initialCommentCount,
  postAuthorId,
  postAuthorName,
  postTitle,
  reactionButton,
  reportButton,
}) => {
  const { t } = useTranslation();
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

  // Report comment state
  const [reportingCommentId, setReportingCommentId] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

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
            className="font-semibold hover:underline cursor-pointer"
            style={{ color: "#1ABC9C" }}
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
    <div className="w-full">
      {/* Action Bar */}
      <div className="px-3 sm:px-5 py-2.5 sm:py-3 flex items-center gap-1.5 bg-white">
        {reactionButton}
        {/* Comment Button */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-sm"
          style={{
            color: showComments ? "#1ABC9C" : "#64748b",
            backgroundColor: showComments ? "rgba(26, 188, 156, 0.08)" : "transparent",
          }}
          onMouseEnter={(e) => {
            if (!showComments) {
              e.currentTarget.style.backgroundColor = "rgba(26, 188, 156, 0.06)";
              e.currentTarget.style.color = "#1ABC9C";
            }
          }}
          onMouseLeave={(e) => {
            if (!showComments) {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#64748b";
            }
          }}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{commentCount}</span>
          <span className="hidden sm:inline">
            {commentCount === 1 ? "Comment" : "Comments"}
          </span>
        </button>
        {reportButton}
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="w-full px-3 sm:px-5 pb-5 pt-3 border-t border-slate-100 bg-white overflow-hidden">
          {/* Close Button */}
          <div className="flex justify-end mb-1">
            <button
              onClick={() => setShowComments(false)}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl p-1.5 transition-all duration-200"
              title="Close comments"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Comments List */}
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500">
                  {commentCount > 0 ? "Loading comments..." : "No comments yet. Be the first to comment!"}
                </p>
              </div>
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
                    <div className="flex gap-2.5 sm:gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: "#2D3E50" }}
                      >
                        {comment.authorName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-slate-50/80 rounded-2xl p-3 sm:p-3.5 border border-slate-100/80">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="font-semibold text-sm" style={{ color: "#2D3E50" }}>
                              {comment.authorName}
                              {comment.isAdminComment && (
                                <span
                                  className="ml-2 px-2 py-0.5 text-xs rounded-lg font-medium inline-flex items-center gap-1"
                                  style={{ backgroundColor: "rgba(26, 188, 156, 0.12)", color: "#1ABC9C" }}
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  Admin
                                </span>
                              )}
                              {comment.edited && (
                                <span className="ml-2 text-xs text-slate-400 font-normal">(edited)</span>
                              )}
                            </span>
                            <span className="text-xs text-slate-400 flex-shrink-0 font-medium">
                              {getTimeAgo(comment.createdAt)}
                            </span>
                          </div>

                          {isEditing ? (
                            <div className="space-y-2.5">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                                style={{ focusRingColor: "#1ABC9C" }}
                                onFocus={(e) => e.target.style.boxShadow = "0 0 0 2px rgba(26, 188, 156, 0.25)"}
                                onBlur={(e) => e.target.style.boxShadow = "none"}
                                rows="2"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveEdit(comment.id)}
                                  className="px-3 py-1.5 text-white text-xs font-medium rounded-xl transition-all duration-200 hover:opacity-90 shadow-sm"
                                  style={{ backgroundColor: "#1ABC9C" }}
                                >
                                  {t('comments.saveEdit')}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-200 transition-all duration-200"
                                >
                                  {t('comments.cancelEdit')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                              {renderCommentWithMentions(comment.text)}
                            </p>
                          )}
                        </div>

                        {/* Comment Actions */}
                        {!isEditing && (
                          <div className="flex items-center gap-1 mt-1.5 ml-1">
                            <button
                              onClick={() => handleReplyToComment(comment)}
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#1ABC9C] px-2 py-1 rounded-lg transition-all duration-200 hover:bg-[rgba(26,188,156,0.06)]"
                            >
                              <Reply className="w-3 h-3" />
                              {t('comments.reply')}
                            </button>
                            {isOwnComment ? (
                              <>
                                <button
                                  onClick={() => handleEditComment(comment)}
                                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#1ABC9C] px-2 py-1 rounded-lg transition-all duration-200 hover:bg-[rgba(26,188,156,0.06)]"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  {t('common.edit')}
                                </button>
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded-lg transition-all duration-200 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  {t('common.delete')}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setReportingCommentId(comment.id);
                                  setShowReportModal(true);
                                }}
                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded-lg transition-all duration-200 hover:bg-red-50"
                              >
                                <Flag className="w-3 h-3" />
                                {t('comments.reportComment')}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Reply Form */}
                        {isReplying && (
                          <div className="mt-3 space-y-2.5">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none transition-shadow"
                              onFocus={(e) => e.target.style.boxShadow = "0 0 0 2px rgba(26, 188, 156, 0.25)"}
                              onBlur={(e) => e.target.style.boxShadow = "none"}
                              rows="2"
                              placeholder={t('comments.addReply')}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveReply(comment.id)}
                                className="px-3 py-1.5 text-white text-xs font-medium rounded-xl transition-all duration-200 hover:opacity-90 shadow-sm"
                                style={{ backgroundColor: "#1ABC9C" }}
                              >
                                {t('comments.reply')}
                              </button>
                              <button
                                onClick={handleCancelReply}
                                className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-200 transition-all duration-200"
                              >
                                {t('common.cancel')}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Nested Replies */}
                        {replies.length > 0 && (
                          <div className="mt-3 ml-4 space-y-2.5 border-l-2 pl-3" style={{ borderColor: "rgba(26, 188, 156, 0.2)" }}>
                            {replies.map((reply) => {
                              const isOwnReply = userData && userData.id === reply.authorId;
                              const isEditingReply = editingCommentId === reply.id;

                              return (
                                <div key={reply.id} className="flex gap-2">
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                                    style={{ backgroundColor: "#3d5166" }}
                                  >
                                    {reply.authorName?.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="bg-slate-50/60 rounded-2xl p-2.5 border border-slate-100/60">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className="font-semibold text-xs" style={{ color: "#2D3E50" }}>
                                          {reply.authorName}
                                          {reply.edited && (
                                            <span className="ml-1 text-xs text-slate-400 font-normal">(edited)</span>
                                          )}
                                        </span>
                                        <span className="text-xs text-slate-400 flex-shrink-0">
                                          {getTimeAgo(reply.createdAt)}
                                        </span>
                                      </div>

                                      {isEditingReply ? (
                                        <div className="space-y-2">
                                          <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs resize-none focus:outline-none transition-shadow"
                                            onFocus={(e) => e.target.style.boxShadow = "0 0 0 2px rgba(26, 188, 156, 0.25)"}
                                            onBlur={(e) => e.target.style.boxShadow = "none"}
                                            rows="2"
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => handleSaveEdit(reply.id)}
                                              className="px-2.5 py-1 text-white text-xs font-medium rounded-xl transition-all duration-200 hover:opacity-90"
                                              style={{ backgroundColor: "#1ABC9C" }}
                                            >
                                              {t('comments.saveEdit')}
                                            </button>
                                            <button
                                              onClick={handleCancelEdit}
                                              className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-200 transition-all duration-200"
                                            >
                                              {t('comments.cancelEdit')}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                                          {renderCommentWithMentions(reply.text)}
                                        </p>
                                      )}
                                    </div>

                                    {/* Reply Actions */}
                                    {!isEditingReply && (
                                      <div className="flex items-center gap-1 mt-1 ml-1">
                                        {isOwnReply ? (
                                          <>
                                            <button
                                              onClick={() => handleEditComment(reply)}
                                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#1ABC9C] px-2 py-0.5 rounded-lg transition-all duration-200 hover:bg-[rgba(26,188,156,0.06)]"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                              {t('common.edit')}
                                            </button>
                                            <button
                                              onClick={() => handleDeleteComment(reply.id)}
                                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 px-2 py-0.5 rounded-lg transition-all duration-200 hover:bg-red-50"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                              {t('common.delete')}
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              setReportingCommentId(reply.id);
                                              setShowReportModal(true);
                                            }}
                                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 px-2 py-0.5 rounded-lg transition-all duration-200 hover:bg-red-50"
                                          >
                                            <Flag className="w-3 h-3" />
                                            {t('comments.reportComment')}
                                          </button>
                                        )}
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
            <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 flex items-center gap-2">
              <span className="text-red-400">!</span>
              {error}
            </div>
          )}

          {/* Add Comment */}
          <div className="mt-5 relative">
            <div className="flex gap-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-sm"
                style={{ backgroundColor: "#2D3E50" }}
              >
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
                    className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-sm resize-none focus:outline-none focus:bg-white transition-all duration-200"
                    style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
                    onFocus={(e) => {
                      e.target.style.boxShadow = "0 0 0 2px rgba(26, 188, 156, 0.2), 0 1px 2px rgba(0,0,0,0.04)";
                      e.target.style.borderColor = "rgba(26, 188, 156, 0.4)";
                    }}
                    onBlur={(e) => {
                      e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
                      e.target.style.borderColor = "";
                    }}
                  />

                  {/* Mention Autocomplete Dropdown */}
                  {showMentions && mentionSuggestions.length > 0 && (
                    <div
                      className="absolute z-50 bg-white border border-slate-200/80 rounded-2xl shadow-lg mt-1.5 max-h-48 overflow-y-auto"
                      style={{
                        minWidth: "220px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)",
                      }}
                    >
                      {mentionSuggestions.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => insertMention(user)}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 text-left first:rounded-t-2xl last:rounded-b-2xl transition-colors duration-150"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                            style={{ backgroundColor: "#2D3E50" }}
                          >
                            {user.displayName?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate" style={{ color: "#2D3E50" }}>
                              {user.displayName}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              @{user.username}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2.5">
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-[#1ABC9C]"
                    />
                    <span className="group-hover:text-slate-700 transition-colors">{t('comments.anonymous')}</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 hidden sm:flex items-center gap-1">
                      <AtSign className="w-3 h-3" /> to mention
                    </span>
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || loading}
                      className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                      style={{ backgroundColor: "#1ABC9C" }}
                      onMouseEnter={(e) => {
                        if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "#17a68a";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#1ABC9C";
                      }}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Comment Modal */}
      {showReportModal && reportingCommentId && userData?.companyId && (
        <ReportContentModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportingCommentId(null);
          }}
          contentType={ReportableContentType.COMMENT}
          contentId={reportingCommentId}
          companyId={userData.companyId}
        />
      )}
    </div>
  );
};

export default CommentsEnhanced;
