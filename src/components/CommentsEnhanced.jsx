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
import { MessageCircle, Send, AtSign, X, Edit2, Trash2, Reply, Flag, ShieldCheck, CornerDownRight } from "lucide-react";
import {
  searchUsersForMention,
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

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState("");
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState("");

  const [showMentions, setShowMentions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [cursorPosition, setCursorPosition] = useState(0);

  const [reportingCommentId, setReportingCommentId] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const textareaRef = useRef(null);

  useEffect(() => {
    if (!showComments || !postId || !userData?.companyId) return;
    const commentsRef = collection(db, "comments");
    const q = query(commentsRef, where("postId", "==", postId), where("companyId", "==", userData.companyId), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const fetchedComments = [];
        snapshot.forEach((doc) => { fetchedComments.push({ id: doc.id, ...doc.data() }); });
        setComments(fetchedComments);
        setCommentCount(fetchedComments.length);
      },
      (error) => {
        console.error("Error fetching comments:", error);
        setError("Failed to load comments.");
      }
    );
    return () => unsubscribe();
  }, [postId, showComments, userData?.companyId]);

  const handleTextChange = async (e) => {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;
    setNewComment(text);
    setCursorPosition(cursorPos);

    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      if (!textAfterAt.includes(" ") && textAfterAt.length <= 20) {
        setShowMentions(true);
        if (userData?.companyId) {
          const users = await searchUsersForMention(textAfterAt, userData.companyId, 5);
          setMentionSuggestions(users);
        }
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const textAfterCursor = newComment.substring(cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");
    const newText = textBeforeCursor.substring(0, lastAtSymbol) + `@${user.username} ` + textAfterCursor;
    setNewComment(newText);
    setShowMentions(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      if (!userData?.id) throw new Error("Please log in to comment");
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
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, { comments: increment(1), updatedAt: serverTimestamp() });
      await createMentionNotifications(newComment, userData.companyId, {
        postId, postTitle,
        authorId: userData.id,
        authorName: isAnonymous ? "Anonymous" : userData.displayName,
        commentId: null,
      });
      setNewComment("");
      setIsAnonymous(false);
    } catch (error) {
      console.error("Error adding comment:", error);
      setError("Failed to add comment.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditText(comment.text);
  };

  const handleSaveEdit = async (commentId) => {
    if (!editText.trim()) return;
    try {
      const commentRef = doc(db, "comments", commentId);
      await updateDoc(commentRef, { text: editText.trim(), edited: true, editedAt: serverTimestamp() });
      setEditingCommentId(null);
      setEditText("");
    } catch (error) {
      setError("Failed to edit comment.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await deleteDoc(doc(db, "comments", commentId));
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, { comments: increment(-1) });

      // Notify post author about comment deletion (if not self)
      if (postAuthorId && userData?.id !== postAuthorId && userData?.companyId) {
        try {
          await addDoc(collection(db, "notifications"), {
            userId: postAuthorId,
            type: "comment",
            title: t("notifications.commentDeleted", "Comment deleted"),
            message: t("notifications.commentDeletedMessage", "A comment was removed from your post."),
            postId,
            companyId: userData.companyId,
            read: false,
            createdAt: serverTimestamp(),
          });
        } catch (notifErr) {
          // Don't fail the delete if notification fails
          console.error("Error creating comment delete notification:", notifErr);
        }
      }
    } catch (error) {
      setError("Failed to delete comment.");
    }
  };

  const handleReplyToComment = (comment) => {
    setReplyingToId(comment.id);
    setReplyText(`@${comment.authorName} `);
  };

  const handleSaveReply = async (parentCommentId) => {
    if (!replyText.trim()) return;
    try {
      await addDoc(collection(db, "comments"), {
        postId,
        text: replyText.trim(),
        authorId: userData.id,
        authorName: userData.displayName,
        authorRole: userData.role,
        parentCommentId,
        isAnonymous: false,
        companyId: userData.companyId,
        createdAt: serverTimestamp(),
      });
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, { comments: increment(1) });
      setReplyingToId(null);
      setReplyText("");
    } catch (error) {
      setError("Failed to add reply.");
    }
  };

  const renderMentions = (text) => {
    const segments = highlightMentions(text);
    return segments.map((segment, index) => {
      if (segment.isMention) {
        return <span key={index} className="font-semibold text-[#1ABC9C] hover:underline cursor-pointer">{segment.text}</span>;
      }
      return <span key={index}>{segment.text}</span>;
    });
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    const now = new Date();
    const postDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffInSeconds = Math.floor((now - postDate) / 1000);
    if (diffInSeconds < 60) return "now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return postDate.toLocaleDateString();
  };

  // Group comments: top-level and replies
  const topLevelComments = comments.filter(c => !c.parentCommentId);
  const getReplies = (commentId) => comments.filter(c => c.parentCommentId === commentId);

  return (
    <div className="w-full">
      {/* Action Bar */}
      <div className="px-4 sm:px-5 py-2 flex items-center gap-1 border-t border-gray-50">
        {reactionButton}

        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
            showComments ? "text-[#1ABC9C] bg-[#1ABC9C]/8" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{commentCount}</span>
        </button>

        {reportButton}
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="px-4 sm:px-5 pb-4 pt-2 border-t border-gray-100">
          {/* Comments List */}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {topLevelComments.length === 0 ? (
              <div className="text-center py-6">
                <MessageCircle className="w-6 h-6 mx-auto mb-1.5 text-gray-300" />
                <p className="text-xs text-gray-400">No comments yet</p>
              </div>
            ) : (
              topLevelComments.map((comment) => {
                const isOwn = userData && userData.id === comment.authorId;
                const isEditing = editingCommentId === comment.id;
                const isReplying = replyingToId === comment.id;
                const replies = getReplies(comment.id);

                return (
                  <div key={comment.id}>
                    {/* Comment */}
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2D3E50] to-[#1e3a4a] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {comment.authorName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-gray-50 rounded-2xl rounded-tl-md px-3 py-2">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-gray-900">
                              {comment.authorName}
                            </span>
                            {comment.isAdminComment && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#1ABC9C]/10 text-[#1ABC9C] text-[10px] font-semibold rounded-md">
                                <ShieldCheck className="w-2.5 h-2.5" />
                                Admin
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400">{getTimeAgo(comment.createdAt)}</span>
                            {comment.edited && <span className="text-[10px] text-gray-400 italic">edited</span>}
                          </div>

                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#1ABC9C]/30"
                                rows="2"
                              />
                              <div className="flex gap-1.5">
                                <button onClick={() => handleSaveEdit(comment.id)} className="px-2.5 py-1 bg-[#1ABC9C] text-white text-xs font-medium rounded-lg hover:opacity-90">Save</button>
                                <button onClick={() => { setEditingCommentId(null); setEditText(""); }} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                              {renderMentions(comment.text)}
                            </p>
                          )}
                        </div>

                        {/* Comment Actions */}
                        {!isEditing && (
                          <div className="flex items-center gap-0.5 mt-1 ml-1">
                            <button
                              onClick={() => handleReplyToComment(comment)}
                              className="text-[11px] text-gray-400 hover:text-[#1ABC9C] px-1.5 py-0.5 rounded-md transition"
                            >
                              Reply
                            </button>
                            {isOwn ? (
                              <>
                                <span className="text-gray-200">|</span>
                                <button onClick={() => handleEditComment(comment)} className="text-[11px] text-gray-400 hover:text-[#1ABC9C] px-1.5 py-0.5 rounded-md transition">Edit</button>
                                <span className="text-gray-200">|</span>
                                <button onClick={() => handleDeleteComment(comment.id)} className="text-[11px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded-md transition">Delete</button>
                              </>
                            ) : (
                              <>
                                <span className="text-gray-200">|</span>
                                <button
                                  onClick={() => { setReportingCommentId(comment.id); setShowReportModal(true); }}
                                  className="text-[11px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded-md transition"
                                >
                                  Report
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Reply Form */}
                        {isReplying && (
                          <div className="mt-2 flex gap-2 items-start">
                            <CornerDownRight className="w-3.5 h-3.5 text-gray-300 mt-2 flex-shrink-0" />
                            <div className="flex-1">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#1ABC9C]/30 focus:bg-white"
                                rows="2"
                                placeholder={t('comments.addReply')}
                              />
                              <div className="flex gap-1.5 mt-1.5">
                                <button onClick={() => handleSaveReply(comment.id)} className="px-3 py-1 bg-[#1ABC9C] text-white text-xs font-medium rounded-lg hover:opacity-90">Reply</button>
                                <button onClick={() => { setReplyingToId(null); setReplyText(""); }} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200">Cancel</button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Replies */}
                        {replies.length > 0 && (
                          <div className="mt-2 space-y-2 ml-2 pl-3 border-l-2 border-[#1ABC9C]/15">
                            {replies.map((reply) => {
                              const isOwnReply = userData && userData.id === reply.authorId;
                              const isEditingReply = editingCommentId === reply.id;

                              return (
                                <div key={reply.id} className="flex gap-2">
                                  <div className="w-6 h-6 rounded-full bg-[#3d5166] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                                    {reply.authorName?.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="bg-gray-50/80 rounded-xl rounded-tl-md px-2.5 py-1.5">
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-[11px] font-semibold text-gray-900">{reply.authorName}</span>
                                        <span className="text-[10px] text-gray-400">{getTimeAgo(reply.createdAt)}</span>
                                        {reply.edited && <span className="text-[10px] text-gray-400 italic">edited</span>}
                                      </div>
                                      {isEditingReply ? (
                                        <div className="space-y-1.5">
                                          <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[#1ABC9C]/30" rows="2" />
                                          <div className="flex gap-1">
                                            <button onClick={() => handleSaveEdit(reply.id)} className="px-2 py-0.5 bg-[#1ABC9C] text-white text-[10px] font-medium rounded-md">Save</button>
                                            <button onClick={() => { setEditingCommentId(null); setEditText(""); }} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded-md">Cancel</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-gray-700 whitespace-pre-wrap break-words">{renderMentions(reply.text)}</p>
                                      )}
                                    </div>
                                    {!isEditingReply && (
                                      <div className="flex items-center gap-0.5 mt-0.5 ml-1">
                                        {isOwnReply ? (
                                          <>
                                            <button onClick={() => handleEditComment(reply)} className="text-[10px] text-gray-400 hover:text-[#1ABC9C] px-1 py-0.5 rounded transition">Edit</button>
                                            <span className="text-gray-200">|</span>
                                            <button onClick={() => handleDeleteComment(reply.id)} className="text-[10px] text-gray-400 hover:text-red-500 px-1 py-0.5 rounded transition">Delete</button>
                                          </>
                                        ) : (
                                          <button
                                            onClick={() => { setReportingCommentId(reply.id); setShowReportModal(true); }}
                                            className="text-[10px] text-gray-400 hover:text-red-500 px-1 py-0.5 rounded transition"
                                          >
                                            Report
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

          {error && (
            <div className="mt-2 p-2 bg-red-50 rounded-xl text-xs text-red-600">{error}</div>
          )}

          {/* Add Comment */}
          <div className="mt-3 relative">
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2D3E50] to-[#1e3a4a] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-1">
                {userData?.displayName?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={newComment}
                    onChange={handleTextChange}
                    onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleAddComment(); }}
                    placeholder="Write a comment..."
                    rows="2"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#1ABC9C]/30 focus:bg-white focus:border-[#1ABC9C]/30 transition-all placeholder-gray-400"
                  />

                  {/* Mention Dropdown */}
                  {showMentions && mentionSuggestions.length > 0 && (
                    <div className="absolute z-50 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-40 overflow-y-auto min-w-[200px]">
                      {mentionSuggestions.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => insertMention(user)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left first:rounded-t-xl last:rounded-b-xl transition"
                        >
                          <div className="w-6 h-6 rounded-full bg-[#2D3E50] flex items-center justify-center text-white text-[9px] font-bold">
                            {user.displayName?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-900">{user.displayName}</div>
                            <div className="text-[10px] text-gray-400">@{user.username}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <div className={`w-7 h-4 rounded-full transition-colors relative ${isAnonymous ? 'bg-[#1ABC9C]' : 'bg-gray-200'}`}>
                        <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="sr-only" />
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isAnonymous ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-[10px] text-gray-400 group-hover:text-gray-600">{t('comments.anonymous')}</span>
                    </label>
                    <span className="text-[10px] text-gray-300 hidden sm:flex items-center gap-0.5">
                      <AtSign className="w-2.5 h-2.5" /> mention
                    </span>
                  </div>
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || loading}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#1ABC9C] text-white text-xs font-medium rounded-lg hover:bg-[#17a68a] transition disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* Report Modal */}
      {showReportModal && reportingCommentId && userData?.companyId && (
        <ReportContentModal
          isOpen={showReportModal}
          onClose={() => { setShowReportModal(false); setReportingCommentId(null); }}
          contentType={ReportableContentType.COMMENT}
          contentId={reportingCommentId}
          companyId={userData.companyId}
        />
      )}
    </div>
  );
};

export default CommentsEnhanced;
