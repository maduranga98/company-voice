import AdminActionPanel from "./AdminActionPanel";
import CaseAttachments from "./CaseAttachments";
import { PostStatus, PostStatusConfig, PostPriorityConfig } from "../utils/constants";
import {
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Edit3,
  Clock,
  Calendar,
  Shield,
  User,
  X,
} from "lucide-react";

const toDate = (value) => {
  if (!value) return null;
  return value?.toDate ? value.toDate() : new Date(value);
};

const formatTimeAgo = (timestamp) => {
  const date = toDate(timestamp);
  if (!date) return "";
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const PostTypeIcon = ({ type }) => {
  const config = {
    problem_report: { bg: "bg-red-50", icon: <AlertTriangle size={16} className="text-red-500" /> },
    creative_content: { bg: "bg-purple-50", icon: <Edit3 size={16} className="text-purple-500" /> },
    team_discussion: { bg: "bg-blue-50", icon: <MessageSquare size={16} className="text-blue-500" /> },
    idea_suggestion: { bg: "bg-emerald-50", icon: <Lightbulb size={16} className="text-emerald-500" /> },
  };
  const c = config[type] || config.problem_report;
  return (
    <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg}`}>
      {c.icon}
    </div>
  );
};

/** Compact case row; on small screens the selected row expands inline with the action panel. */
export const CaseRow = ({ post, isSelected, onToggle, currentUser, onUpdate }) => {
  const statusConfig = PostStatusConfig[post.status] || PostStatusConfig.open;
  const priorityConfig = post.priority && PostPriorityConfig[post.priority];
  const isUnread = !post.status || post.status === PostStatus.OPEN;
  const dueDate = toDate(post.dueDate);

  return (
    <div
      onClick={onToggle}
      className={`bg-white rounded-2xl border transition-all cursor-pointer ${
        isSelected
          ? "border-[#1ABC9C] shadow-md"
          : "border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"
      }`}
    >
      <div className="p-4 lg:p-5">
        <div className="flex items-start gap-3 lg:gap-4">
          <PostTypeIcon type={post.type} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 lg:mb-1">
                  {isUnread && (
                    <span className="w-2 h-2 bg-[#FF6B6B] rounded-full flex-shrink-0" />
                  )}
                  <h3 className="text-sm lg:text-base font-semibold text-[#2D3E50] truncate">
                    {post.title}
                  </h3>
                </div>
                <p className="text-xs lg:text-sm text-gray-500 line-clamp-2 mb-2 lg:mb-3">
                  {post.description || post.content}
                </p>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs lg:text-sm font-semibold ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                {statusConfig.label}
              </span>
              {priorityConfig && post.priority !== "medium" && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs lg:text-sm font-semibold ${priorityConfig.bgColor} ${priorityConfig.textColor}`}>
                  {priorityConfig.icon} {priorityConfig.label}
                </span>
              )}
              {post.category && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs lg:text-sm font-medium bg-gray-100 text-gray-500 capitalize">
                  {String(post.category).replace(/_/g, " ")}
                </span>
              )}
              {dueDate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs lg:text-sm font-medium bg-amber-50 text-amber-600">
                  <Calendar size={10} />
                  {dueDate.toLocaleDateString()}
                </span>
              )}
              {post.isAnonymous && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs lg:text-sm font-medium bg-gray-100 text-gray-500">
                  <User size={10} />
                  Anonymous
                </span>
              )}
              <span className="text-xs lg:text-sm text-gray-400 flex items-center gap-1 ml-auto">
                <Clock size={10} />
                {formatTimeAgo(post.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile inline expansion */}
      {isSelected && (
        <div className="lg:hidden border-t border-gray-100 p-4" onClick={(e) => e.stopPropagation()}>
          <AdminActionPanel post={post} currentUser={currentUser} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
};

/** Detail panel shown beside the list on desktop. */
export const CaseDetailPanel = ({ post, currentUser, onClose, onUpdate }) => (
  <div className="hidden lg:flex lg:flex-col lg:flex-1 bg-white rounded-2xl border border-[#1ABC9C] shadow-md sticky top-24 max-h-[calc(100vh-160px)] overflow-hidden">
    {/* Panel header — title + close */}
    <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start gap-4 flex-shrink-0">
      <PostTypeIcon type={post.type} />
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-[#2D3E50] leading-snug">
          {post.title}
        </h3>
        {/* Metadata chips */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {/* Post type label */}
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md capitalize">
            {(post.type || "").replace(/_/g, " ")}
          </span>
          {/* Anonymity */}
          {post.isAnonymous ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md">
              <Shield size={10} />
              Anonymous
            </span>
          ) : (
            post.authorName && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">
                <User size={10} />
                {post.authorName}
              </span>
            )
          )}
          {/* Date */}
          <span className="inline-flex items-center gap-1 text-xs text-gray-400 ml-auto">
            <Clock size={10} />
            {post.createdAt
              ? toDate(post.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
              : ""}
          </span>
        </div>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
      >
        <X size={16} />
      </button>
    </div>

    {/* Scrollable body */}
    <div className="flex-1 overflow-y-auto">
      {/* Full post content */}
      {(post.description || post.content) && (
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Submission
          </p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {post.description || post.content}
          </p>
        </div>
      )}

      <CaseAttachments attachments={post.attachments} />

      {/* Admin action panel */}
      <div className="px-6 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          HR Actions
        </p>
        <AdminActionPanel post={post} currentUser={currentUser} onUpdate={onUpdate} />
      </div>
    </div>
  </div>
);
