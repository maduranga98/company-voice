import { useState, useEffect, useMemo } from "react";
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
import { UserRole, PostStatus, PostPriority, PostPriorityConfig } from "../../utils/constants";
import { CaseType, getCaseAdapter } from "../../utils/caseTypes";
import AdminActionPanel from "../../components/AdminActionPanel";
import CaseAttachments from "../../components/CaseAttachments";
import Avatar from "../../components/Avatar";
import AnonymousThread from "../../components/AnonymousThread";
import ExportCasePdfButton from "../../components/case/ExportCasePdfButton";
import { StatusBadge, PriorityBadge, DueDateChip } from "../../components/case/CaseBadges";
import {
  Inbox,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Edit3,
  Clock,
  Shield,
  User,
  UserRound,
  FileText,
  Lock,
  SlidersHorizontal,
  SearchX,
  X,
} from "lucide-react";

const IN_PROGRESS_STATUSES = [
  PostStatus.IN_PROGRESS,
  PostStatus.ACKNOWLEDGED,
  PostStatus.UNDER_REVIEW,
  PostStatus.WORKING_ON,
];
const RESOLVED_STATUSES = [PostStatus.RESOLVED, PostStatus.CLOSED];
const CLOSED_STATUSES = getCaseAdapter(CaseType.POST).closedStatuses;

const isOpenPost = (post) => post.status === PostStatus.OPEN || !post.status;

