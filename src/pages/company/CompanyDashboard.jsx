import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { computeAnalytics } from "../../utils/analyticsHelpers";
import { fetchAnalyticsData } from "../../services/analyticsService";
import {
  PostStatus,
  PostStatusConfig,
  PostPriority,
  PostPriorityConfig,
  PostType,
} from "../../utils/constants";
import {
  AlertTriangle,
  Clock,
  Zap,
  FileText,
  ChevronRight,
  Users,
  Tags,
  Building2,
  QrCode,
  ClipboardList,
  CreditCard,
  Scale,
  BarChart3,
  Shield,
  MessagesSquare,
  ShieldAlert,
  BookOpen,
  Lightbulb,
  MessageSquare,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";

const CompanyDashboard = () => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPosts: 0,
    openPosts: 0,
    inProgressPosts: 0,
    workingOnPosts: 0,
    resolvedPosts: 0,
    criticalPosts: 0,
    highPriorityPosts: 0,
  });
  const [recentPosts, setRecentPosts] = useState([]);
  const [happiness, setHappiness] = useState(null);

  useEffect(() => {
    if (userData?.companyId) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const postsRef = collection(db, "posts");
      const companyQuery = query(
        postsRef,
        where("companyId", "==", userData.companyId)
      );

      const snapshot = await getDocs(companyQuery);
      const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const stats = {
        totalPosts: posts.length,
        openPosts: posts.filter((p) => p.status === PostStatus.OPEN).length,
        inProgressPosts: posts.filter(
          (p) => p.status === PostStatus.IN_PROGRESS
        ).length,
        workingOnPosts: posts.filter((p) => p.status === PostStatus.WORKING_ON)
          .length,
        resolvedPosts: posts.filter((p) => p.status === PostStatus.RESOLVED)
          .length,
        criticalPosts: posts.filter((p) => p.priority === PostPriority.CRITICAL)
          .length,
        highPriorityPosts: posts.filter((p) => p.priority === PostPriority.HIGH)
          .length,
      };

      setStats(stats);

      // Happiness is a nice-to-have: never let it break the dashboard
      try {
        const data = await fetchAnalyticsData(userData.companyId, userData.role);
        setHappiness(computeAnalytics(data, { days: 30 }).happinessScore);
      } catch (err) {
        console.warn("Happiness score unavailable:", err);
      }

      const recentQuery = query(
        postsRef,
        where("companyId", "==", userData.companyId),
        where("status", "in", [
          PostStatus.OPEN,
          PostStatus.IN_PROGRESS,
          PostStatus.WORKING_ON,
        ]),
        orderBy("createdAt", "desc"),
        limit(5)
      );

      const recentSnapshot = await getDocs(recentQuery);
      const recentPostsData = recentSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setRecentPosts(recentPostsData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPostTypeIcon = (type) => {
    switch (type) {
      case PostType.PROBLEM_REPORT: return <AlertTriangle size={16} className="text-rose-500" />;
      case PostType.CREATIVE_CONTENT: return <Lightbulb size={16} className="text-amber-500" />;
      case PostType.TEAM_DISCUSSION: return <MessageSquare size={16} className="text-brand-600" />;
      default: return <FileText size={16} className="text-gray-500" />;
    }
  };

  const getPostTypeName = (type) => {
    switch (type) {
      case PostType.PROBLEM_REPORT: return t('company.postTypeProblem');
      case PostType.CREATIVE_CONTENT: return t('company.postTypeCreative');
      case PostType.TEAM_DISCUSSION: return t('company.postTypeDiscussion');
      case PostType.IDEA_SUGGESTION: return t('company.postTypeIdea');
      default: return t('company.postTypeDefault');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-24 animate-pulse rounded-2xl bg-gray-200/60" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-200/60" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-80 animate-pulse rounded-2xl bg-gray-200/60 lg:col-span-2" />
          <div className="h-80 animate-pulse rounded-2xl bg-gray-200/60" />
        </div>
      </div>
    );
  }

  const inProgressTotal = stats.inProgressPosts + stats.workingOnPosts;
  const other = Math.max(
    stats.totalPosts - stats.openPosts - inProgressTotal - stats.resolvedPosts,
    0
  );
  const resolutionRate = stats.totalPosts
    ? Math.round((stats.resolvedPosts / stats.totalPosts) * 100)
    : 0;

  const metricCards = [
    { label: t('company.totalPosts'), value: stats.totalPosts, icon: FileText, tint: "text-brand-600 bg-brand-50" },
    {
      label: t('company.criticalIssues'),
      value: stats.criticalPosts,
      icon: AlertTriangle,
      tint: "text-rose-600 bg-rose-50",
      alert: stats.criticalPosts > 0,
    },
    { label: t('company.openIssues'), value: stats.openPosts, icon: Clock, tint: "text-amber-600 bg-amber-50" },
    { label: t('company.inProgress'), value: inProgressTotal, icon: Zap, tint: "text-ink bg-gray-100" },
  ];

  const breakdown = [
    { label: "Open", value: stats.openPosts, bar: "bg-amber-400", dot: "bg-amber-400" },
    { label: t('company.inProgress'), value: inProgressTotal, bar: "bg-ink", dot: "bg-ink" },
    { label: "Resolved", value: stats.resolvedPosts, bar: "bg-brand-500", dot: "bg-brand-500" },
    { label: "Other", value: other, bar: "bg-gray-300", dot: "bg-gray-300" },
  ];

  const quickGroups = [
    {
      title: "Cases",
      items: [
        { label: "Conversations", icon: MessagesSquare, desc: "Respond to anonymous reporters", path: "/hr/conversations" },
        { label: t('company.analytics'), icon: BarChart3, desc: t('company.analyticsDesc'), path: "/company/analytics" },
        { label: "Vendor Risk", icon: ShieldAlert, desc: "Review third-party risk reports", path: "/hr/vendor-risk" },
      ],
    },
    {
      title: "Organization",
      items: [
        { label: t('company.memberManagementTitle'), icon: Users, desc: t('company.memberManagementDesc'), path: "/company/members" },
        { label: t('company.departmentTitle'), icon: Building2, desc: t('company.departmentsDesc'), path: "/company/departments" },
        { label: t('company.tagManagement'), icon: Tags, desc: t('company.tagManagementDesc'), path: "/company/tag-management" },
        { label: t('company.qrCodeTitle'), icon: QrCode, desc: t('company.qrCodeDesc'), path: "/company/qr-code" },
      ],
    },
    {
      title: "Compliance & billing",
      items: [
        { label: "Policy Library", icon: BookOpen, desc: "Manage company policies", path: "/company/policies" },
        { label: t('company.auditLog'), icon: ClipboardList, desc: t('company.auditLogDesc'), path: "/company/audit-log" },
        { label: t('company.legalRequests'), icon: Scale, desc: t('company.legalRequestsDesc'), path: "/company/legal-requests" },
        { label: t('company.billing'), icon: CreditCard, desc: t('company.billingDesc'), path: "/company/billing" },
      ],
    },
  ];

  const firstName = userData?.displayName?.split(" ")[0] || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Hero */}
      <section className="bg-gradient-ink relative overflow-hidden rounded-2xl p-6 text-white shadow-lg lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-white/60">{today}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/70">
              {stats.openPosts > 0
                ? `${stats.openPosts} open ${stats.openPosts === 1 ? "case needs" : "cases need"} your attention.`
                : t('company.dashboardSubtitle')}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/hr/inbox")}
              className="inline-flex items-center gap-2 rounded-xl bg-background-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-brand-50"
            >
              Open inbox
              <ArrowUpRight size={16} />
            </button>
            <button
              onClick={() => navigate("/company/analytics")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              <BarChart3 size={16} />
              Analytics
            </button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`rounded-2xl border bg-background-white p-4 shadow-xs transition-shadow hover:shadow-md lg:p-5 ${
                card.alert ? "border-rose-200 ring-4 ring-rose-50" : "border-gray-200/70"
              }`}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.tint}`}>
                <Icon size={18} />
              </div>
              <p className="tabular mt-4 text-3xl font-semibold tracking-tight text-ink">{card.value}</p>
              <p className="mt-1 text-[13px] font-medium text-gray-500">{card.label}</p>
            </div>
          );
        })}
      </section>

      {happiness !== null && (
        <button
          onClick={() => navigate("/company/analytics")}
          className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-200/70 bg-background-white p-5 text-left shadow-xs transition-shadow hover:shadow-md"
        >
          <div>
            <p className="text-[13px] font-medium text-gray-500">Company happiness · last 30 days</p>
            <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-ink">
              {happiness}
              <span className="ml-1 text-base font-normal text-gray-400">/ 100</span>
            </p>
          </div>
          <div className="h-2 w-32 shrink-0 overflow-hidden rounded-full bg-gray-100 sm:w-56">
            <div className="h-2 rounded-full bg-brand-500" style={{ width: `${happiness}%` }} />
          </div>
        </button>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Attention queue */}
        <section className="overflow-hidden rounded-2xl border border-gray-200/70 bg-background-white shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 lg:px-6">
            <div>
              <h2 className="text-base font-semibold text-ink">{t('company.recentPostsTitle')}</h2>
              <p className="mt-0.5 text-[13px] text-gray-500">{t('company.recentPostsSubtitle')}</p>
            </div>
            <button
              onClick={() => navigate("/hr/inbox")}
              className="hidden items-center gap-1 text-[13px] font-semibold text-brand-600 hover:text-brand-800 sm:inline-flex"
            >
              View all <ChevronRight size={15} />
            </button>
          </div>

          {recentPosts.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                <CheckCircle2 size={22} className="text-emerald-600" />
              </div>
              <h3 className="text-base font-semibold text-ink">{t('company.allCaughtUp')}</h3>
              <p className="mt-1 text-sm text-gray-500">{t('company.noPostsAttention')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentPosts.map((post) => (
                <li key={post.id}>
                  <button
                    onClick={() => navigate("/hr/inbox")}
                    className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 lg:px-6"
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100">
                      {getPostTypeIcon(post.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-400">{getPostTypeName(post.type)}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            PostStatusConfig[post.status]?.bgColor
                          } ${PostStatusConfig[post.status]?.textColor}`}
                        >
                          {PostStatusConfig[post.status]?.label || post.status}
                        </span>
                        {post.priority && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              PostPriorityConfig[post.priority]?.bgColor
                            } ${PostPriorityConfig[post.priority]?.textColor}`}
                          >
                            {PostPriorityConfig[post.priority]?.icon} {PostPriorityConfig[post.priority]?.label}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-sm font-semibold text-ink">{post.title}</span>
                      <span className="block truncate text-[13px] text-gray-500">{post.description}</span>
                    </span>
                    <ChevronRight
                      size={18}
                      className="flex-shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Case health */}
        <section className="rounded-2xl border border-gray-200/70 bg-background-white p-5 shadow-xs lg:p-6">
          <h2 className="text-base font-semibold text-ink">Case health</h2>
          <p className="mt-0.5 text-[13px] text-gray-500">Where every case stands right now</p>

          <div className="mt-5 flex items-end gap-2">
            <span className="tabular text-4xl font-semibold tracking-tight text-ink">{resolutionRate}%</span>
            <span className="pb-1.5 text-[13px] font-medium text-gray-500">resolved</span>
          </div>

          <div
            className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100"
            role="img"
            aria-label={`${resolutionRate}% of cases resolved`}
          >
            {stats.totalPosts > 0 &&
              breakdown.map((seg) => (
                <div
                  key={seg.label}
                  className={`${seg.bar} transition-all duration-500`}
                  style={{ width: `${(seg.value / stats.totalPosts) * 100}%` }}
                />
              ))}
          </div>

          <ul className="mt-5 space-y-3">
            {breakdown.map((seg) => (
              <li key={seg.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2.5 text-gray-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${seg.dot}`} />
                  {seg.label}
                </span>
                <span className="tabular font-semibold text-ink">{seg.value}</span>
              </li>
            ))}
          </ul>

          {stats.highPriorityPosts > 0 && (
            <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] font-medium text-amber-800">
              <AlertTriangle size={16} className="flex-shrink-0" />
              {stats.highPriorityPosts} high-priority {stats.highPriorityPosts === 1 ? "case" : "cases"}
            </div>
          )}
        </section>
      </div>

      {/* Shortcuts */}
      <section className="space-y-5">
        <h2 className="text-base font-semibold text-ink">Shortcuts</h2>
        <div className="grid gap-5 lg:grid-cols-3">
          {quickGroups.map((group) => (
            <div key={group.title} className="rounded-2xl border border-gray-200/70 bg-background-white p-2 shadow-xs">
              <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                {group.title}
              </p>
              {group.items.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.path}
                    onClick={() => navigate(action.path)}
                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-brand-50"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors group-hover:bg-white group-hover:text-brand-600">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{action.label}</span>
                      <span className="block truncate text-xs text-gray-500">{action.desc}</span>
                    </span>
                    <ChevronRight size={15} className="flex-shrink-0 text-gray-300 group-hover:text-brand-600" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CompanyDashboard;
