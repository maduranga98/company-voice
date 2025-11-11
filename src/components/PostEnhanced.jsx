import { useState } from "react";
import { Flag, Pin, Archive, History, Eye, X, Download, FileText, Image as ImageIcon } from "lucide-react";
import ReactionButton from "./ReactionButton";
import CommentsEnhanced from "./CommentsEnhanced";
import ReportContentModal from "./ReportContentModal";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  PostStatusConfig,
  PostPriorityConfig,
  PostType,
  ReportableContentType,
} from "../utils/constants";
import { getEditHistory } from "../services/postEnhancedFeaturesService";

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

  // Check if this is a problem report to show status/priority
  const isProblemReport = post.type === PostType.PROBLEM_REPORT;

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const postDate = timestamp?.toDate
      ? timestamp.toDate()
      : new Date(timestamp);
    const diffInSeconds = Math.floor((now - postDate) / 1000);

    if (diffInSeconds < 60) {
      return t("time.justNow");
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return t("time.minutesAgo", { count: diffInMinutes });
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return t("time.hoursAgo", { count: diffInHours });
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return t("time.daysAgo", { count: diffInDays });
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return t("time.weeksAgo", { count: diffInWeeks });
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return t("time.monthsAgo", { count: diffInMonths });
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return t("time.yearsAgo", { count: diffInYears });
  };

  // Load edit history
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

  // Open attachment preview
  const handleAttachmentClick = (attachment) => {
    if (attachment.type?.startsWith("image/")) {
      setSelectedAttachment(attachment);
      setShowAttachmentModal(true);
    } else {
      window.open(attachment.url, "_blank");
    }
  };

  // Content length limit for "Read More"
  const CONTENT_LIMIT = 300;
  const content = post.description || post.content || "";
  const shouldTruncate = content.length > CONTENT_LIMIT;
  const displayContent =
    shouldTruncate && !isExpanded
      ? content.substring(0, CONTENT_LIMIT) + "..."
      : content;

  // Get dynamic styling based on status and priority
  const getPostStyling = () => {
    if (!isProblemReport) {
      return {
        border: "border-slate-200 hover:border-slate-300",
        bg: "bg-white",
        leftBorder: "",
      };
    }

    // For problem reports, apply color coding
    let styling = {
      border: "border-slate-200",
      bg: "bg-white",
      leftBorder: "border-l-4",
    };

    // Priority-based colors (overridden by status colors)
    if (post.priority === "critical") {
      styling.border = "border-red-300 hover:border-red-400";
      styling.leftBorder += " border-l-red-500";
      styling.bg = "bg-red-50";
    } else if (post.priority === "high") {
      styling.border = "border-orange-200 hover:border-orange-300";
      styling.leftBorder += " border-l-orange-500";
      styling.bg = "bg-orange-50";
    }

    // Status-based colors (take precedence)
    switch (post.status) {
      case "open":
        styling.border = "border-gray-300 hover:border-gray-400";
        styling.leftBorder += " border-l-gray-400";
        break;
      case "acknowledged":
        styling.border = "border-blue-200 hover:border-blue-300";
        styling.leftBorder += " border-l-blue-500";
        styling.bg = "bg-blue-50";
        break;
      case "in_progress":
        styling.border = "border-yellow-200 hover:border-yellow-300";
        styling.leftBorder += " border-l-yellow-500";
        styling.bg = "bg-yellow-50";
        break;
      case "under_review":
        styling.border = "border-purple-200 hover:border-purple-300";
        styling.leftBorder += " border-l-purple-500";
        styling.bg = "bg-purple-50";
        break;
      case "working_on":
        styling.border = "border-indigo-200 hover:border-indigo-300";
        styling.leftBorder += " border-l-indigo-500";
        styling.bg = "bg-indigo-50";
        break;
      case "resolved":
        styling.border = "border-green-200 hover:border-green-300";
        styling.leftBorder += " border-l-green-500";
        styling.bg = "bg-green-50";
        break;
      case "closed":
      case "not_a_problem":
        styling.border = "border-slate-300 hover:border-slate-400";
        styling.leftBorder += " border-l-slate-400";
        styling.bg = "bg-slate-50";
        break;
      case "rejected":
        styling.border = "border-red-200 hover:border-red-300";
        styling.leftBorder += " border-l-red-500";
        styling.bg = "bg-red-50";
        break;
      default:
        break;
    }

    return styling;
  };

  const styling = getPostStyling();

  return (
    <>
      <article
        className={`${styling.bg} rounded-lg border ${styling.border} ${styling.leftBorder} overflow-visible transition relative`}
      >
        {/* Pinned Banner */}
        {post.isPinned && (
          <div className="bg-purple-100 border-b border-purple-200 px-3 sm:px-4 py-2 flex items-center gap-2">
            <Pin className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-purple-900">
              Pinned Post
            </span>
          </div>
        )}

        {/* Archived Banner */}
        {post.isArchived && (
          <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-4 py-2 flex items-center gap-2">
            <Archive className="w-4 h-4 text-slate-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-slate-700">
              Archived Post
            </span>
          </div>
        )}

        {/* Post Header */}
        <div className="p-3 sm:p-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-medium text-xs sm:text-sm flex-shrink-0">
                {post.authorName?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-slate-900 text-sm sm:text-base truncate">
                  {post.authorName}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-slate-500">
                    {getTimeAgo(post.createdAt)}
                  </p>
                  {post.editHistory && post.editHistory.length > 0 && (
                    <button
                      onClick={handleShowEditHistory}
                      disabled={loadingHistory}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition"
                    >
                      <History className="w-3 h-3" />
                      <span className="hidden sm:inline">Edited</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <span className="px-2 sm:px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full whitespace-nowrap flex-shrink-0">
                {post.category}
              </span>

              {/* Status & Priority Badges for Problem Reports */}
              {isProblemReport && (
                <div className="flex gap-1 flex-wrap justify-end">
                  {post.status && PostStatusConfig[post.status] && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        PostStatusConfig[post.status].bgColor
                      } ${PostStatusConfig[post.status].textColor}`}
                    >
                      {PostStatusConfig[post.status].label}
                    </span>
                  )}
                  {post.priority && PostPriorityConfig[post.priority] && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        PostPriorityConfig[post.priority].bgColor
                      } ${PostPriorityConfig[post.priority].textColor}`}
                    >
                      {PostPriorityConfig[post.priority].icon}
                      <span className="ml-1 hidden sm:inline">
                        {PostPriorityConfig[post.priority].label}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Assigned To Info for Problem Reports */}
          {isProblemReport && post.assignedTo && (
            <div className="mt-2 flex items-center text-xs text-slate-600 bg-blue-50 px-2 py-1 rounded">
              <svg
                className="w-3 h-3 mr-1 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="truncate">
                Assigned to: <span className="font-medium">{post.assignedTo.name}</span>
              </span>
            </div>
          )}
        </div>

        {/* Post Content */}
        <div className="p-3 sm:p-4">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-slate-900 mb-2 break-words">
            {post.title}
          </h2>
          <div className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
            {displayContent}
            {shouldTruncate && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-2 text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
              >
                {isExpanded ? (
                  <>
                    Show less
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </>
                ) : (
                  <>
                    Read more
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
              {post.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 sm:py-1 bg-slate-50 text-slate-600 text-xs rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Post Attachments with Enhanced Preview */}
        {post.attachments && post.attachments.length > 0 && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            {post.attachments.length === 1 ? (
              post.attachments[0].type?.startsWith("image/") ? (
                <div className="relative w-full h-48 sm:h-64 md:h-80 bg-slate-100 rounded-lg overflow-hidden group">
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
                  className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition group"
                >
                  <div className="p-2 bg-slate-200 rounded-lg">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                      {post.attachments[0].name}
                    </p>
                    <p className="text-xs text-slate-500">Click to view</p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
                </a>
              )
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {post.attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="relative h-32 sm:h-40 bg-slate-100 rounded-lg overflow-hidden group cursor-pointer"
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
                          <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full bg-slate-50 hover:bg-slate-100 transition p-2">
                        <FileText className="w-8 h-8 text-slate-400 mb-2" />
                        <p className="text-xs text-slate-600 text-center truncate max-w-full px-2">
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
        <div className="border-t border-slate-100">
          {/* Action Bar */}
          <div className="px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-1 bg-white flex-wrap sm:flex-nowrap">
            <ReactionButton
              postId={post.id}
              initialReactions={post.reactions || {}}
              postAuthorId={post.authorId}
              postAuthorName={post.authorName}
              postTitle={post.title}
            />
            <CommentsEnhanced
              postId={post.id}
              initialCommentCount={post.comments || 0}
              postAuthorId={post.authorId}
              postAuthorName={post.authorName}
              postTitle={post.title}
            />

            {/* Report Button - Only show if not the author */}
            {userData && userData.uid !== post.authorId && !post.isRemoved && (
              <button
                onClick={() => setShowReportModal(true)}
                className="ml-auto flex items-center gap-1 px-2 sm:px-3 py-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                title="Report this post"
              >
                <Flag className="w-4 h-4" />
                <span className="hidden sm:inline">Report</span>
              </button>
            )}
          </div>
        </div>
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200">
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                Edit History
              </h3>
              <button
                onClick={() => setShowEditHistory(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {editHistory.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No edit history available</p>
              ) : (
                <div className="space-y-4">
                  {editHistory.map((entry, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-900 text-sm">
                          {entry.editedByName}
                        </span>
                        <span className="text-xs text-slate-500">
                          {entry.timestamp?.toDate?.()?.toLocaleString() || "Unknown time"}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700">
                        <strong>Changed fields:</strong> {Object.keys(entry.changes).join(", ")}
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
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[9999]" onClick={() => setShowAttachmentModal(false)}>
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
    </>
  );
};

export default PostEnhanced;
