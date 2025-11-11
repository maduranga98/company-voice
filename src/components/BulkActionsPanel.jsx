import { useState } from "react";
import { CheckSquare, Square, Archive, Users, AlertCircle } from "lucide-react";
import {
  bulkUpdateStatus,
  bulkArchivePosts,
  bulkAssignPosts,
} from "../services/postEnhancementsService";
import { useAuth } from "../contexts/AuthContext";
import { PostStatus, AssignmentType } from "../utils/constants";

const BulkActionsPanel = ({ posts, onActionComplete }) => {
  const { userData } = useAuth();
  const [selectedPosts, setSelectedPosts] = useState(new Set());
  const [showActions, setShowActions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin =
    userData?.role === "company_admin" ||
    userData?.role === "super_admin" ||
    userData?.role === "hr";

  if (!isAdmin) {
    return null;
  }

  const togglePost = (postId) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(postId)) {
      newSelected.delete(postId);
    } else {
      newSelected.add(postId);
    }
    setSelectedPosts(newSelected);
    setShowActions(newSelected.size > 0);
  };

  const toggleAll = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
      setShowActions(false);
    } else {
      setSelectedPosts(new Set(posts.map((p) => p.id)));
      setShowActions(true);
    }
  };

  const handleBulkAction = async (action, params = {}) => {
    setLoading(true);
    setError("");

    try {
      const postIds = Array.from(selectedPosts);

      switch (action) {
        case "status":
          await bulkUpdateStatus(postIds, params.status, {
            id: userData.id,
            displayName: userData.displayName,
          });
          break;
        case "archive":
          await bulkArchivePosts(postIds, {
            id: userData.id,
            displayName: userData.displayName,
          });
          break;
        case "assign":
          await bulkAssignPosts(postIds, params.assignment, {
            id: userData.id,
            displayName: userData.displayName,
          });
          break;
        default:
          throw new Error("Unknown action");
      }

      // Clear selection
      setSelectedPosts(new Set());
      setShowActions(false);

      // Notify parent
      if (onActionComplete) {
        onActionComplete();
      }
    } catch (error) {
      console.error("Error performing bulk action:", error);
      setError(error.message || "Failed to perform bulk action");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4">
      {/* Selection Header */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAll}
            className="text-slate-600 hover:text-slate-900"
          >
            {selectedPosts.size === posts.length ? (
              <CheckSquare className="w-5 h-5" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
          <span className="text-sm font-medium text-slate-700">
            {selectedPosts.size === 0
              ? "Select posts for bulk actions"
              : `${selectedPosts.size} post(s) selected`}
          </span>
        </div>

        {selectedPosts.size > 0 && (
          <div className="flex items-center gap-2">
            {/* Bulk Actions Dropdown */}
            <BulkActionMenu
              onAction={handleBulkAction}
              loading={loading}
              selectedCount={selectedPosts.size}
            />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Posts List with Checkboxes */}
      <div className="mt-4 space-y-3">
        {posts.map((post) => (
          <div
            key={post.id}
            className={`flex items-start gap-3 p-4 border rounded-lg transition ${
              selectedPosts.has(post.id)
                ? "border-blue-300 bg-blue-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <button
              onClick={() => togglePost(post.id)}
              className="mt-1 flex-shrink-0"
            >
              {selectedPosts.has(post.id) ? (
                <CheckSquare className="w-5 h-5 text-blue-600" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-slate-900 truncate">{post.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-500">{post.category}</span>
                {post.status && (
                  <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                    {post.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BulkActionMenu = ({ onAction, loading, selectedCount }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
      >
        {loading ? "Processing..." : "Bulk Actions"}
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowMenu(false);
              setShowStatusMenu(false);
            }}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
            <div className="py-2">
              {/* Change Status */}
              <div className="relative">
                <button
                  onMouseEnter={() => setShowStatusMenu(true)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>Change Status</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                {/* Status Submenu */}
                {showStatusMenu && (
                  <div className="absolute left-full top-0 ml-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200">
                    <div className="py-2">
                      {Object.entries(PostStatus).map(([key, value]) => (
                        <button
                          key={value}
                          onClick={() => {
                            onAction("status", { status: value });
                            setShowMenu(false);
                            setShowStatusMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {value.replace(/_/g, " ").toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Archive */}
              <button
                onClick={() => {
                  onAction("archive");
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Archive className="w-4 h-4" />
                Archive Selected
              </button>

              {/* More actions can be added here */}
            </div>

            <div className="border-t border-slate-200 px-4 py-2 bg-slate-50 text-xs text-slate-600">
              {selectedCount} post(s) will be affected
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BulkActionsPanel;
