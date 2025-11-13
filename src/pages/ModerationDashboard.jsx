import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Flag, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  getCompanyReports,
  getModerationStats,
  getModerationActivityLogs,
} from "../services/moderationService";
import {
  ReportStatus,
  ReportStatusConfig,
  ReportReasonConfig,
  ReportableContentType,
} from "../utils/constants";

const ModerationDashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pending");
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, [activeTab, userData?.companyId]);

  const fetchData = async () => {
    if (!userData?.companyId) return;

    setLoading(true);
    setError("");

    try {
      // Fetch reports based on active tab
      let status = null;
      if (activeTab === "pending") status = ReportStatus.PENDING;
      else if (activeTab === "under_review") status = ReportStatus.UNDER_REVIEW;
      else if (activeTab === "resolved") status = ReportStatus.RESOLVED;

      const reportsData = await getCompanyReports(userData.companyId, status);
      setReports(reportsData);

      // Fetch stats
      const statsData = await getModerationStats(userData.companyId);
      setStats(statsData);

      // Fetch recent activity logs
      if (activeTab === "activity") {
        const logsData = await getModerationActivityLogs(userData.companyId, 50);
        setActivityLogs(logsData);
      }
    } catch (err) {
      console.error("Error fetching moderation data:", err);
      setError("Failed to load moderation data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReportClick = (reportId) => {
    navigate(`/moderation/report/${reportId}`);
  };

  const renderStats = () => {
    if (!stats) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">Pending Reports</p>
              <p className="text-2xl font-bold text-yellow-900 mt-1">{stats.pendingReports}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Under Review</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{stats.underReviewReports}</p>
            </div>
            <Flag className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Resolved</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{stats.resolvedReports}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Strikes Issued</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{stats.totalStrikesIssued}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>
    );
  };

  const renderReportsList = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-gray-600 mt-2">Loading reports...</p>
        </div>
      );
    }

    if (reports.length === 0) {
      return (
        <div className="text-center py-12">
          <Flag className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No reports in this category</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {reports.map((report) => {
          const statusConfig = ReportStatusConfig[report.status];
          const reasonConfig = ReportReasonConfig[report.reason];
          const createdDate = report.createdAt?.toDate
            ? report.createdAt.toDate()
            : new Date(report.createdAt);

          return (
            <div
              key={report.id}
              onClick={() => handleReportClick(report.id)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{reasonConfig.icon}</span>
                  <div>
                    <h3 className="font-medium text-gray-900">{reasonConfig.label}</h3>
                    <p className="text-sm text-gray-600">
                      {report.contentType === ReportableContentType.POST ? "Post" : "Comment"} by{" "}
                      {report.contentAuthorName || "Unknown"}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${statusConfig.bgColor} ${statusConfig.textColor}`}
                >
                  {statusConfig.label}
                </span>
              </div>

              <div className="bg-gray-50 rounded p-3 mb-3">
                <p className="text-sm text-gray-700 line-clamp-2">{report.contentPreview}</p>
              </div>

              {report.description && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Reporter notes:</span> {report.description}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Reported {createdDate.toLocaleDateString()}</span>
                {report.totalReportsForContent > 1 && (
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
                    {report.totalReportsForContent} reports on this content
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderActivityLogs = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-gray-600 mt-2">Loading activity logs...</p>
        </div>
      );
    }

    if (activityLogs.length === 0) {
      return (
        <div className="text-center py-12">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No activity logs yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {activityLogs.map((log) => {
          const logDate = log.createdAt?.toDate
            ? log.createdAt.toDate()
            : new Date(log.createdAt);

          return (
            <div
              key={log.id}
              className="bg-white border border-gray-200 rounded-lg p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">
                  {log.activityType.replace(/_/g, " ").toUpperCase()}
                </span>
                <span className="text-gray-500">
                  {logDate.toLocaleDateString()} {logDate.toLocaleTimeString()}
                </span>
              </div>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-gray-600 hover:text-gray-900 transition"
              title="Back to Dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Content Moderation</h1>
          </div>
          <p className="text-gray-600">Review and manage reported content</p>
        </div>

        {/* Stats */}
        {renderStats()}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  activeTab === "pending"
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Pending
                {stats && stats.pendingReports > 0 && (
                  <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                    {stats.pendingReports}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("under_review")}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  activeTab === "under_review"
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Under Review
                {stats && stats.underReviewReports > 0 && (
                  <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    {stats.underReviewReports}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("resolved")}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  activeTab === "resolved"
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Resolved
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  activeTab === "activity"
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Activity Log
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "activity" ? renderActivityLogs() : renderReportsList()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModerationDashboard;
