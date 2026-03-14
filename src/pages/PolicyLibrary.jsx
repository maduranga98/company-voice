import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { X, CheckCircle, Download } from "lucide-react";
import {
  getPublishedPolicies,
  getUserAcknowledgements,
  acknowledgePolicy,
} from "../services/policyService";

const CATEGORY_LABELS = {
  code_of_conduct: "Code of Conduct",
  anti_harassment: "Anti-Harassment",
  data_privacy: "Data Privacy",
  whistleblower: "Whistleblower",
  safety: "Workplace Safety",
  gdpr: "GDPR Notice",
  other: "Other",
};

const CATEGORY_BADGE = {
  code_of_conduct: "bg-blue-100 text-blue-800",
  anti_harassment: "bg-red-100 text-red-800",
  data_privacy: "bg-purple-100 text-purple-800",
  whistleblower: "bg-teal-100 text-teal-800",
  safety: "bg-orange-100 text-orange-800",
  gdpr: "bg-indigo-100 text-indigo-800",
  other: "bg-gray-100 text-gray-700",
};

const ALL_CATEGORIES = [
  { value: "all", label: "All" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

const PolicyLibrary = () => {
  const { userData } = useAuth();

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());
  const [ackDetails, setAckDetails] = useState({});

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackSuccess, setAckSuccess] = useState(false);

  const [toast, setToast] = useState("");

  useEffect(() => {
    if (userData?.companyId) loadData();
  }, [userData]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pols, acks] = await Promise.all([
        getPublishedPolicies(userData.companyId),
        getUserAcknowledgements(userData.id, userData.companyId),
      ]);
      setPolicies(pols);
      const ids = new Set(acks.map((a) => a.policyId));
      setAcknowledgedIds(ids);
      const details = {};
      acks.forEach((a) => { details[a.policyId] = a.acknowledgedAt; });
      setAckDetails(details);
    } catch (err) {
      console.error("Error loading policies:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const filteredPolicies = policies.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (CATEGORY_LABELS[p.category] || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const pendingCount = policies.filter(
    (p) => p.requiresAcknowledgement && !acknowledgedIds.has(p.id)
  ).length;
  const acknowledgedCount = policies.filter((p) => acknowledgedIds.has(p.id)).length;

  const openModal = (policy) => {
    setSelectedPolicy(policy);
    setAckChecked(false);
    setAckSuccess(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPolicy(null);
    setAckChecked(false);
    setAckSuccess(false);
  };

  const handleAcknowledge = async () => {
    if (!ackChecked || !selectedPolicy) return;
    setAcknowledging(true);
    try {
      await acknowledgePolicy(selectedPolicy.id, userData.companyId, userData.id);
      setAcknowledgedIds((prev) => new Set([...prev, selectedPolicy.id]));
      setAckDetails((prev) => ({ ...prev, [selectedPolicy.id]: new Date() }));
      setAckSuccess(true);
      showToast("Policy acknowledged successfully!");
    } catch (err) {
      console.error("Acknowledge error:", err);
      showToast("Failed to acknowledge. Please try again.");
    } finally {
      setAcknowledging(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-b-2 border-[#1ABC9C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Page title */}
      <h1 className="text-xl font-bold text-gray-900 mb-4">Company Policies</h1>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-[#2D3E50]">{policies.length}</div>
          <div className="text-[10px] text-gray-500 mt-1">Total</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-green-700">{acknowledgedCount}</div>
          <div className="text-[10px] text-green-600 mt-1">Acknowledged</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-amber-700">{pendingCount}</div>
          <div className="text-[10px] text-amber-600 mt-1">Pending</div>
        </div>
      </div>

      {/* Pending acknowledgement alert */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 mb-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" className="flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-xs text-amber-800 flex-1">
            <strong>{pendingCount}</strong> {pendingCount === 1 ? "policy needs" : "policies need"} your acknowledgement
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex gap-2 mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="flex-shrink-0 mt-0.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search policies..."
          className="flex-1 text-sm outline-none border-none bg-transparent text-gray-700 placeholder-gray-400"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: "none" }}>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategoryFilter(cat.value)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={{
              backgroundColor: categoryFilter === cat.value ? "#1ABC9C" : "white",
              color: categoryFilter === cat.value ? "white" : "#4b5563",
              border: categoryFilter === cat.value ? "none" : "1px solid #e5e7eb",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Policy cards */}
      {filteredPolicies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" className="mb-3">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No policies found</h3>
          <p className="text-xs text-gray-500">
            {searchQuery || categoryFilter !== "all"
              ? "Try adjusting your search or filter."
              : "No published policies yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPolicies.map((policy) => {
            const isAcknowledged = acknowledgedIds.has(policy.id);
            return (
              <div key={policy.id} className="bg-white rounded-2xl shadow-sm p-4">
                {/* Top row: category + acknowledgement status */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_BADGE[policy.category] || CATEGORY_BADGE.other}`}>
                    {CATEGORY_LABELS[policy.category] || policy.category}
                  </span>
                  {isAcknowledged ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 ml-auto">
                      <CheckCircle className="w-3 h-3" />
                      Acknowledged
                    </span>
                  ) : policy.requiresAcknowledgement ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 ml-auto" />
                  ) : null}
                </div>

                {/* Title */}
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{policy.title}</h3>

                {/* Effective date */}
                <p className="text-[11px] text-gray-400 mb-2">
                  Effective: {formatDate(policy.effectiveDate)}
                </p>

                {/* Content preview */}
                {policy.content && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                    {policy.content}
                  </p>
                )}

                {/* Action button */}
                {policy.requiresAcknowledgement && !isAcknowledged ? (
                  <button
                    onClick={() => openModal(policy)}
                    className="w-full py-2.5 bg-[#1ABC9C] text-white text-xs font-semibold rounded-xl hover:bg-[#17a589] transition-colors"
                  >
                    Read & Acknowledge
                  </button>
                ) : policy.requiresAcknowledgement && isAcknowledged ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-green-600 text-xs font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Acknowledged ✓
                  </div>
                ) : (
                  <button
                    onClick={() => openModal(policy)}
                    className="w-full py-2.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Read Policy
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Policy Detail Modal ── */}
      {showModal && selectedPolicy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_BADGE[selectedPolicy.category] || CATEGORY_BADGE.other}`}>
                    {CATEGORY_LABELS[selectedPolicy.category] || selectedPolicy.category}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">v{selectedPolicy.version}</span>
                </div>
                <h2 className="text-base font-bold text-gray-900">{selectedPolicy.title}</h2>
              </div>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {selectedPolicy.fileUrl && (
                <a
                  href={selectedPolicy.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={selectedPolicy.fileName}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </a>
              )}

              {selectedPolicy.content && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">Policy Content</h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-60 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedPolicy.content}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Effective</p>
                  <p className="text-gray-900">{formatDate(selectedPolicy.effectiveDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Published</p>
                  <p className="text-gray-900">{formatDate(selectedPolicy.publishedAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Created by</p>
                  <p className="text-gray-900">{selectedPolicy.createdByName || "—"}</p>
                </div>
              </div>

              {selectedPolicy.requiresAcknowledgement ? (
                acknowledgedIds.has(selectedPolicy.id) || ackSuccess ? (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">You acknowledged this policy</p>
                      {ackDetails[selectedPolicy.id] && (
                        <p className="text-xs text-green-600 mt-0.5">
                          on {formatDate(ackDetails[selectedPolicy.id])}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ackChecked}
                        onChange={(e) => setAckChecked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">
                        I have read and understood this policy.
                      </span>
                    </label>
                    <button
                      onClick={handleAcknowledge}
                      disabled={!ackChecked || acknowledging}
                      className="w-full py-2.5 bg-[#1ABC9C] text-white text-sm font-semibold rounded-xl hover:bg-[#17a589] transition-colors disabled:opacity-40"
                    >
                      {acknowledging ? "Confirming..." : "Confirm Acknowledgement"}
                    </button>
                  </div>
                )
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-6 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyLibrary;
