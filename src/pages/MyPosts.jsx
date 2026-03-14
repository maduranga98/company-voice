import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import PostEnhanced from "../components/PostEnhanced";
import AnonymousThread from "../components/AnonymousThread";
import {
  getUserPosts,
  markPostAsViewed,
} from "../services/postManagementService";
import {
  PostType,
  PostStatusConfig,
  PostPriorityConfig,
} from "../utils/constants";

const getTimeAgo = (date) => {
  if (!date) return "Just now";
  let dateObj = date;
  if (date.seconds) dateObj = new Date(date.seconds * 1000);
  else if (!(date instanceof Date)) dateObj = new Date(date);
  const seconds = Math.floor((new Date() - dateObj) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return dateObj.toLocaleDateString();
};

const getPostTypeColor = (type) => {
  switch (type) {
    case PostType.PROBLEM_REPORT: return "bg-red-100 text-red-700 border-red-200";
    case PostType.CREATIVE_CONTENT: return "bg-purple-100 text-purple-700 border-purple-200";
    case PostType.TEAM_DISCUSSION: return "bg-blue-100 text-blue-700 border-blue-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const getPostTypeLabel = (type) => {
  switch (type) {
    case PostType.PROBLEM_REPORT: return "Problem";
    case PostType.CREATIVE_CONTENT: return "Creative";
    case PostType.TEAM_DISCUSSION: return "Discussion";
    default: return "Post";
  }
};

const MyPosts = () => {
  const { t } = useTranslation();
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
      alert(t("myPosts.failedToLoad"));
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
    await markPostAsViewed(post.id, userData.id);
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, hasUnreadUpdates: false } : p))
    );
  };

  const handleCollapsePost = () => setExpandedPost(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-b-2 border-[#1ABC9C] animate-spin" />
      </div>
    );
  }

  const tabs = [
    { value: "all", label: t("myPosts.allPosts", "All"), count: posts.length },
    {
      value: "problems",
      label: t("myPosts.problems", "Problems"),
      count: posts.filter((p) => p.type === PostType.PROBLEM_REPORT).length,
    },
    {
      value: "creative",
      label: t("myPosts.creative", "Creative"),
      count: posts.filter((p) => p.type === PostType.CREATIVE_CONTENT).length,
    },
    {
      value: "discussions",
      label: t("myPosts.discussions", "Discussions"),
      count: posts.filter((p) => p.type === PostType.TEAM_DISCUSSION).length,
    },
    {
      value: "unread",
      label: t("myPosts.unreadUpdates", "Unread"),
      count: posts.filter((p) => p.hasUnreadUpdates).length,
    },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold text-gray-900">{t("myPosts.title", "My Posts")}</h1>
        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
          {posts.length}
        </span>
      </div>

      {/* Filter tabs (horizontal scroll) */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: "none" }}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              backgroundColor: activeTab === tab.value ? "#2D3E50" : "white",
              color: activeTab === tab.value ? "white" : "#4b5563",
              border: activeTab === tab.value ? "none" : "1px solid #e5e7eb",
            }}
          >
            {tab.label} {tab.count > 0 && `(${tab.count})`}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filteredPosts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {t("myPosts.noPosts", "No posts")}
          </h3>
          <p className="text-sm text-gray-500">
            {activeTab === "all"
              ? t("myPosts.noPostsYet", "You haven't created any posts yet")
              : `No ${activeTab} posts found`}
          </p>
        </div>
      )}

      {/* Post cards */}
      <div className="space-y-3">
        {filteredPosts.map((post) => {
          const isExpanded = expandedPost === post.id;
          const isAnonymous = post.isAnonymous;

          return (
            <div
              key={post.id}
              className="bg-white rounded-2xl shadow-sm overflow-hidden"
            >
              {!isExpanded ? (
                /* Collapsed card */
                <div className="p-4">
                  {/* Top row: type pill + time + unread dot */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getPostTypeColor(post.type)}`}
                    >
                      {getPostTypeLabel(post.type)}
                    </span>
                    {isAnonymous && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                        Anonymous
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {getTimeAgo(post.createdAt)}
                    </span>
                    {post.hasUnreadUpdates && (
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    {post.title}
                  </h3>

                  {/* Status + priority badges (for problems) */}
                  {post.type === PostType.PROBLEM_REPORT && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {post.status && PostStatusConfig[post.status] && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${PostStatusConfig[post.status].bgColor} ${PostStatusConfig[post.status].textColor}`}
                        >
                          {PostStatusConfig[post.status].label}
                        </span>
                      )}
                      {post.priority && PostPriorityConfig[post.priority] && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${PostPriorityConfig[post.priority].bgColor} ${PostPriorityConfig[post.priority].textColor}`}
                        >
                          {PostPriorityConfig[post.priority].icon}{" "}
                          {PostPriorityConfig[post.priority].label}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expand button */}
                  <button
                    onClick={() => handleExpandPost(post)}
                    className="text-xs text-[#1ABC9C] font-medium"
                  >
                    {t("myPosts.viewDetails", "View details")} ›
                  </button>
                </div>
              ) : (
                /* Expanded card */
                <div>
                  {/* Collapse header */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getPostTypeColor(post.type)}`}
                      >
                        {getPostTypeLabel(post.type)}
                      </span>
                      {isAnonymous && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                          Anonymous
                        </span>
                      )}
                      {post.hasUnreadUpdates && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700">
                          New Update
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleCollapsePost}
                      className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                        <path d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Full post content */}
                  <PostEnhanced post={post} />

                  {/* Anonymous thread (reporter view) */}
                  {isAnonymous && (
                    <AnonymousThread
                      postId={post.id}
                      companyId={post.companyId || userData.companyId}
                      currentUserRole="reporter"
                      isAnonymousPost={true}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyPosts;