const FILTER_MATCHERS = {
  all: () => true,
  open: isOpenPost,
  in_progress: (post) => IN_PROGRESS_STATUSES.includes(post.status),
  resolved: (post) => RESOLVED_STATUSES.includes(post.status),
};

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
    <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg}`}>
      {c.icon}
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{children}</p>
);

// Shimmering placeholders shaped like the real page, so loading doesn't jump layout.
const InboxSkeleton = () => {
  const { t } = useTranslation();
  return (
  <div className="space-y-6 lg:space-y-8 animate-pulse" role="status" aria-live="polite">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gray-200" />
      <div className="space-y-2">
        <div className="h-5 w-32 rounded-md bg-gray-200" />
        <div className="h-3.5 w-48 rounded-md bg-gray-100" />
      </div>
    </div>
    <div className="grid grid-cols-4 gap-2 lg:gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 lg:h-20 rounded-2xl bg-gray-100" />
      ))}
    </div>
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-36 rounded-2xl border border-gray-100 bg-white shadow-sm p-4 flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-4 w-2/3 rounded-md bg-gray-200" />
            <div className="h-3 w-full rounded-md bg-gray-100" />
            <div className="h-3 w-4/5 rounded-md bg-gray-100" />
            <div className="h-5 w-1/3 rounded-full bg-gray-100 mt-4" />
          </div>
        </div>
      ))}
    </div>
    <span className="sr-only">{t("common.loading", "Loading...")}</span>
  </div>
  );
};

const EmptyState = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
    <div className="w-14 h-14 bg-[#1ABC9C]/10 rounded-2xl flex items-center justify-center mb-4">
      {icon}
    </div>
    <h3 className="text-base font-semibold text-[#2D3E50] mb-1">{title}</h3>
    <p className="text-sm text-gray-500 max-w-xs">{description}</p>
    {action}
  </div>
);

const HRInbox = () => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  // Track the id, not a copy, so the detail panel always reflects the live snapshot.
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState("details");

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

  const filteredPosts = useMemo(
    () => posts.filter(FILTER_MATCHERS[activeFilter] || FILTER_MATCHERS.all),
    [posts, activeFilter]
  );
  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedId) || null,
    [posts, selectedId]
  );

  const counts = useMemo(
    () => ({
      all: posts.length,
      open: posts.filter(FILTER_MATCHERS.open).length,
      in_progress: posts.filter(FILTER_MATCHERS.in_progress).length,
      resolved: posts.filter(FILTER_MATCHERS.resolved).length,
    }),
    [posts]
  );

  // The stat tiles are the filter control.
  const filterTiles = [
    { id: "all", label: t("hrInbox.total", "Total"), dot: "bg-[#2D3E50]" },
    { id: "open", label: t("hrInbox.open", "Open"), dot: "bg-gray-400" },
    { id: "in_progress", label: t("hrInbox.inProgress", "In Progress"), dot: "bg-amber-400" },
    { id: "resolved", label: t("hrInbox.resolved", "Resolved"), dot: "bg-emerald-500" },
  ];

  if (loading) return <InboxSkeleton />;

  const toggleSelected = (id) => {
    setActiveTab("details");
    setSelectedId((current) => (current === id ? null : id));
  };

  const tabs = selectedPost
    ? [
        { id: "details", label: t("hrInbox.tabDetails", "Details"), icon: <FileText size={14} aria-hidden="true" /> },
        ...(selectedPost.isAnonymous
          ? [{ id: "conversation", label: t("hrInbox.tabConversation", "Conversation"), icon: <Lock size={14} aria-hidden="true" /> }]
          : []),
        { id: "handle", label: t("hrInbox.tabHandle", "Handle"), icon: <SlidersHorizontal size={14} aria-hidden="true" /> },
      ]
    : [];

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 lg:gap-4">
        <div className="w-10 h-10 lg:w-12 lg:h-12 bg-[#2D3E50] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
          <Inbox size={20} className="text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-[#2D3E50]">
            {t("navigation.hrInbox", "HR Inbox")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("hrInbox.subtitle", "Posts sent directly to HR")}
          </p>
        </div>
      </div>

      {/* Stat tiles — double as the status filter */}
      <div role="group" aria-label={t("hrInbox.filterLabel", "Filter by status")} className="grid grid-cols-4 gap-2 lg:gap-4">
        {filterTiles.map((tile) => {
          const active = activeFilter === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveFilter(tile.id)}
              className={`rounded-2xl border px-3 py-2.5 lg:px-5 lg:py-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ABC9C]/50 ${
                active
                  ? "bg-white border-[#1ABC9C] shadow-md ring-2 ring-[#1ABC9C]/15"
                  : "bg-white border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md"
              }`}
            >
              <span className="flex items-center gap-1.5 text-[11px] lg:text-xs font-medium text-gray-500">
                <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tile.dot}`} />
                <span className="truncate">{tile.label}</span>
              </span>
              <span className="mt-0.5 block text-xl lg:text-3xl font-bold tracking-tight text-[#2D3E50] tabular-nums">
                {counts[tile.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Post List + Detail panel */}
      {filteredPosts.length === 0 ? (
        posts.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-6 h-6 text-[#1ABC9C]" aria-hidden="true" />}
            title={t("hrInbox.empty", "No HR posts yet")}
            description={t("hrInbox.emptyDesc", "Posts sent to HR will appear here")}
          />
        ) : (
          <EmptyState
            icon={<SearchX className="w-6 h-6 text-[#1ABC9C]" aria-hidden="true" />}
            title={t("hrInbox.emptyFiltered", "Nothing here")}
            description={t("hrInbox.emptyFilteredDesc", "No posts match this status right now.")}
            action={
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className="mt-5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#2D3E50] transition hover:border-[#1ABC9C] hover:text-[#1ABC9C]"
              >
                {t("hrInbox.showAll", "Show all posts")}
              </button>
            }
          />
        )
      ) : (
        <div className="lg:flex lg:gap-4 lg:items-start">
          {/* Left: post list */}
          <div className={`space-y-3 ${selectedPost ? "lg:w-[22rem] xl:w-[26rem] lg:flex-shrink-0" : "w-full"}`}>
            {filteredPosts.map((post) => {
              const priority = post.priority || PostPriority.MEDIUM;
              const strip = PostPriorityConfig[priority]?.badgeBg || "bg-gray-300";
              const isUnread = isOpenPost(post) && !post.adminCommentCount;
              const isSelected = selectedId === post.id;
              const isClosed = CLOSED_STATUSES.includes(post.status);

              return (
                <article
                  key={post.id}
                  className={`bg-white rounded-2xl border transition-all ${
                    isSelected
                      ? "border-[#1ABC9C] shadow-md"
                      : "border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isSelected}
                    onClick={() => toggleSelected(post.id)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSelected(post.id);
                      }
                    }}
                    className={`relative cursor-pointer py-4 pl-5 pr-4 lg:pr-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1ABC9C]/50 ${
                      isSelected ? "rounded-t-2xl" : "rounded-2xl"
                    }`}
                  >
                    {/* Priority strip */}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 w-1.5 ${strip} ${isSelected ? "rounded-tl-2xl" : "rounded-l-2xl"}`}
                    />

                    <div className="flex items-start gap-3">
                      <PostTypeIcon type={post.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {isUnread && (
                              <span className="w-2 h-2 bg-[#FF6B6B] rounded-full flex-shrink-0" aria-hidden="true" />
                            )}
                            <h3 className="text-sm lg:text-base font-semibold text-[#2D3E50] truncate">
                              {post.title}
                            </h3>
                          </div>
                          <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0 pt-0.5">
                            <Clock size={11} aria-hidden="true" />
                            {formatTimeAgo(post.createdAt)}
                          </span>
                        </div>

                        <p className="text-xs lg:text-sm text-gray-500 line-clamp-2 mt-1">
                          {post.description || post.content}
                        </p>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-3">
                          <StatusBadge status={post.status} />
                          {post.priority && post.priority !== PostPriority.MEDIUM && (
                            <PriorityBadge priority={post.priority} />
                          )}
                          {post.isAnonymous && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                              <User size={10} aria-hidden="true" />
                              {t("hrInbox.anonymous", "Anonymous")}
                            </span>
                          )}
                        </div>

                        {/* Who's on it, and by when */}
                        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-gray-50">
                          {post.assignedTo?.name ? (
                            <span className="inline-flex items-center gap-1.5 min-w-0 text-xs font-medium text-[#2D3E50]">
                              <Avatar name={post.assignedTo.name} size="xs" />
                              <span className="truncate max-w-[9rem]">{post.assignedTo.name}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                              <UserRound size={14} aria-hidden="true" />
                              {t("casePanel.unassigned", "Unassigned")}
                            </span>
                          )}
                          <DueDateChip dueDate={post.dueDate} closed={isClosed} className="ml-auto" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mobile inline expansion */}
                  {isSelected && (
                    <div className="lg:hidden border-t border-gray-100 bg-background-softGray rounded-b-2xl p-3 space-y-3">
                      <ExportCasePdfButton post={post} currentUser={userData} className="w-full" />
                      <AdminActionPanel post={post} currentUser={userData} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Right: detail panel — desktop only */}
          {selectedPost && (
            <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-w-0 bg-white rounded-2xl border border-[#1ABC9C] shadow-md sticky top-24 h-[calc(100vh-8rem)] overflow-hidden">
              {/* Header: title, state at a glance, export + close */}
              <div className="px-6 pt-5 pb-3 flex-shrink-0">
                <div className="flex items-start gap-4">
                  <PostTypeIcon type={selectedPost.type} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-[#2D3E50] leading-snug">
                      {selectedPost.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                        {(selectedPost.type || "").replace(/_/g, " ")}
                      </span>
                      {selectedPost.isAnonymous ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                          <Shield size={10} aria-hidden="true" />
                          {t("hrInbox.anonymous", "Anonymous")}
                        </span>
                      ) : (
                        selectedPost.authorName && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">
                            <User size={10} aria-hidden="true" />
                            {selectedPost.authorName}
                          </span>
                        )
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={10} aria-hidden="true" />
                        {selectedPost.createdAt
                          ? (selectedPost.createdAt?.toDate
                              ? selectedPost.createdAt.toDate()
                              : new Date(selectedPost.createdAt)
                            ).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                          : ""}
                      </span>
                    </div>
                  </div>
                  <ExportCasePdfButton post={selectedPost} currentUser={userData} />
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    aria-label={t("common.close", "Close")}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                {/* Current state, always visible whichever tab is open */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <StatusBadge status={selectedPost.status} size="md" />
                  <PriorityBadge priority={selectedPost.priority || PostPriority.MEDIUM} size="md" />
                  {selectedPost.assignedTo?.name ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2D3E50]">
                      <Avatar name={selectedPost.assignedTo.name} size="xs" />
                      {selectedPost.assignedTo.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                      <UserRound size={14} aria-hidden="true" />
                      {t("casePanel.unassigned", "Unassigned")}
                    </span>
                  )}
                  <DueDateChip dueDate={selectedPost.dueDate} closed={CLOSED_STATUSES.includes(selectedPost.status)} size="md" />
                </div>
              </div>

              {/* Tabs */}
              <div role="tablist" className="flex gap-1 px-6 border-b border-gray-100 flex-shrink-0">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`hr-tab-${tab.id}`}
                      aria-selected={active}
                      aria-controls={`hr-tabpanel-${tab.id}`}
                      onClick={() => setActiveTab(tab.id)}
                      className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ABC9C]/50 ${
                        active
                          ? "border-[#1ABC9C] text-[#2D3E50]"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab bodies stay mounted (hidden) so notes drafts and the live thread persist */}
              <div className="flex-1 overflow-y-auto bg-background-softGray">
                <div
                  role="tabpanel"
                  id="hr-tabpanel-details"
                  aria-labelledby="hr-tab-details"
                  hidden={activeTab !== "details"}
                  className="space-y-3 p-4"
                >
                  {selectedPost.source === "policy_link" && (
                    <div className="rounded-xl border border-gray-100 bg-white p-4">
                      <SectionLabel>Policy concern</SectionLabel>
                      <p className="text-sm text-gray-700">
                        {selectedPost.policyTitle}
                        {selectedPost.policyVersion ? ` (v${selectedPost.policyVersion})` : ""}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedPost.authorName} · Employee ID {selectedPost.employeeId}
                      </p>
                    </div>
                  )}
                  <div className="rounded-xl border border-gray-100 bg-white p-4">
                    <SectionLabel>Submission</SectionLabel>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedPost.description || selectedPost.content || "-"}
                    </p>
                  </div>
                  {Array.isArray(selectedPost.attachments) && selectedPost.attachments.length > 0 && (
                    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
                      <CaseAttachments attachments={selectedPost.attachments} />
                    </div>
                  )}
                </div>

                {selectedPost.isAnonymous && (
                  <div
                    role="tabpanel"
                    id="hr-tabpanel-conversation"
                    aria-labelledby="hr-tab-conversation"
                    hidden={activeTab !== "conversation"}
                    className="p-4"
                  >
                    <div className="rounded-xl border border-gray-100 bg-white p-3">
                      <AnonymousThread
                        key={selectedPost.id}
                        embedded
                        postId={selectedPost.id}
                        companyId={selectedPost.companyId || userData.companyId}
                        currentUserRole={userData.role}
                        isAnonymousPost={selectedPost.isAnonymous}
                      />
                    </div>
                  </div>
                )}

                <div
                  role="tabpanel"
                  id="hr-tabpanel-handle"
                  aria-labelledby="hr-tab-handle"
                  hidden={activeTab !== "handle"}
                  className="p-4"
                >
                  <AdminActionPanel key={selectedPost.id} post={selectedPost} currentUser={userData} showThread={false} />
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
