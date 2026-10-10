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
      case PostType.PROBLEM_REPORT: return <AlertTriangle size={16} className="text-red-500" />;
      case PostType.CREATIVE_CONTENT: return <Lightbulb size={16} className="text-purple-500" />;
      case PostType.TEAM_DISCUSSION: return <MessageSquare size={16} className="text-blue-500" />;
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl border-2 border-[#1ABC9C] border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      label: t('company.totalPosts'),
      value: stats.totalPosts,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      label: t('company.criticalIssues'),
      value: stats.criticalPosts,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100",
      highlight: stats.criticalPosts > 0,
    },
    {
      label: t('company.openIssues'),
      value: stats.openPosts,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      label: t('company.inProgress'),
      value: stats.inProgressPosts + stats.workingOnPosts,
      icon: Zap,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
    },
  ];

  const quickActions = [
    { label: t('company.analytics'), icon: BarChart3, desc: t('company.analyticsDesc'), path: "/company/analytics", color: "text-purple-600", bg: "bg-purple-50" },
    { label: t('company.memberManagementTitle'), icon: Users, desc: t('company.memberManagementDesc'), path: "/company/members", color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: t('company.departmentTitle'), icon: Building2, desc: t('company.departmentsDesc'), path: "/company/departments", color: "text-blue-600", bg: "bg-blue-50" },
    { label: t('company.tagManagement'), icon: Tags, desc: t('company.tagManagementDesc'), path: "/company/tag-management", color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Conversations", icon: MessagesSquare, desc: "Respond to anonymous reporters", path: "/hr/conversations", color: "text-teal-600", bg: "bg-teal-50" },
    { label: "Vendor Risk", icon: ShieldAlert, desc: "Review third-party risk reports", path: "/hr/vendor-risk", color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Policy Library", icon: BookOpen, desc: "Manage company policies", path: "/company/policies", color: "text-cyan-600", bg: "bg-cyan-50" },
    { label: t('company.auditLog'), icon: ClipboardList, desc: t('company.auditLogDesc'), path: "/company/audit-log", color: "text-amber-600", bg: "bg-amber-50" },
    { label: t('company.qrCodeTitle'), icon: QrCode, desc: t('company.qrCodeDesc'), path: "/company/qr-code", color: "text-sky-600", bg: "bg-sky-50" },
    { label: t('company.billing'), icon: CreditCard, desc: t('company.billingDesc'), path: "/company/billing", color: "text-teal-600", bg: "bg-teal-50" },
    { label: t('company.legalRequests'), icon: Scale, desc: t('company.legalRequestsDesc'), path: "/company/legal-requests", color: "text-slate-600", bg: "bg-slate-50" },
  ];

  return (
    <div className="space-y-4 lg:space-y-6 px-4 sm:px-6 lg:px-0">
      {/* Welcome header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
          {t('company.dashboardTitle')}
        </h1>
        <p className="text-xs lg:text-sm text-gray-500 mt-1">
          {t('company.dashboardSubtitle')}
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`bg-white rounded-xl lg:rounded-2xl p-3 lg:p-5 border ${card.border} ${
                card.highlight ? "ring-2 ring-red-200" : ""
              } transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-2 lg:mb-3">
                <div className={`w-8 h-8 lg:w-10 lg:h-10 ${card.bg} rounded-lg lg:rounded-xl flex items-center justify-center`}>
                  <Icon size={16} className={`${card.color} lg:hidden`} />
                  <Icon size={20} className={`${card.color} hidden lg:block`} />
                </div>
              </div>
              <p className="text-2xl lg:text-3xl font-bold text-gray-900">{card.value}</p>
              <p className="text-[11px] lg:text-xs font-medium text-gray-500 mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent posts needing attention */}
      <div className="bg-white rounded-xl lg:rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 lg:px-6 py-4 lg:py-5 border-b border-gray-100">
          <h2 className="text-base lg:text-lg font-bold text-gray-900">
            {t('company.recentPostsTitle')}
          </h2>
          <p className="text-xs lg:text-sm text-gray-500 mt-0.5">
            {t('company.recentPostsSubtitle')}
          </p>
        </div>

        {recentPosts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield size={24} className="text-emerald-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {t('company.allCaughtUp')}
            </h3>
            <p className="text-sm text-gray-500">
              {t('company.noPostsAttention')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => navigate("/hr/inbox")}
                className="w-full px-6 py-4 hover:bg-gray-50/50 transition text-left flex items-center gap-4 group"
              >
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-gray-100 transition-colors">
                  {getPostTypeIcon(post.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-medium text-gray-400">
                      {getPostTypeName(post.type)}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        PostStatusConfig[post.status]?.bgColor
                      } ${PostStatusConfig[post.status]?.textColor}`}
                    >
                      {PostStatusConfig[post.status]?.label || post.status}
                    </span>
                    {post.priority && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          PostPriorityConfig[post.priority]?.bgColor
                        } ${PostPriorityConfig[post.priority]?.textColor}`}
                      >
                        {PostPriorityConfig[post.priority]?.icon}{" "}
                        {PostPriorityConfig[post.priority]?.label}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
                    {post.title}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                    {post.description}
                  </p>
                </div>

                <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions grid */}
      <div>
        <h2 className="text-base lg:text-lg font-bold text-gray-900 mb-3 lg:mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 lg:gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="bg-white rounded-xl lg:rounded-2xl p-3 lg:p-4 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all text-left group flex items-center gap-3 lg:gap-4 relative"
              >
                                <div className={`w-9 h-9 lg:w-11 lg:h-11 ${action.bg} rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  <Icon size={16} className={`${action.color} lg:hidden`} />
                  <Icon size={20} className={`${action.color} hidden lg:block`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-semibold text-gray-900">{action.label}</p>
                  <p className="text-[11px] lg:text-xs text-gray-400 mt-0.5 line-clamp-1">{action.desc}</p>
                </div>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0 lg:hidden" />
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0 hidden lg:block" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CompanyDashboard;
