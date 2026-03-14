import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import Post from "../components/Post";
import AdminActionPanel from "../components/AdminActionPanel";
import {
  PostStatus,
  PostStatusConfig,
  PostPriority,
  PostPriorityConfig,
} from "../utils/constants";
import { isAdmin } from "../services/postManagementService";

const getTimeAgo = (date) => {
  if (!date) return "";
  let d = date instanceof Date ? date : new Date(date);
  const seconds = Math.floor((new Date() - d) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const AssignedToMe = () => {
  const { userData } = useAuth();
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [expandedPost, setExpandedPost] = useState(null);

  const userIsAdmin = isAdmin(userData?.role);

  useEffect(() => {
    if (userData?.id && userData?.companyId) {
      loadAssignedPosts();
    }
  }, [userData?.id, userData?.companyId]);

  useEffect(() => {
    filterPosts();
  }, [posts, selectedStatus, selectedPriority]);

  const loadAssignedPosts = async () => {
    if (!userData?.id || !userData?.companyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const postsRef = collection(db, "posts");
      const q = query(
        postsRef,
        where("companyId", "==", userData.companyId),
        where("assignedTo.id", "==", userData.id),
        orderBy("createdAt", "desc")
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
      setPosts(postsData);
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

  const handlePostUpdate = () => loadAssignedPosts();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-b-2 border-[#1ABC9C] animate-spin" />
      </div>
    );
  }

  if (!userData?.userTagId) {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-amber-900 mb-2">
            {t("assignedToMe.noTagTitle")}
          </h3>
          <p className="text-sm text-amber-700">{t("assignedToMe.noTagMessage")}</p>
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
    <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold text-gray-900">{t("assignedToMe.title")}</h1>
        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
          {posts.length}
        </span>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3" style={{ scrollbarWidth: "none" }}>
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedStatus(tab.value)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              backgroundColor: selectedStatus === tab.value ? "#2D3E50" : "white",
              color: selectedStatus === tab.value ? "white" : "#4b5563",
              border: selectedStatus === tab.value ? "none" : "1px solid #e5e7eb",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Priority filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: "none" }}>
        {priorityTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedPriority(tab.value)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              backgroundColor: selectedPriority === tab.value ? "#1ABC9C" : "white",
              color: selectedPriority === tab.value ? "white" : "#4b5563",
              border: selectedPriority === tab.value ? "none" : "1px solid #e5e7eb",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {t("assignedToMe.noPosts")}
          </h3>
          <p className="text-sm text-gray-500">{t("assignedToMe.noPostsDescription")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const isExpanded = expandedPost === post.id;
            return (
              <div key={post.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {!isExpanded ? (
                  <div className="p-4">
                    {/* Top row: type + time */}
                    <div className="flex items-center gap-2 mb-2">
                      {post.status && PostStatusConfig[post.status] && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PostStatusConfig[post.status].bgColor} ${PostStatusConfig[post.status].textColor}`}
                        >
                          {PostStatusConfig[post.status].label}
                        </span>
                      )}
                      {post.priority && PostPriorityConfig[post.priority] && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PostPriorityConfig[post.priority].bgColor} ${PostPriorityConfig[post.priority].textColor}`}
                        >
                          {PostPriorityConfig[post.priority].icon} {PostPriorityConfig[post.priority].label}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {getTimeAgo(post.createdAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                      {post.title}
                    </h3>

                    {/* Due date if present */}
                    {post.dueDate && (
                      <p className="text-[11px] text-amber-600 mb-2">
                        Due: {post.dueDate.toLocaleDateString()}
                      </p>
                    )}

                    {/* Expand button */}
                    <button
                      onClick={() => setExpandedPost(post.id)}
                      className="text-xs text-[#1ABC9C] font-medium"
                    >
                      View details ›
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Collapse header */}
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        {post.status && PostStatusConfig[post.status] && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PostStatusConfig[post.status].bgColor} ${PostStatusConfig[post.status].textColor}`}
                          >
                            {PostStatusConfig[post.status].label}
                          </span>
                        )}
                        {post.priority && PostPriorityConfig[post.priority] && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PostPriorityConfig[post.priority].bgColor} ${PostPriorityConfig[post.priority].textColor}`}
                          >
                            {PostPriorityConfig[post.priority].icon} {PostPriorityConfig[post.priority].label}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setExpandedPost(null)}
                        className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                          <path d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                    </div>

                    {userIsAdmin && (
                      <div className="p-4 pb-0">
                        <AdminActionPanel
                          post={post}
                          currentUser={userData}
                          onUpdate={handlePostUpdate}
                        />
                      </div>
                    )}
                    <Post post={post} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AssignedToMe;
