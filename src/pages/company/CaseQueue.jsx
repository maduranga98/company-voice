import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";
import { hrCaseScope, sortByCreatedAtDesc } from "../../utils/caseVisibility";
import { UserRole, PostPriority, PostPriorityConfig } from "../../utils/constants";
import { CaseType, getCaseAdapter } from "../../utils/caseTypes";
import CaseHandlingPanel from "../../components/case/CaseHandlingPanel";
import CaseAttachments from "../../components/CaseAttachments";
import ExportCasePdfButton from "../../components/case/ExportCasePdfButton";
import ShareWithCounselButton from "../../components/case/ShareWithCounselButton";
import AnonymousThread from "../../components/AnonymousThread";
import Avatar from "../../components/Avatar";
import OpenCaseLink from "../../components/case/OpenCaseLink";
import { StatusBadge, PriorityBadge, DueDateChip } from "../../components/case/CaseBadges";
import {
  LayoutGrid,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Edit3,
  ShieldAlert,
  Clock,
  User,
  UserRound,
  FileText,
  SlidersHorizontal,
  Inbox,
  SearchX,
  X,
} from "lucide-react";
import PageHeader, { PageContainer } from "../../components/PageHeader";

const POST_ADAPTER = getCaseAdapter(CaseType.POST);
const VENDOR_ADAPTER = getCaseAdapter(CaseType.VENDOR);

const TypeIcon = ({ caseType, type }) => {
  if (caseType === CaseType.VENDOR) {
    return (
      <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
        <ShieldAlert size={16} className="text-red-500" />
      </div>
    );
  }
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

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = new Date() - date;
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

const EmptyState = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-background-white rounded-2xl border border-gray-100 shadow-sm">
    <div className="w-14 h-14 bg-[#1ABC9C]/10 rounded-2xl flex items-center justify-center mb-4">{icon}</div>
    <h3 className="text-base font-semibold text-[#2D3E50] mb-1">{title}</h3>
    <p className="text-sm text-gray-500 max-w-xs">{description}</p>
    {action}
  </div>
);

