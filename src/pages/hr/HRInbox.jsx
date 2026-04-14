import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import {
  UserRole,
  PostStatusConfig,
  PostPriorityConfig,
  PostType,
  PostStatus,
} from "../../utils/constants";
import AdminActionPanel from "../../components/AdminActionPanel";
import {
  Inbox,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Edit3,
  Clock,
  Shield,
  Filter,
  User,
  X,
} from "lucide-react";

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const PostTypeIcon = ({ type }) => {
  const config = {
    problem_report: { bg: "bg-red-50", icon: <AlertTriangle size={16} className="text-red-500" /> },
    creative_content: { bg: "bg-purple-50", icon: <Edit3 size={16} className="text-purple-500" /> },
    team_discussion: { bg: "bg-blue-50", icon: <MessageSquare size={16} className="text-blue-500" /> },
    idea_suggestion: { bg: "bg-emerald-50", icon: <Lightbulb size={16} className="text-emerald-500" /> },
  };
  const c = config[type] || config.problem_report;
  return (
    <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg}`}>
      {c.icon}
    </div>
  );
};

const HRInbox = () => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedPost, setSelectedPost] = useState(null);

  // Access control
  useEffect(() => {
    if (!userData) return;
    if (userData.role !== UserRole.HR && userData.role !== UserRole.COMPANY_ADMIN) {
      navigate("/feed/problems");
    }
  }, [userData, navigate]);

  // Real-time listener for hr_only posts
  useEffect(() => {
    if (!userData?.companyId) return;

    const q = query(
      collection(db, "posts"),
      where("companyId", "==", userData.companyId),
      where("privacyLevel", "==", "hr_only"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hrPosts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPosts(hrPosts);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching HR inbox posts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.companyId]);

  const filteredPosts = posts.filter((post) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "open") return post.status === PostStatus.OPEN || !post.status;
    if (activeFilter === "in_progress") {
      return [PostStatus.IN_PROGRESS, PostStatus.ACKNOWLEDGED, PostStatus.UNDER_REVIEW, PostStatus.WORKING_ON].includes(post.status);
    }
    if (activeFilter === "resolved") {
      return [PostStatus.RESOLVED, PostStatus.CLOSED].includes(post.status);
    }
    return true;
  });

  const stats = {
    total: posts.length,
    open: posts.filter((p) => p.status === PostStatus.OPEN || !p.status).length,
    inProgress: posts.filter((p) =>
      [PostStatus.IN_PROGRESS, PostStatus.ACKNOWLEDGED, PostStatus.UNDER_REVIEW, PostStatus.WORKING_ON].includes(p.status)
    ).length,
    resolved: posts.filter((p) =>
      [PostStatus.RESOLVED, PostStatus.CLOSED].includes(p.status)
    ).length,
  };

  const filterTabs = [
    { id: "all", label: t("hrInbox.all", "All"), count: stats.total },
    { id: "open", label: t("hrInbox.open", "Open"), count: stats.open },
    { id: "in_progress", label: t("hrInbox.inProgress", "In Progress"), count: stats.inProgress },
    { id: "resolved", label: t("hrInbox.resolved", "Resolved"), count: stats.resolved },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1ABC9C] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">{t("common.loading", "Loading...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 lg:gap-4 mb-1 lg:mb-2">
          <div className="w-10 h-10 lg:w-14 lg:h-14 bg-[#1ABC9C]/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Inbox size={20} className="text-[#1ABC9C] lg:hidden" />
            <Inbox size={26} className="text-[#1ABC9C] hidden lg:block" />
          </div>
          <div>
            <h1 className="text-xl lg:text-3xl font-bold text-[#2D3E50]">
              {t("navigation.hrInbox", "HR Inbox")}
            </h1>
            <p className="text-sm lg:text-base text-gray-500">
              {t("hrInbox.subtitle", "Posts sent directly to HR")}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: t("hrInbox.total", "Total"), value: stats.total, color: "text-[#2D3E50]", bg: "bg-gray-50" },
          { label: t("hrInbox.open", "Open"), value: stats.open, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: t("hrInbox.inProgress", "In Progress"), value: stats.inProgress, color: "text-blue-600", bg: "bg-blue-50" },
          { label: t("hrInbox.resolved", "Resolved"), value: stats.resolved, color: "text-green-600", bg: "bg-green-50" },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-3 lg:p-5 text-center`}>
            <p className={`text-lg lg:text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs lg:text-sm text-gray-500 font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`flex-1 px-3 py-2 lg:px-4 lg:py-2.5 rounded-lg text-xs lg:text-sm font-medium transition-all ${
              activeFilter === tab.id
                ? "bg-white text-[#2D3E50] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs lg:text-sm ${
                activeFilter === tab.id ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "bg-gray-200 text-gray-500"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Post List + Detail panel */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Inbox size={28} className="text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-400 mb-1">
            {t("hrInbox.empty", "No HR posts yet")}
          </h3>
          <p className="text-sm text-gray-400">
            {t("hrInbox.emptyDesc", "Posts sent to HR will appear here")}
          </p>
        </div>
      ) : (
        <div className="lg:flex lg:gap-4 lg:items-start">
          {/* Left: post list */}
          <div className={`space-y-3 ${selectedPost ? "lg:w-2/5" : "w-full"}`}>
            {filteredPosts.map((post) => {
              const statusConfig = PostStatusConfig[post.status] || PostStatusConfig.open;
              const priorityConfig = post.priority && PostPriorityConfig[post.priority];
              const isUnread = (!post.status || post.status === PostStatus.OPEN) && !post.adminCommentCount;
              const isSelected = selectedPost?.id === post.id;

              return (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(isSelected ? null : post)}
                  className={`bg-white rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-[#1ABC9C] shadow-md"
                      : "border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"
                  }`}
                >
                  <div className="p-4 lg:p-5">
                    <div className="flex items-start gap-3 lg:gap-4">
                      <PostTypeIcon type={post.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 lg:mb-1">
                              {isUnread && (
                                <span className="w-2 h-2 bg-[#FF6B6B] rounded-full flex-shrink-0" />
                              )}
                              <h3 className="text-sm lg:text-base font-semibold text-[#2D3E50] truncate">
                                {post.title}
                              </h3>
                            </div>
                            <p className="text-xs lg:text-sm text-gray-500 line-clamp-2 mb-2 lg:mb-3">
                              {post.description || post.content}
                            </p>
                          </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs lg:text-sm font-semibold ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                            {statusConfig.label}
                          </span>
                          {priorityConfig && post.priority !== "medium" && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs lg:text-sm font-semibold ${priorityConfig.bgColor} ${priorityConfig.textColor}`}>
                              {priorityConfig.icon} {priorityConfig.label}
                            </span>
                          )}
                          {post.isAnonymous && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs lg:text-sm font-medium bg-gray-100 text-gray-500">
                              <User size={10} />
                              Anonymous
                            </span>
                          )}
                          <span className="text-xs lg:text-sm text-gray-400 flex items-center gap-1 ml-auto">
                            <Clock size={10} />
                            {formatTimeAgo(post.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mobile inline expansion */}
                  {isSelected && (
                    <div className="lg:hidden border-t border-gray-100 p-4" onClick={(e) => e.stopPropagation()}>
                      <AdminActionPanel post={post} currentUser={userData} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: detail panel — desktop only */}
          {selectedPost && (
            <div className="hidden lg:flex lg:flex-col lg:flex-1 bg-white rounded-2xl border border-[#1ABC9C] shadow-md sticky top-24 max-h-[calc(100vh-160px)] overflow-hidden">
              {/* Panel header — title + close */}
              <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start gap-4 flex-shrink-0">
                <PostTypeIcon type={selectedPost.type} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-[#2D3E50] leading-snug">
                    {selectedPost.title}
                  </h3>
                  {/* Metadata chips */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {/* Post type label */}
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md capitalize">
                      {(selectedPost.type || "").replace(/_/g, " ")}
                    </span>
                    {/* Anonymity */}
                    {selectedPost.isAnonymous ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md">
                        <Shield size={10} />
                        Anonymous
                      </span>
                    ) : (
                      selectedPost.authorName && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">
                          <User size={10} />
                          {selectedPost.authorName}
                        </span>
                      )
                    )}
                    {/* Date */}
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400 ml-auto">
                      <Clock size={10} />
                      {selectedPost.createdAt
                        ? (selectedPost.createdAt?.toDate
                            ? selectedPost.createdAt.toDate()
                            : new Date(selectedPost.createdAt)
                          ).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                        : ""}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">
                {/* Full post content */}
                {(selectedPost.description || selectedPost.content) && (
                  <div className="px-6 py-4 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Submission
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedPost.description || selectedPost.content}
                    </p>
                  </div>
                )}

                {/* Admin action panel */}
                <div className="px-6 py-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    HR Actions
                  </p>
                  <AdminActionPanel post={selectedPost} currentUser={userData} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HRInbox;
