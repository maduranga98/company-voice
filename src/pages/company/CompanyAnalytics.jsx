import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import {
  PostStatus,
  PostPriority,
  PostType,
} from "../../utils/constants";

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
      pendingUsers: 0,
    },
    postsByType: {},
    postsByStatus: {},
    postsByPriority: {},
    responseTimeAvg: 0,
    resolutionRate: 0,
    departmentStats: [],
    userEngagement: [],
    trendsLast30Days: [],
  });

  useEffect(() => {
    if (userData?.companyId) {
      fetchAnalyticsData();
    }
  }, [userData]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      // Fetch all posts for the company
      const postsRef = collection(db, "posts");
      const postsQuery = query(
        postsRef,
        where("companyId", "==", userData.companyId)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const posts = postsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch all comments for the company posts
      const commentsRef = collection(db, "comments");
      const commentsSnapshot = await getDocs(commentsRef);
      const allComments = commentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const companyComments = allComments.filter((comment) =>
        posts.some((post) => post.id === comment.postId)
      );

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
        pendingUsers: users.filter((u) => u.status === "pending").length,
      };

      // Posts by type
      const postsByType = {
        [PostType.PROBLEM_REPORT]: posts.filter(
          (p) => p.type === PostType.PROBLEM_REPORT
        ).length,
        [PostType.CREATIVE_CONTENT]: posts.filter(
          (p) => p.type === PostType.CREATIVE_CONTENT
        ).length,
        [PostType.TEAM_DISCUSSION]: posts.filter(
          (p) => p.type === PostType.TEAM_DISCUSSION
        ).length,
        [PostType.IDEA_SUGGESTION]: posts.filter(
          (p) => p.type === PostType.IDEA_SUGGESTION
        ).length,
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

      setAnalytics({
        overview,
        postsByType,
        postsByStatus,
        postsByPriority,
        responseTimeAvg: avgResponseHours,
        resolutionRate,
        departmentStats: [],
        userEngagement,
        trendsLast30Days,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      [PostType.PROBLEM_REPORT]: "Problems",
      [PostType.CREATIVE_CONTENT]: "Creative",
      [PostType.TEAM_DISCUSSION]: "Discussions",
      [PostType.IDEA_SUGGESTION]: "Ideas",
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status) => {
    const labels = {
      [PostStatus.OPEN]: "Open",
      [PostStatus.ACKNOWLEDGED]: "Acknowledged",
      [PostStatus.IN_PROGRESS]: "In Progress",
      [PostStatus.WORKING_ON]: "Working On",
      [PostStatus.UNDER_REVIEW]: "Under Review",
      [PostStatus.RESOLVED]: "Resolved",
      [PostStatus.CLOSED]: "Closed",
      [PostStatus.REJECTED]: "Rejected",
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      [PostPriority.CRITICAL]: "Critical",
      [PostPriority.HIGH]: "High",
      [PostPriority.MEDIUM]: "Medium",
      [PostPriority.LOW]: "Low",
    };
    return labels[priority] || priority;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      [PostPriority.CRITICAL]: "bg-red-100 text-red-800",
      [PostPriority.HIGH]: "bg-orange-100 text-orange-800",
      [PostPriority.MEDIUM]: "bg-yellow-100 text-yellow-800",
      [PostPriority.LOW]: "bg-green-100 text-green-800",
    };
    return colors[priority] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const maxTrendValue = Math.max(...analytics.trendsLast30Days.map((d) => d.count), 1);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/company/dashboard")}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("common.back")}
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Analytics Dashboard
        </h1>
        <p className="text-gray-600">
          Comprehensive insights into your company's engagement and performance
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Posts</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {analytics.overview.totalPosts}
              </p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Comments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {analytics.overview.totalComments}
              </p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {analytics.overview.activeUsers}
              </p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Users</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {analytics.overview.pendingUsers}
              </p>
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <svg
                className="w-6 h-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-sm p-6 text-white">
          <div>
            <p className="text-sm font-medium text-blue-100">Resolution Rate</p>
            <p className="text-3xl font-bold mt-1">{analytics.resolutionRate}%</p>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Average Response Time
          </h3>
          <div className="flex items-baseline">
            <p className="text-4xl font-bold text-indigo-600">
              {analytics.responseTimeAvg}
            </p>
            <span className="ml-2 text-gray-600">hours</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Time to first admin response on posts
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Engagement Score
          </h3>
          <div className="flex items-baseline">
            <p className="text-4xl font-bold text-purple-600">
              {(
                (analytics.overview.totalComments /
                  Math.max(analytics.overview.totalPosts, 1)) *
                10
              ).toFixed(1)}
            </p>
            <span className="ml-2 text-gray-600">/ 10</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Comments per post ratio indicator
          </p>
        </div>
      </div>

      {/* Posts Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* By Type */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Posts by Type
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.postsByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {getTypeLabel(type)}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${
                          (count / Math.max(analytics.overview.totalPosts, 1)) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-8 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Status */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Posts by Status
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.postsByStatus)
              .filter(([_, count]) => count > 0)
              .slice(0, 6)
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {getStatusLabel(status)}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{
                          width: `${
                            (count /
                              Math.max(analytics.overview.totalPosts, 1)) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-8 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* By Priority */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Posts by Priority
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.postsByPriority).map(
              ([priority, count]) => (
                <div
                  key={priority}
                  className="flex items-center justify-between"
                >
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${getPriorityColor(
                      priority
                    )}`}
                  >
                    {getPriorityLabel(priority)}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{
                          width: `${
                            (count /
                              Math.max(analytics.overview.totalPosts, 1)) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-8 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Trends Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Post Activity - Last 30 Days
        </h3>
        <div className="h-64 flex items-end justify-between gap-1">
          {analytics.trendsLast30Days.map((data, index) => {
            const height = (data.count / maxTrendValue) * 100;
            const isWeekend =
              new Date(data.date).getDay() === 0 ||
              new Date(data.date).getDay() === 6;
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center justify-end group relative"
              >
                <div
                  className={`w-full ${
                    isWeekend ? "bg-indigo-300" : "bg-indigo-600"
                  } rounded-t hover:bg-indigo-700 transition-all cursor-pointer`}
                  style={{ height: `${height}%`, minHeight: data.count > 0 ? "4px" : "0" }}
                ></div>
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
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
        <div className="flex justify-between mt-4 text-xs text-gray-500">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Top Contributors */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Top Contributors (Most Active)
        </h3>
        <div className="space-y-4">
          {analytics.userEngagement.map((user, index) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">
                    {user.posts} posts • {user.comments} comments
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-indigo-600">
                  {user.total}
                </p>
                <p className="text-xs text-gray-500">activities</p>
              </div>
            </div>
          ))}
          {analytics.userEngagement.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No user activity data available yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyAnalytics;
