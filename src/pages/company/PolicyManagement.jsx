import { useState, useEffect } from "react";
import PageHeader, { PageContainer, PageLoading } from "../../components/PageHeader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import {
  BookOpen,
  Plus,
  Edit2,
  Archive,
  BarChart2,
  CheckCircle,
  X,
  Upload,
  FileText,
  Bell,
  Trash2,
  Link2,
  Layers,
  Loader2,
} from "lucide-react";
import {
  createPolicy,
  updatePolicy,
  publishPolicy,
  archivePolicy,
  deletePolicy,
  getPolicies,
  getPolicyAcknowledgements,
  getPolicyAcknowledgementStats,
  uploadPolicyFileWithProgress,
} from "../../services/policyService";
import { ensurePolicyBundleLink, getPolicyBundles, getPolicyLinkStats } from "../../services/policyAckService";

const MIN_BUNDLE = 2;
const MAX_BUNDLE = 20;

const CATEGORY_LABELS = {
  code_of_conduct: "Code of Conduct",
  anti_harassment: "Anti-Harassment",
  data_privacy: "Data Privacy",
  whistleblower: "Whistleblower Protection",
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

const STATUS_BADGE = {
  published: "bg-green-100 text-green-800",
  draft: "bg-amber-100 text-amber-800",
  archived: "bg-gray-100 text-gray-600",
};

const EMPTY_FORM = {
  title: "",
  category: "code_of_conduct",
  version: "1.0",
  effectiveDate: "",
  requiresAcknowledgement: true,
  content: "",
  fileUrl: null,
  fileName: null,
};

// Only live policies that employees must acknowledge can go into a bundle.
const isShareable = (p) => p.status === "published" && p.requiresAcknowledgement;

const PolicyManagement = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formError, setFormError] = useState("");

  // Stats modal
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsPolicy, setStatsPolicy] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [statsAcks, setStatsAcks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [linkStats, setLinkStats] = useState(null);

  // Bundles: several policies shared (and acknowledged) through one link
  const [selectedIds, setSelectedIds] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleTitle, setBundleTitle] = useState("");
  const [bundleBusy, setBundleBusy] = useState(false);
  const [bundleError, setBundleError] = useState("");

  const [toast, setToast] = useState("");

  useEffect(() => {
    if (userData?.role !== "company_admin" && userData?.role !== "hr") {
      navigate("/dashboard");
      return;
    }
    loadPolicies();
  }, [userData]);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const [data, bundleLinks] = await Promise.all([
        getPolicies(userData.companyId),
        getPolicyBundles(userData.companyId).catch(() => []),
      ]);
      setPolicies(data);
      setBundles(bundleLinks);
      // Drop selections that are no longer shareable (archived, deleted, ...).
      const shareable = new Set(data.filter(isShareable).map((p) => p.id));
      setSelectedIds((prev) => prev.filter((id) => shareable.has(id)));
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

  const filteredPolicies =
    activeTab === "all" ? policies : policies.filter((p) => p.status === activeTab);

  const stats = {
    total: policies.length,
    published: policies.filter((p) => p.status === "published").length,
    draft: policies.filter((p) => p.status === "draft").length,
    archived: policies.filter((p) => p.status === "archived").length,
  };

  // ─── Bundles ────────────────────────────────────────────────────
  const shareable = filteredPolicies.filter(isShareable);
  const allShareableSelected = shareable.length > 0 && shareable.every((p) => selectedIds.includes(p.id));
  const policyTitleById = Object.fromEntries(policies.map((p) => [p.id, p.title]));

  const toggleSelected = (id) =>
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_BUNDLE) {
        showToast(`You can share up to ${MAX_BUNDLE} policies at once.`);
        return prev;
      }
      return [...prev, id];
    });

  const toggleAllShareable = () =>
    setSelectedIds((prev) =>
      allShareableSelected
        ? prev.filter((id) => !shareable.some((p) => p.id === id))
        : [...new Set([...prev, ...shareable.map((p) => p.id)])].slice(0, MAX_BUNDLE)
    );

  const openBundleModal = () => {
    setBundleTitle("");
    setBundleError("");
    setShowBundleModal(true);
  };

  const handleCreateBundle = async () => {
    setBundleBusy(true);
    setBundleError("");
    try {
      const { slug } = await ensurePolicyBundleLink(selectedIds, bundleTitle.trim());
      setShowBundleModal(false);
      setSelectedIds([]);
      navigate(`/company/policy-bundles/${slug}`);
    } catch (err) {
      console.error("Bundle error:", err);
      setBundleError("Could not create the link. Make sure every selected policy is published, then try again.");
    } finally {
      setBundleBusy(false);
    }
  };

  // ─── Modal open/close ───────────────────────────────────────────
  const openCreateModal = () => {
    setEditingPolicy(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (policy) => {
    setEditingPolicy(policy);
    setForm({
      title: policy.title,
      category: policy.category,
      version: policy.version,
      effectiveDate: policy.effectiveDate
        ? toDateInputValue(policy.effectiveDate)
        : "",
      requiresAcknowledgement: policy.requiresAcknowledgement,
      content: policy.content,
      fileUrl: policy.fileUrl || null,
      fileName: policy.fileName || null,
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPolicy(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setUploadProgress(0);
  };

  // ─── File upload ────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setFormError("Only PDF files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormError("File must be under 10 MB.");
      return;
    }
    setFormError("");
    setUploading(true);
    setUploadProgress(0);
    try {
      // Use a temp policyId for new policies; will be updated on save
      const tempId = editingPolicy?.id || `temp_${Date.now()}`;
      const { url, fileName } = await uploadPolicyFileWithProgress(
        file,
        userData.companyId,
        tempId,
        setUploadProgress
      );
      setForm((prev) => ({ ...prev, fileUrl: url, fileName }));
    } catch (err) {
      console.error("Upload error:", err);
      setFormError("File upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setForm((prev) => ({ ...prev, fileUrl: null, fileName: null }));
  };

  // ─── Save ────────────────────────────────────────────────────────
  const handleSave = async (asDraft = true) => {
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    if (!form.version.trim()) { setFormError("Version is required."); return; }
    if (!form.effectiveDate) { setFormError("Effective date is required."); return; }
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        version: form.version.trim(),
        effectiveDate: new Date(form.effectiveDate),
        requiresAcknowledgement: form.requiresAcknowledgement,
        content: form.content,
        fileUrl: form.fileUrl,
        fileName: form.fileName,
      };

      if (editingPolicy) {
        await updatePolicy(editingPolicy.id, payload);
        showToast("Policy updated.");
      } else {
        await createPolicy(payload, userData);
        showToast("Policy saved as draft.");
      }
      closeModal();
      loadPolicies();
    } catch (err) {
      console.error("Save error:", err);
      setFormError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Publish / Archive ──────────────────────────────────────────
  const handlePublish = async (policy) => {
    try {
      await publishPolicy(policy.id);
      showToast("Policy published.");
      loadPolicies();
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchive = async (policy) => {
    try {
      await archivePolicy(policy.id);
      showToast("Policy archived.");
      loadPolicies();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (policy) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${policy.title}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deletePolicy(policy.id, userData.companyId);
      showToast("Policy deleted.");
      loadPolicies();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete policy.");
    }
  };

  // ─── Stats modal ────────────────────────────────────────────────
  const openStatsModal = async (policy) => {
    setStatsPolicy(policy);
    setShowStatsModal(true);
    setStatsLoading(true);
    try {
      const [sd, acks, usersSnap, ls] = await Promise.all([
        getPolicyAcknowledgementStats(policy.id, userData.companyId),
        getPolicyAcknowledgements(policy.id, userData.companyId),
        getDocs(
          query(
            collection(db, "users"),
            where("companyId", "==", userData.companyId),
            where("status", "==", "active")
          )
        ),
        getPolicyLinkStats(policy, userData.companyId).catch((err) => {
          console.error("Link stats error:", err);
          return null;
        }),
      ]);
      setLinkStats(ls);
      setStatsData(sd);
      setStatsAcks(acks);
      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const ackedIds = new Set(acks.map((a) => a.userId));
      setAllUsers(users.filter((u) => !ackedIds.has(u.id)));
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────
  const toDateInputValue = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toISOString().split("T")[0];
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  // ─── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageLoading />
    );
  }

  // Anchors for the guided tour: the first row that shows each action.
  const firstDraftId = filteredPolicies.find((p) => p.status === "draft")?.id;
  const firstPublishedId = filteredPolicies.find((p) => p.status === "published")?.id;

  return (
    <PageContainer>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      <PageHeader
        icon={BookOpen}
        title="Policy Library"
        subtitle="Create, publish and track acknowledgement of company policies"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length >= MIN_BUNDLE && (
              <button
                onClick={openBundleModal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#1ABC9C] px-3.5 py-2.5 text-sm font-semibold text-[#16A085] transition hover:bg-teal-50"
              >
                <Layers size={16} aria-hidden="true" />
                Share {selectedIds.length} together
              </button>
            )}
            <button
              data-tour="policy-new"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1ABC9C] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16A085]"
            >
              <Plus size={16} aria-hidden="true" />
              New Policy
            </button>
          </div>
        }
      />

      <main className="space-y-6 lg:space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Policies", value: stats.total, color: "text-gray-900", bg: "bg-background-white" },
            { label: "Published", value: stats.published, color: "text-green-700", bg: "bg-green-50" },
            { label: "Draft", value: stats.draft, color: "text-amber-700", bg: "bg-amber-50" },
            { label: "Archived", value: stats.archived, color: "text-gray-500", bg: "bg-gray-100" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl p-5 border border-gray-100 shadow-sm`}>
              <p className="text-sm font-medium text-gray-600">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-xl p-1 w-fit">
          {["all", "published", "draft", "archived"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? "bg-background-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Table */}
        {filteredPolicies.length === 0 ? (
          <div className="bg-background-white rounded-xl border border-gray-100 p-16 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No policies</h3>
            <p className="text-gray-500 text-sm">
              {activeTab === "all"
                ? "Create your first policy using the \"New Policy\" button."
                : `No ${activeTab} policies found.`}
            </p>
          </div>
        ) : (
          <div className="bg-background-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="w-10 pl-5 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all shareable policies"
                        data-tour="policy-select"
                        checked={allShareableSelected}
                        disabled={shareable.length === 0}
                        onChange={toggleAllShareable}
                        className="h-4 w-4 rounded border-gray-300 accent-[#1ABC9C] disabled:opacity-30"
                      />
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-700">Title</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-700">Category</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Version</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Ack. Required</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Effective Date</th>
                    <th className="text-right px-5 py-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPolicies.map((policy) => (
                    <tr key={policy.id} className="hover:bg-gray-50 transition">
                      <td className="w-10 pl-5 py-4">
                        {isShareable(policy) && (
                          <input
                            type="checkbox"
                            aria-label={`Select ${policy.title}`}
                            checked={selectedIds.includes(policy.id)}
                            onChange={() => toggleSelected(policy.id)}
                            className="h-4 w-4 rounded border-gray-300 accent-[#1ABC9C]"
                          />
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{policy.title}</p>
                        {policy.fileName && (
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {policy.fileName}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_BADGE[policy.category] || CATEGORY_BADGE.other}`}>
                          {CATEGORY_LABELS[policy.category] || policy.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-600 font-mono text-xs">v{policy.version}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[policy.status] || "bg-gray-100 text-gray-600"}`}>
                          {policy.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {policy.requiresAcknowledgement ? (
                          <span className="text-teal-600 font-medium text-xs">Yes</span>
                        ) : (
                          <span className="text-gray-400 text-xs">No</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-600 text-xs">{formatDate(policy.effectiveDate)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(policy)}
                            className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {policy.status === "draft" && (
                            <button
                              data-tour={policy.id === firstDraftId ? "policy-publish" : undefined}
                              onClick={() => handlePublish(policy)}
                              className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition flex items-center gap-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Publish
                            </button>
                          )}
                          {policy.status === "published" && (
                            <>
                              <button
                                onClick={() => handleArchive(policy)}
                                className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                                title="Archive"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                              <button
                                data-tour={policy.id === firstPublishedId ? "policy-link" : undefined}
                                onClick={() => navigate(`/company/policies/${policy.id}/link`)}
                                className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                                title="Public link, QR code and acknowledgements"
                              >
                                <Link2 className="w-4 h-4" />
                              </button>
                              <button
                                data-tour={policy.id === firstPublishedId ? "policy-stats" : undefined}
                                onClick={() => openStatsModal(policy)}
                                className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Acknowledgement Stats"
                              >
                                <BarChart2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(policy)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Hint */}
        {selectedIds.length === 1 && (
          <p className="text-sm text-gray-500">Select at least one more policy to share them together in one link.</p>
        )}

        {/* Existing bundles */}
        {bundles.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-gray-900">Shared together</h2>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-background-white shadow-sm">
              {bundles.map((b) => (
                <li key={b.slug} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {b.title || `${b.policyIds.length} policies`}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {b.policyIds.map((id) => policyTitleById[id] || "Deleted policy").join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        b.active === false ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-800"
                      }`}
                    >
                      {b.active === false ? "Paused" : "Active"}
                    </span>
                    <button
                      onClick={() => navigate(`/company/policy-bundles/${b.slug}`)}
                      className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                    >
                      Manage
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* ─── Bundle Modal ────────────────────────────────────────── */}
      {showBundleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Share {selectedIds.length} policies together</h2>
              <button onClick={() => setShowBundleModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <p className="text-sm text-gray-600">
                Employees open one link, read every policy below and acknowledge them all in one go.
              </p>
              <ul className="space-y-1.5 rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
                {selectedIds.map((id) => (
                  <li key={id} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-teal-600" />
                    <span className="truncate">{policyTitleById[id]}</span>
                  </li>
                ))}
              </ul>
              <div>
                <label htmlFor="bundle-title" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Pack name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="bundle-title"
                  type="text"
                  maxLength={100}
                  value={bundleTitle}
                  onChange={(e) => setBundleTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  placeholder="e.g. 2025 onboarding policies"
                />
              </div>
              {bundleError && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{bundleError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowBundleModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBundle}
                disabled={bundleBusy}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition disabled:opacity-50"
              >
                {bundleBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Create link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create / Edit Modal ─────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPolicy ? "Edit Policy" : "New Policy"}
              </h2>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  placeholder="e.g. Employee Code of Conduct 2025"
                />
              </div>

              {/* Category + Version row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Version <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    placeholder="1.0"
                  />
                </div>
              </div>

              {/* Effective Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm((p) => ({ ...p, effectiveDate: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              {/* Requires Acknowledgement */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Requires Acknowledgement</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Employees must confirm they have read this policy.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, requiresAcknowledgement: !p.requiresAcknowledgement }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.requiresAcknowledgement ? "bg-teal-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.requiresAcknowledgement ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Policy Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm resize-y"
                  rows={8}
                  style={{ minHeight: "200px" }}
                  placeholder="Write the full policy text here..."
                />
              </div>

              {/* PDF Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Upload PDF <span className="text-gray-400 font-normal">(optional, max 10 MB)</span>
                </label>
                {form.fileUrl ? (
                  <div className="flex items-center justify-between px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-teal-700">
                      <FileText className="w-4 h-4" />
                      <span className="font-medium truncate max-w-xs">{form.fileName}</span>
                    </div>
                    <button onClick={removeFile} className="text-red-500 hover:text-red-700 p-1 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition">
                      <Upload className="w-6 h-6 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600 font-medium">Click to upload PDF</span>
                      <span className="text-xs text-gray-400 mt-1">PDF only, max 10 MB</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={uploading}
                      />
                    </label>
                    {uploading && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Uploading...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full">
                          <div
                            className="h-2 bg-teal-500 rounded-full transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error */}
              {formError && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{formError}</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave()}
                disabled={saving || uploading}
                className="px-5 py-2.5 text-sm font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : editingPolicy ? "Save & Update" : "Save as Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Stats Modal ─────────────────────────────────────────── */}
      {showStatsModal && statsPolicy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Acknowledgement Stats</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {statsPolicy.title} — v{statsPolicy.version}
                </p>
              </div>
              <button
                onClick={() => { setShowStatsModal(false); setStatsPolicy(null); setStatsData(null); setLinkStats(null); }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              {statsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
                </div>
              ) : statsData ? (
                <>
                  {/* Progress */}
                  <div className="bg-teal-50 border border-teal-100 rounded-2xl p-6 mb-6 text-center">
                    <p className="text-5xl font-bold text-teal-700 mb-1">{statsData.percentage}%</p>
                    <p className="text-gray-600 text-sm mt-1">
                      <span className="font-semibold text-gray-900">{statsData.acknowledgedCount}</span> of{" "}
                      <span className="font-semibold text-gray-900">{statsData.totalUsers}</span> active employees acknowledged
                    </p>
                    <div className="h-3 bg-teal-100 rounded-full mt-4">
                      <div
                        className="h-3 bg-teal-500 rounded-full transition-all"
                        style={{ width: `${statsData.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Public link + packs */}
                  {linkStats && (linkStats.linkCount > 0 || linkStats.summary.acknowledged > 0) && (
                    <div className="mb-6 rounded-2xl border border-gray-100 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">Public link acknowledgements</h3>
                        <span className="text-xs text-gray-500">
                          v{statsPolicy.version}
                          {linkStats.bundleCount > 0 &&
                            ` · in ${linkStats.bundleCount} pack${linkStats.bundleCount > 1 ? "s" : ""}`}
                        </span>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                        {[
                          ["Acknowledged", linkStats.summary.acknowledged, "text-green-700"],
                          ["Not yet", linkStats.summary.rosterTotal > 0 ? linkStats.summary.pending : "–", "text-amber-700"],
                          ["Concerns", linkStats.summary.concerns, "text-red-700"],
                        ].map(([label, value, color]) => (
                          <div key={label} className="rounded-xl bg-gray-50 p-3">
                            <dt className="text-xs text-gray-500">{label}</dt>
                            <dd className={`mt-0.5 text-2xl font-bold ${color}`}>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      {linkStats.summary.rosterTotal > 0 && (
                        <div className="mt-3 h-2 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-teal-500 transition-all"
                            style={{
                              width: `${Math.min(100, Math.round((linkStats.summary.acknowledged / linkStats.summary.rosterTotal) * 100))}%`,
                            }}
                          />
                        </div>
                      )}
                      {linkStats.pending.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-semibold text-gray-700">
                            Roster employees yet to acknowledge ({linkStats.pending.length})
                          </p>
                          <div className="max-h-40 space-y-1.5 overflow-y-auto">
                            {linkStats.pending.map((row) => (
                              <div key={row.employeeKey} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                                <span className="text-gray-900">{row.name || row.employeeId}</span>
                                <span className="font-mono text-xs text-gray-400">{row.employeeId}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pending list */}
                  {allUsers.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Pending Acknowledgement ({allUsers.length})
                        </h3>
                        <button
                          onClick={() => showToast("Reminder feature coming soon")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          Send Reminder
                        </button>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {allUsers.map((user) => (
                          <div key={user.id} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                              {(user.displayName || user.username || "?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {user.displayName || user.username}
                              </p>
                              {user.username && user.displayName && (
                                <p className="text-xs text-gray-400">@{user.username}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-900">All active employees have acknowledged!</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500 text-sm text-center py-8">Failed to load stats.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default PolicyManagement;
