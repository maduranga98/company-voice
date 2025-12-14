import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Flag,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Shield,
  Download,
  Filter,
  Users,
  FileText,
} from "lucide-react";
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
  ReportReason,
} from "../utils/constants";

// Critical issues that HR focuses on
const CRITICAL_REASONS = [
  ReportReason.HARASSMENT,
  ReportReason.DISCRIMINATION,
  ReportReason.VIOLENCE,
];

// General violations
const GENERAL_REASONS = [
  ReportReason.SPAM,
  ReportReason.INAPPROPRIATE,
  ReportReason.FALSE_INFO,
  ReportReason.OTHER,
];

const ModerationDashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState("all"); // all, critical, general, users
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReasons, setSelectedReasons] = useState([...CRITICAL_REASONS]);
  const [reports, setReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [repeatOffenders, setRepeatOffenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, [mainTab, statusFilter, selectedReasons, userData?.companyId]);

  const fetchData = async () => {
    if (!userData?.companyId) return;

    setLoading(true);
    setError("");

    try {
      // Fetch all reports for analysis
      const allReportsData = await getCompanyReports(userData.companyId, null);
      setAllReports(allReportsData);

      // Filter reports based on active tab
      let filteredReports = [...allReportsData];

      if (mainTab === "critical") {
        // Show only critical issues
        filteredReports = filteredReports.filter((report) =>
          CRITICAL_REASONS.includes(report.reason)
        );
        // Filter by selected critical reasons if any are unchecked
        if (selectedReasons.length < CRITICAL_REASONS.length) {
          filteredReports = filteredReports.filter((report) =>
            selectedReasons.includes(report.reason)
          );
        }
      } else if (mainTab === "general") {
        // Show only general violations
        filteredReports = filteredReports.filter((report) =>
          GENERAL_REASONS.includes(report.reason)
        );
      } else if (mainTab === "users") {
        // For user management, we'll show all reports but group by user later
        // No filtering needed here
      }
      // For "all" tab, show everything (no filtering)

      // Apply status filter if not "all"
      if (statusFilter !== "all") {
        filteredReports = filteredReports.filter(
          (report) => report.status === statusFilter
        );
      }

      // Sort by priority and date
      filteredReports.sort((a, b) => {
        const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;

        if (bPriority !== aPriority) return bPriority - aPriority;

        const aDate = a.createdAt?.toDate
          ? a.createdAt.toDate()
          : new Date(a.createdAt);
        const bDate = b.createdAt?.toDate
          ? b.createdAt.toDate()
          : new Date(b.createdAt);
        return bDate - aDate;
      });

      setReports(filteredReports);

      // Fetch stats
      const statsData = await getModerationStats(userData.companyId);
      setStats(statsData);

      // Fetch activity logs if needed
      if (mainTab === "activity") {
        const logsData = await getModerationActivityLogs(userData.companyId, 50);
        setActivityLogs(logsData);
      }

      // Identify repeat offenders for Critical and Users tabs
      if (mainTab === "critical" || mainTab === "users") {
        identifyRepeatOffenders(allReportsData);
      }
    } catch (err) {
      console.error("Error fetching moderation data:", err);
      setError("Failed to load moderation data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const identifyRepeatOffenders = (allReports) => {
    const authorReportCounts = {};

    allReports.forEach((report) => {
      if (report.contentAuthorId && !report.isAnonymous) {
        if (!authorReportCounts[report.contentAuthorId]) {
          authorReportCounts[report.contentAuthorId] = {
            authorId: report.contentAuthorId,
            authorName: report.contentAuthorName || "Unknown",
            count: 0,
            criticalCount: 0,
            strikes: report.strikes || 0,
          };
        }
        authorReportCounts[report.contentAuthorId].count++;
        if (report.priority === "critical") {
          authorReportCounts[report.contentAuthorId].criticalCount++;
        }
      }
    });

    // Filter to get only repeat offenders (2+ reports)
    const offenders = Object.values(authorReportCounts)
      .filter((author) => author.count >= 2)
      .sort((a, b) => b.count - a.count);

    setRepeatOffenders(offenders);
  };

  const handleReportClick = (reportId) => {
    navigate(`/moderation/report/${reportId}`);
  };

  const handleQuickAction = async (reportId, action, e) => {
    e.stopPropagation();
    navigate(`/moderation/report/${reportId}`, {
      state: { suggestedAction: action },
    });
  };

  const exportCaseSummary = async (report, e) => {
    e.stopPropagation();

    const summary = `
CASE SUMMARY
============
Report ID: ${report.id}
Date: ${
      report.createdAt?.toDate
        ? report.createdAt.toDate().toLocaleString()
        : "N/A"
    }
Reason: ${ReportReasonConfig[report.reason]?.label || report.reason}
Status: ${ReportStatusConfig[report.status]?.label || report.status}
Priority: ${report.priority || "N/A"}
Content Type: ${report.contentType}
Description: ${report.description || "No description provided"}

${report.legalHold ? "⚠️ LEGAL HOLD ACTIVE" : ""}
${report.retentionYears ? `Retention: ${report.retentionYears} years` : ""}
`;

    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `case-summary-${report.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleReason = (reason) => {
    if (selectedReasons.includes(reason)) {
      if (selectedReasons.length > 1) {
        setSelectedReasons(selectedReasons.filter((r) => r !== reason));
      }
    } else {
      setSelectedReasons([...selectedReasons, reason]);
    }
  };

  const renderMainTabStats = () => {
    if (!stats) return null;

    if (mainTab === "all") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">
                  Pending Reports
                </p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">
                  {stats.pendingReports}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Under Review</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {stats.underReviewReports}
                </p>
              </div>
              <Flag className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Resolved</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {stats.resolvedReports}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Strikes Issued</p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {stats.totalStrikesIssued}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>
      );
    }

    if (mainTab === "critical") {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const criticalThisMonth = reports.filter((r) => {
        const reportDate = r.createdAt?.toDate
          ? r.createdAt.toDate()
          : new Date(r.createdAt);
        return r.priority === "critical" && reportDate >= thisMonthStart;
      }).length;

      const resolvedReports = reports.filter(
        (r) => r.status === ReportStatus.RESOLVED
      );
      let avgResolutionTime = 0;
      if (resolvedReports.length > 0) {
        const totalTime = resolvedReports.reduce((sum, report) => {
          if (report.reviewedAt && report.createdAt) {
            const created = report.createdAt?.toDate
              ? report.createdAt.toDate()
              : new Date(report.createdAt);
            const resolved = report.reviewedAt?.toDate
              ? report.reviewedAt.toDate()
              : new Date(report.reviewedAt);
            return sum + (resolved - created);
          }
          return sum;
        }, 0);
        avgResolutionTime = Math.round(
          totalTime / resolvedReports.length / (1000 * 60 * 60 * 24)
        );
      }

      const reportsByType = {
        harassment: reports.filter(
          (r) => r.reason === ReportReason.HARASSMENT
        ).length,
        discrimination: reports.filter(
          (r) => r.reason === ReportReason.DISCRIMINATION
        ).length,
        violence: reports.filter((r) => r.reason === ReportReason.VIOLENCE)
          .length,
      };

      const pendingLegalReviews = reports.filter(
        (r) => r.status === ReportStatus.UNDER_REVIEW && r.legalHold
      ).length;

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">
                  Critical This Month
                </p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {criticalThisMonth}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">
                  Avg Resolution Time
                </p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {avgResolutionTime > 0 ? `${avgResolutionTime}d` : "N/A"}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">
                  Reports by Type
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  H: {reportsByType.harassment} | D: {reportsByType.discrimination}{" "}
                  | V: {reportsByType.violence}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">
                  Pending Legal Review
                </p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {pendingLegalReviews}
                </p>
              </div>
              <Shield className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>
      );
    }

    if (mainTab === "general") {
      const spamCount = reports.filter((r) => r.reason === ReportReason.SPAM)
        .length;
      const inappropriateCount = reports.filter(
        (r) => r.reason === ReportReason.INAPPROPRIATE
      ).length;
      const falseInfoCount = reports.filter(
        (r) => r.reason === ReportReason.FALSE_INFO
      ).length;

      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Spam Reports</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {spamCount}
                </p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">
                  Inappropriate
                </p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {inappropriateCount}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">
                  False Information
                </p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {falseInfoCount}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Resolved</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {
                    reports.filter((r) => r.status === ReportStatus.RESOLVED)
                      .length
                  }
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>
      );
    }

    if (mainTab === "users") {
      const totalOffenders = repeatOffenders.length;
      const criticalOffenders = repeatOffenders.filter(
        (o) => o.criticalCount > 0
      ).length;
      const totalStrikes = repeatOffenders.reduce(
        (sum, o) => sum + o.strikes,
        0
      );

      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">
                  Repeat Offenders
                </p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {totalOffenders}
                </p>
              </div>
              <Users className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">
                  Critical Offenders
                </p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {criticalOffenders}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">
                  Total Strikes
                </p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">
                  {totalStrikes}
                </p>
              </div>
              <Flag className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">
                  Total Reports
                </p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {allReports.length}
                </p>
              </div>
              <FileText className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderFilters = () => {
    if (mainTab === "critical") {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center mb-3">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Types
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedReasons.includes(ReportReason.HARASSMENT)}
                    onChange={() => toggleReason(ReportReason.HARASSMENT)}
                    className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">
                    {ReportReasonConfig[ReportReason.HARASSMENT].icon}{" "}
                    Harassment
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedReasons.includes(
                      ReportReason.DISCRIMINATION
                    )}
                    onChange={() => toggleReason(ReportReason.DISCRIMINATION)}
                    className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">
                    {ReportReasonConfig[ReportReason.DISCRIMINATION].icon}{" "}
                    Discrimination
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedReasons.includes(ReportReason.VIOLENCE)}
                    onChange={() => toggleReason(ReportReason.VIOLENCE)}
                    className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">
                    {ReportReasonConfig[ReportReason.VIOLENCE].icon} Violence
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value={ReportStatus.PENDING}>Pending</option>
                <option value={ReportStatus.UNDER_REVIEW}>Under Review</option>
                <option value={ReportStatus.RESOLVED}>Resolved</option>
                <option value={ReportStatus.DISMISSED}>Dismissed</option>
              </select>
            </div>
          </div>
        </div>
      );
    }

    if (mainTab === "all" || mainTab === "general") {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center mb-3">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value={ReportStatus.PENDING}>Pending</option>
              <option value={ReportStatus.UNDER_REVIEW}>Under Review</option>
              <option value={ReportStatus.RESOLVED}>Resolved</option>
              <option value={ReportStatus.DISMISSED}>Dismissed</option>
            </select>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderRepeatOffenders = () => {
    if (repeatOffenders.length === 0) return null;

    return (
      <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
        <div className="flex items-center mb-3">
          <Users className="w-5 h-5 text-red-600 mr-2" />
          <h3 className="text-lg font-semibold text-red-900">
            Repeat Offenders
          </h3>
        </div>
        <div className="space-y-2">
          {repeatOffenders.slice(0, 5).map((offender) => (
            <div
              key={offender.authorId}
              className="flex items-center justify-between bg-white p-3 rounded border border-red-200"
            >
              <div>
                <p className="font-medium text-gray-900">{offender.authorName}</p>
                <p className="text-sm text-gray-600">
                  {offender.count} reports
                  {offender.criticalCount > 0 && (
                    <span className="text-red-600 ml-2">
                      ({offender.criticalCount} critical)
                    </span>
                  )}
                  {offender.strikes > 0 && (
                    <span className="text-orange-600 ml-2">
                      • {offender.strikes} strikes
                    </span>
                  )}
                </p>
              </div>
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
          ))}
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

          const isCritical = mainTab === "critical" || report.priority === "critical";

          return (
            <div
              key={report.id}
              onClick={() => handleReportClick(report.id)}
              className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                isCritical && report.priority === "critical"
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{reasonConfig.icon}</span>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {reasonConfig.label}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {report.contentType === ReportableContentType.POST
                        ? "Post"
                        : "Comment"}{" "}
                      by {report.contentAuthorName || "Unknown"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {report.legalHold && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                      Legal Hold
                    </span>
                  )}
                  {report.priority === "critical" && (
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                      Critical
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${statusConfig.bgColor} ${statusConfig.textColor}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded p-3 mb-3">
                <p className="text-sm text-gray-700 line-clamp-2">
                  {report.contentPreview}
                </p>
              </div>

              {report.description && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Reporter notes:</span>{" "}
                    {report.description}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Reported {createdDate.toLocaleDateString()}</span>
                <div className="flex items-center space-x-2">
                  {report.totalReportsForContent > 1 && (
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
                      {report.totalReportsForContent} reports on this content
                    </span>
                  )}
                  {mainTab === "critical" && (
                    <button
                      onClick={(e) => exportCaseSummary(report, e)}
                      className="flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Export
                    </button>
                  )}
                </div>
              </div>

              {mainTab === "critical" && (
                <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-gray-200">
                  {report.status === ReportStatus.PENDING && (
                    <>
                      <button
                        onClick={(e) =>
                          handleQuickAction(report.id, "legal_review", e)
                        }
                        className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded hover:bg-orange-200 transition-colors"
                      >
                        Mark as Legal Review
                      </button>
                      <button
                        onClick={(e) =>
                          handleQuickAction(report.id, "escalate", e)
                        }
                        className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded hover:bg-purple-200 transition-colors"
                      >
                        Escalate
                      </button>
                    </>
                  )}
                  {report.status === ReportStatus.UNDER_REVIEW && (
                    <button
                      onClick={(e) =>
                        handleQuickAction(report.id, "resolve", e)
                      }
                      className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded hover:bg-green-200 transition-colors"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderUserManagement = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-gray-600 mt-2">Loading user data...</p>
        </div>
      );
    }

    if (repeatOffenders.length === 0) {
      return (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No repeat offenders found</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {repeatOffenders.map((offender) => (
          <div
            key={offender.authorId}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">
                  {offender.authorName}
                </h3>
                <p className="text-sm text-gray-600">ID: {offender.authorId}</p>
              </div>
              <div className="flex items-center space-x-2">
                {offender.criticalCount > 0 && (
                  <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                    {offender.criticalCount} Critical
                  </span>
                )}
                {offender.strikes > 0 && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded-full">
                    {offender.strikes} Strikes
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 rounded p-3">
                <p className="text-2xl font-bold text-gray-900">
                  {offender.count}
                </p>
                <p className="text-sm text-gray-600">Total Reports</p>
              </div>
              <div className="bg-red-50 rounded p-3">
                <p className="text-2xl font-bold text-red-900">
                  {offender.criticalCount}
                </p>
                <p className="text-sm text-red-600">Critical Issues</p>
              </div>
              <div className="bg-orange-50 rounded p-3">
                <p className="text-2xl font-bold text-orange-900">
                  {offender.strikes}
                </p>
                <p className="text-sm text-orange-600">Strikes</p>
              </div>
            </div>
          </div>
        ))}
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
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              Unified Moderation Dashboard
            </h1>
          </div>
          <p className="text-gray-600">
            Comprehensive content moderation and user management
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Main Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => {
                  setMainTab("all");
                  setStatusFilter("all");
                }}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  mainTab === "all"
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All Reports
              </button>
              <button
                onClick={() => {
                  setMainTab("critical");
                  setStatusFilter("all");
                  setSelectedReasons([...CRITICAL_REASONS]);
                }}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  mainTab === "critical"
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                🚨 Critical Issues
              </button>
              <button
                onClick={() => {
                  setMainTab("general");
                  setStatusFilter("all");
                }}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  mainTab === "general"
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                General Violations
              </button>
              <button
                onClick={() => {
                  setMainTab("users");
                  setStatusFilter("all");
                }}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  mainTab === "users"
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                User Management
              </button>
            </nav>
          </div>
        </div>

        {/* Stats */}
        {renderMainTabStats()}

        {/* Filters */}
        {renderFilters()}

        {/* Repeat Offenders (for Critical tab) */}
        {mainTab === "critical" && renderRepeatOffenders()}

        {/* Content */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {mainTab === "all" && `All Reports (${reports.length})`}
              {mainTab === "critical" && `Critical Issues (${reports.length})`}
              {mainTab === "general" && `General Violations (${reports.length})`}
              {mainTab === "users" && `User Management (${repeatOffenders.length} offenders)`}
            </h2>
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          {mainTab === "users" ? renderUserManagement() : renderReportsList()}
        </div>
      </div>
    </div>
  );
};

export default ModerationDashboard;
