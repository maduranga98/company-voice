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
  ArrowLeft,
  LayoutDashboard,
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
        filteredReports = filteredReports.filter((report) =>
          CRITICAL_REASONS.includes(report.reason)
        );
        if (selectedReasons.length < CRITICAL_REASONS.length) {
          filteredReports = filteredReports.filter((report) =>
            selectedReasons.includes(report.reason)
          );
        }
      } else if (mainTab === "general") {
        filteredReports = filteredReports.filter((report) =>
          GENERAL_REASONS.includes(report.reason)
        );
      } else if (mainTab === "users") {
        // For user management, show all reports but group by user later
      }

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
          <div className="bg-amber-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">
                  Pending Reports
                </p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {stats.pendingReports}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Under Review</p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {stats.underReviewReports}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Flag className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Resolved</p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {stats.resolvedReports}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Strikes Issued</p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {stats.totalStrikesIssued}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
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
          <div className="bg-red-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">
                  Critical This Month
                </p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {criticalThisMonth}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">
                  Avg Resolution Time
                </p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {avgResolutionTime > 0 ? `${avgResolutionTime}d` : "N/A"}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
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
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">
                  Pending Legal Review
                </p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {pendingLegalReviews}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-orange-600" />
              </div>
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
          <div className="bg-blue-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Spam Reports</p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {spamCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">
                  Inappropriate
                </p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {inappropriateCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">
                  False Information
                </p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {falseInfoCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Resolved</p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {
                    reports.filter((r) => r.status === ReportStatus.RESOLVED)
                      .length
                  }
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
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
          <div className="bg-red-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">
                  Repeat Offenders
                </p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {totalOffenders}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">
                  Critical Offenders
                </p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {criticalOffenders}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">
                  Total Strikes
                </p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {totalStrikes}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Flag className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">
                  Total Reports
                </p>
                <p className="text-2xl font-bold text-[#2D3E50] mt-1">
                  {allReports.length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
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
        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-[#2D3E50] mr-2" />
            <h3 className="text-lg font-semibold text-[#2D3E50]">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Report Types
              </label>
              <div className="space-y-2.5">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedReasons.includes(ReportReason.HARASSMENT)}
                    onChange={() => toggleReason(ReportReason.HARASSMENT)}
                    className="mr-2.5 rounded-md border-gray-300 text-[#1ABC9C] focus:ring-[#1ABC9C]"
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
                    className="mr-2.5 rounded-md border-gray-300 text-[#1ABC9C] focus:ring-[#1ABC9C]"
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
                    className="mr-2.5 rounded-md border-gray-300 text-[#1ABC9C] focus:ring-[#1ABC9C]"
                  />
                  <span className="text-sm text-gray-700">
                    {ReportReasonConfig[ReportReason.VIOLENCE].icon} Violence
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] text-sm"
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
        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-[#2D3E50] mr-2" />
            <h3 className="text-lg font-semibold text-[#2D3E50]">Filters</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] text-sm"
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
      <div className="bg-red-50 border border-gray-100 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-center mb-4">
          <Users className="w-5 h-5 text-red-600 mr-2" />
          <h3 className="text-lg font-semibold text-[#2D3E50]">
            Repeat Offenders
          </h3>
        </div>
        <div className="space-y-2.5">
          {repeatOffenders.slice(0, 5).map((offender) => (
            <div
              key={offender.authorId}
              className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
            >
              <div>
                <p className="font-medium text-[#2D3E50]">{offender.authorName}</p>
                <p className="text-sm text-gray-500">
                  {offender.count} reports
                  {offender.criticalCount > 0 && (
                    <span className="text-red-600 ml-2">
                      ({offender.criticalCount} critical)
                    </span>
                  )}
                  {offender.strikes > 0 && (
                    <span className="text-orange-600 ml-2">
                      {offender.strikes} strikes
                    </span>
                  )}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderReportsList = () => {
    if (loading) {
      return (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1ABC9C]"></div>
          <p className="text-gray-500 mt-3 text-sm">Loading reports...</p>
        </div>
      );
    }

    if (reports.length === 0) {
      return (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Flag className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-500">No reports in this category</p>
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
              className={`bg-white border rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer ${
                isCritical && report.priority === "critical"
                  ? "border-red-200 bg-red-50/50"
                  : "border-gray-100"
              } shadow-sm`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{reasonConfig.icon}</span>
                  <div>
                    <h3 className="font-semibold text-[#2D3E50]">
                      {reasonConfig.label}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {report.contentType === ReportableContentType.POST
                        ? "Post"
                        : "Comment"}{" "}
                      by {report.contentAuthorName || "Unknown"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {report.legalHold && (
                    <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-xl">
                      Legal Hold
                    </span>
                  )}
                  {report.priority === "critical" && (
                    <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-xl">
                      Critical
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-xl ${statusConfig.bgColor} ${statusConfig.textColor}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3.5 mb-3">
                <p className="text-sm text-gray-600 line-clamp-2">
                  {report.contentPreview}
                </p>
              </div>

              {report.description && (
                <div className="mb-3">
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-gray-600">Reporter notes:</span>{" "}
                    {report.description}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Reported {createdDate.toLocaleDateString()}</span>
                <div className="flex items-center space-x-2">
                  {report.totalReportsForContent > 1 && (
                    <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-xl font-medium">
                      {report.totalReportsForContent} reports on this content
                    </span>
                  )}
                  {mainTab === "critical" && (
                    <button
                      onClick={(e) => exportCaseSummary(report, e)}
                      className="flex items-center px-2.5 py-1 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Export
                    </button>
                  )}
                </div>
              </div>

              {mainTab === "critical" && (
                <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-gray-100">
                  {report.status === ReportStatus.PENDING && (
                    <>
                      <button
                        onClick={(e) =>
                          handleQuickAction(report.id, "legal_review", e)
                        }
                        className="px-3.5 py-1.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-xl hover:bg-orange-200 transition-colors"
                      >
                        Mark as Legal Review
                      </button>
                      <button
                        onClick={(e) =>
                          handleQuickAction(report.id, "escalate", e)
                        }
                        className="px-3.5 py-1.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-xl hover:bg-purple-200 transition-colors"
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
                      className="px-3.5 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-xl hover:bg-emerald-200 transition-colors"
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
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1ABC9C]"></div>
          <p className="text-gray-500 mt-3 text-sm">Loading user data...</p>
        </div>
      );
    }

    if (repeatOffenders.length === 0) {
      return (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-500">No repeat offenders found</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {repeatOffenders.map((offender) => (
          <div
            key={offender.authorId}
            className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-[#2D3E50] text-lg">
                  {offender.authorName}
                </h3>
                <p className="text-sm text-gray-400">ID: {offender.authorId}</p>
              </div>
              <div className="flex items-center space-x-2">
                {offender.criticalCount > 0 && (
                  <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-xl">
                    {offender.criticalCount} Critical
                  </span>
                )}
                {offender.strikes > 0 && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-xl">
                    {offender.strikes} Strikes
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-[#2D3E50]">
                  {offender.count}
                </p>
                <p className="text-sm text-gray-500">Total Reports</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-red-700">
                  {offender.criticalCount}
                </p>
                <p className="text-sm text-red-500">Critical Issues</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-orange-700">
                  {offender.strikes}
                </p>
                <p className="text-sm text-orange-500">Strikes</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const tabs = [
    { id: "all", label: "All Reports" },
    { id: "critical", label: "Critical Issues", icon: <AlertTriangle className="w-4 h-4" /> },
    { id: "general", label: "General Violations" },
    { id: "users", label: "User Management" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500 hover:text-[#2D3E50] hover:border-gray-200 transition shadow-sm"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2D3E50] flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[#2D3E50]">
                Unified Moderation Dashboard
              </h1>
            </div>
          </div>
          <p className="text-gray-500 ml-[88px]">
            Comprehensive content moderation and user management
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-gray-100 rounded-2xl shadow-sm">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Main Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="p-1.5">
            <nav className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setMainTab(tab.id);
                    setStatusFilter("all");
                    if (tab.id === "critical") setSelectedReasons([...CRITICAL_REASONS]);
                  }}
                  className={`flex-1 py-3 px-4 text-center font-medium text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${
                    mainTab === tab.id
                      ? "bg-[#2D3E50] text-white shadow-sm"
                      : "text-gray-500 hover:text-[#2D3E50] hover:bg-gray-50"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
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
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-[#2D3E50]">
              {mainTab === "all" && `All Reports (${reports.length})`}
              {mainTab === "critical" && `Critical Issues (${reports.length})`}
              {mainTab === "general" && `General Violations (${reports.length})`}
              {mainTab === "users" && `User Management (${repeatOffenders.length} offenders)`}
            </h2>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          {mainTab === "users" ? renderUserManagement() : renderReportsList()}
        </div>
      </div>
    </div>
  );
};

export default ModerationDashboard;
