import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { History, X, Upload, FileText, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { editPost, getPostEditHistory, updateDraft } from "../services/postEnhancementsService";
import { encryptAuthorId } from "../services/postManagementService";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../config/firebase";

const NAVY = "#2D3E50";
const TEAL = "#1ABC9C";

const EditPost = ({ post, onClose, onSuccess }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [editHistory, setEditHistory] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState(post.attachments || []);
  const [newFiles, setNewFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isAnonymous, setIsAnonymous] = useState(post.isAnonymous || false);

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
        errors.push(
          `${file.name}: Invalid file type. Only images, videos, PDFs, and documents are allowed.`
        );
      } else if (!isValidSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        errors.push(
          `${file.name}: File too large (${fileSizeMB}MB). Maximum size is 10MB.`
        );
      } else {
        validFiles.push(file);
      }
    });

    // Check total file count
    const totalFiles = existingAttachments.length + newFiles.length + validFiles.length;
    if (totalFiles > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed. You currently have ${totalFiles} files total.`);
      return;
    }

    // Show errors if any
    if (errors.length > 0) {
      setError(errors.join("\n"));
      if (validFiles.length === 0) {
        return;
      }
    } else {
      setError("");
    }

    const fileObjects = validFiles.map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      name: file.name,
      type: file.type,
      size: file.size,
    }));

    setNewFiles((prev) => [...prev, ...fileObjects]);
  };

  const removeExistingAttachment = (index) => {
    setExistingAttachments((prev) => {
      const newAttachments = [...prev];
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  const removeNewFile = (index) => {
    setNewFiles((prev) => {
      const files = [...prev];
      if (files[index].preview) {
        URL.revokeObjectURL(files[index].preview);
      }
      files.splice(index, 1);
      return files;
    });
  };

  const uploadNewFiles = async () => {
    if (newFiles.length === 0) return [];

    setUploadProgress(0);
    const totalFiles = newFiles.length;
    let completedFiles = 0;

    const uploadPromises = newFiles.map(async (fileObj) => {
      const file = fileObj.file;
      const fileRef = ref(
        storage,
        `posts/${userData.companyId}/${Date.now()}_${file.name}`
      );

      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const fileProgress = snapshot.bytesTransferred / snapshot.totalBytes;
            const overallProgress = ((completedFiles + fileProgress) / totalFiles) * 100;
            setUploadProgress(Math.round(overallProgress));
          },
          (error) => {
            console.error("Upload error:", error);
            reject(error);
          },
          async () => {
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
      if (!userData?.id && !userData?.uid) {
        throw new Error("User authentication required");
      }

      // Upload new files if any
      let uploadedNewFiles = [];
      if (newFiles.length > 0) {
        try {
          uploadedNewFiles = await uploadNewFiles();
        } catch (uploadError) {
          console.error("Error uploading files:", uploadError);
          throw new Error("Failed to upload new attachments. Please try again.");
        }
      }

      // Combine existing attachments with newly uploaded files
      const allAttachments = [...existingAttachments, ...uploadedNewFiles];

      const userId = userData.id || userData.uid;

      const updateData = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        attachments: allAttachments,
      };

      if (post.isDraft) {
        // For drafts: use updateDraft (no author check on encrypted ID) and persist anonymous choice
        await updateDraft(post.id, {
          ...updateData,
          isAnonymous,
          authorId: isAnonymous ? encryptAuthorId(userId) : userId,
          authorName: isAnonymous ? "Anonymous" : (userData.displayName || "Unknown"),
          creatorId: userId,
        });
      } else {
        await editPost(post.id, updateData, {
          id: userId,
          uid: userData.uid || userData.id,
          displayName: userData.displayName,
          role: userData.role,
        });
      }

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-2xl my-8 flex flex-col max-h-[calc(100vh-4rem)]">
        {/* HEADER */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${NAVY}10` }}
              >
                <FileText className="w-4.5 h-4.5" style={{ color: NAVY }} />
              </div>
              <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
                Edit Post
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                type="button"
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                style={{ color: NAVY }}
              >
                <History className="w-4 h-4" />
                History
              </button>
              <button
                onClick={onClose}
                type="button"
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl p-2 transition-colors"
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
            <div className="mb-5 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
              <h3 className="text-sm font-semibold mb-3" style={{ color: NAVY }}>
                Edit History
              </h3>
              {editHistory.length === 0 ? (
                <p className="text-sm text-gray-500">No edit history yet</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {editHistory.map((edit) => (
                    <div
                      key={edit.id}
                      className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: NAVY }}>
                          {edit.editorName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(edit.editedAt)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(edit.changes || {}).map(
                          ([field, change]) => (
                            <div key={field} className="text-xs">
                              <span className="font-medium" style={{ color: NAVY }}>
                                {field}:
                              </span>
                              <div className="ml-2 mt-1">
                                <div className="text-red-500 line-through">
                                  {String(change.old).substring(0, 100)}
                                  {String(change.old).length > 100 ? "..." : ""}
                                </div>
                                <div style={{ color: TEAL }}>
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
            <div className="mb-4 p-3.5 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Edit Count */}
          {post.editCount > 0 && (
            <div className="mb-4 text-sm text-gray-500">
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
              <label className="block text-sm font-medium mb-1.5" style={{ color: NAVY }}>
                Title
              </label>
              <input
                name="title"
                type="text"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                style={{ color: NAVY, "--tw-ring-color": TEAL }}
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: NAVY }}>
                Content
              </label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                required
                rows="10"
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow resize-none"
                style={{ color: NAVY, "--tw-ring-color": TEAL }}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: NAVY }}>
                Category
              </label>
              <input
                name="category"
                type="text"
                value={formData.category}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                style={{ color: NAVY, "--tw-ring-color": TEAL }}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: NAVY }}>
                Tags
              </label>
              <input
                name="tags"
                type="text"
                value={formData.tags}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                style={{ color: NAVY, "--tw-ring-color": TEAL }}
                placeholder="tag1, tag2, tag3"
              />
            </div>

            {/* Anonymous toggle — only for drafts */}
            {post.isDraft && (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isAnonymous ? "#1ABC9C20" : "#2D3E5010" }}>
                    {isAnonymous ? <EyeOff className="w-4 h-4" style={{ color: "#1ABC9C" }} /> : <Eye className="w-4 h-4" style={{ color: NAVY }} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: NAVY }}>Post Anonymously</p>
                    <p className="text-xs text-gray-400">{isAnonymous ? "Your identity will be hidden" : "Your name will be visible"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAnonymous((v) => !v)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${isAnonymous ? "bg-[#1ABC9C]" : "bg-gray-200"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isAnonymous ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            )}

            {/* Attachments Section */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: NAVY }}>
                Attachments
              </label>

              {/* Existing Attachments */}
              {existingAttachments.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-2">Existing Files:</p>
                  <div className="space-y-2">
                    {existingAttachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="w-4 h-4 flex-shrink-0" style={{ color: NAVY }} />
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm hover:underline truncate"
                            style={{ color: TEAL }}
                          >
                            {attachment.name}
                          </a>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            ({(attachment.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExistingAttachment(index)}
                          className="ml-2 p-1.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Files */}
              {newFiles.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-2">New Files to Upload:</p>
                  <div className="space-y-2">
                    {newFiles.map((fileObj, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-xl border"
                        style={{ backgroundColor: `${TEAL}08`, borderColor: `${TEAL}30` }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {fileObj.preview ? (
                            <img
                              src={fileObj.preview}
                              alt={fileObj.name}
                              className="w-8 h-8 object-cover rounded-lg flex-shrink-0"
                            />
                          ) : (
                            <FileText className="w-4 h-4 flex-shrink-0" style={{ color: TEAL }} />
                          )}
                          <span className="text-sm truncate" style={{ color: NAVY }}>
                            {fileObj.name}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            ({(fileObj.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeNewFile(index)}
                          className="ml-2 p-1.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mb-3">
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%`, backgroundColor: TEAL }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              {/* Add Files Button */}
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors shadow-sm"
                  style={{ color: NAVY }}
                >
                  <Upload className="w-4 h-4" />
                  Add Files
                </label>
                <p className="text-xs text-gray-400">
                  Max 5 files, 10MB each. Images, videos, PDFs, and documents.
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-gray-100 p-6 z-10">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-post-form"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-sm"
              style={{ backgroundColor: loading ? "#9CA3AF" : TEAL }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPost;
