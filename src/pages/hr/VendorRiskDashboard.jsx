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

const TABS = ["all", "open", "investigating", "escalated", "resolved", "closed"];

const STATUS_STRIP_COLOR = {
  open: "bg-blue-400",
  investigating: "bg-amber-400",
  escalated: "bg-red-500",
  resolved: "bg-green-500",
  closed: "bg-gray-300",
};

const STATUS_BADGE = {
  open: "bg-blue-100 text-blue-800",
  investigating: "bg-amber-100 text-amber-800",
  escalated: "bg-red-100 text-red-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

const CATEGORY_BADGE = {
  labor: "bg-blue-100 text-blue-800",
  data_privacy: "bg-purple-100 text-purple-800",
  safety: "bg-orange-100 text-orange-800",
  fraud: "bg-red-100 text-red-800",
  compliance: "bg-indigo-100 text-indigo-800",
  other: "bg-gray-100 text-gray-600",
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
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

const RELATIONSHIP_BADGE = {
  witness: "bg-blue-100 text-blue-800",
  directly_affected: "bg-red-100 text-red-800",
  heard_from_others: "bg-gray-100 text-gray-600",
};

const RELATIONSHIP_LABEL = {
  witness: "Direct Witness",
  directly_affected: "Directly Affected",
  heard_from_others: "Heard from Others",
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "—";
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
    return "—";
  }
};

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1ABC9C]" />
  </div>
);

