import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { BookOpen, Search, Download, X, CheckCircle } from "lucide-react";
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
  const [ackDetails, setAckDetails] = useState({}); // policyId -> acknowledgedAt

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackSuccess, setAckSuccess] = useState(false);

  const [toast, setToast] = useState("");

  useEffect(() => {
    if (userData?.companyId) {
      loadData();
    }
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 min-h-screen">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8 text-teal-600" />
          <h1 className="text-3xl font-bold text-gray-900">Company Policies</h1>
        </div>
        <p className="text-gray-500">
          Stay informed about your company's guidelines and policies.
        </p>
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{policies.length}</p>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">Total Policies</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 shadow-sm px-5 py-4 text-center">
          <p className="text-2xl font-bold text-green-700">{acknowledgedCount}</p>
          <p className="text-xs text-green-600 mt-0.5 font-medium">Acknowledged by Me</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 shadow-sm px-5 py-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
          <p className="text-xs text-amber-600 mt-0.5 font-medium">Pending Acknowledgement</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search policies by title or category..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
        />
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategoryFilter(cat.value)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
              categoryFilter === cat.value
                ? "bg-teal-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-teal-400 hover:text-teal-600"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Policy Cards Grid */}
      {filteredPolicies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No policies found</h3>
          <p className="text-gray-500 text-sm">
            {searchQuery || categoryFilter !== "all"
              ? "Try adjusting your search or filter."
              : "No published policies yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredPolicies.map((policy) => {
            const isAcknowledged = acknowledgedIds.has(policy.id);
            return (
              <div
                key={policy.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer"
                onClick={() => openModal(policy)}
              >
                <div className="p-5">
                  {/* Top row: category badge + acknowledged badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_BADGE[policy.category] || CATEGORY_BADGE.other}`}>
                      {CATEGORY_LABELS[policy.category] || policy.category}
                    </span>
                    {isAcknowledged && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3" />
                        Acknowledged
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-gray-900 text-base mb-1 line-clamp-2">
                    {policy.title}
                  </h3>

                  {/* Version + Date */}
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                    <span className="font-mono">v{policy.version}</span>
                    <span>•</span>
                    <span>Effective: {formatDate(policy.effectiveDate)}</span>
                  </div>

                  {/* Content preview */}
                  {policy.content && (
                    <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                      {policy.content}
                    </p>
                  )}

                  {/* Action button */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {policy.requiresAcknowledgement && !isAcknowledged ? (
                      <button
                        onClick={() => openModal(policy)}
                        className="w-full py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition"
                      >
                        Read & Acknowledge
                      </button>
                    ) : policy.requiresAcknowledgement && isAcknowledged ? (
                      <div className="flex items-center justify-center gap-2 py-2 text-green-600 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        Acknowledged ✓
                      </div>
                    ) : (
                      <button
                        onClick={() => openModal(policy)}
                        className="w-full py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                      >
                        Read Policy
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Policy Detail Modal ─────────────────────────────────── */}
      {showModal && selectedPolicy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_BADGE[selectedPolicy.category] || CATEGORY_BADGE.other}`}>
                    {CATEGORY_LABELS[selectedPolicy.category] || selectedPolicy.category}
                  </span>
                  <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    Published
                  </span>
                  <span className="text-xs text-gray-400 font-mono">v{selectedPolicy.version}</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">{selectedPolicy.title}</h2>
              </div>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Download PDF */}
              {selectedPolicy.fileUrl && (
                <a
                  href={selectedPolicy.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={selectedPolicy.fileName}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition"
                >
                  <Download className="w-4 h-4" />
                  Download PDF — {selectedPolicy.fileName}
                </a>
              )}

              {/* Policy Content */}
              {selectedPolicy.content && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Policy Content</h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedPolicy.content}
                    </p>
                  </div>
                </div>
              )}

              {/* Meta info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Effective Date</p>
                  <p className="text-gray-900 font-medium">{formatDate(selectedPolicy.effectiveDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Published</p>
                  <p className="text-gray-900 font-medium">{formatDate(selectedPolicy.publishedAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Created by</p>
                  <p className="text-gray-900 font-medium">{selectedPolicy.createdByName || "—"}</p>
                </div>
              </div>

              {/* Acknowledgement Section */}
              {selectedPolicy.requiresAcknowledgement ? (
                acknowledgedIds.has(selectedPolicy.id) || ackSuccess ? (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
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
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ackChecked}
                        onChange={(e) => setAckChecked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700 font-medium">
                        I have read and understood this policy.
                      </span>
                    </label>
                    <button
                      onClick={handleAcknowledge}
                      disabled={!ackChecked || acknowledging}
                      className="w-full py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {acknowledging ? "Confirming..." : "Confirm Acknowledgement"}
                    </button>
                  </div>
                )
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-6 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition"
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
