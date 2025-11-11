import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { FileText, Trash2, Send, Edit } from "lucide-react";
import {
  getUserDrafts,
  publishDraft,
  deleteDraft,
  updateDraft,
} from "../services/postEnhancementsService";

const DraftsPage = () => {
  const { userData } = useAuth();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDrafts();
  }, [userData]);

  const loadDrafts = async () => {
    if (!userData?.id || !userData?.companyId) return;

    setLoading(true);
    setError("");

    try {
      const fetchedDrafts = await getUserDrafts(
        userData.id,
        userData.companyId
      );
      setDrafts(fetchedDrafts);
    } catch (error) {
      console.error("Error loading drafts:", error);
      setError("Failed to load drafts");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (draftId) => {
    try {
      await publishDraft(draftId, {
        id: userData.id,
        displayName: userData.displayName,
      });
      loadDrafts();
    } catch (error) {
      console.error("Error publishing draft:", error);
      setError("Failed to publish draft");
    }
  };

  const handleDelete = async (draftId) => {
    if (!confirm("Are you sure you want to delete this draft?")) return;

    try {
      await deleteDraft(draftId, userData.id);
      loadDrafts();
    } catch (error) {
      console.error("Error deleting draft:", error);
      setError("Failed to delete draft");
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
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
          <FileText className="w-6 h-6" />
          My Drafts
        </h1>
        <p className="text-slate-600 mt-1">
          Manage your saved draft posts
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">No drafts found</p>
          <p className="text-sm text-slate-500 mt-1">
            Start creating a post and save it as a draft
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition"
            >
              {/* Draft Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {draft.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                      {draft.category}
                    </span>
                    <span className="text-xs text-slate-500">
                      {draft.type?.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Draft Content Preview */}
              <p className="text-sm text-slate-700 line-clamp-2 mb-3">
                {draft.content}
              </p>

              {/* Draft Metadata */}
              <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                <span>Last updated: {formatDate(draft.updatedAt)}</span>
                {draft.tags && draft.tags.length > 0 && (
                  <div className="flex gap-1">
                    {draft.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-slate-50 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => handlePublish(draft.id)}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                >
                  <Send className="w-4 h-4" />
                  Publish
                </button>
                <button
                  onClick={() => {
                    /* Navigate to edit */
                  }}
                  className="flex items-center gap-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(draft.id)}
                  className="ml-auto flex items-center gap-1 px-4 py-2 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DraftsPage;
