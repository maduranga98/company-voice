import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";
import {
  getVendorReports,
  getVendorReport,
  getVendorReportStats,
  updateVendorReportStatus,
} from "../../services/vendorRiskService";
import {
  ArrowLeft, FileText, AlertTriangle, ChevronRight, Download, Shield,
  Calendar, User, Clock, CheckCircle, Users, Flag, FileSearch, MessageSquare,
} from "lucide-react";

const TABS = ["all", "open", "investigating", "escalated", "resolved", "closed"];

const STATUS_STRIP_COLOR = {
  open: "bg-blue-400",
  investigating: "bg-amber-400",
  escalated: "bg-red-500",
  resolved: "bg-emerald-500",
  closed: "bg-gray-300",
};

const STATUS_BADGE = {
  open: "bg-blue-50 text-blue-700 border border-blue-100",
  investigating: "bg-amber-50 text-amber-700 border border-amber-100",
  escalated: "bg-red-50 text-red-700 border border-red-100",
  resolved: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  closed: "bg-gray-50 text-gray-600 border border-gray-100",
};

const CATEGORY_BADGE = {
  labor: "bg-blue-50 text-blue-700 border border-blue-100",
  data_privacy: "bg-purple-50 text-purple-700 border border-purple-100",
  safety: "bg-orange-50 text-orange-700 border border-orange-100",
  fraud: "bg-red-50 text-red-700 border border-red-100",
  compliance: "bg-indigo-50 text-indigo-700 border border-indigo-100",
  other: "bg-gray-50 text-gray-600 border border-gray-100",
};

const CATEGORY_LABEL = {
  labor: "Labor Practices",
  data_privacy: "Data Privacy",
  safety: "Health & Safety",
  fraud: "Fraud / Corruption",
  compliance: "Regulatory Non-Compliance",
  other: "Other",
};

const SEVERITY_BADGE = {
  low: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  medium: "bg-amber-50 text-amber-700 border border-amber-100",
  high: "bg-red-50 text-red-700 border border-red-100",
};

const RELATIONSHIP_BADGE = {
  witness: "bg-blue-50 text-blue-700 border border-blue-100",
  directly_affected: "bg-red-50 text-red-700 border border-red-100",
  heard_from_others: "bg-gray-50 text-gray-600 border border-gray-100",
};

const RELATIONSHIP_LABEL = {
  witness: "Direct Witness",
  directly_affected: "Directly Affected",
  heard_from_others: "Heard from Others",
};

