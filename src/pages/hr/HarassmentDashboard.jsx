import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  Download,
  Filter,
  Users,
  FileText,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  getCompanyReports,
  getModerationStats,
} from "../../services/moderationService";
import {
  ReportStatus,
  ReportStatusConfig,
  ReportReasonConfig,
  ReportReason,
} from "../../utils/constants";

const HarassmentDashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  // Filters
  const [selectedReasons, setSelectedReasons] = useState([
    ReportReason.HARASSMENT,
    ReportReason.DISCRIMINATION,
    ReportReason.VIOLENCE,
  ]);
  const [statusFilter, setStatusFilter] = useState("all");

  // Data
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repeatOffenders, setRepeatOffenders] = useState([]);

  useEffect(() => {
    fetchData();
  }, [selectedReasons, statusFilter, userData?.companyId]);

  const fetchData = async () => {
    if (!userData?.companyId) return;

    setLoading(true);
    setError("");

    try {
      // Fetch all reports and filter by reason
      const allReports = await getCompanyReports(userData.companyId, null);

      // Filter by selected reasons
      let filteredReports = allReports.filter((report) =>
        selectedReasons.includes(report.reason)
      );

      // Filter by status if not "all"
      if (statusFilter !== "all") {
        filteredReports = filteredReports.filter(
          (report) => report.status === statusFilter
        );
      }

      // Sort by priority (critical first) and then by date
      filteredReports.sort((a, b) => {
        const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;

        if (bPriority !== aPriority) return bPriority - aPriority;

        // If same priority, sort by date (newest first)
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bDate - aDate;
      });

      setReports(filteredReports);

      // Fetch stats
      const statsData = await getModerationStats(userData.companyId);
      setStats(statsData);

      // Identify repeat offenders (content authors with multiple reports)
      identifyRepeatOffenders(allReports);
    } catch (err) {
      console.error("Error fetching harassment data:", err);
      setError("Failed to load harassment data. Please try again.");
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
    // Navigate to report detail view where they can take the action
    navigate(`/moderation/report/${reportId}`, { state: { suggestedAction: action } });
  };

  const exportCaseSummary = async (report, e) => {
    e.stopPropagation();

    // Create a simple text summary
    const summary = `
CASE SUMMARY
============
Report ID: ${report.id}
Date: ${report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString() : "N/A"}
Reason: ${ReportReasonConfig[report.reason]?.label || report.reason}
Status: ${ReportStatusConfig[report.status]?.label || report.status}
Priority: ${report.priority || "N/A"}
Content Type: ${report.contentType}
Description: ${report.description || "No description provided"}

${report.legalHold ? "⚠️ LEGAL HOLD ACTIVE" : ""}
${report.retentionYears ? `Retention: ${report.retentionYears} years` : ""}
`;

    // Download as text file
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
      // Don't allow removing all reasons
      if (selectedReasons.length > 1) {
        setSelectedReasons(selectedReasons.filter((r) => r !== reason));
      }
    } else {
      setSelectedReasons([...selectedReasons, reason]);
    }
  };

  const renderStatistics = () => {
    if (!stats) return null;

    // Calculate critical reports this month
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const criticalThisMonth = reports.filter((r) => {
      const reportDate = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      return r.priority === "critical" && reportDate >= thisMonthStart;
    }).length;

    // Calculate average resolution time
    const resolvedReports = reports.filter((r) => r.status === ReportStatus.RESOLVED);
    let avgResolutionTime = 0;
    if (resolvedReports.length > 0) {
      const totalTime = resolvedReports.reduce((sum, report) => {
        if (report.reviewedAt && report.createdAt) {
          const created = report.createdAt?.toDate ? report.createdAt.toDate() : new Date(report.createdAt);
          const resolved = report.reviewedAt?.toDate ? report.reviewedAt.toDate() : new Date(report.reviewedAt);
          return sum + (resolved - created);
        }
        return sum;
      }, 0);
      avgResolutionTime = Math.round(totalTime / resolvedReports.length / (1000 * 60 * 60 * 24)); // Convert to days
    }

    // Reports by type breakdown
    const reportsByType = {
      harassment: reports.filter((r) => r.reason === ReportReason.HARASSMENT).length,
      discrimination: reports.filter((r) => r.reason === ReportReason.DISCRIMINATION).length,
      violence: reports.filter((r) => r.reason === ReportReason.VIOLENCE).length,
    };

    // Pending legal reviews
    const pendingLegalReviews = reports.filter(
      (r) => r.status === ReportStatus.UNDER_REVIEW && r.legalHold
    ).length;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Critical This Month</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{criticalThisMonth}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Avg Resolution Time</p>
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
              <p className="text-sm text-purple-600 font-medium">Reports by Type</p>
              <p className="text-xs text-purple-700 mt-1">
                H: {reportsByType.harassment} | D: {reportsByType.discrimination} | V: {reportsByType.violence}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-medium">Pending Legal Review</p>
              <p className="text-2xl font-bold text-orange-900 mt-1">{pendingLegalReviews}</p>
            </div>
            <Shield className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>
    );
  };

  const renderFilters = () => {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center mb-3">
          <Filter className="w-5 h-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Report Type Filters */}
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
                  {ReportReasonConfig[ReportReason.HARASSMENT].icon} Harassment
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedReasons.includes(ReportReason.DISCRIMINATION)}
                  onChange={() => toggleReason(ReportReason.DISCRIMINATION)}
                  className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">
                  {ReportReasonConfig[ReportReason.DISCRIMINATION].icon} Discrimination
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

          {/* Status Filter */}
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
  };

  const renderRepeatOffenders = () => {
    if (repeatOffenders.length === 0) return null;

    return (
      <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
        <div className="flex items-center mb-3">
          <Users className="w-5 h-5 text-red-600 mr-2" />
          <h3 className="text-lg font-semibold text-red-900">Repeat Offenders</h3>
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
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No reports match the current filters</p>
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

          // Get related reports count (simplified - would need actual query)
          const relatedCount = 0; // This would need to be fetched

          return (
            <div
              key={report.id}
              onClick={() => handleReportClick(report.id)}
              className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                report.priority === "critical"
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200"
              }`}
            >
              {/* Header Row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{reasonConfig?.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {reasonConfig?.label}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {createdDate.toLocaleDateString()} at{" "}
                      {createdDate.toLocaleTimeString()}
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
                    className={`px-3 py-1 ${statusConfig.bgColor} ${statusConfig.textColor} text-sm font-medium rounded-full`}
                  >
                    {statusConfig.label}
                  </span>
                </div>
              </div>

              {/* Key Info Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                <div>
                  <span className="text-gray-600">Severity:</span>
                  <span className="ml-2 font-medium text-gray-900 capitalize">
                    {report.priority || "Medium"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Content:</span>
                  <span className="ml-2 font-medium text-gray-900 capitalize">
                    {report.contentType}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {statusConfig.label}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Related:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {relatedCount} reports
                  </span>
                </div>
              </div>

              {/* Description */}
              {report.description && (
                <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                  {report.description}
                </p>
              )}

              {/* Quick Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <div className="flex space-x-2">
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
                <button
                  onClick={(e) => exportCaseSummary(report, e)}
                  className="flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export Summary
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <Shield className="w-8 h-8 text-red-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">
              HR Harassment Dashboard
            </h1>
          </div>
          <p className="text-gray-600">
            Dedicated workspace for managing serious workplace incidents
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Statistics */}
        {renderStatistics()}

        {/* Filters */}
        {renderFilters()}

        {/* Repeat Offenders */}
        {renderRepeatOffenders()}

        {/* Reports List */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Harassment Reports ({reports.length})
            </h2>
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          {renderReportsList()}
        </div>
      </div>
    </div>
  );
};

export default HarassmentDashboard;
