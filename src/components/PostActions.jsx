import { useState } from "react";
import { Pin, Archive, Edit2, MoreVertical } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  pinPost,
  unpinPost,
  archivePost,
  unarchivePost,
} from "../services/postEnhancementsService";

const PostActions = ({ post, onEdit, onActionComplete }) => {
  const { userData } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin =
    userData?.role === "company_admin" ||
    userData?.role === "super_admin" ||
    userData?.role === "hr";
  const isAuthor = userData?.id === post.authorId;
  const canEdit = isAuthor || isAdmin;

  const handlePinToggle = async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError("");

    try {
      if (post.isPinned) {
        await unpinPost(post.id, {
          id: userData.id,
          displayName: userData.displayName,
        });
      } else {
        await pinPost(post.id, {
          id: userData.id,
          displayName: userData.displayName,
        });
      }

      setShowMenu(false);

      if (onActionComplete) {
        onActionComplete();
      }
    } catch (error) {
      console.error("Error toggling pin:", error);
      setError(error.message || "Failed to toggle pin");
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveToggle = async () => {
    setLoading(true);
    setError("");

    try {
      if (post.isArchived) {
        await unarchivePost(post.id, {
          id: userData.id,
          displayName: userData.displayName,
        });
      } else {
        await archivePost(post.id, {
          id: userData.id,
          displayName: userData.displayName,
        });
      }

      setShowMenu(false);

      if (onActionComplete) {
        onActionComplete();
      }
    } catch (error) {
      console.error("Error toggling archive:", error);
      setError(error.message || "Failed to toggle archive");
    } finally {
      setLoading(false);
    }
  };

  if (!canEdit && !isAdmin) {
    return null;
  }

  return (
    <div className="relative">
      {/* Actions Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
        title="Post actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
            <div className="py-2">
              {/* Edit */}
              {canEdit && (
                <button
                  onClick={() => {
                    if (onEdit) onEdit(post);
                    setShowMenu(false);
                  }}
                  disabled={loading}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Post
                </button>
              )}

              {/* Pin/Unpin (Admin only) */}
              {isAdmin && (
                <button
                  onClick={handlePinToggle}
                  disabled={loading}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <Pin
                    className={`w-4 h-4 ${post.isPinned ? "fill-current" : ""}`}
                  />
                  {post.isPinned ? "Unpin Post" : "Pin Post"}
                </button>
              )}

              {/* Archive/Unarchive */}
              {(isAuthor || isAdmin) && (
                <button
                  onClick={handleArchiveToggle}
                  disabled={loading}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <Archive className="w-4 h-4" />
                  {post.isArchived ? "Unarchive Post" : "Archive Post"}
                </button>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="border-t border-slate-200 px-4 py-2 bg-red-50">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PostActions;
