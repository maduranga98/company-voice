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
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelectedReport(null)}
          />
          <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="bg-[#2D3E50] p-5 flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => setSelectedReport(null)}
                className="text-white/60 hover:text-white transition p-1"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-white/50">{selectedReport.referenceCode}</div>
                <div className="text-sm font-bold text-white truncate mt-0.5">{selectedReport.vendorName}</div>
              </div>
              {selectedReport.autoEscalated && (
                <span className="flex-shrink-0 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Auto-escalated
                </span>
              )}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <Spinner />
              ) : (
                <>
                  {/* Section 1 - Report Details */}
                  <div className="bg-white p-5 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Report Details</h3>
                    <div className="space-y-3">
                      {[
                        { label: "Vendor", value: selectedReport.vendorName },
                        { label: "Category", value: CATEGORY_LABEL[selectedReport.riskCategory] || selectedReport.riskCategory },
                        { label: "Severity", value: selectedReport.severity?.charAt(0).toUpperCase() + selectedReport.severity?.slice(1) },
                        { label: "Status", value: selectedReport.status?.charAt(0).toUpperCase() + selectedReport.status?.slice(1) },
                        { label: "Submitted", value: formatRelativeTime(selectedReport.submittedAt) },
                        { label: "Corroborations", value: selectedReport.corroborationCount ?? 0 },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between gap-4 items-center">
                          <span className="text-xs text-gray-400 font-medium">{label}</span>
                          <span className="text-sm font-semibold text-[#2D3E50] text-right">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Description */}
                    <div className="mt-5">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Original Report</div>
                      <div className="bg-gray-50 rounded-2xl p-5 text-sm text-gray-700 leading-relaxed border border-gray-100">
                        {selectedReport.description}
                      </div>
                    </div>

                    {/* Evidence files */}
                    {selectedReport.attachmentUrls?.length > 0 && (
                      <div className="mt-5">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Evidence Files</div>
                        <div className="space-y-2">
                          {selectedReport.attachmentUrls.map((url, i) => (
                            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="flex-1 text-xs text-gray-600 truncate font-medium">Evidence file {i + 1}</span>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#1ABC9C] font-semibold hover:underline flex-shrink-0 flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" /> Download
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 2 - Corroborating Submissions */}
                  <div className="bg-gray-50/50 p-5 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                      Corroborating Submissions ({selectedReport.corroborations?.length ?? 0})
                    </h3>

                    {selectedReport.corroborations?.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4">
                        <p className="text-xs text-amber-700">
                          Each submission below is independent. Submitters cannot see each other or the original report.
                        </p>
                      </div>
                    )}

                    {!selectedReport.corroborations?.length ? (
                      <p className="text-sm text-gray-400 italic">No corroborating submissions yet.</p>
                    ) : (
                      selectedReport.corroborations.map((corr, i) => (
                        <div key={corr.id || i} className="bg-white rounded-2xl p-5 mb-3 border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={RELATIONSHIP_BADGE[corr.relationship] || "bg-gray-50 text-gray-600 border border-gray-100"}>
                              {RELATIONSHIP_LABEL[corr.relationship] || corr.relationship}
                            </Badge>
                            <Badge className={SEVERITY_BADGE[corr.severity] || "bg-gray-50 text-gray-600 border border-gray-100"}>
                              {corr.severity?.charAt(0).toUpperCase() + corr.severity?.slice(1)}
                            </Badge>
                            <span className="text-xs text-gray-400 ml-auto">{formatRelativeTime(corr.submittedAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-3 leading-relaxed">{corr.account}</p>
                          {corr.attachmentUrls?.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              {corr.attachmentUrls.map((url, j) => (
                                <div key={j} className="flex items-center gap-2">
                                  <FileText className="w-3 h-3 text-gray-400" />
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[#1ABC9C] hover:underline font-medium"
                                  >
                                    Evidence file {j + 1}
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Section 3 - Update Status */}
                  <div className="bg-white p-5">
                    <h3 className="text-sm font-bold text-[#2D3E50] mb-4">Update Status</h3>

                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full border border-gray-100 rounded-xl p-3.5 text-sm focus:outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C]/20 bg-gray-50/50"
                    >
                      <option value="open">Open</option>
                      <option value="investigating">Investigating</option>
                      <option value="escalated">Escalated</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>

                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={3}
                      placeholder="Add review notes (optional)..."
                      className="w-full border border-gray-100 rounded-xl p-3.5 mt-3 text-sm focus:outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C]/20 resize-none bg-gray-50/50"
                    />

                    <button
                      onClick={handleUpdateStatus}
                      disabled={statusUpdating}
                      className="w-full bg-[#2D3E50] text-white rounded-xl py-3.5 font-semibold mt-4 text-sm disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#24333f] transition-colors"
                    >
                      {statusUpdating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          Updating...
                        </>
                      ) : (
                        "Update Status"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VendorRiskDashboard;
