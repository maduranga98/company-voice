import { useState, useEffect } from "react";
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

const CompanyDashboard = () => {
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
    problemReports: 0,
    creativeIdeas: 0,
    discussions: 0,
  });
  const [recentPosts, setRecentPosts] = useState([]);
  const [pendingUsers, setPendingUsers] = useState(0);

  useEffect(() => {
    if (userData?.companyId) {
      fetchDashboardData();
    }
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

      // Fetch pending users
      const usersRef = collection(db, "users");
      const usersQuery = query(
        usersRef,
        where("companyId", "==", userData.companyId),
        where("status", "==", "pending")
      );
      const usersSnapshot = await getDocs(usersQuery);
      setPendingUsers(usersSnapshot.size);

      // Calculate stats
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
        problemReports: posts.filter((p) => p.type === PostType.PROBLEM_REPORT)
          .length,
        creativeIdeas: posts.filter((p) => p.type === PostType.CREATIVE_CONTENT)
          .length,
        discussions: posts.filter((p) => p.type === PostType.TEAM_DISCUSSION)
          .length,
      };

      setStats(stats);

      // Get recent posts that need attention
      const recentQuery = query(
        postsRef,
        where("companyId", "==", userData.companyId),
        where("status", "in", [
          PostStatus.OPEN,
          PostStatus.IN_PROGRESS,
          PostStatus.WORKING_ON,
        ]),
        orderBy("createdAt", "desc"),
        limit(10)
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
      case PostType.PROBLEM_REPORT:
        return "🚨";
      case PostType.CREATIVE_CONTENT:
        return "🎨";
      case PostType.TEAM_DISCUSSION:
        return "💬";
      case PostType.IDEA_SUGGESTION:
        return "💡";
      default:
        return "📄";
    }
  };

  const getPostTypeName = (type) => {
    switch (type) {
      case PostType.PROBLEM_REPORT:
        return "Problem";
      case PostType.CREATIVE_CONTENT:
        return "Creative";
      case PostType.TEAM_DISCUSSION:
        return "Discussion";
      case PostType.IDEA_SUGGESTION:
        return "Idea";
      default:
        return "Post";
    }
  };

  const navigateToFeed = (type) => {
    switch (type) {
      case PostType.PROBLEM_REPORT:
        navigate("/feed/problems");
        break;
      case PostType.CREATIVE_CONTENT:
        navigate("/feed/creative");
        break;
      case PostType.TEAM_DISCUSSION:
        navigate("/feed/discussions");
        break;
      default:
        navigate("/feed/creative");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Overview of all posts and action items requiring attention
        </p>

        {/* Pending Employees Alert */}
        {pendingUsers > 0 && (
          <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-yellow-400 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    {pendingUsers}{" "}
                    {pendingUsers === 1 ? "employee" : "employees"} pending
                    approval
                  </p>
                  <p className="text-xs text-yellow-700 mt-0.5">
                    Review and approve new employee registrations
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  navigate("/company/member-management?filter=pending")
                }
                className="px-4 py-2 bg-yellow-400 text-yellow-900 rounded-lg hover:bg-yellow-500 transition font-medium text-sm"
              >
                Review Now
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Posts */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Posts</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalPosts}
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

        {/* Critical Issues */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Critical Issues
              </p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {stats.criticalPosts}
              </p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Open/Pending */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open Issues</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {stats.openPosts}
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

        {/* In Progress + Working On */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-3xl font-bold text-indigo-600 mt-1">
                {stats.inProgressPosts + stats.workingOnPosts}
              </p>
            </div>
            <div className="bg-indigo-100 rounded-full p-3">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Post Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <button
          onClick={() => navigate("/feed/problems")}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:border-red-300 hover:shadow-md transition text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Problem Reports
            </h3>
            <span className="text-3xl">🚨</span>
          </div>
          <p className="text-3xl font-bold text-red-600">
            {stats.problemReports}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Click to view all problems
          </p>
        </button>

        <button
          onClick={() => navigate("/feed/creative")}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:border-purple-300 hover:shadow-md transition text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Creative Ideas
            </h3>
            <span className="text-3xl">🎨</span>
          </div>
          <p className="text-3xl font-bold text-purple-600">
            {stats.creativeIdeas}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Click to view all creative posts
          </p>
        </button>

        <button
          onClick={() => navigate("/feed/discussions")}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:border-blue-300 hover:shadow-md transition text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Discussions</h3>
            <span className="text-3xl">💬</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">
            {stats.discussions}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Click to view all discussions
          </p>
        </button>
      </div>

      {/* Recent Posts Needing Attention */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Recent Posts Needing Attention
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Posts that are open, in progress, or being worked on
          </p>
        </div>

        {recentPosts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              All Caught Up!
            </h3>
            <p className="text-gray-600">
              There are no posts requiring immediate attention.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => navigateToFeed(post.type)}
                className="w-full px-6 py-4 hover:bg-gray-50 transition text-left flex items-start space-x-4"
              >
                {/* Post Type Icon */}
                <div className="flex-shrink-0 mt-1">
                  <span className="text-2xl">{getPostTypeIcon(post.type)}</span>
                </div>

                {/* Post Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-medium text-gray-500">
                      {getPostTypeName(post.type)}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        PostStatusConfig[post.status]?.bgColor
                      } ${PostStatusConfig[post.status]?.textColor}`}
                    >
                      {PostStatusConfig[post.status]?.label || post.status}
                    </span>
                    {post.priority && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            PostPriorityConfig[post.priority]?.bgColor
                          } ${PostPriorityConfig[post.priority]?.textColor}`}
                        >
                          {PostPriorityConfig[post.priority]?.icon}{" "}
                          {PostPriorityConfig[post.priority]?.label}
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 line-clamp-1">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {post.description}
                  </p>
                  {post.assignedTo && (
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Assigned to: {post.assignedTo.name}
                    </div>
                  )}
                </div>

                {/* Arrow Icon */}
                <div className="flex-shrink-0 mt-2">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        <button
          onClick={() => navigate("/company/analytics")}
          className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl shadow-sm p-6 text-white hover:shadow-lg transition text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Analytics</h3>
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="text-purple-100">
            View detailed insights, trends, and engagement metrics
          </p>
        </button>

        <button
          onClick={() => navigate("/company/member-management")}
          className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl shadow-sm p-6 text-white hover:shadow-lg transition text-left relative"
        >
          {pendingUsers > 0 && (
            <span className="absolute top-4 right-4 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
              {pendingUsers}
            </span>
          )}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Member Management</h3>
            <svg
              className="w-8 h-8"
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
          <p className="text-green-100">
            Assign tags and manage your team members
          </p>
        </button>

        <button
          onClick={() => navigate("/company/tag-management")}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-sm p-6 text-white hover:shadow-lg transition text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Tag Management</h3>
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
          </div>
          <p className="text-indigo-100">
            Create and manage tags for categorizing members
          </p>
        </button>
        <button
          onClick={() => navigate("/company/departments")}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-sm p-6 text-white hover:shadow-lg transition text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Departments</h3>
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
          </div>
          <p className="text-indigo-100">
            Create and manage tags for categorizing members
          </p>
        </button>
        <button
          onClick={() => navigate("/company/members")}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-sm p-6 text-white hover:shadow-lg transition text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Member Management</h3>
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
          </div>
          <p className="text-indigo-100">
            Create and manage tags for categorizing members
          </p>
        </button>

        <button
          onClick={() => navigate("/company/qr-code")}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl shadow-sm p-6 text-white hover:shadow-lg transition text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Company QR Code</h3>
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
          </div>
          <p className="text-blue-100">
            Share your company QR code with employees to join
          </p>
        </button>

        <button
          onClick={() => navigate("/my-posts")}
          className="bg-gradient-to-r from-pink-600 to-rose-600 rounded-xl shadow-sm p-6 text-white hover:shadow-lg transition text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">My Posts</h3>
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <p className="text-pink-100">
            View and manage your own posts and updates
          </p>
        </button>
      </div>
    </div>
  );
};

export default CompanyDashboard;
