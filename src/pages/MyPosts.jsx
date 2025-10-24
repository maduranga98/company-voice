import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import Post from "../components/Post";
import {
  getUserPosts,
  markPostAsViewed,
  isAdmin,
} from "../services/postManagementService";
import { PostType, PostStatusConfig, PostPriorityConfig } from "../utils/constants";
import AdminActionPanel from "../components/AdminActionPanel";

/**
 * My Posts Dashboard
 * Private dashboard showing user's own posts (both anonymous and named)
 * Zero-notification model - all updates visible here without external notifications for anonymous posts
 */
const MyPosts = () => {
  const { userData } = useAuth();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedPost, setSelectedPost] = useState(null);

  const userIsAdmin = isAdmin(userData?.role);

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
        // all - no filter
        break;
    }

    setFilteredPosts(filtered);
  };

  const handlePostClick = async (post) => {
    setSelectedPost(post);

    // Mark as viewed
    await markPostAsViewed(post.id, userData.id);

    // Update local state
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, hasUnreadUpdates: false } : p))
    );
  };

  const getUnreadCount = () => {
    return posts.filter((p) => p.hasUnreadUpdates).length;
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case PostType.PROBLEM_REPORT:
        return { label: "Problem", icon: "🚨", color: "text-red-600", bg: "bg-red-100" };
      case PostType.CREATIVE_CONTENT:
        return { label: "Creative", icon: "🎨", color: "text-purple-600", bg: "bg-purple-100" };
      case PostType.TEAM_DISCUSSION:
        return { label: "Discussion", icon: "💬", color: "text-blue-600", bg: "bg-blue-100" };
      default:
        return { label: "Post", icon: "📄", color: "text-gray-600", bg: "bg-gray-100" };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            📋 My Posts
          </h1>
          <p className="text-white/90 mt-1 text-sm sm:text-base">
            Track all your posts and their status in one place
          </p>
          {getUnreadCount() > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-sm font-medium">
                {getUnreadCount()} post{getUnreadCount() > 1 ? "s" : ""} with unread updates
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                activeTab === "all"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              All Posts ({posts.length})
            </button>
            <button
              onClick={() => setActiveTab("unread")}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition relative ${
                activeTab === "unread"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Unread Updates
              {getUnreadCount() > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                  {getUnreadCount()}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("problems")}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                activeTab === "problems"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              🚨 Problems ({posts.filter((p) => p.type === PostType.PROBLEM_REPORT).length})
            </button>
            <button
              onClick={() => setActiveTab("creative")}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                activeTab === "creative"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              🎨 Creative ({posts.filter((p) => p.type === PostType.CREATIVE_CONTENT).length})
            </button>
            <button
              onClick={() => setActiveTab("discussions")}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                activeTab === "discussions"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              💬 Discussions ({posts.filter((p) => p.type === PostType.TEAM_DISCUSSION).length})
            </button>
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {filteredPosts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600 text-lg font-medium mb-2">No posts found</p>
            <p className="text-gray-500 text-sm">
              {activeTab === "unread"
                ? "You're all caught up! No unread updates."
                : "You haven't created any posts yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => {
              const typeInfo = getTypeLabel(post.type);
              const statusInfo = PostStatusConfig[post.status] || PostStatusConfig.open;
              const priorityInfo = PostPriorityConfig[post.priority] || PostPriorityConfig.medium;

              return (
                <div
                  key={post.id}
                  onClick={() => handlePostClick(post)}
                  className={`bg-white rounded-lg shadow-sm border-2 transition-all cursor-pointer ${
                    post.hasUnreadUpdates
                      ? "border-indigo-400 shadow-lg"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Unread Badge */}
                  {post.hasUnreadUpdates && (
                    <div className="bg-indigo-600 text-white px-4 py-2 flex items-center gap-2 rounded-t-lg">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                      <span className="text-sm font-medium">New updates on this post</span>
                    </div>
                  )}

                  {/* Post Metadata */}
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {/* Type Badge */}
                      <span className={`${typeInfo.bg} ${typeInfo.color} px-2 py-1 rounded font-medium`}>
                        {typeInfo.icon} {typeInfo.label}
                      </span>

                      {/* Anonymous Badge */}
                      {post.isAnonymous && (
                        <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded font-medium">
                          🔒 Anonymous
                        </span>
                      )}

                      {/* Status Badge */}
                      <span
                        className={`${statusInfo.bgColor} ${statusInfo.textColor} px-2 py-1 rounded font-medium`}
                      >
                        {statusInfo.label}
                      </span>

                      {/* Priority Badge */}
                      <span
                        className={`${priorityInfo.bgColor} ${priorityInfo.textColor} px-2 py-1 rounded font-medium`}
                      >
                        {priorityInfo.icon} {priorityInfo.label}
                      </span>

                      {/* Assignment Badge */}
                      {post.assignedTo && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                          📌 Assigned to {post.assignedTo.name}
                        </span>
                      )}

                      {/* Due Date */}
                      {post.dueDate && (
                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
                          📅 Due: {new Date(post.dueDate.seconds * 1000).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Admin Action Panel (if user is admin and viewing expanded) */}
                  {userIsAdmin && selectedPost?.id === post.id && (
                    <div className="p-4 border-b border-gray-200">
                      <AdminActionPanel
                        post={post}
                        currentUser={userData}
                        onUpdate={loadMyPosts}
                      />
                    </div>
                  )}

                  {/* Post Content */}
                  <Post post={post} />

                  {/* Stats Footer */}
                  <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                    <div className="flex gap-4">
                      <span>👍 {post.likes || 0} likes</span>
                      <span>💬 {post.comments || 0} comments</span>
                    </div>
                    <div>
                      Posted {new Date(post.createdAt?.seconds * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-900 font-semibold mb-2 flex items-center gap-2">
            ℹ️ About My Posts
          </h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• View all your posts (anonymous and named) in one place</li>
            <li>• Get notified of status changes, admin comments, and priority updates</li>
            <li>• Anonymous posts maintain your privacy - updates only visible here</li>
            <li>• Track progress from Open → In Progress → Resolved</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MyPosts;
