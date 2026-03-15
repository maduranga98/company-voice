import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  RotateCcw,
  User,
  Clock,
  MessageSquare,
  PackageOpen,
} from "lucide-react";
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
    <div className="min-h-screen bg-gray-50/50 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm hover:bg-gray-50 hover:shadow-md transition-all active:scale-95"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
                style={{ backgroundColor: "#2D3E50" }}
              >
                <Archive className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#2D3E50" }}>
                  Archived Posts
                </h1>
                <p className="text-sm text-gray-500">
                  View and reactivate archived posts from your company
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
            <div
              className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-gray-200"
              style={{ borderTopColor: "#1ABC9C" }}
            ></div>
            <p className="text-sm text-gray-500 mt-4">Loading archived posts...</p>
          </div>
        ) : archivedPosts.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <PackageOpen className="w-7 h-7 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3E50" }}>
              No Archived Posts
            </h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              There are no archived posts in your company
            </p>
          </div>
        ) : (
          /* Posts List */
          <div className="space-y-3">
            {archivedPosts.map((post) => {
              const statusConfig = post.status ? PostStatusConfig[post.status] : null;
              const priorityConfig = post.priority ? PostPriorityConfig[post.priority] : null;

              return (
                <div
                  key={post.id}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Post Header */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded-xl border border-gray-100">
                          {getPostTypeLabel(post.type)}
                        </span>
                        {statusConfig && (
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-xl ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                            {statusConfig.label}
                          </span>
                        )}
                        {priorityConfig && (
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-xl ${priorityConfig.bgColor} ${priorityConfig.textColor}`}>
                            {priorityConfig.icon} {priorityConfig.label}
                          </span>
                        )}
                      </div>

                      {/* Post Title */}
                      <h3 className="text-base font-semibold mb-2.5" style={{ color: "#2D3E50" }}>
                        {post.title}
                      </h3>

                      {/* Post Metadata */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {post.authorName}
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          Archived {getTimeAgo(post.archivedAt)}
                        </span>
                        {post.archiveReason && (
                          <span className="inline-flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
                            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                            {post.archiveReason}
                          </span>
                        )}
                      </div>

                      {/* Post Description Preview */}
                      {post.description && (
                        <p className="mt-3 text-sm text-gray-600 line-clamp-2 leading-relaxed">
                          {post.description}
                        </p>
                      )}
                    </div>

                    {/* Reactivate Button */}
                    <button
                      onClick={() => handleReactivate(post)}
                      disabled={reactivating === post.id}
                      className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 hover:shadow-md active:scale-[0.98]"
                      style={{ backgroundColor: "#1ABC9C" }}
                      title="Reactivate this post"
                    >
                      <RotateCcw className={`w-4 h-4 ${reactivating === post.id ? "animate-spin" : ""}`} />
                      <span className="hidden sm:inline text-sm font-medium">
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
