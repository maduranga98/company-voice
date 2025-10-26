import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";

const TagManagement = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "blue",
    icon: "👤",
    priority: 1,
  });

  const colorOptions = [
    { value: "purple", label: "Purple", bgClass: "bg-purple-100", textClass: "text-purple-800" },
    { value: "blue", label: "Blue", bgClass: "bg-blue-100", textClass: "text-blue-800" },
    { value: "indigo", label: "Indigo", bgClass: "bg-indigo-100", textClass: "text-indigo-800" },
    { value: "green", label: "Green", bgClass: "bg-green-100", textClass: "text-green-800" },
    { value: "yellow", label: "Yellow", bgClass: "bg-yellow-100", textClass: "text-yellow-800" },
    { value: "red", label: "Red", bgClass: "bg-red-100", textClass: "text-red-800" },
    { value: "gray", label: "Gray", bgClass: "bg-gray-100", textClass: "text-gray-800" },
  ];

  const iconOptions = ["👔", "🎯", "📊", "🔧", "👤", "⭐", "🏆", "💼", "🎓", "🔑"];

  useEffect(() => {
    loadTags();
  }, [userData]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const tagsRef = collection(db, "userTags");
      const q = query(tagsRef, where("companyId", "==", userData.companyId));
      const snapshot = await getDocs(q);

      const tagsData = [];
      snapshot.forEach((doc) => {
        tagsData.push({ id: doc.id, ...doc.data() });
      });

      // Sort by priority (highest first)
      tagsData.sort((a, b) => b.priority - a.priority);
      setTags(tagsData);
    } catch (error) {
      console.error("Error loading tags:", error);
      alert("Failed to load tags");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("Please enter a tag name");
      return;
    }

    try {
      setLoading(true);

      const tagData = {
        ...formData,
        companyId: userData.companyId,
        updatedAt: serverTimestamp(),
      };

      if (editingTag) {
        // Update existing tag
        const tagRef = doc(db, "userTags", editingTag.id);
        await updateDoc(tagRef, tagData);
        alert("Tag updated successfully!");
      } else {
        // Create new tag
        tagData.createdAt = serverTimestamp();
        tagData.createdBy = userData.uid;
        await addDoc(collection(db, "userTags"), tagData);
        alert("Tag created successfully!");
      }

      setShowCreateModal(false);
      setEditingTag(null);
      setFormData({ name: "", description: "", color: "blue", icon: "👤", priority: 1 });
      loadTags();
    } catch (error) {
      console.error("Error saving tag:", error);
      alert("Failed to save tag");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      description: tag.description || "",
      color: tag.color,
      icon: tag.icon,
      priority: tag.priority,
    });
    setShowCreateModal(true);
  };

  const handleDelete = async (tagId) => {
    if (!confirm("Are you sure you want to delete this tag? This action cannot be undone.")) {
      return;
    }

    try {
      setLoading(true);
      await deleteDoc(doc(db, "userTags", tagId));
      alert("Tag deleted successfully!");
      loadTags();
    } catch (error) {
      console.error("Error deleting tag:", error);
      alert("Failed to delete tag");
    } finally {
      setLoading(false);
    }
  };

  const getColorClasses = (color) => {
    const colorOption = colorOptions.find((c) => c.value === color);
    return colorOption || colorOptions[0];
  };

  if (loading && tags.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tag Management</h1>
          <p className="text-gray-600">
            Create and manage tags to categorize members by their roles and levels
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTag(null);
            setFormData({ name: "", description: "", color: "blue", icon: "👤", priority: 1 });
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Tag
        </button>
      </div>

      {/* Tags List */}
      {tags.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tags Created</h3>
          <p className="text-gray-600 mb-4">
            Create your first tag to categorize members by their roles
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Create First Tag
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tags.map((tag) => {
            const colorClasses = getColorClasses(tag.color);
            return (
              <div
                key={tag.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`inline-flex items-center px-3 py-1.5 rounded-lg ${colorClasses.bgClass} ${colorClasses.textClass}`}>
                    <span className="text-xl mr-2">{tag.icon}</span>
                    <span className="font-semibold">{tag.name}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Priority: {tag.priority}
                  </span>
                </div>

                {tag.description && (
                  <p className="text-sm text-gray-600 mb-4">{tag.description}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(tag)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {editingTag ? "Edit Tag" : "Create New Tag"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tag Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tag Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Executive, Manager, etc."
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="e.g., C-level executives, VPs"
                    rows="2"
                  />
                </div>

                {/* Icon Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Icon
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {iconOptions.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon })}
                        className={`p-3 text-2xl border-2 rounded-lg hover:border-blue-500 transition ${
                          formData.icon === icon
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {colorOptions.map((colorOption) => (
                      <button
                        key={colorOption.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: colorOption.value })}
                        className={`px-3 py-2 text-sm font-medium rounded-lg border-2 ${colorOption.bgClass} ${colorOption.textClass} ${
                          formData.color === colorOption.value
                            ? "border-gray-800"
                            : "border-transparent"
                        } hover:border-gray-600 transition`}
                      >
                        {colorOption.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority (higher = shown first)
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                    max="10"
                  />
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview
                  </label>
                  <div className={`inline-flex items-center px-3 py-1.5 rounded-lg ${getColorClasses(formData.color).bgClass} ${getColorClasses(formData.color).textClass}`}>
                    <span className="text-xl mr-2">{formData.icon}</span>
                    <span className="font-semibold">{formData.name || "Tag Name"}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingTag(null);
                      setFormData({ name: "", description: "", color: "blue", icon: "👤", priority: 1 });
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {loading ? "Saving..." : editingTag ? "Update Tag" : "Create Tag"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagManagement;
