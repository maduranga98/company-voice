import LikeButton from "./LikeButton";
import CommentsSection from "./CommentsSection";
import { PostStatusConfig, PostPriorityConfig, PostType } from "../utils/constants";

const Post = ({ post, getTimeAgo }) => {
  // Check if this is a problem report to show status/priority
  const isProblemReport = post.type === PostType.PROBLEM_REPORT;

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
    <article className={`${styling.bg} rounded-lg border ${styling.border} ${styling.leftBorder} overflow-hidden transition`}>
      {/* Post Header */}
      <div className="p-3 sm:p-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-medium text-sm sm:text-base flex-shrink-0">
              {post.authorName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-slate-900 text-sm sm:text-base truncate">
                {post.authorName}
              </h3>
              <p className="text-xs text-slate-500">
                {getTimeAgo(post.createdAt)}
              </p>
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
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PostStatusConfig[post.status].bgColor} ${PostStatusConfig[post.status].textColor}`}>
                    {PostStatusConfig[post.status].label}
                  </span>
                )}
                {post.priority && PostPriorityConfig[post.priority] && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PostPriorityConfig[post.priority].bgColor} ${PostPriorityConfig[post.priority].textColor}`}>
                    {PostPriorityConfig[post.priority].icon}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Assigned To Info for Problem Reports */}
        {isProblemReport && post.assignedTo && (
          <div className="mt-2 flex items-center text-xs text-slate-600 bg-blue-50 px-2 py-1 rounded">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Assigned to: <span className="font-medium ml-1">{post.assignedTo.name}</span>
          </div>
        )}
      </div>

      {/* Post Content */}
      <div className="p-3 sm:p-4">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">
          {post.title}
        </h2>
        <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap">
          {post.description}
        </p>

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

      {/* Post Attachments */}
      {post.attachments && post.attachments.length > 0 && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          {post.attachments.length === 1 ? (
            post.attachments[0].type.startsWith("image/") ? (
              <img
                src={post.attachments[0].url}
                alt={post.title}
                className="w-full rounded-lg"
              />
            ) : (
              <a
                href={post.attachments[0].url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
              >
                <svg
                  className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                    {post.attachments[0].name}
                  </p>
                  <p className="text-xs text-slate-500">Click to view</p>
                </div>
              </a>
            )
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {post.attachments.map((attachment, index) => (
                <div key={index}>
                  {attachment.type.startsWith("image/") ? (
                    <img
                      src={attachment.url}
                      alt={`${post.title} ${index + 1}`}
                      className="w-full h-32 sm:h-48 object-cover rounded-lg"
                    />
                  ) : (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center h-32 sm:h-48 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                    >
                      <svg
                        className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="text-xs text-slate-600 text-center px-2 truncate max-w-full">
                        {attachment.name}
                      </p>
                    </a>
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
        <div className="px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-1 sm:gap-2">
          <LikeButton
            postId={post.id}
            initialLikes={post.likes || 0}
            postAuthorId={post.authorId}
            postAuthorName={post.authorName}
            postTitle={post.title}
          />
          <CommentsSection
            postId={post.id}
            initialCommentCount={post.comments || 0}
            postAuthorId={post.authorId}
            postAuthorName={post.authorName}
            postTitle={post.title}
          />
          <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition ml-auto">
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
                d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
};

export default Post;
