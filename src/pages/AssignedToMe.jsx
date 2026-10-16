import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { hrCaseScope, sortByCreatedAtDesc } from "../utils/caseVisibility";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import AdminActionPanel from "../components/AdminActionPanel";
import OpenCaseLink from "../components/case/OpenCaseLink";
import { PostStatusConfig, PostPriorityConfig } from "../utils/constants";
import { CaseType, getCaseAdapter } from "../utils/caseTypes";
import { StatusBadge, PriorityBadge, DueDateChip } from "../components/case/CaseBadges";
import PageHeader, { PageContainer } from "../components/PageHeader";
import {
  ClipboardCheck,
  AlertTriangle,
  ChevronUp,
  Inbox,
} from "lucide-react";

const CLOSED_STATUSES = getCaseAdapter(CaseType.POST).closedStatuses;

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
      <PageContainer>
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
      </PageContainer>
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
    <PageContainer>
      <PageHeader
        icon={ClipboardCheck}
        title={t("assignedToMe.title")}
        badge={
          <span className="rounded-xl bg-[#1ABC9C] px-2.5 py-1 text-xs font-semibold text-white">
            {posts.length}
          </span>
        }
      />

      <div className="space-y-3">
      {/* Status filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
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
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
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
      </div>

      {/* Empty state */}
      {filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-background-white rounded-2xl border border-gray-100 shadow-sm">
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
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const isExpanded = expandedPost === post.id;
            return (
              <div
                key={post.id}
                className="bg-background-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {!isExpanded ? (
                  <div className="p-4">
                    {/* Top row: type + time */}
                    <div className="flex items-center gap-2 mb-2.5">
                      {post.status && PostStatusConfig[post.status] && <StatusBadge status={post.status} />}
                      {post.priority && PostPriorityConfig[post.priority] && <PriorityBadge priority={post.priority} />}
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {getTimeAgo(post.createdAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#2D3E50" }}>
                      {post.title}
                    </h3>

                    {/* Due date if present */}
                    {post.dueDate && (
                      <div className="mb-2.5">
                        <DueDateChip dueDate={post.dueDate} closed={CLOSED_STATUSES.includes(post.status)} />
                      </div>
                    )}

                    {/* Expand button */}
                    <button
                      onClick={() => setExpandedPost(post.id)}
                      className="text-xs font-medium rounded-xl px-3 py-1.5 transition-all hover:bg-[#1ABC9C]/10"
                      style={{ color: "#1ABC9C" }}
                    >
                      View details ›
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Collapse header */}
                    <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        {post.status && PostStatusConfig[post.status] && <StatusBadge status={post.status} />}
                        {post.priority && PostPriorityConfig[post.priority] && <PriorityBadge priority={post.priority} />}
                      </div>
                      <OpenCaseLink caseType={CaseType.POST} caseId={post.id} className="ml-auto mr-2" />
                      <button
                        onClick={() => setExpandedPost(null)}
                        className="p-1.5 rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    <div className="p-4 pb-0">
                      <AdminActionPanel
                        post={post}
                        currentUser={userData}
                        onUpdate={handlePostUpdate}
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-semibold mb-2" style={{ color: "#2D3E50" }}>
                        {post.title}
                      </h3>
                      {(post.description || post.content) && (
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {post.description || post.content}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
};

export default AssignedToMe;