const SEVERITY_CONFIG = {
  low: { label: "Low", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500", level: 1 },
  medium: { label: "Medium", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500", level: 2 },
  high: { label: "High", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", bar: "bg-red-500", level: 3 },
};

const STATUS_CONFIG = {
  open: { label: "Open", icon: Flag, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  investigating: { label: "Investigating", icon: FileSearch, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  escalated: { label: "Escalated", icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  resolved: { label: "Resolved", icon: CheckCircle, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  closed: { label: "Closed", icon: Shield, color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" },
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "\u2014";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  } catch {
    return "\u2014";
  }
};

const Spinner = () => (
  <div className="flex items-center justify-center py-16">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#1ABC9C] border-t-transparent" />
  </div>
);

const Badge = ({ className, children }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold ${className}`}>
    {children}
  </span>
);

const VendorRiskDashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState("open");
  const [reviewNotes, setReviewNotes] = useState("");

  useEffect(() => {
    if (!userData) return;
    if (!["hr", "company_admin"].includes(userData.role)) {
      navigate("/feed/creative");
      return;
    }
    loadData();
  }, [userData]);

  const loadData = async () => {
    try {
      const [reportsData, statsData] = await Promise.all([
        getVendorReports(userData.companyId),
        getVendorReportStats(userData.companyId),
      ]);
      setReports(reportsData);
      setStats(statsData);
    } catch (err) {
      console.error("Error loading vendor reports:", err);
      toast.error("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = async (report) => {
    setDetailLoading(true);
    setSelectedReport({ ...report, corroborations: [] });
    setNewStatus(report.status);
    setReviewNotes(report.reviewNotes || "");
    try {
      const full = await getVendorReport(report.id);
      setSelectedReport(full);
      setNewStatus(full.status);
      setReviewNotes(full.reviewNotes || "");
    } catch (err) {
      console.error("Error loading report detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedReport) return;
    setStatusUpdating(true);
    try {
      await updateVendorReportStatus(
        selectedReport.id,
        newStatus,
        userData.displayName || userData.username,
        reviewNotes
      );
      toast.success("Status updated");
      await loadData();
      // Refresh selected report
      const updated = await getVendorReport(selectedReport.id);
      setSelectedReport(updated);
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const filteredReports =
    activeTab === "all" ? reports : reports.filter((r) => r.status === activeTab);

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-32">
      {/* Header */}
      <div className="bg-[#2D3E50] text-white px-6 py-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-[#1ABC9C]/20 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#1ABC9C]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Vendor Risk Reports</h1>
            <p className="text-sm text-white/50 mt-0.5">Anonymous third-party risk submissions from employees</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 p-4">
          {[
            { label: "Total", value: stats.total, color: "text-[#2D3E50]" },
            { label: "Open", value: stats.open, color: "text-blue-600" },
            { label: "Investigating", value: stats.investigating, color: "text-amber-600" },
            { label: "Escalated", value: stats.escalated, color: stats.escalated > 0 ? "text-red-600" : "text-gray-400" },
            { label: "Resolved", value: stats.resolved, color: "text-emerald-600" },
            { label: "Closed", value: stats.closed, color: "text-gray-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-3.5 text-center shadow-sm border border-gray-100">
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-gray-500 mt-1 font-medium uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab
                ? "bg-[#2D3E50] text-white shadow-sm"
                : "bg-white text-gray-500 border border-gray-100 hover:border-gray-200"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Report list */}
      <div className="p-4">
        {filteredReports.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No reports found</p>
            <p className="text-xs text-gray-400 mt-1">No vendor risk reports match this filter</p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              onClick={() => handleCardClick(report)}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-3 overflow-hidden cursor-pointer hover:shadow-md hover:border-gray-200 transition-all"
            >
              {/* Status strip */}
              <div className={`h-1 ${STATUS_STRIP_COLOR[report.status] || "bg-gray-300"}`} />

              <div className="p-5">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-gray-400">{report.referenceCode}</div>
                    <div className="text-sm font-bold text-[#2D3E50] mt-0.5 truncate">{report.vendorName}</div>
                  </div>
                  {report.autoEscalated && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-red-100">
                      <AlertTriangle className="w-3 h-3" /> Auto-escalated
                    </span>
                  )}
                </div>

                {/* Badges row */}
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  <Badge className={CATEGORY_BADGE[report.riskCategory] || "bg-gray-50 text-gray-600 border border-gray-100"}>
                    {CATEGORY_LABEL[report.riskCategory] || report.riskCategory}
                  </Badge>
                  <Badge className={SEVERITY_BADGE[report.severity] || "bg-gray-50 text-gray-600 border border-gray-100"}>
                    {report.severity?.charAt(0).toUpperCase() + report.severity?.slice(1)}
                  </Badge>
                  {report.corroborationCount > 0 && (
                    <Badge className="bg-teal-50 text-teal-700 border border-teal-100">
                      {report.corroborationCount} corroboration{report.corroborationCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  <Badge className={STATUS_BADGE[report.status] || "bg-gray-50 text-gray-600 border border-gray-100"}>
                    {report.status?.charAt(0).toUpperCase() + report.status?.slice(1)}
                  </Badge>
                </div>

                {/* Bottom row */}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-gray-400">{formatRelativeTime(report.submittedAt)}</span>
                  <span className="text-xs text-[#1ABC9C] font-semibold flex items-center gap-1">
                    View Details <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DETAIL PANEL */}
      {selectedReport && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setSelectedReport(null)}
          />
          <div className="fixed inset-0 z-50 bg-[#f8f9fb] flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="bg-[#2D3E50] px-5 py-4 flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => setSelectedReport(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono text-white/40 tracking-wider">{selectedReport.referenceCode}</div>
                <div className="text-base font-bold text-white truncate leading-tight mt-0.5">{selectedReport.vendorName}</div>
              </div>
              {selectedReport.autoEscalated && (
                <span className="flex-shrink-0 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> Auto-escalated
                </span>
              )}
            </div>

            {/* Severity accent bar */}
            {!detailLoading && (
              <div className={`h-1 flex-shrink-0 ${
                selectedReport.severity === "high" ? "bg-red-500" :
                selectedReport.severity === "medium" ? "bg-amber-400" : "bg-emerald-400"
              }`} />
            )}

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <Spinner />
              ) : (
                <div className="max-w-2xl mx-auto">
                  {/* ── RISK OVERVIEW ── */}
                  <div className="bg-white mx-4 mt-4 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 pt-5 pb-4">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Risk Overview</div>

                      {/* Severity visual */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1">
                          <div className="flex gap-1 mb-1.5">
                            {["low", "medium", "high"].map((lvl) => (
                              <div
                                key={lvl}
                                className={`h-2 flex-1 rounded-full transition-all ${
                                  selectedReport.severity === "high"
                                    ? lvl === "low" ? "bg-red-200" : lvl === "medium" ? "bg-red-300" : "bg-red-500"
                                    : selectedReport.severity === "medium"
                                    ? lvl === "low" ? "bg-amber-200" : lvl === "medium" ? "bg-amber-500" : "bg-gray-100"
                                    : lvl === "low" ? "bg-emerald-500" : "bg-gray-100"
                                }`}
                              />
                            ))}
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium">
                            Severity: <span className={`font-bold ${SEVERITY_CONFIG[selectedReport.severity]?.color || "text-gray-700"}`}>
                              {SEVERITY_CONFIG[selectedReport.severity]?.label || selectedReport.severity}
                            </span>
                          </div>
                        </div>
                        <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                          STATUS_CONFIG[selectedReport.status]?.bg || "bg-gray-50"
                        } ${STATUS_CONFIG[selectedReport.status]?.color || "text-gray-600"} ${
                          STATUS_CONFIG[selectedReport.status]?.border || "border-gray-200"
                        }`}>
                          {(() => { const Icon = STATUS_CONFIG[selectedReport.status]?.icon; return Icon ? <Icon className="w-3 h-3" /> : null; })()}
                          {STATUS_CONFIG[selectedReport.status]?.label || selectedReport.status}
                        </div>
                      </div>

                      {/* Metadata grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="text-[10px] text-gray-400 font-medium mb-1 flex items-center gap-1">
                            <Flag className="w-3 h-3" /> Category
                          </div>
                          <div className="text-xs font-semibold text-[#2D3E50]">
                            {CATEGORY_LABEL[selectedReport.riskCategory] || selectedReport.riskCategory}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="text-[10px] text-gray-400 font-medium mb-1 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Corroborations
                          </div>
                          <div className="text-xs font-semibold text-[#2D3E50] flex items-center gap-1.5">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold ${
                              (selectedReport.corroborationCount ?? 0) >= 3 ? "bg-red-500" :
                              (selectedReport.corroborationCount ?? 0) > 0 ? "bg-amber-500" : "bg-gray-300"
                            }`}>
                              {selectedReport.corroborationCount ?? 0}
                            </span>
                            {(selectedReport.corroborationCount ?? 0) >= 3 ? "High confirmation" :
                             (selectedReport.corroborationCount ?? 0) > 0 ? "Corroborated" : "None yet"}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="text-[10px] text-gray-400 font-medium mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Submitted
                          </div>
                          <div className="text-xs font-semibold text-[#2D3E50]">{formatRelativeTime(selectedReport.submittedAt)}</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="text-[10px] text-gray-400 font-medium mb-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Last Updated
                          </div>
                          <div className="text-xs font-semibold text-[#2D3E50]">{formatRelativeTime(selectedReport.updatedAt)}</div>
                        </div>
                      </div>

                      {/* Reviewer info */}
                      {selectedReport.reviewedBy && (
                        <div className="mt-3 flex items-center gap-2.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-3.5 py-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#1ABC9C] flex items-center justify-center flex-shrink-0">
                            <User className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <div className="text-[10px] text-[#15803d] font-medium">Reviewed by</div>
                            <div className="text-xs font-semibold text-[#166534]">{selectedReport.reviewedBy}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── ORIGINAL REPORT ── */}
                  <div className="bg-white mx-4 mt-3 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 pt-5 pb-2">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3" /> Original Report
                      </div>
                    </div>
                    <div className="px-5 pb-5">
                      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed border border-gray-100">
                        {selectedReport.description}
                      </div>
                    </div>

                    {/* Review notes */}
                    {selectedReport.reviewNotes && (
                      <div className="px-5 pb-5">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <FileSearch className="w-3 h-3" /> Review Notes
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
                          {selectedReport.reviewNotes}
                        </div>
                      </div>
                    )}

                    {/* Evidence files */}
                    {selectedReport.attachmentUrls?.length > 0 && (
                      <div className="px-5 pb-5">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <FileText className="w-3 h-3" /> Evidence Files ({selectedReport.attachmentUrls.length})
                        </div>
                        <div className="space-y-2">
                          {selectedReport.attachmentUrls.map((url, i) => (
                            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                              <div className="w-8 h-8 bg-[#2D3E50]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-[#2D3E50]" />
                              </div>
                              <span className="flex-1 text-xs text-gray-600 font-medium">Evidence file {i + 1}</span>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[10px] font-bold text-[#1ABC9C] bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-1.5 rounded-lg hover:bg-[#dcfce7] transition-colors flex-shrink-0"
                              >
                                <Download className="w-3 h-3" /> Download
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── CORROBORATING SUBMISSIONS ── */}
                  <div className="mx-4 mt-3">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      Corroborating Submissions ({selectedReport.corroborations?.length ?? 0})
                    </div>

                    {(selectedReport.corroborations?.length ?? 0) > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-3 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 leading-relaxed">
                          Each submission below is independent. Submitters cannot see each other or the original report.
                        </p>
                      </div>
                    )}

                    {!selectedReport.corroborations?.length ? (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                          <Users className="w-5 h-5 text-gray-300" />
                        </div>
                        <p className="text-sm font-semibold text-gray-400">No corroborations yet</p>
                        <p className="text-xs text-gray-300 mt-1">Other employees can anonymously confirm this report</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedReport.corroborations.map((corr, i) => (
                          <div key={corr.id || i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className={`h-0.5 ${SEVERITY_CONFIG[corr.severity]?.bar || "bg-gray-200"}`} />
                            <div className="p-4">
                              <div className="flex items-center gap-2 flex-wrap mb-3">
                                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                                  #{i + 1}
                                </span>
                                <Badge className={RELATIONSHIP_BADGE[corr.relationship] || "bg-gray-50 text-gray-600 border border-gray-100"}>
                                  {RELATIONSHIP_LABEL[corr.relationship] || corr.relationship}
                                </Badge>
                                <Badge className={SEVERITY_BADGE[corr.severity] || "bg-gray-50 text-gray-600 border border-gray-100"}>
                                  {corr.severity?.charAt(0).toUpperCase() + corr.severity?.slice(1)}
                                </Badge>
                                <span className="text-[10px] text-gray-400 ml-auto flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatRelativeTime(corr.submittedAt)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed">{corr.account}</p>
                              {corr.attachmentUrls?.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                                  {corr.attachmentUrls.map((url, j) => (
                                    <div key={j} className="flex items-center gap-2">
                                      <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-[#1ABC9C] hover:underline font-semibold"
                                      >
                                        Evidence file {j + 1}
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── UPDATE STATUS ── */}
                  <div className="bg-white mx-4 mt-3 mb-8 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 pt-5 pb-4">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <FileSearch className="w-3 h-3" /> Investigation Actions
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Update Status</label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {["open", "investigating", "escalated", "resolved", "closed"].map((s) => {
                            const cfg = STATUS_CONFIG[s];
                            const Icon = cfg?.icon;
                            return (
                              <button
                                key={s}
                                onClick={() => setNewStatus(s)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                                  newStatus === s
                                    ? `${cfg?.bg || "bg-gray-50"} ${cfg?.color || "text-gray-600"} ${cfg?.border || "border-gray-200"} shadow-sm`
                                    : "bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200 hover:text-gray-600"
                                }`}
                              >
                                {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                                {cfg?.label || s}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Review Notes</label>
                        <textarea
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          rows={3}
                          placeholder="Document your findings, actions taken, or escalation rationale..."
                          className="w-full border border-gray-100 rounded-xl p-3.5 text-sm focus:outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C]/20 resize-none bg-gray-50/50"
                        />
                      </div>

                      <button
                        onClick={handleUpdateStatus}
                        disabled={statusUpdating}
                        className="w-full bg-[#2D3E50] text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#24333f] transition-colors"
                      >
                        {statusUpdating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Save Investigation Update
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VendorRiskDashboard;
