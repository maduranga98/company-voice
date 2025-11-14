import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import PostEnhanced from "../components/PostEnhanced";
import {
  getUserPosts,
  markPostAsViewed,
  isAdmin,
} from "../services/postManagementService";
import {
  PostType,
  PostStatusConfig,
  PostPriorityConfig,
} from "../utils/constants";

/**
 * My Posts Dashboard - Title-Only View
 * Shows all posts as title cards with expandable full view
 * Anonymous posts marked with * for privacy
 */
const MyPosts = () => {
  const { userData } = useAuth();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedPost, setExpandedPost] = useState(null);

  useEffect(() => {
    loadMyPosts();
  }, [userData]);

  useEffect(() => {
    filterPosts();
  }, [posts, activeTab]);

  const loadMyPosts = async () => {
    try {
      setLoading(true);
      const myPosts = await getUserPosts(userData.id, userData.companyId);
      setPosts(myPosts);
    } catch (error) {
      console.error("Error loading my posts:", error);
      alert("Failed to load your posts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = [...posts];

    switch (activeTab) {
      case "problems":
        filtered = filtered.filter((p) => p.type === PostType.PROBLEM_REPORT);
        break;
      case "creative":
        filtered = filtered.filter((p) => p.type === PostType.CREATIVE_CONTENT);
        break;
      case "discussions":
        filtered = filtered.filter((p) => p.type === PostType.TEAM_DISCUSSION);
        break;
      case "unread":
        filtered = filtered.filter((p) => p.hasUnreadUpdates);
        break;
      default:
        break;
    }

    setFilteredPosts(filtered);
  };

  const handleExpandPost = async (post) => {
    setExpandedPost(post.id);

    // Mark as viewed
    await markPostAsViewed(post.id, userData.id);

    // Update local state
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, hasUnreadUpdates: false } : p
      )
    );
  };

  const handleCollapsePost = () => {
    setExpandedPost(null);
  };

  // Utility function to format timestamps
  const getTimeAgo = (date) => {
    if (!date) return "Just now";

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

  const getPostTypeColor = (type) => {
    switch (type) {
      case PostType.PROBLEM_REPORT:
        return "bg-red-100 text-red-700 border-red-200";
      case PostType.CREATIVE_CONTENT:
        return "bg-purple-100 text-purple-700 border-purple-200";
      case PostType.TEAM_DISCUSSION:
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getPostTypeLabel = (type) => {
    switch (type) {
      case PostType.PROBLEM_REPORT:
        return "Problem";
      case PostType.CREATIVE_CONTENT:
        return "Creative";
      case PostType.TEAM_DISCUSSION:
        return "Discussion";
      default:
        return "Post";
    }
  };

  const getPostTypeIcon = (type) => {
    switch (type) {
      case PostType.PROBLEM_REPORT:
        return "⚠️";
      case PostType.CREATIVE_CONTENT:
        return "💡";
      case PostType.TEAM_DISCUSSION:
        return "💬";
      default:
        return "📝";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Posts</h1>
          <p className="text-gray-600">
            Track all your posts and their updates in one place
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { value: "all", label: "All Posts", count: posts.length },
            {
              value: "problems",
              label: "Problems",
              count: posts.filter((p) => p.type === PostType.PROBLEM_REPORT)
                .length,
            },
            {
              value: "creative",
              label: "Creative",
              count: posts.filter((p) => p.type === PostType.CREATIVE_CONTENT)
                .length,
            },
            {
              value: "discussions",
              label: "Discussions",
              count: posts.filter((p) => p.type === PostType.TEAM_DISCUSSION)
                .length,
            },
            {
              value: "unread",
              label: "Unread Updates",
              count: posts.filter((p) => p.hasUnreadUpdates).length,
            },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition ${
                activeTab === tab.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Posts List - Title-Only Cards */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No posts yet
            </h3>
            <p className="text-gray-600">
              {activeTab === "all"
                ? "You haven't created any posts yet"
                : `No ${activeTab} posts found`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((post) => {
              const isExpanded = expandedPost === post.id;
              const isAnonymous = post.isAnonymous;

              return (
                <div
                  key={post.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 transition"
                >
                  {/* Collapsed View - Title Card */}
                  {!isExpanded ? (
                    <button
                      onClick={() => handleExpandPost(post)}
                      className="w-full p-4 text-left hover:bg-gray-50 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Title with Anonymous Marker */}
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-xl flex-shrink-0">
                              {getPostTypeIcon(post.type)}
                            </span>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                              {isAnonymous && (
                                <span
                                  className="text-purple-600 font-bold text-lg"
                                  title="Anonymous Post"
                                >
                                  *
                                </span>
                              )}
                              <span className="flex-1">{post.title}</span>
                            </h3>
                          </div>

                          {/* Meta Info */}
                          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full border ${getPostTypeColor(
                                post.type
                              )}`}
                            >
                              {getPostTypeLabel(post.type)}
                            </span>
                            <span>{getTimeAgo(post.createdAt)}</span>
                            <span>
                              👍 {post.likes || 0} · 💬 {post.comments || 0}
                            </span>
                            {isAnonymous && (
                              <span className="text-purple-600 font-medium">
                                Anonymous
                              </span>
                            )}
                            {post.hasUnreadUpdates && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                                New Update
                              </span>
                            )}
                          </div>

                          {/* Status & Priority (for Problem Reports) */}
                          {post.type === PostType.PROBLEM_REPORT && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {post.status && PostStatusConfig[post.status] && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    PostStatusConfig[post.status].bgColor
                                  } ${PostStatusConfig[post.status].textColor}`}
                                >
                                  {PostStatusConfig[post.status].label}
                                </span>
                              )}
                              {post.priority &&
                                PostPriorityConfig[post.priority] && (
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded ${
                                      PostPriorityConfig[post.priority].bgColor
                                    } ${
                                      PostPriorityConfig[post.priority]
                                        .textColor
                                    }`}
                                  >
                                    {PostPriorityConfig[post.priority].icon}{" "}
                                    {PostPriorityConfig[post.priority].label}
                                  </span>
                                )}
                            </div>
                          )}
                        </div>

                        {/* Expand Icon */}
                        <div className="flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-gray-400"
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
                        </div>
                      </div>
                    </button>
                  ) : (
                    /* Expanded View - Full Post */
                    <div>
                      {/* Collapse Button */}
                      <div className="px-4 pt-4 pb-2 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">
                              {getPostTypeIcon(post.type)}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs rounded-full border font-medium ${getPostTypeColor(
                                post.type
                              )}`}
                            >
                              {getPostTypeLabel(post.type)}
                            </span>
                            {isAnonymous && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 border border-purple-200 rounded-full text-xs font-medium flex items-center gap-1">
                                <span className="font-bold">*</span>
                                Anonymous
                              </span>
                            )}
                            {post.hasUnreadUpdates && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                New Update
                              </span>
                            )}
                          </div>
                          <button
                            onClick={handleCollapsePost}
                            className="p-1 hover:bg-gray-200 rounded transition"
                            title="Collapse"
                          >
                            <svg
                              className="w-5 h-5 text-gray-600"
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
                          </button>
                        </div>
                      </div>

                      {/* Full Post Content */}
                      <PostEnhanced post={post} />

                      {/* Stats Footer */}
                      <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                        <div className="flex gap-4">
                          <span>👍 {post.likes || 0} reactions</span>
                          <span>💬 {post.comments || 0} comments</span>
                        </div>
                        <div>
                          Posted{" "}
                          {new Date(
                            post.createdAt?.seconds * 1000
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-6 pt-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-900 font-semibold mb-2 flex items-center gap-2">
            ℹ️ About My Posts
          </h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>
              • All posts shown as title cards - click to expand full view
            </li>
            <li>
              • <span className="font-bold text-purple-600">*</span> marks
              anonymous posts for your reference
            </li>
            <li>• Track all your posts (anonymous and named) in one place</li>
            <li>
              • Get notified of status changes, comments, and priority updates
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MyPosts;
