import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { X, CheckCircle, Download, Search, FileText, AlertTriangle, ChevronRight } from "lucide-react";
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
  code_of_conduct: "bg-blue-50 text-blue-700 border border-blue-100",
  anti_harassment: "bg-red-50 text-red-700 border border-red-100",
  data_privacy: "bg-purple-50 text-purple-700 border border-purple-100",
  whistleblower: "bg-teal-50 text-teal-700 border border-teal-100",
  safety: "bg-orange-50 text-orange-700 border border-orange-100",
  gdpr: "bg-indigo-50 text-indigo-700 border border-indigo-100",
  other: "bg-gray-50 text-gray-600 border border-gray-100",
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
      const pols = await getPublishedPolicies(userData.companyId);
      setPolicies(pols);
    } catch (err) {
      console.error("Error loading policies:", err);
    }
    try {
      const acks = await getUserAcknowledgements(userData.id, userData.companyId);
      const ids = new Set(acks.map((a) => a.policyId));
      setAcknowledgedIds(ids);
      const details = {};
      acks.forEach((a) => { details[a.policyId] = a.acknowledgedAt; });
      setAckDetails(details);
    } catch (err) {
      console.error("Error loading acknowledgements:", err);
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
    if (!ts) return "\u2014";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#1ABC9C] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 pt-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#2D3E50] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Page title */}
      <h1 className="text-xl font-bold text-[#2D3E50] mb-1">Company Policies</h1>
      <p className="text-sm text-gray-500 mb-5">Review and acknowledge company policies</p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
          <div className="text-2xl font-bold text-[#2D3E50]">{policies.length}</div>
          <div className="text-xs text-gray-500 mt-1 font-medium">Total</div>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
          <div className="text-2xl font-bold text-emerald-600">{acknowledgedCount}</div>
          <div className="text-xs text-emerald-600 mt-1 font-medium">Acknowledged</div>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          <div className="text-xs text-amber-600 mt-1 font-medium">Pending</div>
        </div>
      </div>

      {/* Pending acknowledgement alert */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 mb-5">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <span className="text-sm text-amber-800 flex-1">
            <strong>{pendingCount}</strong> {pendingCount === 1 ? "policy needs" : "policies need"} your acknowledgement
          </span>
          <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 mb-4 shadow-sm">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search policies..."
          className="flex-1 text-sm outline-none border-none bg-transparent text-gray-700 placeholder-gray-400"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5" style={{ scrollbarWidth: "none" }}>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategoryFilter(cat.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              categoryFilter === cat.value
                ? "bg-[#1ABC9C] text-white shadow-sm"
                : "bg-white text-gray-500 border border-gray-100 hover:border-gray-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Policy cards */}
      {filteredPolicies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-gray-300" />
          </div>
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
              <div key={policy.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                {/* Top row: category + acknowledgement status */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${CATEGORY_BADGE[policy.category] || CATEGORY_BADGE.other}`}>
                    {CATEGORY_LABELS[policy.category] || policy.category}
                  </span>
                  {isAcknowledged ? (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 ml-auto">
                      <CheckCircle className="w-3 h-3" />
                      Acknowledged
                    </span>
                  ) : policy.requiresAcknowledgement ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ml-auto" />
                  ) : null}
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-[#2D3E50] mb-1">{policy.title}</h3>

                {/* Effective date */}
                <p className="text-xs text-gray-400 mb-2">
                  Effective: {formatDate(policy.effectiveDate)}
                </p>

                {/* Content preview */}
                {policy.content && (
                  <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">
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
                  <div className="flex items-center justify-center gap-2 py-2.5 text-emerald-600 text-xs font-semibold bg-emerald-50 rounded-xl">
                    <CheckCircle className="w-4 h-4" />
                    Acknowledged
                  </div>
                ) : (
                  <button
                    onClick={() => openModal(policy)}
                    className="w-full py-2.5 border border-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Read Policy
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Policy Detail Modal */}
      {showModal && selectedPolicy && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto pb-20 sm:pb-0">
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${CATEGORY_BADGE[selectedPolicy.category] || CATEGORY_BADGE.other}`}>
                    {CATEGORY_LABELS[selectedPolicy.category] || selectedPolicy.category}
                  </span>
                  <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded-lg">v{selectedPolicy.version}</span>
                </div>
                <h2 className="text-lg font-bold text-[#2D3E50]">{selectedPolicy.title}</h2>
              </div>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl flex-shrink-0 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {selectedPolicy.fileUrl && (
                <a
                  href={selectedPolicy.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={selectedPolicy.fileName}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition-colors border border-indigo-100"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </a>
              )}

              {selectedPolicy.content && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Policy Content</h3>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 max-h-60 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedPolicy.content}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Effective", value: formatDate(selectedPolicy.effectiveDate) },
                  { label: "Published", value: formatDate(selectedPolicy.publishedAt) },
                  { label: "Created by", value: selectedPolicy.createdByName || "\u2014" },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">{item.label}</p>
                    <p className="text-xs text-[#2D3E50] font-medium">{item.value}</p>
                  </div>
                ))}
              </div>

              {selectedPolicy.requiresAcknowledgement ? (
                acknowledgedIds.has(selectedPolicy.id) || ackSuccess ? (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">You acknowledged this policy</p>
                      {ackDetails[selectedPolicy.id] && (
                        <p className="text-xs text-emerald-600 mt-0.5">
                          on {formatDate(ackDetails[selectedPolicy.id])}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ackChecked}
                        onChange={(e) => setAckChecked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-[#1ABC9C] border-gray-300 rounded focus:ring-[#1ABC9C]"
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
                    className="px-6 py-2.5 border border-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
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
