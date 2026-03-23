import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, doc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import PollCreator from "./PollCreator";
import AnonymityGuaranteeScreen from "./AnonymityGuaranteeScreen";
import { useTranslation } from "react-i18next";
import { encryptAuthorId } from "../services/postManagementService";
import { X, Paperclip, Eye, EyeOff, Send, Sparkles, AlertTriangle, MessageCircle, ChevronDown, Image as ImageIcon, FileText, Shield, Lock } from "lucide-react";

const CreatePost = ({ type = "creative", onClose, onSuccess }) => {
  const { userData } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pollData, setPollData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [showAnonymityGuarantee, setShowAnonymityGuarantee] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    tags: "",
    isAnonymous: false,
    privacyLevel: "company_public",
    departmentId: "",
  });

  useEffect(() => {
    if (!userData) {
      setError("Loading user data...");
    } else if (!userData.id) {
      setError("User authentication required. Please log in again.");
    } else if (!userData.companyId) {
      setError("Company information missing. Please contact support.");
    } else {
      setError("");
    }
  }, [userData]);

  useEffect(() => {
    const loadDepartments = async () => {
      if (!userData?.companyId) return;
      try {
        const deptRef = collection(db, "departments");
        const q = query(deptRef, where("companyId", "==", userData.companyId), orderBy("name", "asc"));
        const snapshot = await getDocs(q);
        const deptList = [];
        snapshot.forEach((doc) => { deptList.push({ id: doc.id, ...doc.data() }); });
        setDepartments(deptList);
      } catch (error) {
        console.error("Error loading departments:", error);
      }
    };
    loadDepartments();
  }, [userData?.companyId]);

  const config = {
    creative: {
      title: "Share Something Creative",
      icon: Sparkles,
      iconColor: "text-violet-500",
      iconBg: "bg-violet-50",
      accentColor: "violet",
      categories: ["Art", "Design", "Writing", "Photography", "Music", "Video", "Innovation", "DIY Project", "Success Story", "Team Achievement", "Other"],
      placeholder: { title: "Give your creation a catchy title", description: "Share your creative work, story, or idea..." },
      buttonText: "Share Creation",
      buttonGradient: "from-violet-500 to-fuchsia-500",
      postType: "creative_content",
    },
    complaint: {
      title: "Report a Problem",
      icon: AlertTriangle,
      iconColor: "text-rose-500",
      iconBg: "bg-rose-50",
      accentColor: "rose",
      categories: ["Safety Issue", "Equipment Problem", "Workplace Concern", "Process Issue", "Communication Gap", "Resource Shortage", "Technical Problem", "Environment Issue", "Policy Concern", "Harassment", "Other"],
      placeholder: { title: "Briefly describe the problem", description: "Provide details about the issue you're experiencing..." },
      buttonText: "Submit Report",
      buttonGradient: "from-rose-500 to-orange-500",
      postType: "problem_report",
    },
    discussion: {
      title: "Start a Discussion",
      icon: MessageCircle,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-50",
      accentColor: "blue",
      categories: ["General Discussion", "Ideas & Suggestions", "Team Updates", "Announcements", "Questions", "Feedback", "Collaboration", "Events", "Other"],
      placeholder: { title: "What would you like to discuss?", description: "Share your thoughts, ideas, or questions with the team..." },
      buttonText: "Start Discussion",
      buttonGradient: "from-blue-500 to-cyan-500",
      postType: "team_discussion",
    },
  };

  const currentConfig = config[type] || config.creative;
  const IconComponent = currentConfig.icon;

  const handleInputChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    if (name === "isAnonymous" && checked && type === "complaint") {
      const alreadySeen = sessionStorage.getItem("voxwel_anon_guarantee_shown");
      if (!alreadySeen) {
        setShowAnonymityGuarantee(true);
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [name]: inputType === "checkbox" ? checked : value }));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxFileSize = 10 * 1024 * 1024;
    const maxFiles = 5;
    const validFiles = [];
    const errors = [];

    files.forEach((file) => {
      const isValidType = file.type.startsWith("image/") || file.type.startsWith("video/") || file.type === "application/pdf" || file.type.includes("document") || file.type.includes("word") || file.type.includes("msword") || file.type.includes("officedocument");
      const isValidSize = file.size <= maxFileSize;
      if (!isValidType) {
        errors.push(`${file.name}: Invalid file type.`);
      } else if (!isValidSize) {
        errors.push(`${file.name}: File too large (max 10MB).`);
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length + selectedFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed.`);
      return;
    }
    if (errors.length > 0) {
      setError(errors.join("\n"));
      if (validFiles.length === 0) return;
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
    setSelectedFiles((prev) => [...prev, ...fileObjects]);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) URL.revokeObjectURL(newFiles[index].preview);
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
      const fileRef = ref(storage, `posts/${userData.companyId}/${Date.now()}_${file.name}`);
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(fileRef, file);
        uploadTask.on("state_changed",
          (snapshot) => {
            const fileProgress = snapshot.bytesTransferred / snapshot.totalBytes;
            const overallProgress = ((completedFiles + fileProgress) / totalFiles) * 100;
            setUploadProgress(Math.round(overallProgress));
          },
          (error) => reject(error),
          async () => {
            completedFiles++;
            const url = await getDownloadURL(fileRef);
            resolve({ url, name: file.name, type: file.type, size: file.size });
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
      if (!userData?.id) throw new Error("User authentication required. Please log in again.");
      if (!userData?.companyId) throw new Error("Company information missing. Please contact support.");
      if (formData.privacyLevel === "department_only" && !formData.departmentId) throw new Error("Please select a department for department-only posts.");

      let uploadedAttachments = [];
      if (selectedFiles.length > 0) {
        try {
          uploadedAttachments = await uploadFiles();
        } catch (uploadError) {
          throw new Error("Failed to upload attachments. Please try again.");
        }
      }

      const postData = {
        title: formData.title.trim(),
        content: formData.description.trim(),
        category: formData.category,
        tags: formData.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        isAnonymous: formData.isAnonymous,
        authorId: formData.isAnonymous ? encryptAuthorId(userData.id) : userData.id,
        authorName: formData.isAnonymous ? "Anonymous" : userData.displayName || "Unknown User",
        authorEmail: userData.email || "",
        authorDepartmentId: userData.departmentId || null,
        companyId: userData.companyId,
        type: currentConfig.postType,
        status: "open",
        priority: "medium",
        privacyLevel: formData.privacyLevel,
        departmentId: formData.privacyLevel === "department_only" ? formData.departmentId : null,
        attachments: uploadedAttachments,
        poll: pollData,
        likes: [],
        comments: 0,
        views: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const newPostRef = await addDoc(collection(db, "posts"), postData);

      // Notify HR and company admin users when an hr_only post is created
      if (postData.privacyLevel === "hr_only") {
        try {
          const hrUsersQuery = query(
            collection(db, "users"),
            where("companyId", "==", postData.companyId),
            where("role", "in", ["hr", "company_admin"])
          );
          const hrSnapshot = await getDocs(hrUsersQuery);
          const notificationPromises = hrSnapshot.docs.map((hrDoc) =>
            addDoc(collection(db, "notifications"), {
              userId: hrDoc.id,
              type: "hr_post_received",
              title: "New HR Post Received",
              message: `A new post has been sent directly to HR: "${postData.title}"`,
              companyId: postData.companyId,
              metadata: { postId: newPostRef.id },
              read: false,
              createdAt: serverTimestamp(),
            })
          );
          await Promise.all(notificationPromises);
        } catch (notifError) {
          // Don't fail post creation if notifications fail
          console.error("Error sending HR notifications:", notifError);
        }
      }

      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (error) {
      console.error("Error creating post:", error);
      if (error.message.includes("authentication")) {
        setError("Please log in again to create a post.");
      } else if (error.message.includes("Company information")) {
        setError(error.message);
      } else if (error.message.includes("attachments")) {
        setError(error.message);
      } else if (error.code === "permission-denied") {
        setError("You don't have permission to create posts. Please contact your admin.");
      } else {
        setError(error.message || "Failed to create post. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const privacyOptions = [
    { value: "company_public", label: t('createPost.companyPublic'), icon: Eye, desc: "Visible to all employees" },
    { value: "department_only", label: t('createPost.departmentOnly'), icon: EyeOff, desc: "Department members only" },
    { value: "hr_only", label: t('createPost.sendToHR', 'Send to HR only'), icon: Shield, desc: t('createPost.sendToHRDesc', 'Only HR and admins can see this') },
  ];

  return (
    <>
      {showAnonymityGuarantee && (
        <AnonymityGuaranteeScreen
          onContinue={() => {
            sessionStorage.setItem("voxwel_anon_guarantee_shown", "1");
            setFormData((prev) => ({ ...prev, isAnonymous: true }));
            setShowAnonymityGuarantee(false);
          }}
          onBack={() => setShowAnonymityGuarantee(false)}
        />
      )}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4 flex flex-col max-h-[calc(100vh-2rem)]">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 ${currentConfig.iconBg} rounded-xl flex items-center justify-center`}>
                <IconComponent className={`w-4.5 h-4.5 ${currentConfig.iconColor}`} size={18} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{currentConfig.title}</h2>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Form */}
          <div className="overflow-y-auto flex-1 p-5">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
              </div>
            )}

            <form id="create-post-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <input
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleInputChange}
                  required={!pollData}
                  className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-gray-200 text-lg font-semibold text-gray-900 placeholder-gray-300 focus:outline-none focus:border-gray-900 transition-colors"
                  placeholder={currentConfig.placeholder.title}
                />
              </div>

              {/* Description */}
              <div>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required={!pollData}
                  rows="5"
                  className="w-full px-0 py-2 bg-transparent border-0 border-b border-gray-100 text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors resize-none text-sm leading-relaxed"
                  placeholder={currentConfig.placeholder.description}
                />
              </div>

              {/* Category - Pill selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {t('createPost.postCategory')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {currentConfig.categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        formData.category === cat
                          ? `bg-gradient-to-r ${currentConfig.buttonGradient} text-white shadow-sm`
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Poll Creator */}
              <PollCreator onPollChange={setPollData} initialPoll={pollData} />

              {/* Attachments */}
              <div>
                <input
                  type="file"
                  id="fileUpload"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {selectedFiles.length === 0 ? (
                  <label
                    htmlFor="fileUpload"
                    className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition group"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition">
                      <Paperclip size={18} className="text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">{t('createPost.attachFiles')}</p>
                      <p className="text-xs text-gray-400">Images, PDFs, documents (max 10MB, 5 files)</p>
                    </div>
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Attachments ({selectedFiles.length})
                      </span>
                      <label htmlFor="fileUpload" className="text-xs text-[#1ABC9C] font-medium cursor-pointer hover:underline">
                        + Add more
                      </label>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="relative flex-shrink-0 group">
                          {file.preview ? (
                            <img src={file.preview} alt={file.name} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                              <FileText size={20} className="text-gray-400" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom row: Anonymous + Privacy */}
              <div className="flex items-center gap-3 pt-1">
                {/* Anonymous toggle */}
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-8 h-5 rounded-full transition-colors relative ${formData.isAnonymous ? 'bg-[#1ABC9C]' : 'bg-gray-200'}`}>
                    <input
                      type="checkbox"
                      name="isAnonymous"
                      checked={formData.isAnonymous}
                      onChange={handleInputChange}
                      className="sr-only"
                    />
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${formData.isAnonymous ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-xs text-gray-500 group-hover:text-gray-700 transition">{t('createPost.anonymous')}</span>
                </label>

                <div className="h-4 w-px bg-gray-200" />

                {/* Privacy */}
                <div className="relative flex-1">
                  <select
                    name="privacyLevel"
                    value={formData.privacyLevel}
                    onChange={handleInputChange}
                    className="w-full appearance-none px-3 py-1.5 bg-gray-50 border-0 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer pr-7"
                  >
                    {privacyOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Department Selection */}
              {formData.privacyLevel === "department_only" && (
                <div>
                  <select
                    name="departmentId"
                    value={formData.departmentId}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    <option value="">Choose a department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.icon} {dept.name}</option>
                    ))}
                  </select>
                  {departments.length === 0 && (
                    <p className="text-xs text-orange-500 mt-1">No departments available.</p>
                  )}
                </div>
              )}

              {/* HR Only info banner */}
              {formData.privacyLevel === "hr_only" && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <Lock size={14} className="text-teal-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-teal-700">
                    {t('createPost.hrOnlyBanner', 'This post will only be visible to your HR team and company admins. Your anonymity is still fully protected.')}
                  </p>
                </div>
              )}

              {/* Advanced: Tags */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-gray-400 hover:text-gray-600 transition flex items-center gap-1"
              >
                <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                {showAdvanced ? "Hide" : "More"} options
              </button>

              {showAdvanced && (
                <div>
                  <input
                    name="tags"
                    type="text"
                    value={formData.tags}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    placeholder="Tags (comma-separated)"
                  />
                </div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100">
            {loading && uploadProgress > 0 && uploadProgress < 100 && selectedFiles.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>Uploading files...</span>
                  <span className="font-semibold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`bg-gradient-to-r ${currentConfig.buttonGradient} h-full rounded-full transition-all duration-300`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              form="create-post-form"
              disabled={loading || !userData?.id || !userData?.companyId || !formData.category}
              className={`w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${currentConfig.buttonGradient} transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {uploadProgress > 0 && uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : t('createPost.submitting')}
                </>
              ) : (
                <>
                  <Send size={16} />
                  {currentConfig.buttonText}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreatePost;
