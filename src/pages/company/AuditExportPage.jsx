import { useState, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  queryAuditLogs,
  computeSummary,
  normalizeLog,
  exportToCSV,
  exportToPDF,
  formatDetails,
} from "../../services/auditExportService";

// ---- constants ----
const ACTION_TYPE_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "status_changed", label: "Post Status Changed" },
  { value: "user_created", label: "User Created" },
  { value: "role_changed", label: "Role Changed" },
  { value: "user_login", label: "Login" },
  { value: "assigned", label: "Assignment" },
  { value: "legal_disclosure", label: "Legal Disclosure" },
];

const ITEMS_PER_PAGE = 50;

// Badge styling by category
const getActionBadgeStyle = (type) => {
  const statusTypes = ["status_changed", "priority_changed", "resolved", "reopened", "created", "edited", "archived", "unarchived", "post_deleted"];
  const legalTypes = ["identity_disclosure", "court_order", "subpoena", "content_preservation", "legal_disclosure"];
  if (legalTypes.includes(type)) return "bg-[#FF6B6B]/15 text-[#cc3333] border border-[#FF6B6B]/30";
  if (statusTypes.includes(type)) return "bg-[#00BCD4]/15 text-[#006e7f] border border-[#00BCD4]/30";
  return "bg-[#2D3E50]/10 text-[#2D3E50] border border-[#2D3E50]/20";
};

// Skeleton row
const SkeletonRow = () => (
  <tr className="animate-pulse">
    {[...Array(6)].map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded w-full" />
      </td>
    ))}
  </tr>
);

// Expanded detail cell
const DetailCell = ({ details }) => {
  const [open, setOpen] = useState(false);
  const hasContent = details && Object.keys(details).length > 0;
  if (!hasContent) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <div>
      <button
        onClick={() => setOpen((p) => !p)}
        className="inline-flex items-center gap-1 text-xs text-[#00BCD4] hover:text-[#0097a7] transition-colors"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        {open ? "Collapse" : "Expand"}
      </button>
      {open && (
        <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 overflow-x-auto max-w-xs whitespace-pre-wrap font-mono leading-relaxed">
          {formatDetails(details)}
        </div>
      )}
    </div>
  );
};

// Summary card
const SummaryCard = ({ label, value, highlight, sublabel }) => (
  <div
    className={`bg-white rounded-lg border p-4 shadow-sm ${
      highlight ? "border-[#FF6B6B]/50 bg-[#FF6B6B]/5" : "border-slate-200"
    }`}
  >
    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
    <p
      className={`text-3xl font-bold mt-1 ${
        highlight ? "text-[#FF6B6B]" : "text-[#2D3E50]"
      }`}
    >
      {value}
    </p>
    {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
  </div>
);

// ============================================================
// Main page
// ============================================================
const AuditExportPage = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [actionType, setActionType] = useState("all");
  const [actorSearch, setActorSearch] = useState("");

  // Results
  const [rawLogs, setRawLogs] = useState([]);
  const [normalizedLogs, setNormalizedLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  const handleGenerate = useCallback(async () => {
    if (!userData?.companyId) return;
    setLoading(true);
    setHasQueried(true);
    setPage(1);
    try {
      const filters = { fromDate, toDate, actionType, actorName: actorSearch };
      const logs = await queryAuditLogs(userData.companyId, filters);
      setRawLogs(logs);
      setNormalizedLogs(logs.map(normalizeLog));
      setSummary(computeSummary(logs));
    } catch (err) {
      console.error("Error generating report:", err);
    } finally {
      setLoading(false);
    }
  }, [userData, fromDate, toDate, actionType, actorSearch]);

  const handleExportCSV = () => {
    if (!rawLogs.length) return;
    exportToCSV(rawLogs);
  };

  const handleExportPDF = () => {
    if (!rawLogs.length) return;
    const companyName = userData?.companyName || userData?.company || "Company";
    exportToPDF(rawLogs, companyName, { fromDate, toDate });
  };

  // Pagination
  const totalPages = Math.ceil(normalizedLogs.length / ITEMS_PER_PAGE);
  const pagedLogs = normalizedLogs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const isAdmin = ["company_admin", "super_admin"].includes(userData?.role);
  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-slate-500">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-500 hover:text-[#2D3E50] transition-colors"
          title="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#2D3E50]">Compliance Audit Export</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Filter, view, and export audit logs for compliance purposes
          </p>
        </div>
      </div>

      {/* ---- STICKY FILTERS BAR ---- */}
      <div className="sticky top-0 z-20 bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          {/* From date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00BCD4]/40 focus:border-[#00BCD4] transition"
            />
          </div>
          {/* To date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00BCD4]/40 focus:border-[#00BCD4] transition"
            />
          </div>
          {/* Action type */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Action Type</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00BCD4]/40 focus:border-[#00BCD4] transition"
            >
              {ACTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {/* Actor search */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Actor Name</label>
            <input
              type="text"
              value={actorSearch}
              onChange={(e) => setActorSearch(e.target.value)}
              placeholder="Search by name…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00BCD4]/40 focus:border-[#00BCD4] transition"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-[#2D3E50] text-white text-sm font-medium rounded-lg hover:bg-[#3a4f63] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generating…" : "Generate Report"}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!rawLogs.length}
            className="px-4 py-2 bg-[#00BCD4] text-white text-sm font-medium rounded-lg hover:bg-[#0097a7] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!rawLogs.length}
            className="px-4 py-2 bg-[#2D3E50] text-white text-sm font-medium rounded-lg hover:bg-[#1a2633] transition disabled:opacity-40 disabled:cursor-not-allowed border border-[#2D3E50]"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* ---- SUMMARY CARDS (show after first query) ---- */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            label="Total Actions"
            value={summary.total.toLocaleString()}
            sublabel="in selected period"
          />
          <SummaryCard
            label="Unique Actors"
            value={summary.uniqueActors.toLocaleString()}
            sublabel="distinct users"
          />
          <SummaryCard
            label="Legal Disclosures"
            value={summary.legalCount.toLocaleString()}
            highlight={summary.legalCount > 0}
            sublabel={summary.legalCount > 0 ? "Requires attention" : "None recorded"}
          />
          <SummaryCard
            label="Most Active Dept."
            value={summary.mostActiveDept}
            sublabel="by audit activity"
          />
        </div>
      )}

      {/* ---- RESULTS TABLE ---- */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#2D3E50] text-white">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                  Action Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Target
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}
              {!loading && hasQueried && pagedLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="font-medium text-slate-500">No audit records match your filters.</p>
                      <p className="text-xs">Try adjusting the date range or action type.</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !hasQueried && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">
                    Set your filters above and click <strong>Generate Report</strong> to load audit records.
                  </td>
                </tr>
              )}
              {!loading &&
                pagedLogs.map((log, idx) => (
                  <tr
                    key={log.id}
                    className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${
                      idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap font-mono">
                      {log.timestampStr}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#2D3E50] whitespace-nowrap">
                      {log.actor}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium ${getActionBadgeStyle(
                          log.actionType
                        )}`}
                      >
                        {log.actionType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {log.target}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <DetailCell details={log.details} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(page * ITEMS_PER_PAGE, normalizedLogs.length)} of{" "}
              {normalizedLogs.length} records
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Compliance note */}
      <div className="mt-6 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-blue-700">
          Audit logs are immutable and cryptographically chained. Exported reports reflect
          the current state of the audit trail and are suitable for compliance purposes.
        </p>
      </div>
    </div>
  );
};

export default AuditExportPage;
