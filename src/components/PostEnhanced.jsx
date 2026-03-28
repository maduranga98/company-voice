import { useState, useEffect } from "react";
import {
  Flag,
  Pin,
  Archive,
  History,
  Eye,
  X,
  Download,
  FileText,
  Edit2,
  Trash2,
  MoreVertical,
  User,
  Bookmark,
} from "lucide-react";
import ReactionButton from "./ReactionButton";
import VotingButton from "./VotingButton";
import PollDisplay from "./PollDisplay";
import ReportContentModal from "./ReportContentModal";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  PostStatusConfig,
  PostPriorityConfig,
  PostType,
  ReportableContentType,
  UserRole,
} from "../utils/constants";
import { getEditHistory } from "../services/postEnhancedFeaturesService";
import { deletePost } from "../services/postManagementService";
import { subscribeToBookmark, toggleBookmark } from "../services/bookmarkService";
import { showSuccess, showError, showPromise } from "../services/toastService";
import CommentsEnhanced from "./CommentsEnhanced";
import EditPost from "./EditPost";

const PostEnhanced = ({ post }) => {
  const { t } = useTranslation();
  const { userData } = useAuth();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [editHistory, setEditHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    if (!userData?.id) return;
    const unsub = subscribeToBookmark(userData.id, post.id, setIsBookmarked);
    return () => unsub();
  }, [userData?.id, post.id]);

  const handleToggleBookmark = async () => {
    if (!userData?.id || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      const nowBookmarked = await toggleBookmark(userData.id, post.id, userData.companyId);
      setIsBookmarked(nowBookmarked);
    } catch {
      // silently ignore bookmark errors (e.g. rules not yet deployed)
    } finally {
      setBookmarkLoading(false);
    }
  };

  const isProblemReport = post.type === PostType.PROBLEM_REPORT;

  const isAuthor =
    userData &&
    (userData.id === post.authorId || userData.uid === post.authorId);
  const isAdmin =
    userData &&
    [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR].includes(userData.role);

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const postDate = timestamp?.toDate
      ? timestamp.toDate()
      : new Date(timestamp);
    const diffInSeconds = Math.floor((now - postDate) / 1000);

    if (diffInSeconds < 60) return t("time.justNow");
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return t("time.minutesAgo", { count: diffInMinutes });
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return t("time.hoursAgo", { count: diffInHours });
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return t("time.daysAgo", { count: diffInDays });
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return t("time.weeksAgo", { count: diffInWeeks });
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return t("time.monthsAgo", { count: diffInMonths });
    const diffInYears = Math.floor(diffInDays / 365);
    return t("time.yearsAgo", { count: diffInYears });
  };

  const handleShowEditHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await getEditHistory(post.id);
      setEditHistory(history);
      setShowEditHistory(true);
    } catch (error) {
      console.error("Error loading edit history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAttachmentClick = (attachment) => {
    if (attachment.type?.startsWith("image/")) {
      setSelectedAttachment(attachment);
      setShowAttachmentModal(true);
    } else {
      window.open(attachment.url, "_blank");
    }
  };

  const handleDeletePost = async () => {
    if (!isAuthor && !isAdmin) {
      showError(t("posts.errors.unauthorizedDelete") || "You can only delete your own posts");
      return;
    }
    setDeleting(true);
    setShowDeleteConfirm(false);
    try {
      await showPromise(deletePost(post.id, userData), {
        pending: t("posts.deleting") || "Deleting post...",
        success: t("posts.deleteSuccess") || "Post deleted successfully",
        error: t("posts.deleteError") || "Failed to delete post",
      });
      if (window.onPostDeleted) {
        window.onPostDeleted(post.id);
      } else {
        setTimeout(() => { window.location.reload(); }, 500);
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      showError(error.message || t("posts.deleteError") || "Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditPost = () => {
    if (!isAuthor) {
      showError(t("posts.errors.unauthorizedEdit") || "You can only edit your own posts");
      return;
    }
    setShowEditModal(true);
    setShowOptionsMenu(false);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    showSuccess(t("posts.editSuccess") || "Post updated successfully");
    setTimeout(() => { window.location.reload(); }, 500);
  };

  const CONTENT_LIMIT = 300;
  const content = post.description || post.content || "";
  const shouldTruncate = content.length > CONTENT_LIMIT;
  const displayContent =
    shouldTruncate && !isExpanded
      ? content.substring(0, CONTENT_LIMIT) + "..."
      : content;

  // Simplified status color - just a subtle dot
  const getStatusDotColor = () => {
    switch (post.status) {
      case "open": return "bg-gray-400";
      case "acknowledged": return "bg-blue-400";
      case "in_progress": return "bg-yellow-400";
      case "under_review": return "bg-purple-400";
      case "working_on": return "bg-indigo-400";
      case "resolved": return "bg-green-400";
      case "closed":
      case "not_a_problem": return "bg-slate-400";
      case "rejected": return "bg-red-400";
      default: return "bg-gray-400";
    }
  };

  const getStatusHighlight = () => {
    switch (post.status) {
      case "resolved": return "border-l-4 border-l-green-400 bg-green-50/40";
      case "closed": return "border-l-4 border-l-slate-400 bg-slate-50/40";
      case "rejected":
      case "not_a_problem": return "border-l-4 border-l-red-300 bg-red-50/30";
      default: return "";
    }
  };

  return (
    <>
      <article className={`bg-white rounded-2xl overflow-visible transition-all relative ${getStatusHighlight()}`}>
        {/* Pinned Banner */}
        {post.isPinned && (
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2 rounded-t-2xl">
            <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700">
              {t('postActions.pinnedPost')}
            </span>
          </div>
        )}

        {/* Archived Banner */}
        {post.isArchived && (
          <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex items-center gap-2 rounded-t-2xl">
            <Archive className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-600">
              Archived Post
            </span>
          </div>
        )}

        {/* Post Header - Simplified */}
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-9 h-9 bg-gradient-to-br from-[#2D3E50] to-[#1e3a4a] rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                {post.authorName?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900 text-sm truncate">
                    {post.authorName}
                  </h3>
                  {post.isFormerEmployee && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200 flex-shrink-0">
                      Former Employee
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 flex-shrink-0">
                    {getTimeAgo(post.createdAt)}
                  </span>
                  {post.editHistory && post.editHistory.length > 0 && (
                    <button
                      onClick={handleShowEditHistory}
                      disabled={loadingHistory}
                      className="flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-slate-600 transition flex-shrink-0"
                    >
                      <History className="w-3 h-3" />
                      <span className="hidden sm:inline">Edited</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-medium rounded-md">
                    {post.category}
                  </span>
                  {/* Compact status + priority for problem reports */}
                  {isProblemReport && post.status && PostStatusConfig[post.status] && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-50 text-gray-600">
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor()}`} />
                      {PostStatusConfig[post.status].label}
                    </span>
                  )}
                  {isProblemReport && post.priority && PostPriorityConfig[post.priority] && post.priority !== "medium" && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${PostPriorityConfig[post.priority].bgColor} ${PostPriorityConfig[post.priority].textColor}`}>
                      {PostPriorityConfig[post.priority].icon}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Edit/Delete Menu */}
            {(isAuthor || isAdmin) && !post.isArchived && (
              <div className="relative">
                <button
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                  className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-lg transition"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showOptionsMenu && (
                  <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                    {isAuthor && (
                      <button
                        onClick={handleEditPost}
                        className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        {t('postActions.editPost')}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowOptionsMenu(false);
                      }}
                      className="w-full px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('postActions.deletePost')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Assigned To - Compact */}
          {isProblemReport && post.assignedTo && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
              <User className="w-3 h-3" />
              <span>{t('postActions.assignedTo')} <span className="font-semibold">{post.assignedTo.name}</span></span>
            </div>
          )}
        </div>

        {/* Post Content */}
        <div className="px-4 sm:px-5 pb-4">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-2 break-words leading-snug">
            {post.title}
          </h2>
          <div className="text-sm text-slate-600 leading-relaxed break-words">
            <style>{`
              .post-content ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
              .post-content ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
              .post-content li { margin: 0.25rem 0; }
              .post-content li p { margin: 0; display: inline; }
              .post-content h2 { font-size: 1.25em; font-weight: 600; margin: 0.75rem 0 0.5rem 0; }
              .post-content h3 { font-size: 1.1em; font-weight: 600; margin: 0.5rem 0; }
              .post-content blockquote { border-left: 3px solid #e2e8f0; padding-left: 1rem; margin: 0.5rem 0; color: #64748b; }
              .post-content code { background-color: #f1f5f9; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.875em; }
              .post-content p { margin: 0.5rem 0; }
              .post-content strong { font-weight: 600; }
              .post-content em { font-style: italic; }
            `}</style>
            <div
              className="post-content"
              dangerouslySetInnerHTML={{ __html: displayContent }}
            />
            {shouldTruncate && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[#1ABC9C] hover:text-[#16a085] font-medium text-sm mt-1"
              >
                {isExpanded ? t('postActions.showLess') : t('postActions.readMore')}
              </button>
            )}
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {post.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 bg-gray-50 text-gray-400 text-[11px] font-medium rounded-md"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Poll Display */}
        {post.poll && post.poll.options && post.poll.options.length > 0 && (
          <div className="px-4 sm:px-5 pb-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h4 className="font-semibold text-blue-900 text-sm">Poll</h4>
              </div>
              <PollDisplay poll={post.poll} postId={post.id} />
            </div>
          </div>
        )}

        {/* Attachments */}
        {post.attachments && post.attachments.length > 0 && (
          <div className="px-4 sm:px-5 pb-4">
            {post.attachments.length === 1 ? (
              post.attachments[0].type?.startsWith("image/") ? (
                <div className="relative w-full h-48 sm:h-64 bg-slate-50 rounded-xl overflow-hidden group">
                  <img
                    src={post.attachments[0].url}
                    alt={post.title}
                    className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition"
                    onClick={() => handleAttachmentClick(post.attachments[0])}
                  />
                  <button
                    onClick={() => handleAttachmentClick(post.attachments[0])}
                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <a
                  href={post.attachments[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition group"
                >
                  <div className="p-2 bg-slate-200 rounded-lg">
                    <FileText className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{post.attachments[0].name}</p>
                    <p className="text-xs text-slate-500">Click to view</p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
                </a>
              )
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {post.attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="relative h-28 sm:h-36 bg-slate-50 rounded-xl overflow-hidden group cursor-pointer"
                    onClick={() => handleAttachmentClick(attachment)}
                  >
                    {attachment.type?.startsWith("image/") ? (
                      <>
                        <img
                          src={attachment.url}
                          alt={`${post.title} ${index + 1}`}
                          className="w-full h-full object-cover hover:opacity-90 transition"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full bg-slate-50 hover:bg-slate-100 transition p-2">
                        <FileText className="w-7 h-7 text-slate-400 mb-1.5" />
                        <p className="text-[10px] text-slate-500 text-center truncate max-w-full px-2">
                          {attachment.name}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Post Actions & Comments */}
        <CommentsEnhanced
          postId={post.id}
          initialCommentCount={post.comments || 0}
          postAuthorId={post.authorId}
          postAuthorName={post.authorName}
          postTitle={post.title}
          reactionButton={
            <>
              <VotingButton
                postId={post.id}
                initialUpvotes={post.upvotes || []}
                initialDownvotes={post.downvotes || []}
              />
              <div className="h-5 w-px bg-slate-200 mx-1.5" />
              <ReactionButton
                postId={post.id}
                initialReactions={post.reactions || {}}
                postAuthorId={post.authorId}
                postAuthorName={post.authorName}
                postTitle={post.title}
              />
            </>
          }
          reportButton={
            <div className="ml-auto flex items-center gap-1">
              {userData && (
                <button
                  onClick={handleToggleBookmark}
                  disabled={bookmarkLoading}
                  className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg transition-colors text-sm ${
                    isBookmarked
                      ? "text-[#1ABC9C] bg-teal-50 hover:bg-teal-100"
                      : "text-gray-400 hover:text-[#1ABC9C] hover:bg-teal-50"
                  } disabled:opacity-50`}
                  title={isBookmarked ? "Remove bookmark" : "Bookmark this post"}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? "fill-current" : ""}`} />
                  <span className="hidden sm:inline text-xs">{isBookmarked ? "Saved" : "Save"}</span>
                </button>
              )}
              {userData && userData.id !== post.authorId && (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm"
                  title="Report this post"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs">Report</span>
                </button>
              )}
            </div>
          }
        />
      </article>

      {/* Report Modal */}
      {showReportModal && userData?.companyId && (
        <ReportContentModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          contentType={ReportableContentType.POST}
          contentId={post.id}
          companyId={userData.companyId}
        />
      )}

      {/* Edit History Modal */}
      {showEditHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Edit History</h3>
              <button
                onClick={() => setShowEditHistory(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {editHistory.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No edit history available</p>
              ) : (
                <div className="space-y-3">
                  {editHistory.map((entry, index) => (
                    <div key={index} className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-900 text-sm">{entry.editedByName}</span>
                        <span className="text-xs text-slate-500">
                          {entry.timestamp?.toDate?.()?.toLocaleString() || "Unknown time"}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        <strong>Changed:</strong> {Object.keys(entry.changes).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {showAttachmentModal && selectedAttachment && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[9999]"
          onClick={() => setShowAttachmentModal(false)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={() => setShowAttachmentModal(false)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedAttachment.url}
              alt={selectedAttachment.name}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <a
              href={selectedAttachment.url}
              download
              className="absolute bottom-4 right-4 p-3 bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Download</span>
            </a>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                {t('postActions.deletePost')}
              </h3>
              <p className="text-sm text-slate-500">
                {t('postActions.confirmDelete')}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-2.5 text-slate-700 hover:bg-slate-50 rounded-xl transition text-sm font-medium border border-slate-200 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeletePost}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  t('common.delete')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {showEditModal && (
        <EditPost
          post={post}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
};

export default PostEnhanced;
