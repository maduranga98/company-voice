import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";

const CreatePost = ({ type = "creative", onClose, onSuccess }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    tags: "",
    isAnonymous: false,
  });

  // Validate user data on component mount
  useEffect(() => {
    if (!userData) {
      setError("Loading user data...");
    } else if (!userData.id) {
      setError("User authentication required. Please log in again.");
    } else if (!userData.companyId) {
      setError("Company information missing. Please contact support.");
    } else {
      setError(""); // Clear error if everything is valid
    }
  }, [userData]);

  const config = {
    creative: {
      title: "Share Something Creative",
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
        "Art",
        "Design",
        "Writing",
        "Photography",
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
        "Safety Issue",
        "Equipment Problem",
        "Workplace Concern",
        "Process Issue",
        "Communication Gap",
        "Resource Shortage",
        "Technical Problem",
        "Environment Issue",
        "Policy Concern",
        "Other",
      ],
      placeholder: {
        title: "Briefly describe the problem",
        description: "Provide details about the issue you're experiencing...",
      },
      buttonText: "Submit Report",
      buttonColor: "bg-red-600 hover:bg-red-700",
      postType: "problem_report",
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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const maxFiles = 5;

    // Validate each file
    const validFiles = [];
    const errors = [];

    files.forEach((file) => {
      const isValidType =
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        file.type === "application/pdf" ||
        file.type.includes("document") ||
        file.type.includes("word") ||
        file.type.includes("msword") ||
        file.type.includes("officedocument");

      const isValidSize = file.size <= maxFileSize;

      if (!isValidType) {
        errors.push(`${file.name}: Invalid file type. Only images, videos, PDFs, and documents are allowed.`);
      } else if (!isValidSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        errors.push(`${file.name}: File too large (${fileSizeMB}MB). Maximum size is 10MB.`);
      } else {
        validFiles.push(file);
      }
    });

    // Check total file count
    if (validFiles.length + selectedFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed. You selected ${validFiles.length + selectedFiles.length} files total.`);
      return;
    }

    // Show errors if any
    if (errors.length > 0) {
      setError(errors.join("\n"));
      // Still add valid files if there are any
      if (validFiles.length === 0) {
        return;
      }
    } else {
      setError(""); // Clear any previous errors
    }

    const fileObjects = validFiles.map((file) => ({
      file,
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
      name: file.name,
      type: file.type,
      size: file.size,
    }));

    setSelectedFiles((prev) => [...prev, ...fileObjects]);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return [];

    setUploadProgress(0);
    const totalFiles = selectedFiles.length;
    let completedFiles = 0;

    const uploadPromises = selectedFiles.map(async (fileObj) => {
      const file = fileObj.file;
      const fileRef = ref(
        storage,
        `posts/${userData.companyId}/${Date.now()}_${file.name}`
      );

      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Calculate overall progress
            const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes);
            const overallProgress = ((completedFiles + fileProgress) / totalFiles) * 100;
            setUploadProgress(Math.round(overallProgress));
          },
          (error) => {
            console.error('Upload error:', error);
            reject(error);
          },
          async () => {
            // Upload completed successfully
            completedFiles++;
            const url = await getDownloadURL(fileRef);
            resolve({
              url,
              name: file.name,
              type: file.type,
              size: file.size,
            });
          }
        );
      });
    });

    const results = await Promise.all(uploadPromises);
    setUploadProgress(100);
    return results;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate user data
      if (!userData?.id) {
        throw new Error("User authentication required. Please log in again.");
      }

      if (!userData?.companyId) {
        throw new Error("Company information missing. Please contact support.");
      }

      // Upload files if any
      let uploadedAttachments = [];
      if (selectedFiles.length > 0) {
        try {
          uploadedAttachments = await uploadFiles();
        } catch (uploadError) {
          console.error("Error uploading files:", uploadError);
          throw new Error("Failed to upload attachments. Please try again.");
        }
      }

      // Prepare post data
      const postData = {
        title: formData.title.trim(),
        content: formData.description.trim(),
        category: formData.category,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        isAnonymous: formData.isAnonymous,
        authorId: userData.id,
        authorName: formData.isAnonymous
          ? "Anonymous"
          : userData.displayName || "Unknown User",
        authorEmail: userData.email || "",
        companyId: userData.companyId,
        type:
          type === "creative"
            ? "creative_content"
            : type === "complaint"
            ? "problem_report"
            : "team_discussion",
        status: "open",
        priority: "medium",
        attachments: uploadedAttachments, // Save uploaded file URLs
        likes: [],
        comments: 0,
        views: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Save to posts collection - all post types go to the same collection
      await addDoc(collection(db, "posts"), postData);

      // Success callbacks
      if (onSuccess) {
        onSuccess();
      }

      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Error creating post:", error);

      // User-friendly error messages
      if (error.message.includes("authentication")) {
        setError("Please log in again to create a post.");
      } else if (error.message.includes("Company information")) {
        setError(error.message);
      } else if (error.message.includes("attachments")) {
        setError(error.message);
      } else if (error.code === "permission-denied") {
        setError(
          "You don't have permission to create posts. Please contact your admin."
        );
      } else {
        setError("Failed to create post. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999] overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[calc(100vh-4rem)]">
        {/* STICKY HEADER - Always visible at top */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-slate-100 p-6 z-10">
          <div className="flex items-center justify-between">
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
              type="button"
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-2 transition"
              aria-label="Close modal"
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
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form Fields */}
          <form
            id="create-post-form"
            onSubmit={handleSubmit}
            className="space-y-5"
          >
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
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="fileUpload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <svg
                    className="w-10 h-10 text-slate-400 mb-2"
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
                  <span className="text-sm text-slate-600 font-medium">
                    Click to upload files
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    Images, videos, PDFs, or documents (Max 10MB each, 5 files
                    total)
                  </span>
                </label>
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      {file.preview ? (
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
          </form>
        </div>

        {/* STICKY FOOTER - Submit button always visible at bottom */}
        <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-slate-100 p-6 z-10">
          {/* Upload Progress Bar */}
          {loading && uploadProgress > 0 && uploadProgress < 100 && selectedFiles.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                <span>Uploading files...</span>
                <span className="font-semibold">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            form="create-post-form"
            disabled={loading || !userData?.id || !userData?.companyId}
            className={`w-full py-3 rounded-lg font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${currentConfig.buttonColor}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {uploadProgress > 0 && uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Publishing...'}
              </span>
            ) : (
              currentConfig.buttonText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