const CaseQueue = () => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState(null); // null = still loading
  const [vendorReports, setVendorReports] = useState(null);
  const [scope, setScope] = useState("unassigned"); // unassigned | mine | all
  const [typeFilter, setTypeFilter] = useState("all"); // all | post | vendor
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (!userData) return;
    if (userData.role !== UserRole.HR && userData.role !== UserRole.COMPANY_ADMIN) {
      navigate("/");
    }
  }, [userData, navigate]);

  // Live posts — same scoping as HR Inbox (HR never sees involvesHR=true cases).
  useEffect(() => {
    if (!userData?.companyId) return undefined;
    const q = query(
      collection(db, "posts"),
      where("companyId", "==", userData.companyId),
      ...hrCaseScope(userData.role)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setPosts(snapshot.docs.map((d) => ({ id: d.id, caseType: CaseType.POST, ...d.data() }))),
      (error) => {
        console.error("Error fetching case queue posts:", error);
        setPosts([]);
      }
    );
    return () => unsubscribe();
  }, [userData?.companyId, userData?.role]);

  // Live vendor risk reports.
  useEffect(() => {
    if (!userData?.companyId) return undefined;
    const q = query(collection(db, "vendorReports"), where("companyId", "==", userData.companyId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setVendorReports(snapshot.docs.map((d) => ({ id: d.id, caseType: CaseType.VENDOR, ...d.data() }))),
      (error) => {
        console.error("Error fetching case queue vendor reports:", error);
        setVendorReports([]);
      }
    );
    return () => unsubscribe();
  }, [userData?.companyId]);

  const loading = posts === null || vendorReports === null;

  const allCases = useMemo(() => {
    if (loading) return [];
    const combined = [...posts, ...vendorReports].map((c) => {
      const adapter = getCaseAdapter(c.caseType);
      return { ...c, _title: adapter.getTitle(c), _createdAt: adapter.getCreatedAt(c), _priority: adapter.getPriority(c) };
    });
    return sortByCreatedAtDesc(combined.map((c) => ({ ...c, createdAt: c._createdAt })));
  }, [posts, vendorReports, loading]);

  const scoped = useMemo(() => {
    let list = allCases;
    if (typeFilter !== "all") list = list.filter((c) => c.caseType === typeFilter);
    if (scope === "unassigned") list = list.filter((c) => !c.assignedTo);
    if (scope === "mine") list = list.filter((c) => c.assignedTo?.id === userData?.id);
    return list;
  }, [allCases, typeFilter, scope, userData?.id]);

  const counts = useMemo(
    () => ({
      unassigned: allCases.filter((c) => !c.assignedTo).length,
      mine: allCases.filter((c) => c.assignedTo?.id === userData?.id).length,
      all: allCases.length,
    }),
    [allCases, userData?.id]
  );

  const selectedCase = useMemo(() => allCases.find((c) => c.id === selectedId) || null, [allCases, selectedId]);
  const selectedAdapter = selectedCase ? getCaseAdapter(selectedCase.caseType) : null;

  const toggleSelected = (id) => {
    setActiveTab("details");
    setSelectedId((current) => (current === id ? null : id));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-9 h-9 rounded-full border-2 border-gray-200 animate-spin" style={{ borderTopColor: "#1ABC9C" }} />
        <p className="mt-3 text-xs text-gray-400">{t("common.loading")}</p>
      </div>
    );
  }

  const scopeTabs = [
    { id: "unassigned", label: "Unassigned", count: counts.unassigned },
    { id: "mine", label: "Assigned to me", count: counts.mine },
    { id: "all", label: "All cases", count: counts.all },
  ];

  const tabs = selectedCase
    ? [
        { id: "details", label: "Details", icon: <FileText size={14} aria-hidden="true" /> },
        ...(selectedCase.caseType === CaseType.POST && selectedCase.isAnonymous
          ? [{ id: "conversation", label: "Conversation", icon: <MessageSquare size={14} aria-hidden="true" /> }]
          : []),
        { id: "handle", label: "Handle", icon: <SlidersHorizontal size={14} aria-hidden="true" /> },
      ]
    : [];

  return (
    <PageContainer>
      <PageHeader
        icon={LayoutGrid}
        title="Case Queue"
        subtitle="All reports and vendor-risk cases, in one place"
      />

      {/* Scope tabs — the "who has this" view */}
      <div role="group" aria-label="Filter by assignment" className="grid grid-cols-3 gap-2 lg:gap-4">
        {scopeTabs.map((tab) => {
          const active = scope === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              onClick={() => setScope(tab.id)}
              className={`rounded-2xl border px-3 py-2.5 lg:px-5 lg:py-4 text-left transition-all ${
                active
                  ? "bg-background-white border-[#1ABC9C] shadow-md ring-2 ring-[#1ABC9C]/15"
                  : "bg-background-white border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md"
              }`}
            >
              <span className="block text-[11px] lg:text-xs font-medium text-gray-500 truncate">{tab.label}</span>
              <span className="mt-0.5 block text-xl lg:text-3xl font-bold tracking-tight text-[#2D3E50] tabular-nums">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Type filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {[
          { id: "all", label: "All types" },
          { id: CaseType.POST, label: "Reports" },
          { id: CaseType.VENDOR, label: "Vendor risk" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTypeFilter(tab.id)}
            className="flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm"
            style={{
              backgroundColor: typeFilter === tab.id ? "#2D3E50" : "white",
              color: typeFilter === tab.id ? "white" : "#4b5563",
              border: `1px solid ${typeFilter === tab.id ? "#2D3E50" : "#f3f4f6"}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {scoped.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-6 h-6 text-[#1ABC9C]" aria-hidden="true" />}
          title={scope === "unassigned" ? "Nothing unassigned" : "No cases here"}
          description={
            scope === "unassigned"
              ? "Every open case has an owner. New submissions will show up here as they come in."
              : "No cases match this filter right now."
          }
        />
      ) : (
        <div className="lg:flex lg:gap-4 lg:items-start">
          <div className={`space-y-3 ${selectedCase ? "lg:w-[22rem] xl:w-[26rem] lg:flex-shrink-0" : "w-full"}`}>
            {scoped.map((c) => {
              const adapter = getCaseAdapter(c.caseType);
              const priority = c._priority || PostPriority.MEDIUM;
              const strip = PostPriorityConfig[priority]?.badgeBg || "bg-gray-300";
              const isSelected = selectedId === c.id;
              const isClosed = adapter.closedStatuses.includes(c.status);

              return (
                <article
                  key={`${c.caseType}-${c.id}`}
                  className={`bg-background-white rounded-2xl border transition-all ${
                    isSelected ? "border-[#1ABC9C] shadow-md" : "border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isSelected}
                    onClick={() => toggleSelected(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSelected(c.id);
                      }
                    }}
                    className={`relative cursor-pointer py-4 pl-5 pr-4 lg:pr-5 ${isSelected ? "rounded-t-2xl" : "rounded-2xl"}`}
                  >
                    <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${strip} ${isSelected ? "rounded-tl-2xl" : "rounded-l-2xl"}`} />
                    <div className="flex items-start gap-3">
                      <TypeIcon caseType={c.caseType} type={c.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm lg:text-base font-semibold text-[#2D3E50] truncate">{c._title || "Untitled"}</h3>
                          <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0 pt-0.5">
                            <Clock size={11} aria-hidden="true" />
                            {formatTimeAgo(c._createdAt)}
                          </span>
                        </div>
                        {c.caseType === CaseType.VENDOR && (
                          <p className="text-xs text-gray-400 mt-0.5">Vendor risk report</p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap mt-3">
                          <StatusBadge status={c.status} config={adapter.statusConfig} />
                          {priority !== PostPriority.MEDIUM && <PriorityBadge priority={priority} />}
                          {c.caseType === CaseType.VENDOR && c.visibility === "restricted" && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                              Restricted
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-gray-50">
                          {c.assignedTo?.name ? (
                            <span className="inline-flex items-center gap-1.5 min-w-0 text-xs font-medium text-[#2D3E50]">
                              <Avatar name={c.assignedTo.name} size="xs" />
                              <span className="truncate max-w-[9rem]">{c.assignedTo.name}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                              <UserRound size={14} aria-hidden="true" />
                              Unassigned
                            </span>
                          )}
                          <DueDateChip dueDate={c.dueDate} closed={isClosed} className="ml-auto" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="lg:hidden border-t border-gray-100 bg-background-softGray rounded-b-2xl p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                      {c.caseType === CaseType.POST && <ExportCasePdfButton post={c} currentUser={userData} className="w-full" />}
                      <OpenCaseLink caseType={c.caseType} caseId={c.id} className="w-full" />
                      <CaseHandlingPanel caseType={c.caseType} caseData={c} currentUser={userData} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {selectedCase && (
            <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-w-0 bg-background-white rounded-2xl border border-[#1ABC9C] shadow-md sticky top-24 h-[calc(100vh-8rem)] overflow-hidden">
              <div className="px-6 pt-5 pb-3 flex-shrink-0">
                <div className="flex items-start gap-4">
                  <TypeIcon caseType={selectedCase.caseType} type={selectedCase.type} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-[#2D3E50] leading-snug">{selectedCase._title}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                        {selectedCase.caseType === CaseType.VENDOR ? "Vendor risk" : (selectedCase.type || "").replace(/_/g, " ")}
                      </span>
                      {selectedCase.caseType === CaseType.POST && selectedCase.isAnonymous ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                          <User size={10} aria-hidden="true" /> Anonymous
                        </span>
                      ) : (
                        selectedCase.authorName && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">
                            <User size={10} aria-hidden="true" /> {selectedCase.authorName}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  <OpenCaseLink caseType={selectedCase.caseType} caseId={selectedCase.id} className="flex-shrink-0" />
                  {selectedCase.caseType === CaseType.POST && <ExportCasePdfButton post={selectedCase} currentUser={userData} />}
                  {(selectedCase.caseType === CaseType.POST || selectedCase.caseType === CaseType.VENDOR) && (
                    <ShareWithCounselButton caseType={selectedCase.caseType} caseId={selectedCase.id} caseTitle={selectedCase.title || selectedCase.vendorName} currentUser={userData} />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    aria-label="Close"
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <StatusBadge status={selectedCase.status} config={selectedAdapter.statusConfig} size="md" />
                  <PriorityBadge priority={selectedCase._priority || PostPriority.MEDIUM} size="md" />
                  {selectedCase.assignedTo?.name ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2D3E50]">
                      <Avatar name={selectedCase.assignedTo.name} size="xs" />
                      {selectedCase.assignedTo.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                      <UserRound size={14} aria-hidden="true" /> Unassigned
                    </span>
                  )}
                  <DueDateChip dueDate={selectedCase.dueDate} closed={selectedAdapter.closedStatuses.includes(selectedCase.status)} size="md" />
                </div>
              </div>

              <div role="tablist" className="flex gap-1 px-6 border-b border-gray-100 flex-shrink-0">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.id)}
                      className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                        active ? "border-[#1ABC9C] text-[#2D3E50]" : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto bg-background-page">
                <div hidden={activeTab !== "details"} className="space-y-3 p-4">
                  <div className="rounded-xl border border-gray-100 bg-background-white p-4">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      {selectedCase.caseType === CaseType.VENDOR ? "Vendor" : "Submission"}
                    </p>
                    {selectedCase.caseType === CaseType.VENDOR && (
                      <p className="text-sm font-medium text-[#2D3E50] mb-1">{selectedCase.vendorName}</p>
                    )}
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedCase.description || selectedCase.content || "-"}
                    </p>
                  </div>
                  {selectedCase.caseType === CaseType.POST && Array.isArray(selectedCase.attachments) && selectedCase.attachments.length > 0 && (
                    <div className="rounded-xl border border-gray-100 bg-background-white overflow-hidden">
                      <CaseAttachments attachments={selectedCase.attachments} />
                    </div>
                  )}
                  {selectedCase.caseType === CaseType.VENDOR && Array.isArray(selectedCase.attachmentUrls) && selectedCase.attachmentUrls.length > 0 && (
                    <div className="rounded-xl border border-gray-100 bg-background-white p-4 space-y-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Evidence</p>
                      {selectedCase.attachmentUrls.map((url, i) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="block text-sm text-[#1ABC9C] hover:underline truncate">
                          Attachment {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {selectedCase.caseType === CaseType.POST && selectedCase.isAnonymous && (
                  <div hidden={activeTab !== "conversation"} className="p-4">
                    <div className="rounded-xl border border-gray-100 bg-background-white p-3">
                      <AnonymousThread
                        key={selectedCase.id}
                        embedded
                        postId={selectedCase.id}
                        companyId={selectedCase.companyId || userData.companyId}
                        currentUserRole={userData.role}
                        isAnonymousPost={selectedCase.isAnonymous}
                      />
                    </div>
                  </div>
                )}

                <div hidden={activeTab !== "handle"} className="p-4">
                  <CaseHandlingPanel key={selectedCase.id} caseType={selectedCase.caseType} caseData={selectedCase} currentUser={userData} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
};

export default CaseQueue;
