import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Archive, ArrowLeft, RotateCcw } from "lucide-react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { unarchivePost } from "../services/postEnhancedFeaturesService";
import { showSuccess, showError } from "../services/toastService";
import {
  PostType,
  PostStatusConfig,
  PostPriorityConfig,
} from "../utils/constants";

const ArchivedPosts = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [archivedPosts, setArchivedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reactivating, setReactivating] = useState(null);

  useEffect(() => {
    if (userData?.companyId) {
      loadArchivedPosts();
    }
  }, [userData]);

  const loadArchivedPosts = async () => {
    try {
      setLoading(true);

      // Query archived posts for the company
      const postsRef = collection(db, "posts");
      const q = query(
        postsRef,
        where("companyId", "==", userData.companyId),
        where("isArchived", "==", true),
        orderBy("archivedAt", "desc")
      );

      const snapshot = await getDocs(q);
      const posts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setArchivedPosts(posts);
    } catch (error) {
      console.error("Error loading archived posts:", error);
      showError("Failed to load archived posts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async (post) => {
    if (!window.confirm(`Are you sure you want to reactivate "${post.title}"?`)) {
      return;
    }

    try {
      setReactivating(post.id);
      await unarchivePost(post.id, userData.id, userData.displayName);

      // Remove from local state
      setArchivedPosts((prev) => prev.filter((p) => p.id !== post.id));

      showSuccess(`"${post.title}" has been reactivated successfully`);
    } catch (error) {
      console.error("Error reactivating post:", error);
      showError("Failed to reactivate post. Please try again.");
    } finally {
      setReactivating(null);
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "Unknown";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getPostTypeLabel = (type) => {
    const typeLabels = {
      [PostType.PROBLEM_REPORT]: "Problem Report",
      [PostType.IDEA_SUGGESTION]: "Idea/Suggestion",
      [PostType.CREATIVE_CONTENT]: "Creative Content",
      [PostType.TEAM_DISCUSSION]: "Team Discussion",
    };
    return typeLabels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-600 hover:text-gray-900 transition"
              title="Go back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center space-x-3">
              <Archive className="w-8 h-8 text-gray-700" />
              <h1 className="text-3xl font-bold text-gray-900">Archived Posts</h1>
            </div>
          </div>
          <p className="text-gray-600">View and reactivate archived posts from your company</p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="text-gray-600 mt-4">Loading archived posts...</p>
          </div>
        ) : archivedPosts.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <Archive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Archived Posts</h3>
            <p className="text-gray-600">There are no archived posts in your company</p>
          </div>
        ) : (
          /* Posts List */
          <div className="space-y-4">
            {archivedPosts.map((post) => {
              const statusConfig = post.status ? PostStatusConfig[post.status] : null;
              const priorityConfig = post.priority ? PostPriorityConfig[post.priority] : null;

              return (
                <div
                  key={post.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Post Header */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                          {getPostTypeLabel(post.type)}
                        </span>
                        {statusConfig && (
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                            {statusConfig.label}
                          </span>
                        )}
                        {priorityConfig && (
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${priorityConfig.bgColor} ${priorityConfig.textColor}`}>
                            {priorityConfig.icon} {priorityConfig.label}
                          </span>
                        )}
                      </div>

                      {/* Post Title */}
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {post.title}
                      </h3>

                      {/* Post Metadata */}
                      <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                        <span>By {post.authorName}</span>
                        <span>•</span>
                        <span>Archived {getTimeAgo(post.archivedAt)}</span>
                        {post.archiveReason && (
                          <>
                            <span>•</span>
                            <span className="text-gray-500">Reason: {post.archiveReason}</span>
                          </>
                        )}
                      </div>

                      {/* Post Description Preview */}
                      {post.description && (
                        <p className="mt-3 text-gray-700 line-clamp-2">
                          {post.description}
                        </p>
                      )}
                    </div>

                    {/* Reactivate Button */}
                    <button
                      onClick={() => handleReactivate(post)}
                      disabled={reactivating === post.id}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      title="Reactivate this post"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {reactivating === post.id ? "Reactivating..." : "Reactivate"}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchivedPosts;
