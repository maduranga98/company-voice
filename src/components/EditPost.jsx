import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { History, X } from "lucide-react";
import { editPost, getPostEditHistory } from "../services/postEnhancementsService";

const EditPost = ({ post, onClose, onSuccess }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [editHistory, setEditHistory] = useState([]);

  const [formData, setFormData] = useState({
    title: post.title || "",
    content: post.content || post.description || "",
    category: post.category || "",
    tags: post.tags?.join(", ") || "",
  });

  // Load edit history
  useEffect(() => {
    const loadHistory = async () => {
      if (showHistory) {
        const history = await getPostEditHistory(post.id);
        setEditHistory(history);
      }
    };
    loadHistory();
  }, [showHistory, post.id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!userData?.id && !userData?.uid) {
        throw new Error("User authentication required");
      }

      const updateData = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      await editPost(post.id, updateData, {
        id: userData.id || userData.uid,
        uid: userData.uid || userData.id,
        displayName: userData.displayName,
        role: userData.role,
      });

      if (onSuccess) {
        onSuccess();
      }

      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Error editing post:", error);
      setError(error.message || "Failed to edit post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999] overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[calc(100vh-4rem)]">
        {/* HEADER */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-slate-100 p-6 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Edit Post</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                type="button"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <History className="w-4 h-4" />
                History
              </button>
              <button
                onClick={onClose}
                type="button"
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-2 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Edit History Panel */}
          {showHistory && (
            <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Edit History
              </h3>
              {editHistory.length === 0 ? (
                <p className="text-sm text-slate-600">No edit history yet</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {editHistory.map((edit) => (
                    <div
                      key={edit.id}
                      className="p-3 bg-white rounded border border-slate-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-medium text-slate-700">
                          {edit.editorName}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(edit.editedAt)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(edit.changes || {}).map(
                          ([field, change]) => (
                            <div key={field} className="text-xs">
                              <span className="font-medium text-slate-700">
                                {field}:
                              </span>
                              <div className="ml-2 mt-1">
                                <div className="text-red-600 line-through">
                                  {String(change.old).substring(0, 100)}
                                  {String(change.old).length > 100 ? "..." : ""}
                                </div>
                                <div className="text-green-600">
                                  {String(change.new).substring(0, 100)}
                                  {String(change.new).length > 100 ? "..." : ""}
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Edit Count */}
          {post.editCount > 0 && (
            <div className="mb-4 text-sm text-slate-600">
              This post has been edited {post.editCount} time(s).
              {post.lastEditedBy && (
                <span>
                  {" "}
                  Last edited by {post.lastEditedBy} on{" "}
                  {formatDate(post.lastEditedAt)}
                </span>
              )}
            </div>
          )}

          {/* Edit Form */}
          <form id="edit-post-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Title
              </label>
              <input
                name="title"
                type="text"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Content
              </label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                required
                rows="10"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Category
              </label>
              <input
                name="category"
                type="text"
                value={formData.category}
                onChange={handleInputChange}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tags
              </label>
              <input
                name="tags"
                type="text"
                value={formData.tags}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </form>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-slate-100 p-6 z-10">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-post-form"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPost;
