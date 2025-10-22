import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";

const CreatePost = ({ type, onClose, onSuccess }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    tags: "",
    isAnonymous: false,
    attachments: [],
  });

  const [filePreview, setFilePreview] = useState([]);

  const config = {
    complaint: {
      title: "Report a Problem",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      ),
      iconBg: "bg-red-50",
      iconColor: "text-red-600",
      categories: [
        "Workplace Safety",
        "Equipment Issue",
        "Environment",
        "Harassment",
        "Discrimination",
        "Work Conditions",
        "Policy Violation",
        "Management",
        "Other",
      ],
      placeholder: {
        title: "Brief summary of the issue",
        description: "Describe the problem in detail...",
      },
      buttonText: "Submit Report",
      buttonColor: "bg-red-600 hover:bg-red-700",
      postType: "problem_report",
    },
    creative: {
      title: "Share Creative Content",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      ),
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      categories: [
        "Art & Design",
        "Photography",
        "Writing",
        "Music",
        "Video",
        "Innovation",
        "DIY Project",
        "Success Story",
        "Team Achievement",
        "Other",
      ],
      placeholder: {
        title: "Give your creation a catchy title",
        description: "Share your creative work, story, or idea...",
      },
      buttonText: "Share Creation",
      buttonColor: "bg-purple-600 hover:bg-purple-700",
      postType: "creative_content",
    },
    discussion: {
      title: "Start a Discussion",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
        />
      ),
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      categories: [
        "General Discussion",
        "Ideas & Suggestions",
        "Team Updates",
        "Announcements",
        "Questions",
        "Feedback",
        "Collaboration",
        "Events",
        "Other",
      ],
      placeholder: {
        title: "What would you like to discuss?",
        description:
          "Share your thoughts, ideas, or questions with the team...",
      },
      buttonText: "Start Discussion",
      buttonColor: "bg-blue-600 hover:bg-blue-700",
      postType: "team_discussion",
    },
  };

  const currentConfig = config[type] || config.creative;

  const handleInputChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: inputType === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);

    if (files.length + formData.attachments.length > 5) {
      setError("Maximum 5 files allowed");
      return;
    }

    const newPreviews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      type: file.type,
    }));

    setFilePreview((prev) => [...prev, ...newPreviews]);
    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...files],
    }));
  };

  const removeFile = (index) => {
    setFilePreview((prev) => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].preview);
      newPreviews.splice(index, 1);
      return newPreviews;
    });

    setFormData((prev) => {
      const newAttachments = [...prev.attachments];
      newAttachments.splice(index, 1);
      return {
        ...prev,
        attachments: newAttachments,
      };
    });
  };

  const uploadFiles = async () => {
    const uploadPromises = formData.attachments.map(async (file) => {
      const fileRef = ref(
        storage,
        `posts/${userData.companyId}/${Date.now()}_${file.name}`
      );
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      return {
        url,
        name: file.name,
        type: file.type,
        size: file.size,
      };
    });

    return await Promise.all(uploadPromises);
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError("Title is required");
      return false;
    }

    if (!formData.description.trim()) {
      setError("Description is required");
      return false;
    }

    if (!formData.category) {
      setError("Please select a category");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      let uploadedFiles = [];
      if (formData.attachments.length > 0) {
        uploadedFiles = await uploadFiles();
      }

      const tagsList = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const postData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: tagsList,
        type: currentConfig.postType,
        isAnonymous: formData.isAnonymous,
        attachments: uploadedFiles,
        authorId: userData.id,
        authorName: formData.isAnonymous ? "Anonymous" : userData.displayName,
        companyId: userData.companyId,
        status: "published",
        likes: 0,
        comments: 0,
        views: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "posts"), postData);

      if (onSuccess) {
        onSuccess();
      }

      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Error creating post:", error);
      setError("Failed to create post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`${currentConfig.iconBg} rounded-full p-2.5`}>
                <svg
                  className={`w-5 h-5 ${currentConfig.iconColor}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {currentConfig.icon}
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900">
                {currentConfig.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition"
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
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
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
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                placeholder={currentConfig.placeholder.title}
              />
            </div>

            {/* Description - Text Area with prominence */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                What's on your mind?
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows="8"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition resize-none"
                placeholder={currentConfig.placeholder.description}
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Share your thoughts, ideas, or stories
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              >
                <option value="">Select a category</option>
                {currentConfig.categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tags (Optional)
              </label>
              <input
                name="tags"
                type="text"
                value={formData.tags}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                placeholder="creativity, innovation, teamwork (comma-separated)"
              />
            </div>

            {/* Anonymous Option */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isAnonymous"
                name="isAnonymous"
                checked={formData.isAnonymous}
                onChange={handleInputChange}
                className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
              />
              <label htmlFor="isAnonymous" className="text-sm text-slate-700">
                Post anonymously
              </label>
            </div>

            {/* Attachments (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Add Attachments (Optional)
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-slate-300 transition">
                <input
                  type="file"
                  id="fileUpload"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={formData.attachments.length >= 5}
                />
                <label htmlFor="fileUpload" className="cursor-pointer">
                  <svg
                    className="w-10 h-10 text-slate-400 mx-auto mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-sm text-slate-600">
                    <span className="text-slate-900 font-medium">
                      Click to upload
                    </span>{" "}
                    or drag and drop
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Images, Videos, PDFs, Documents (Max 5 files)
                  </p>
                </label>
              </div>

              {/* File Previews */}
              {filePreview.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {filePreview.map((file, index) => (
                    <div key={index} className="relative group">
                      {file.type.startsWith("image/") ? (
                        <img
                          src={file.preview}
                          alt={file.name}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-24 bg-slate-100 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                      >
                        ×
                      </button>
                      <p className="text-xs text-slate-600 mt-1 truncate">
                        {file.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${currentConfig.buttonColor}`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Publishing...
                </span>
              ) : (
                currentConfig.buttonText
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
