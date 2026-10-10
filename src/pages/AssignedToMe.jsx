import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { hrCaseScope, sortByCreatedAtDesc } from "../utils/caseVisibility";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { CaseRow, CaseDetailPanel } from "../components/CaseRow";
import {
  PostStatusConfig,
  PostPriorityConfig,
} from "../utils/constants";
import {
  ClipboardCheck,
  AlertTriangle,
  Inbox,
} from "lucide-react";

const AssignedToMe = () => {
  const { userData } = useAuth();
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    if (userData?.id && userData?.companyId) {
      loadAssignedPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.id, userData?.companyId]);

  useEffect(() => {
    filterPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, selectedStatus, selectedPriority]);

  const loadAssignedPosts = async ({ silent = false } = {}) => {
    if (!userData?.id || !userData?.companyId) {
      setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      const postsRef = collection(db, "posts");
      const q = query(
        postsRef,
        where("companyId", "==", userData.companyId),
        where("assignedTo.id", "==", userData.id),
        ...hrCaseScope(userData.role)
      );
      const snapshot = await getDocs(q);
      const postsData = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        postsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          dueDate: data.dueDate?.toDate(),
        });
      });
      setPosts(sortByCreatedAtDesc(postsData));
      setSelectedPost((prev) => (prev ? postsData.find((x) => x.id === prev.id) || null : null));
    } catch (error) {
      console.error("Error loading assigned posts:", error);
      if (error.code === "failed-precondition") {
        console.error("Index may be missing. Check Firebase Console.");
      }
      if (posts.length > 0) {
        alert("Failed to load assigned posts. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = [...posts];
    if (selectedStatus !== "all") {
      filtered = filtered.filter((post) => post.status === selectedStatus);
    }
    if (selectedPriority !== "all") {
      filtered = filtered.filter((post) => post.priority === selectedPriority);
    }
    setFilteredPosts(filtered);
  };

  const handlePostUpdate = () => loadAssignedPosts({ silent: true });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div
          className="w-9 h-9 rounded-full border-2 border-gray-200 animate-spin"
          style={{ borderTopColor: "#1ABC9C" }}
        />
        <p className="mt-3 text-xs text-gray-400">{t("common.loading")}</p>
      </div>
    );
  }

  if (!userData?.userTagId) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-24 pt-6">
        <div className="bg-amber-50 border border-gray-100 rounded-2xl p-6 text-center shadow-sm">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-base font-semibold text-amber-900 mb-2">
            {t("assignedToMe.noTagTitle")}
          </h3>
          <p className="text-sm text-amber-700 leading-relaxed">
            {t("assignedToMe.noTagMessage")}
          </p>
        </div>
      </div>
    );
  }

  const statusTabs = [
    { value: "all", label: t("assignedToMe.allStatus", "All Status") },
    ...Object.entries(PostStatusConfig).map(([key, config]) => ({
      value: key,
      label: config.label,
    })),
  ];

  const priorityTabs = [
    { value: "all", label: t("assignedToMe.allPriority", "All Priority") },
    ...Object.entries(PostPriorityConfig).map(([key, config]) => ({
      value: key,
      label: config.label,
    })),
  ];

  return (
    <div className="max-w-2xl lg:max-w-none mx-auto px-4 pb-24 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
          style={{ backgroundColor: "#2D3E50" }}
        >
          <ClipboardCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "#2D3E50" }}>
            {t("assignedToMe.title")}
          </h1>
        </div>
        <span
          className="ml-auto px-2.5 py-1 rounded-xl text-xs font-semibold text-white"
          style={{ backgroundColor: "#1ABC9C" }}
        >
          {posts.length}
        </span>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{ scrollbarWidth: "none" }}>
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedStatus(tab.value)}
            className="flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm"
            style={{
              backgroundColor: selectedStatus === tab.value ? "#2D3E50" : "white",
              color: selectedStatus === tab.value ? "white" : "#4b5563",
              border: `1px solid ${selectedStatus === tab.value ? "#2D3E50" : "#f3f4f6"}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Priority filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5" style={{ scrollbarWidth: "none" }}>
        {priorityTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedPriority(tab.value)}
            className="flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm"
            style={{
              backgroundColor: selectedPriority === tab.value ? "#1ABC9C" : "white",
              color: selectedPriority === tab.value ? "white" : "#4b5563",
              border: `1px solid ${selectedPriority === tab.value ? "#1ABC9C" : "#f3f4f6"}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
            <Inbox className="w-6 h-6 text-gray-300" />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: "#2D3E50" }}>
            {t("assignedToMe.noPosts")}
          </h3>
          <p className="text-sm text-gray-500 max-w-xs">
            {t("assignedToMe.noPostsDescription")}
          </p>
        </div>
      ) : (
        <div className="lg:flex lg:gap-4 lg:items-start">
          <div className={`space-y-3 ${selectedPost ? "lg:w-2/5" : "w-full"}`}>
            {filteredPosts.map((post) => (
              <CaseRow
                key={post.id}
                post={post}
                isSelected={selectedPost?.id === post.id}
                onToggle={() => setSelectedPost(selectedPost?.id === post.id ? null : post)}
                currentUser={userData}
                onUpdate={handlePostUpdate}
              />
            ))}
          </div>
          {selectedPost && (
            <CaseDetailPanel
              post={selectedPost}
              currentUser={userData}
              onClose={() => setSelectedPost(null)}
              onUpdate={handlePostUpdate}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default AssignedToMe;
