import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Clock, Calendar, X, Edit } from "lucide-react";
import {
  getScheduledPosts,
  cancelScheduledPost,
  publishScheduledPost,
} from "../services/postEnhancementsService";

const ScheduledPostsPage = () => {
  const { userData } = useAuth();
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadScheduledPosts();
  }, [userData]);

  const loadScheduledPosts = async () => {
    if (!userData?.companyId) return;

    setLoading(true);
    setError("");

    try {
      const posts = await getScheduledPosts(userData.companyId);
      setScheduledPosts(posts);
    } catch (error) {
      console.error("Error loading scheduled posts:", error);
      setError("Failed to load scheduled posts");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (postId) => {
    if (!confirm("Are you sure you want to cancel this scheduled post?")) return;

    try {
      await cancelScheduledPost(postId, userData.id);
      loadScheduledPosts();
    } catch (error) {
      console.error("Error canceling scheduled post:", error);
      setError("Failed to cancel scheduled post");
    }
  };

  const handlePublishNow = async (postId) => {
    if (!confirm("Do you want to publish this post now?")) return;

    try {
      await publishScheduledPost(postId);
      loadScheduledPosts();
    } catch (error) {
      console.error("Error publishing post:", error);
      setError("Failed to publish post");
    }
  };

  const formatScheduledDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const getTimeUntilPublish = (timestamp) => {
    if (!timestamp) return "";
    const scheduledDate = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp);
    const now = new Date();
    const diffMs = scheduledDate - now;

    if (diffMs < 0) return "Overdue";

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `in ${diffMins} minutes`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `in ${diffHours} hours`;

    const diffDays = Math.floor(diffHours / 24);
    return `in ${diffDays} days`;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-6 h-6" />
          Scheduled Posts
        </h1>
        <p className="text-slate-600 mt-1">
          Manage posts scheduled for future publishing
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Scheduled Posts List */}
      {scheduledPosts.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">No scheduled posts</p>
          <p className="text-sm text-slate-500 mt-1">
            Schedule a post to have it published automatically
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {scheduledPosts.map((post) => {
            const isOwner = post.authorId === userData?.id;
            const timeUntil = getTimeUntilPublish(post.scheduledPublishDate);

            return (
              <div
                key={post.id}
                className="bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition"
              >
                {/* Post Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {post.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatScheduledDate(post.scheduledPublishDate)}
                      </span>
                      <span className="text-xs text-slate-500">{timeUntil}</span>
                    </div>
                  </div>
                </div>

                {/* Post Content Preview */}
                <p className="text-sm text-slate-700 line-clamp-2 mb-3">
                  {post.content}
                </p>

                {/* Post Metadata */}
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                  <span className="px-2 py-1 bg-slate-100 rounded">
                    {post.category}
                  </span>
                  <span>{post.type?.replace(/_/g, " ")}</span>
                  <span>by {post.authorName}</span>
                </div>

                {/* Actions */}
                {isOwner && (
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handlePublishNow(post.id)}
                      className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                    >
                      Publish Now
                    </button>
                    <button
                      onClick={() => handleCancel(post.id)}
                      className="ml-auto flex items-center gap-1 px-4 py-2 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                      Cancel Schedule
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScheduledPostsPage;
