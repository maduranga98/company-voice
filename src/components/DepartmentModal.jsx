import { useState, useEffect } from "react";

const DepartmentModal = ({ department, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: "🏢",
    color: "blue",
    parentDepartmentId: null,
    isActive: true,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Available icons for departments
  const departmentIcons = [
    { icon: "🏢", label: "Building" },
    { icon: "⚙️", label: "Engineering" },
    { icon: "👥", label: "People" },
    { icon: "💰", label: "Finance" },
    { icon: "📢", label: "Marketing" },
    { icon: "💼", label: "Business" },
    { icon: "💻", label: "Technology" },
    { icon: "⚖️", label: "Legal" },
    { icon: "📋", label: "Admin" },
    { icon: "🔧", label: "Operations" },
    { icon: "🎨", label: "Creative" },
    { icon: "📊", label: "Analytics" },
    { icon: "🛡️", label: "Security" },
    { icon: "🎯", label: "Strategy" },
    { icon: "🏭", label: "Production" },
    { icon: "🚚", label: "Logistics" },
  ];

  // Available colors
  const colors = [
    "blue",
    "purple",
    "green",
    "red",
    "orange",
    "yellow",
    "indigo",
    "pink",
    "teal",
    "gray",
  ];

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || "",
        description: department.description || "",
        icon: department.icon || "🏢",
        color: department.color || "blue",
        parentDepartmentId: department.parentDepartmentId || null,
        isActive: department.isActive !== false,
      });
    }
  }, [department]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Department name is required";
    }

    if (formData.name.length > 50) {
      newErrors.name = "Department name must be less than 50 characters";
    }

    if (formData.description && formData.description.length > 200) {
      newErrors.description = "Description must be less than 200 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      await onSave({
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim(),
      });
    } catch (error) {
      console.error("Error saving department:", error);
      setErrors({ submit: "Failed to save department. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {department ? "Edit Department" : "Create New Department"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Department Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g., Engineering, Human Resources"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.description ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Brief description of the department's role..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-500">{errors.description}</p>
            )}
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department Icon
            </label>
            <div className="grid grid-cols-8 gap-2">
              {departmentIcons.map(({ icon, label }) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, icon }))}
                  className={`p-3 text-2xl rounded-lg border-2 transition-all ${
                    formData.icon === icon
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  title={label}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, color }))}
                  className={`w-12 h-12 rounded-lg border-2 transition-all ${
                    formData.color === color
                      ? "border-gray-800 scale-110"
                      : "border-gray-300"
                  }`}
                  style={{
                    backgroundColor:
                      color === "blue"
                        ? "#3B82F6"
                        : color === "purple"
                        ? "#8B5CF6"
                        : color === "green"
                        ? "#10B981"
                        : color === "red"
                        ? "#EF4444"
                        : color === "orange"
                        ? "#F97316"
                        : color === "yellow"
                        ? "#EAB308"
                        : color === "indigo"
                        ? "#6366F1"
                        : color === "pink"
                        ? "#EC4899"
                        : color === "teal"
                        ? "#14B8A6"
                        : "#6B7280",
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Department is active
            </label>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {department ? "Update Department" : "Create Department"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentModal;
