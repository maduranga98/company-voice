import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Trash2,
  Send,
  Edit,
  Clock,
  Tag,
  FolderOpen,
} from "lucide-react";
import {
  getUserDrafts,
  publishDraft,
  deleteDraft,
  updateDraft,
} from "../services/postEnhancementsService";

const DraftsPage = () => {
  const { userData } = useAuth();
  const { t } = useTranslation();
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
    if (!confirm(t('drafts.confirmDelete'))) return;

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
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-16">
          <div
            className="w-9 h-9 rounded-full border-2 border-gray-200 animate-spin"
            style={{ borderTopColor: "#1ABC9C" }}
          />
          <p className="mt-3 text-xs text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ backgroundColor: "#2D3E50" }}
          >
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#2D3E50" }}>
              {t('drafts.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage your saved draft posts
            </p>
          </div>
          {drafts.length > 0 && (
            <span
              className="ml-auto px-2.5 py-1 rounded-xl text-xs font-semibold text-white"
              style={{ backgroundColor: "#1ABC9C" }}
            >
              {drafts.length}
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-gray-100 rounded-2xl shadow-sm">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-7 h-7 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold mb-1" style={{ color: "#2D3E50" }}>
            {t('drafts.noDrafts')}
          </h3>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">
            {t('drafts.noDraftsDescription')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              <div className="p-5">
                {/* Draft Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold truncate" style={{ color: "#2D3E50" }}>
                      {draft.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2.5 py-1 bg-gray-50 text-gray-600 rounded-xl border border-gray-100 font-medium">
                        {draft.category}
                      </span>
                      <span className="text-xs text-gray-400">
                        {draft.type?.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Draft Content Preview */}
                <p className="text-sm text-gray-600 line-clamp-2 mb-3 leading-relaxed">
                  {draft.content}
                </p>

                {/* Draft Metadata */}
                <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {t('drafts.lastUpdated')} {formatDate(draft.updatedAt)}
                  </span>
                  {draft.tags && draft.tags.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-gray-400" />
                      {draft.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-gray-50 rounded-lg text-gray-500 border border-gray-100"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handlePublish(draft.id)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-white text-sm font-medium rounded-xl shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                    style={{ backgroundColor: "#1ABC9C" }}
                  >
                    <Send className="w-4 h-4" />
                    {t('drafts.publish')}
                  </button>
                  <button
                    onClick={() => {
                      /* Navigate to edit */
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-medium rounded-xl transition-all border border-gray-100"
                    style={{ color: "#2D3E50" }}
                  >
                    <Edit className="w-4 h-4" />
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(draft.id)}
                    className="ml-auto flex items-center gap-1.5 px-4 py-2.5 text-red-500 hover:bg-red-50 text-sm font-medium rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DraftsPage;
