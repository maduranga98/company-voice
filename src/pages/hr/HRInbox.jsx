import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { hrCaseScope, sortByCreatedAtDesc } from "../../utils/caseVisibility";
import { UserRole, PostStatus } from "../../utils/constants";
import { CaseRow, CaseDetailPanel } from "../../components/CaseRow";
import { Inbox } from "lucide-react";

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
      navigate("/");
    }
  }, [userData, navigate]);

  // Real-time listener for hr_only posts
  useEffect(() => {
    if (!userData?.companyId) return;

    const q = query(
      collection(db, "posts"),
      where("companyId", "==", userData.companyId),
      where("privacyLevel", "==", "hr_only"),
      ...hrCaseScope(userData.role)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hrPosts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPosts(sortByCreatedAtDesc(hrPosts));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching HR inbox posts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.companyId, userData?.role]);

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
            {filteredPosts.map((post) => (
              <CaseRow
                key={post.id}
                post={post}
                isSelected={selectedPost?.id === post.id}
                onToggle={() => setSelectedPost(selectedPost?.id === post.id ? null : post)}
                currentUser={userData}
              />
            ))}
          </div>

          {/* Right: detail panel — desktop only */}
          {selectedPost && (
            <CaseDetailPanel post={selectedPost} currentUser={userData} onClose={() => setSelectedPost(null)} />
          )}
        </div>
      )}
    </div>
  );
};

export default HRInbox;
