import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { FileText, Plus, Edit, Trash2, TrendingUp } from "lucide-react";
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getMostUsedTemplates,
} from "../services/postTemplatesService";

const TemplatesPage = () => {
  const { userData } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [mostUsed, setMostUsed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const isAdmin =
    userData?.role === "company_admin" ||
    userData?.role === "super_admin" ||
    userData?.role === "hr";

  useEffect(() => {
    loadTemplates();
  }, [userData]);

  const loadTemplates = async () => {
    if (!userData?.companyId) return;

    setLoading(true);
    setError("");

    try {
      const [allTemplates, popularTemplates] = await Promise.all([
        getTemplates(userData.companyId),
        getMostUsedTemplates(userData.companyId, 3),
      ]);
      setTemplates(allTemplates);
      setMostUsed(popularTemplates);
    } catch (error) {
      console.error("Error loading templates:", error);
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      await deleteTemplate(templateId, {
        id: userData.id,
        displayName: userData.displayName,
        role: userData.role,
      });
      loadTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      setError("Failed to delete template");
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Post Templates
          </h1>
          <p className="text-slate-600 mt-1">
            Create and manage reusable post templates
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Most Used Templates */}
      {mostUsed.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Most Popular Templates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mostUsed.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={() => setEditingTemplate(template)}
                onDelete={handleDelete}
                isAdmin={isAdmin}
                showStats
              />
            ))}
          </div>
        </div>
      )}

      {/* All Templates */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          All Templates
        </h2>
        {templates.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No templates found</p>
            <p className="text-sm text-slate-500 mt-1">
              Create your first template to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={() => setEditingTemplate(template)}
                onDelete={handleDelete}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingTemplate) && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
          }}
          onSuccess={() => {
            loadTemplates();
            setShowCreateModal(false);
            setEditingTemplate(null);
          }}
          userData={userData}
        />
      )}
    </div>
  );
};

const TemplateCard = ({ template, onEdit, onDelete, isAdmin, showStats }) => {
  const canEdit = isAdmin;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition">
      {/* Template Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">{template.name}</h3>
          <p className="text-xs text-slate-500 mt-1">{template.description}</p>
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(template)}
              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(template.id)}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Template Details */}
      <div className="space-y-2 mb-3">
        <div className="text-xs">
          <span className="text-slate-500">Type:</span>
          <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
            {template.type?.replace(/_/g, " ")}
          </span>
        </div>
        <div className="text-xs">
          <span className="text-slate-500">Category:</span>
          <span className="ml-2 text-slate-700">{template.category}</span>
        </div>
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-0.5 bg-slate-50 text-slate-600 text-xs rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {showStats && template.useCount > 0 && (
        <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
          Used {template.useCount} {template.useCount === 1 ? "time" : "times"}
        </div>
      )}
    </div>
  );
};

const TemplateModal = ({ template, onClose, onSuccess, userData }) => {
  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    type: template?.type || "team_discussion",
    title: template?.title || "",
    content: template?.content || "",
    category: template?.category || "",
    tags: template?.tags?.join(", ") || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const templateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category,
        tags: formData.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (template) {
        await updateTemplate(template.id, templateData, {
          id: userData.id,
          displayName: userData.displayName,
          role: userData.role,
        });
      } else {
        await createTemplate(templateData, userData);
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving template:", error);
      setError(error.message || "Failed to save template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold">
            {template ? "Edit Template" : "Create Template"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Post Type
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="creative_content">Creative Content</option>
              <option value="problem_report">Problem Report</option>
              <option value="team_discussion">Team Discussion</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Default Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Default Content
            </label>
            <textarea
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              required
              rows="8"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) =>
                setFormData({ ...formData, tags: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {loading ? "Saving..." : template ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TemplatesPage;