const Badge = ({ className, children }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>
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
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-[#2D3E50] text-white p-5">
        <h1 className="text-xl font-bold">Vendor Risk Reports</h1>
        <p className="text-sm text-white/60 mt-1">Anonymous third-party risk submissions from employees</p>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 p-4 bg-gray-50">
          {[
            { label: "Total", value: stats.total, color: "text-[#2D3E50]" },
            { label: "Open", value: stats.open, color: "text-[#2D3E50]" },
            { label: "Investigating", value: stats.investigating, color: "text-[#2D3E50]" },
            { label: "Escalated", value: stats.escalated, color: stats.escalated > 0 ? "text-red-600" : "text-[#2D3E50]" },
            { label: "Resolved", value: stats.resolved, color: "text-[#2D3E50]" },
            { label: "Closed", value: stats.closed, color: "text-[#2D3E50]" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl p-3 text-center shadow-sm">
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-200 bg-white overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              activeTab === tab
                ? "bg-[#2D3E50] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Report list */}
      <div className="p-4">
        {filteredReports.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">No reports found</p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              onClick={() => handleCardClick(report)}
              className="bg-white rounded-2xl shadow-sm mb-3 overflow-hidden cursor-pointer hover:shadow-md transition"
            >
              {/* Status strip */}
              <div className={`h-1 ${STATUS_STRIP_COLOR[report.status] || "bg-gray-300"}`} />

              <div className="p-4">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-gray-500">{report.referenceCode}</div>
                    <div className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{report.vendorName}</div>
                  </div>
                  {report.autoEscalated && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      🚨 Auto-escalated
                    </span>
                  )}
                </div>

                {/* Badges row */}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <Badge className={CATEGORY_BADGE[report.riskCategory] || "bg-gray-100 text-gray-600"}>
                    {CATEGORY_LABEL[report.riskCategory] || report.riskCategory}
                  </Badge>
                  <Badge className={SEVERITY_BADGE[report.severity] || "bg-gray-100 text-gray-600"}>
                    {report.severity?.charAt(0).toUpperCase() + report.severity?.slice(1)}
                  </Badge>
                  {report.corroborationCount > 0 && (
                    <Badge className="bg-teal-100 text-teal-700">
                      {report.corroborationCount} corroboration{report.corroborationCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  <Badge className={STATUS_BADGE[report.status] || "bg-gray-100 text-gray-600"}>
                    {report.status?.charAt(0).toUpperCase() + report.status?.slice(1)}
                  </Badge>
                </div>

                {/* Bottom row */}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400">{formatRelativeTime(report.submittedAt)}</span>
                  <span className="text-xs text-[#1ABC9C] font-medium">View Details →</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── DETAIL PANEL ── */}
      {selectedReport && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelectedReport(null)}
          />
          <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="bg-[#2D3E50] p-4 flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => setSelectedReport(null)}
                className="text-white/70 hover:text-white transition"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-white/60">{selectedReport.referenceCode}</div>
                <div className="text-sm font-semibold text-white truncate">{selectedReport.vendorName}</div>
              </div>
              {selectedReport.autoEscalated && (
                <span className="flex-shrink-0 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  🚨 Auto-escalated
                </span>
              )}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <Spinner />
              ) : (
                <>
                  {/* Section 1 — Report Details */}
                  <div className="bg-white p-4 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Report Details</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Vendor", value: selectedReport.vendorName },
                        { label: "Category", value: CATEGORY_LABEL[selectedReport.riskCategory] || selectedReport.riskCategory },
                        { label: "Severity", value: selectedReport.severity?.charAt(0).toUpperCase() + selectedReport.severity?.slice(1) },
                        { label: "Status", value: selectedReport.status?.charAt(0).toUpperCase() + selectedReport.status?.slice(1) },
                        { label: "Submitted", value: formatRelativeTime(selectedReport.submittedAt) },
                        { label: "Corroborations", value: selectedReport.corroborationCount ?? 0 },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between gap-4">
                          <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
                          <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Description */}
                    <div className="mt-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Original Report</div>
                      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
                        {selectedReport.description}
                      </div>
                    </div>

                    {/* Evidence files */}
                    {selectedReport.attachmentUrls?.length > 0 && (
                      <div className="mt-4">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Evidence Files</div>
                        <div className="space-y-2">
                          {selectedReport.attachmentUrls.map((url, i) => (
                            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              <span className="flex-1 text-xs text-gray-600 truncate">Evidence file {i + 1}</span>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#1ABC9C] font-medium hover:underline flex-shrink-0"
                              >
                                Download
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 2 — Corroborating Submissions */}
                  <div className="bg-gray-50 p-4 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Corroborating Submissions ({selectedReport.corroborations?.length ?? 0})
                    </h3>

                    {selectedReport.corroborations?.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                        <p className="text-xs text-amber-700">
                          Each submission below is independent. Submitters cannot see each other or the original report.
                        </p>
                      </div>
                    )}

                    {!selectedReport.corroborations?.length ? (
                      <p className="text-sm text-gray-400 italic">No corroborating submissions yet.</p>
                    ) : (
                      selectedReport.corroborations.map((corr, i) => (
                        <div key={corr.id || i} className="bg-white rounded-xl p-4 mb-3 border border-gray-200">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={RELATIONSHIP_BADGE[corr.relationship] || "bg-gray-100 text-gray-600"}>
                              {RELATIONSHIP_LABEL[corr.relationship] || corr.relationship}
                            </Badge>
                            <Badge className={SEVERITY_BADGE[corr.severity] || "bg-gray-100 text-gray-600"}>
                              {corr.severity?.charAt(0).toUpperCase() + corr.severity?.slice(1)}
                            </Badge>
                            <span className="text-xs text-gray-400 ml-auto">{formatRelativeTime(corr.submittedAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-2 leading-relaxed">{corr.account}</p>
                          {corr.attachmentUrls?.length > 0 && (
                            <div className="mt-3 space-y-1">
                              {corr.attachmentUrls.map((url, j) => (
                                <div key={j} className="flex items-center gap-2">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                  </svg>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[#1ABC9C] hover:underline"
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

                  {/* Section 3 — Update Status */}
                  <div className="bg-white p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Update Status</h3>

                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#1ABC9C] bg-white"
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
                      className="w-full border border-gray-200 rounded-xl p-3 mt-3 text-sm focus:outline-none focus:border-[#1ABC9C] resize-none"
                    />

                    <button
                      onClick={handleUpdateStatus}
                      disabled={statusUpdating}
                      className="w-full bg-[#2D3E50] text-white rounded-xl py-3 font-semibold mt-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {statusUpdating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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
