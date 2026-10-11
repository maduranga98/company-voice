import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { hrCaseScope } from "../../utils/caseVisibility";
import {
  PostStatus,
  PostPriority,
  PostPriorityConfig,
} from "../../utils/constants";
import { getDepartments, getDepartmentStats } from "../../services/departmentservice";
import {
  filterPostsByDateRange,
  exportToCSV,
  downloadCSV,
} from "../../utils/analyticsHelpers";
import { StatusBadge, PriorityBadge } from "../../components/case/CaseBadges";
import {
  ArrowLeft,
  FileText,
  MessagesSquare,
  Users,
  Download,
  ChevronDown,
  TrendingUp,
  Trophy,
  Info,
} from "lucide-react";

const CompanyAnalytics = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    overview: {
      totalPosts: 0,
      totalComments: 0,
      totalUsers: 0,
      activeUsers: 0,
    },
    postsByStatus: {},
    postsByPriority: {},
    responseTimeAvg: 0,
    resolutionRate: 0,
    departmentStats: [],
    userEngagement: [],
    trendsLast30Days: [],
    trendsLast7Days: [],
    happinessScore: 0,
  });
  const [trendPeriod, setTrendPeriod] = useState("30"); // 7, 30, or 90 days
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: "",
    enabled: false,
  });
  const [allPostsData, setAllPostsData] = useState(null); // Store all data for filtering
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  useEffect(() => {
    if (userData?.companyId) {
      fetchAnalyticsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  // Re-calculate analytics when date filter changes
  useEffect(() => {
    if (allPostsData && dateFilter.enabled) {
      applyDateFilter();
    } else if (allPostsData && !dateFilter.enabled) {
      // Reset to show all data
      calculateAnalytics(allPostsData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      // Fetch all posts for the company
      const postsRef = collection(db, "posts");
      const postsQuery = query(
        postsRef,
        where("companyId", "==", userData.companyId),
        ...hrCaseScope(userData.role)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const posts = postsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch all comments for the company
      const commentsRef = collection(db, "comments");
      const commentsQuery = query(
        commentsRef,
        where("companyId", "==", userData.companyId)
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const companyComments = commentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch all users for the company
      const usersRef = collection(db, "users");
      const usersQuery = query(
        usersRef,
        where("companyId", "==", userData.companyId)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Calculate overview stats
      const overview = {
        totalPosts: posts.length,
        totalComments: companyComments.length,
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.status === "active").length,
      };

      // Posts by status
      const postsByStatus = {
        [PostStatus.OPEN]: posts.filter((p) => p.status === PostStatus.OPEN)
          .length,
        [PostStatus.ACKNOWLEDGED]: posts.filter(
          (p) => p.status === PostStatus.ACKNOWLEDGED
        ).length,
        [PostStatus.IN_PROGRESS]: posts.filter(
          (p) => p.status === PostStatus.IN_PROGRESS
        ).length,
        [PostStatus.WORKING_ON]: posts.filter(
          (p) => p.status === PostStatus.WORKING_ON
        ).length,
        [PostStatus.UNDER_REVIEW]: posts.filter(
          (p) => p.status === PostStatus.UNDER_REVIEW
        ).length,
        [PostStatus.RESOLVED]: posts.filter(
          (p) => p.status === PostStatus.RESOLVED
        ).length,
        [PostStatus.CLOSED]: posts.filter((p) => p.status === PostStatus.CLOSED)
          .length,
        [PostStatus.REJECTED]: posts.filter(
          (p) => p.status === PostStatus.REJECTED
        ).length,
      };

      // Posts by priority
      const postsByPriority = {
        [PostPriority.CRITICAL]: posts.filter(
          (p) => p.priority === PostPriority.CRITICAL
        ).length,
        [PostPriority.HIGH]: posts.filter((p) => p.priority === PostPriority.HIGH)
          .length,
        [PostPriority.MEDIUM]: posts.filter(
          (p) => p.priority === PostPriority.MEDIUM
        ).length,
        [PostPriority.LOW]: posts.filter((p) => p.priority === PostPriority.LOW)
          .length,
      };

      // Calculate resolution rate
      const resolvedPosts = posts.filter(
        (p) =>
          p.status === PostStatus.RESOLVED || p.status === PostStatus.CLOSED
      ).length;
      const resolutionRate =
        posts.length > 0 ? ((resolvedPosts / posts.length) * 100).toFixed(1) : 0;

      // Calculate average response time
      const postsWithResponse = posts.filter(
        (p) => p.status !== PostStatus.OPEN && p.updatedAt && p.createdAt
      );
      let totalResponseTime = 0;
      postsWithResponse.forEach((post) => {
        const created = post.createdAt?.toDate?.() || new Date(post.createdAt);
        const updated = post.updatedAt?.toDate?.() || new Date(post.updatedAt);
        const diff = updated - created;
        totalResponseTime += diff;
      });
      const avgResponseTime =
        postsWithResponse.length > 0
          ? totalResponseTime / postsWithResponse.length
          : 0;
      const avgResponseHours = (avgResponseTime / (1000 * 60 * 60)).toFixed(1);

      // User engagement (top contributors)
      const userEngagementMap = {};
      users.forEach((user) => {
        userEngagementMap[user.id] = {
          name: user.displayName || "Unknown",
          posts: 0,
          comments: 0,
        };
      });

      posts.forEach((post) => {
        if (!post.isAnonymous && userEngagementMap[post.authorId]) {
          userEngagementMap[post.authorId].posts += 1;
        }
      });

      companyComments.forEach((comment) => {
        if (userEngagementMap[comment.authorId]) {
          userEngagementMap[comment.authorId].comments += 1;
        }
      });

      const userEngagement = Object.entries(userEngagementMap)
        .map(([id, data]) => ({
          id,
          ...data,
          total: data.posts + data.comments,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Trends for last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const trendsMap = {};

      for (let i = 0; i < 30; i++) {
        const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split("T")[0];
        trendsMap[dateKey] = 0;
      }

      posts.forEach((post) => {
        const postDate = post.createdAt?.toDate?.() || new Date(post.createdAt);
        const dateKey = postDate.toISOString().split("T")[0];
        if (trendsMap[dateKey] !== undefined) {
          trendsMap[dateKey] += 1;
        }
      });

      const trendsLast30Days = Object.entries(trendsMap).map(([date, count]) => ({
        date,
        count,
      }));

      // Trends for last 7 days
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const trends7Map = {};
      for (let i = 0; i < 7; i++) {
        const date = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split("T")[0];
        trends7Map[dateKey] = 0;
      }
      posts.forEach((post) => {
        const postDate = post.createdAt?.toDate?.() || new Date(post.createdAt);
        const dateKey = postDate.toISOString().split("T")[0];
        if (trends7Map[dateKey] !== undefined) {
          trends7Map[dateKey] += 1;
        }
      });
      const trendsLast7Days = Object.entries(trends7Map).map(([date, count]) => ({
        date,
        count,
      }));

      // Fetch department statistics
      const departments = await getDepartments(userData.companyId, false);
      const departmentStatsData = [];
      for (const dept of departments) {
        const stats = await getDepartmentStats(dept.id, userData.companyId);
        departmentStatsData.push({
          id: dept.id,
          name: dept.name,
          icon: dept.icon || "🏢",
          memberCount: dept.memberCount || 0,
          totalPosts: stats.totalPosts || 0,
          resolvedIssues: stats.resolvedIssues || 0,
          pendingIssues: stats.pendingIssues || 0,
          resolutionRate: stats.totalPosts > 0
            ? ((stats.resolvedIssues / stats.totalPosts) * 100).toFixed(1)
            : 0,
        });
      }

      // Calculate happiness score (based on resolution rate, engagement, and response time)
      const engagementRate = overview.totalPosts > 0
        ? (companyComments.length / overview.totalPosts) * 10
        : 0;
      const resolutionScore = parseFloat(resolutionRate);
      const responseScore = avgResponseHours > 0
        ? Math.max(0, 100 - (avgResponseHours * 2)) // Lower response time = higher score
        : 50;
      const happinessScore = ((resolutionScore + Math.min(engagementRate * 10, 100) + responseScore) / 3).toFixed(1);

      setAnalytics({
        overview,
        postsByStatus,
        postsByPriority,
        responseTimeAvg: avgResponseHours,
        resolutionRate,
        departmentStats: departmentStatsData,
        userEngagement,
        trendsLast30Days,
        trendsLast7Days,
        happinessScore,
      });
      // Store all data for filtering
      setAllPostsData({ posts, comments: companyComments, users, departments: departmentStatsData });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyDateFilter = () => {
    if (!allPostsData) return;

    const startDate = new Date(dateFilter.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateFilter.endDate);
    endDate.setHours(23, 59, 59, 999);

    const filteredPosts = filterPostsByDateRange(
      allPostsData.posts,
      startDate,
      endDate
    );

    calculateAnalytics({
      posts: filteredPosts,
      comments: allPostsData.comments,
      users: allPostsData.users,
      departments: allPostsData.departments,
    });
  };

  const calculateAnalytics = (data) => {
    const { posts, comments, users } = data;

    // Filter comments to only those belonging to filtered posts
    const postIds = new Set(posts.map((p) => p.id));
    const filteredComments = comments.filter((c) => postIds.has(c.postId));

    // Recalculate overview
    const overview = {
      totalPosts: posts.length,
      totalComments: filteredComments.length,
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === "active").length,
    };

    // Recalculate other analytics based on filtered data...
    // (Using simplified recalculation for now to avoid excessive complexity)
    setAnalytics((prev) => ({
      ...prev,
      overview,
      // Keep other analytics as-is for now
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6 lg:space-y-8" aria-busy="true">
        <div className="h-16 w-64 animate-pulse rounded-xl bg-gray-200/60" />
        <div className="h-24 animate-pulse rounded-2xl bg-gray-200/60" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200/60" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-gray-200/60" />
      </div>
    );
  }

  const trendData = trendPeriod === "7" ? analytics.trendsLast7Days : analytics.trendsLast30Days;
  const maxTrendValue = Math.max(...trendData.map((d) => d.count), 1);

  const getHappinessEmoji = (score) => {
    if (score >= 80) return "😊";
    if (score >= 60) return "🙂";
    if (score >= 40) return "😐";
    if (score >= 20) return "😟";
    return "😢";
  };

  const getHappinessColor = (score) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-brand-600";
    if (score >= 40) return "text-amber-600";
    if (score >= 20) return "text-orange-600";
    return "text-rose-600";
  };

  const getHappinessBar = (score) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-brand-500";
    if (score >= 40) return "bg-amber-500";
    if (score >= 20) return "bg-orange-500";
    return "bg-rose-500";
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            onClick={() => navigate("/company/dashboard")}
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-500 transition hover:text-ink"
          >
            <ArrowLeft size={14} />
            {t("common.back")}
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-ink lg:text-3xl">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Engagement and performance across your company
          </p>
        </div>
      </div>

      {/* Controls: Date Filter & Export */}
      <section className="rounded-2xl border border-gray-200/70 bg-background-white p-5 shadow-xs lg:p-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Date Range Filter */}
          <div className="min-w-[300px] flex-1">
            <label className="mb-2 block text-[13px] font-medium text-gray-600">
              Date range filter
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) =>
                  setDateFilter((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              <span className="text-sm text-gray-500">to</span>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) =>
                  setDateFilter((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              <button
                onClick={() =>
                  setDateFilter((prev) => ({
                    ...prev,
                    enabled: prev.startDate && prev.endDate,
                  }))
                }
                disabled={!dateFilter.startDate || !dateFilter.endDate}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Apply filter
              </button>
              {dateFilter.enabled && (
                <button
                  onClick={() =>
                    setDateFilter({
                      startDate: "",
                      endDate: "",
                      enabled: false,
                    })
                  }
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const csvContent = exportToCSV(analytics, "full");
                downloadCSV(
                  csvContent,
                  `analytics-report-${new Date().toISOString().split("T")[0]}.csv`
                );
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-soft"
            >
              <Download size={16} />
              Export full report
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-background-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                More
                <ChevronDown size={15} />
              </button>
              {showExportDropdown && (
                <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-gray-200/70 bg-background-white py-1 shadow-lg">
                  <button
                    onClick={() => {
                      const csvContent = exportToCSV(analytics, "overview");
                      downloadCSV(csvContent, `overview-${new Date().toISOString().split("T")[0]}.csv`);
                      setShowExportDropdown(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Export overview
                  </button>
                  <button
                    onClick={() => {
                      const csvContent = exportToCSV(analytics, "engagement");
                      downloadCSV(csvContent, `user-engagement-${new Date().toISOString().split("T")[0]}.csv`);
                      setShowExportDropdown(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Export user engagement
                  </button>
                  <button
                    onClick={() => {
                      const csvContent = exportToCSV(analytics, "departments");
                      downloadCSV(csvContent, `departments-${new Date().toISOString().split("T")[0]}.csv`);
                      setShowExportDropdown(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Export department performance
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {dateFilter.enabled && (
          <div className="mt-4 text-[13px] font-medium text-brand-700">
            Showing data from {new Date(dateFilter.startDate).toLocaleDateString()} to{" "}
            {new Date(dateFilter.endDate).toLocaleDateString()}
          </div>
        )}
      </section>

      {/* Overview Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border border-gray-200/70 bg-background-white p-4 shadow-xs lg:p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <FileText size={18} />
          </div>
          <p className="tabular mt-4 text-3xl font-semibold tracking-tight text-ink">
            {analytics.overview.totalPosts}
          </p>
          <p className="mt-1 text-[13px] font-medium text-gray-500">Total posts</p>
        </div>

        <div className="rounded-2xl border border-gray-200/70 bg-background-white p-4 shadow-xs lg:p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <MessagesSquare size={18} />
          </div>
          <p className="tabular mt-4 text-3xl font-semibold tracking-tight text-ink">
            {analytics.overview.totalComments}
          </p>
          <p className="mt-1 text-[13px] font-medium text-gray-500">Total comments</p>
        </div>

        <div className="rounded-2xl border border-gray-200/70 bg-background-white p-4 shadow-xs lg:p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Users size={18} />
          </div>
          <p className="tabular mt-4 text-3xl font-semibold tracking-tight text-ink">
            {analytics.overview.activeUsers}
          </p>
          <p className="mt-1 text-[13px] font-medium text-gray-500">Active users</p>
        </div>

        <div className="bg-gradient-primary rounded-2xl p-4 text-white shadow-sm lg:p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <TrendingUp size={18} />
          </div>
          <p className="tabular mt-4 text-3xl font-semibold tracking-tight">
            {analytics.resolutionRate}%
          </p>
          <p className="mt-1 text-[13px] font-medium text-white/80">Resolution rate</p>
        </div>
      </section>

      {/* Employee Happiness Indicator */}
      <section className="rounded-2xl border border-gray-200/70 bg-background-white p-5 shadow-xs lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-ink">
              Employee happiness indicator
            </h3>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Based on resolution rate, engagement, and response time
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-5xl">{getHappinessEmoji(analytics.happinessScore)}</span>
            <div className="text-center">
              <p className={`text-4xl font-semibold tabular ${getHappinessColor(analytics.happinessScore)}`}>
                {analytics.happinessScore}
              </p>
              <p className="text-xs text-gray-400">out of 100</p>
            </div>
          </div>
        </div>
        <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${getHappinessBar(analytics.happinessScore)}`}
            style={{ width: `${analytics.happinessScore}%` }}
          />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-[13px] text-gray-500">Resolution</p>
            <p className="tabular text-lg font-semibold text-ink">{analytics.resolutionRate}%</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-[13px] text-gray-500">Engagement</p>
            <p className="tabular text-lg font-semibold text-ink">
              {((analytics.overview.totalComments / Math.max(analytics.overview.totalPosts, 1)) * 10).toFixed(1)}/10
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-[13px] text-gray-500">Response time</p>
            <p className="tabular text-lg font-semibold text-ink">{analytics.responseTimeAvg}h</p>
          </div>
        </div>
      </section>

      {/* Performance Metrics */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
        <div className="rounded-2xl border border-gray-200/70 bg-background-white p-5 shadow-xs lg:p-6">
          <h3 className="text-base font-semibold text-ink">Average response time</h3>
          <div className="mt-3 flex items-baseline">
            <p className="tabular text-4xl font-semibold text-ink">
              {analytics.responseTimeAvg}
            </p>
            <span className="ml-2 text-gray-500">hours</span>
          </div>
          <p className="mt-2 text-[13px] text-gray-500">
            Time to first admin response on posts
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200/70 bg-background-white p-5 shadow-xs lg:p-6">
          <h3 className="text-base font-semibold text-ink">Engagement score</h3>
          <div className="mt-3 flex items-baseline">
            <p className="tabular text-4xl font-semibold text-ink">
              {(
                (analytics.overview.totalComments /
                  Math.max(analytics.overview.totalPosts, 1)) *
                10
              ).toFixed(1)}
            </p>
            <span className="ml-2 text-gray-500">/ 10</span>
          </div>
          <p className="mt-2 text-[13px] text-gray-500">
            Comments per post ratio indicator
          </p>
        </div>
      </section>

      {/* Posts Breakdown */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
        {/* By Status */}
        <div className="rounded-2xl border border-gray-200/70 bg-background-white p-5 shadow-xs lg:p-6">
          <h3 className="mb-4 text-base font-semibold text-ink">Posts by status</h3>
          <div className="space-y-3">
            {Object.entries(analytics.postsByStatus)
              .filter(([, count]) => count > 0)
              .slice(0, 6)
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between gap-3">
                  <StatusBadge status={status} />
                  <div className="flex flex-1 items-center justify-end gap-2">
                    <div className="h-2 w-24 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-brand-500"
                        style={{
                          width: `${
                            (count /
                              Math.max(analytics.overview.totalPosts, 1)) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="tabular w-8 text-right text-sm font-semibold text-ink">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* By Priority */}
        <div className="rounded-2xl border border-gray-200/70 bg-background-white p-5 shadow-xs lg:p-6">
          <h3 className="mb-4 text-base font-semibold text-ink">Posts by priority</h3>
          <div className="space-y-3">
            {Object.entries(analytics.postsByPriority).map(
              ([priority, count]) => (
                <div key={priority} className="flex items-center justify-between gap-3">
                  <PriorityBadge priority={priority} />
                  <div className="flex flex-1 items-center justify-end gap-2">
                    <div className="h-2 w-24 rounded-full bg-gray-100">
                      <div
                        className={`h-2 rounded-full ${PostPriorityConfig[priority]?.badgeBg || "bg-gray-400"}`}
                        style={{
                          width: `${
                            (count /
                              Math.max(analytics.overview.totalPosts, 1)) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="tabular w-8 text-right text-sm font-semibold text-ink">
                      {count}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Department Comparison */}
      {analytics.departmentStats.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-gray-200/70 bg-background-white shadow-xs">
          <div className="border-b border-gray-100 px-5 py-4 lg:px-6">
            <h3 className="text-base font-semibold text-ink">Department comparison</h3>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Compare performance metrics across departments
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 lg:px-6">
                    Department
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 lg:px-6">
                    Members
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 lg:px-6">
                    Total posts
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 lg:px-6">
                    Resolved
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 lg:px-6">
                    Pending
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 lg:px-6">
                    Resolution rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.departmentStats
                  .sort((a, b) => b.totalPosts - a.totalPosts)
                  .map((dept) => (
                    <tr
                      key={dept.id}
                      className="cursor-pointer transition hover:bg-gray-50"
                      onClick={() => navigate(`/departments/${dept.id}`)}
                    >
                      <td className="whitespace-nowrap px-5 py-4 lg:px-6">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{dept.icon}</span>
                          <span className="text-sm font-semibold text-ink">
                            {dept.name}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600 lg:px-6">
                        {dept.memberCount}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600 lg:px-6">
                        {dept.totalPosts}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 lg:px-6">
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          {dept.resolvedIssues}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 lg:px-6">
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                          {dept.pendingIssues}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 lg:px-6">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 rounded-full bg-gray-100">
                            <div
                              className="h-2 rounded-full bg-brand-500"
                              style={{ width: `${dept.resolutionRate}%` }}
                            ></div>
                          </div>
                          <span className="tabular text-sm font-semibold text-ink">
                            {dept.resolutionRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Trends Chart */}
      <section className="rounded-2xl border border-gray-200/70 bg-background-white p-5 shadow-xs lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-ink">Post activity trends</h3>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Track post creation patterns over time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTrendPeriod("7")}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                trendPeriod === "7"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              7 days
            </button>
            <button
              onClick={() => setTrendPeriod("30")}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                trendPeriod === "30"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              30 days
            </button>
          </div>
        </div>
        <div className="mt-5 flex h-64 items-end justify-between gap-1">
          {trendData.map((data, index) => {
            const height = (data.count / maxTrendValue) * 100;
            const isWeekend =
              new Date(data.date).getDay() === 0 ||
              new Date(data.date).getDay() === 6;
            return (
              <div
                key={index}
                className="group relative flex flex-1 flex-col items-center justify-end"
              >
                <div
                  className={`w-full rounded-t transition-all ${
                    isWeekend ? "bg-brand-200" : "bg-brand-500"
                  } cursor-pointer hover:bg-brand-600`}
                  style={{ height: `${height}%`, minHeight: data.count > 0 ? "4px" : "0" }}
                ></div>
                <div className="absolute bottom-full mb-2 hidden whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white group-hover:block">
                  {new Date(data.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  : {data.count} posts
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-between text-xs text-gray-400">
          <span>{trendPeriod} days ago</span>
          <span>Today</span>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-brand-50 p-4">
          <Info size={18} className="mt-0.5 flex-shrink-0 text-brand-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-800">Trend insights</p>
            <p className="mt-1 text-sm text-brand-700">
              {trendData.reduce((sum, d) => sum + d.count, 0)} total posts in the last {trendPeriod} days.
              Average: {(trendData.reduce((sum, d) => sum + d.count, 0) / trendData.length).toFixed(1)} posts/day
            </p>
          </div>
        </div>
      </section>

      {/* Top Contributors */}
      <section className="rounded-2xl border border-gray-200/70 bg-background-white p-5 shadow-xs lg:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
          <Trophy size={17} className="text-amber-500" />
          Top contributors
        </h3>
        <div className="space-y-3">
          {analytics.userEngagement.map((user, index) => (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-xl bg-gray-50 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{user.name}</p>
                  <p className="text-xs text-gray-500">
                    {user.posts} posts • {user.comments} comments
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="tabular text-lg font-semibold text-brand-600">
                  {user.total}
                </p>
                <p className="text-xs text-gray-400">activities</p>
              </div>
            </div>
          ))}
          {analytics.userEngagement.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">
              No user activity data available yet
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default CompanyAnalytics;
