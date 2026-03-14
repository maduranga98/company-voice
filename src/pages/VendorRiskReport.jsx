import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import {
  submitVendorReport,
  submitCorroboration,
  validateReferenceCode,
} from "../services/vendorRiskService";

const VendorRiskReport = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("choice"); // choice | new | corroborate | success_new | success_corr
  const [loading, setLoading] = useState(false);
  const [refCodeInput, setRefCodeInput] = useState("");
  const [refCodeValid, setRefCodeValid] = useState(null);
  const [refCodeChecking, setRefCodeChecking] = useState(false);
  const [foundReportId, setFoundReportId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [submittedCode, setSubmittedCode] = useState(null);

  // New report form
  const [vendorName, setVendorName] = useState("");
  const [riskCategory, setRiskCategory] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");

  // Corroboration form
  const [relationship, setRelationship] = useState("");
  const [account, setAccount] = useState("");
  const [corrSeverity, setCorrSeverity] = useState("medium");
  const [corrFiles, setCorrFiles] = useState([]);

  const resetNewForm = () => {
    setVendorName("");
    setRiskCategory("");
    setSeverity("medium");
    setDescription("");
    setSelectedFiles([]);
    setUploadProgress(0);
  };

  const resetCorrForm = () => {
    setRelationship("");
    setAccount("");
    setCorrSeverity("medium");
    setCorrFiles([]);
    setRefCodeInput("");
    setRefCodeValid(null);
    setFoundReportId(null);
  };

  const handleFileSelect = (e, setter) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((f) => {
      if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
        toast.error(`${f.name}: only images and PDFs are allowed.`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: file exceeds 10MB limit.`);
        return false;
      }
      return true;
    });
    setter((prev) => {
      const combined = [...prev, ...validFiles];
      return combined.slice(0, 5);
    });
    e.target.value = "";
  };

  const removeFile = (index, setter) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleVerifyCode = async () => {
    setRefCodeChecking(true);
    setRefCodeValid(null);
    try {
      const result = await validateReferenceCode(refCodeInput.trim(), userData.companyId);
      if (result.valid) {
        setRefCodeValid(true);
        setFoundReportId(result.reportId);
      } else {
        setRefCodeValid(false);
      }
    } catch {
      setRefCodeValid(false);
    } finally {
      setRefCodeChecking(false);
    }
  };

  const handleSubmitReport = async () => {
    setLoading(true);
    setUploadProgress(0);
    try {
      const result = await submitVendorReport(
        { vendorName, riskCategory, severity, description },
        selectedFiles,
        userData,
        setUploadProgress
      );
      setSubmittedCode(result.referenceCode);
      setMode("success_new");
    } catch {
      toast.error("Failed to submit report. Please try again.");
      setLoading(false);
    }
  };

  const handleSubmitCorroboration = async () => {
    setLoading(true);
    try {
      await submitCorroboration(
        foundReportId,
        { relationship, account: account.trim(), severity: corrSeverity },
        corrFiles,
        userData
      );
      setMode("success_corr");
    } catch {
      toast.error("Submission failed.");
      setLoading(false);
    }
  };

  const SeverityPills = ({ value, onChange }) => (
    <div className="flex gap-2">
      {[
        { val: "low", label: "Low", activeClass: "bg-green-100 text-green-800" },
        { val: "medium", label: "Medium", activeClass: "bg-amber-100 text-amber-800" },
        { val: "high", label: "High", activeClass: "bg-red-100 text-red-800" },
      ].map(({ val, label, activeClass }) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
            value === val ? activeClass : "bg-gray-100 text-gray-500"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const FileList = ({ files, onRemove }) => (
    <div className="mt-2 space-y-2">
      {files.map((file, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          {file.type === "application/pdf" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          )}
          <span className="flex-1 text-xs text-gray-700 truncate">{file.name}</span>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="text-gray-400 hover:text-red-500 transition flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );

  const UploadArea = ({ files, onFilesChange }) => (
    <div>
      <label className="block dashed border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#1ABC9C] transition">
        <svg className="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span className="text-sm text-gray-500">Tap to upload files</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e, onFilesChange)}
        />
      </label>
      {files.length > 0 && <FileList files={files} onRemove={(i) => removeFile(i, onFilesChange)} />}
    </div>
  );

  const AnonymousBadge = () => (
    <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center gap-3">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      <div className="flex-1">
        <div className="text-sm font-semibold text-teal-700">Submitting anonymously</div>
        <div className="text-xs text-teal-600">Your identity is encrypted and protected</div>
      </div>
    </div>
  );

  // ── CHOICE SCREEN ──────────────────────────────────────────────────────────
  if (mode === "choice") {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24">
        {/* Header */}
        <div className="bg-[#2D3E50] text-white rounded-b-2xl px-6 py-8 -mx-4">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 bg-[#1ABC9C]/20 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1ABC9C" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-bold text-center">Report a Vendor Concern</h1>
          <p className="text-sm text-white/60 text-center mt-1">All submissions are anonymous and encrypted</p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {/* New Report Card */}
          <button
            onClick={() => setMode("new")}
            className="bg-white rounded-2xl border border-gray-200 p-5 cursor-pointer hover:border-[#1ABC9C] hover:shadow-md transition text-left flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Report a new concern</div>
              <div className="text-xs text-gray-500 mt-1">Submit a new anonymous report about a vendor or supplier</div>
            </div>
          </button>

          {/* Corroborate Card */}
          <button
            onClick={() => setMode("corroborate")}
            className="bg-white rounded-2xl border border-gray-200 p-5 cursor-pointer hover:border-[#1ABC9C] hover:shadow-md transition text-left flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Add to an existing report</div>
              <div className="text-xs text-gray-500 mt-1">Have information about an existing concern? Enter the reference code.</div>
            </div>
          </button>
        </div>

        {/* Privacy notice */}
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mt-6 flex items-start gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" className="mt-0.5 flex-shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-xs text-teal-700">Your identity is never revealed. All reports are encrypted and anonymous.</span>
        </div>
      </div>
    );
  }

  // ── NEW REPORT FORM ────────────────────────────────────────────────────────
  if (mode === "new") {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
        <button
          onClick={() => { resetNewForm(); setMode("choice"); }}
          className="text-sm text-gray-500 flex items-center gap-1 mb-4"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h2 className="text-lg font-bold text-gray-900 mb-4">New Vendor Report</h2>

        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          {/* Vendor Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor or Supplier Name</label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. ABC Logistics Pvt Ltd"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1ABC9C]"
            />
          </div>

          {/* Risk Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Risk Category</label>
            <select
              value={riskCategory}
              onChange={(e) => setRiskCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1ABC9C] bg-white"
            >
              <option value="">Select a category...</option>
              <option value="labor">Labor Practices</option>
              <option value="data_privacy">Data Privacy</option>
              <option value="safety">Health & Safety</option>
              <option value="fraud">Fraud or Corruption</option>
              <option value="compliance">Regulatory Non-Compliance</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity Level</label>
            <SeverityPills value={severity} onChange={setSeverity} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Describe your concern</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Provide as much detail as possible. Describe what you observed, when it happened, and any relevant context..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1ABC9C] resize-none"
            />
            <div className="text-xs text-gray-400 text-right mt-1">
              {description.length} characters (minimum 50)
            </div>
          </div>

          {/* Evidence Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attach Evidence (optional)</label>
            <p className="text-xs text-gray-400 mb-2">Images or PDFs only · Max 5 files · 10MB each</p>
            <UploadArea files={selectedFiles} onFilesChange={setSelectedFiles} />
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-2">
                <div className="bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-[#1ABC9C] h-full rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Uploading... {uploadProgress}%</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <AnonymousBadge />
        </div>

        <button
          onClick={handleSubmitReport}
          disabled={loading || !vendorName.trim() || !riskCategory || description.length < 50}
          className="mt-4 w-full bg-[#2D3E50] text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Submitting...
            </>
          ) : (
            "Submit Report Anonymously"
          )}
        </button>
      </div>
    );
  }

  // ── SUCCESS — NEW REPORT ───────────────────────────────────────────────────
  if (mode === "success_new") {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24 pt-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mt-4">Report Submitted</h2>
        <p className="text-sm text-gray-500 mt-2">Your concern has been recorded anonymously.</p>

        <div className="bg-[#2D3E50] text-white rounded-2xl p-5 mt-6 text-left">
          <div className="text-xs uppercase tracking-wide text-white/60">Your Reference Code</div>
          <div className="text-2xl font-mono font-bold text-[#1ABC9C] mt-1 text-center">{submittedCode}</div>

          <div className="border-t border-white/10 my-4" />

          <div className="text-sm font-semibold text-white">Save this code.</div>
          <p className="text-xs text-white/60 mt-1 leading-relaxed">
            If you know colleagues who witnessed the same issue, share this code with them.
            They can add their accounts anonymously using this code, which strengthens the report.
          </p>

          <button
            onClick={() => {
              navigator.clipboard.writeText(submittedCode);
              toast.success("Code copied!");
            }}
            className="mt-4 w-full border border-white text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-white/10 transition"
          >
            Copy Code
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <button
            onClick={() => { resetNewForm(); setSubmittedCode(null); setMode("choice"); }}
            className="w-full border border-gray-200 text-gray-700 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition"
          >
            Report Another Concern
          </button>
          <button
            onClick={() => navigate("/feed/problems")}
            className="w-full bg-[#1ABC9C] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#17a589] transition"
          >
            Go to Problems Wall
          </button>
        </div>
      </div>
    );
  }

  // ── CORROBORATE FORM ───────────────────────────────────────────────────────
  if (mode === "corroborate") {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
        <button
          onClick={() => { resetCorrForm(); setMode("choice"); }}
          className="text-sm text-gray-500 flex items-center gap-1 mb-4"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h2 className="text-lg font-bold text-gray-900 mb-4">Add to Existing Report</h2>

        {/* Explanation */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="mt-0.5 flex-shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-blue-700">
            Enter the reference code shared with you by the original reporter. You will submit your account completely independently — you will not see the original report.
          </p>
        </div>

        {/* Reference Code Input */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Reference Code</label>
          <p className="text-xs text-gray-400 mb-2">Format: VXW-YYYY-NNNN</p>

          <div className="flex gap-2">
            <input
              type="text"
              value={refCodeInput}
              onChange={(e) => setRefCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. VXW-2025-0047"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1ABC9C] font-mono"
            />
            <button
              onClick={handleVerifyCode}
              disabled={refCodeInput.length < 8 || refCodeChecking}
              className="bg-[#2D3E50] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {refCodeChecking ? "..." : "Verify"}
            </button>
          </div>

          {/* Validation feedback */}
          <div className="mt-2">
            {refCodeChecking && (
              <p className="text-sm text-gray-400">Checking...</p>
            )}
            {refCodeValid === true && !refCodeChecking && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Valid reference code — report found
              </p>
            )}
            {refCodeValid === false && !refCodeChecking && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Code not found for your company. Check the code and try again.
              </p>
            )}
          </div>
        </div>

        {/* Corroboration form - only if code is valid */}
        {refCodeValid === true && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mt-4 space-y-4">
            {/* Privacy reminder */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-xs text-amber-700">
                You are submitting independently. You will not see the original report or other submissions.
              </p>
            </div>

            {/* Relationship */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Relationship to This Incident</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1ABC9C] bg-white"
              >
                <option value="">Select...</option>
                <option value="witness">I witnessed this directly</option>
                <option value="directly_affected">I was directly affected</option>
                <option value="heard_from_others">I heard about this from others</option>
              </select>
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Describe what you know</label>
              <p className="text-xs text-gray-400 mb-1">Describe your own independent account. Do not reference the original report.</p>
              <textarea
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                rows={4}
                placeholder="What did you observe or experience?..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1ABC9C] resize-none"
              />
              <div className="text-xs text-gray-400 text-right mt-1">
                {account.length} characters (minimum 30)
              </div>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">In your view, how serious is this?</label>
              <SeverityPills value={corrSeverity} onChange={setCorrSeverity} />
            </div>

            {/* Evidence upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Attach Evidence (optional)</label>
              <p className="text-xs text-gray-400 mb-2">Images or PDFs only · Max 5 files · 10MB each</p>
              <UploadArea files={corrFiles} onFilesChange={setCorrFiles} />
            </div>

            <AnonymousBadge />

            <button
              onClick={handleSubmitCorroboration}
              disabled={loading || !relationship || account.length < 30}
              className="w-full bg-[#2D3E50] text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Submitting...
                </>
              ) : (
                "Submit My Account Anonymously"
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── SUCCESS — CORROBORATION ────────────────────────────────────────────────
  if (mode === "success_corr") {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24 pt-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mt-4">Account Submitted</h2>
        <p className="text-sm text-gray-500 mt-2">Your information has been added to the report anonymously.</p>

        <div className="bg-[#2D3E50] rounded-2xl p-5 mt-6 text-left">
          <div className="text-sm font-semibold text-white">What happens next?</div>
          <ul className="text-xs text-white/70 mt-2 space-y-2">
            <li>• HR will review all submissions independently</li>
            <li>• If 3 or more people report the same concern, it is automatically escalated</li>
            <li>• No submitter's identity is ever revealed</li>
            <li>• You will not receive updates (to protect your anonymity)</li>
          </ul>
        </div>

        <button
          onClick={() => navigate("/feed/problems")}
          className="mt-6 w-full bg-[#2D3E50] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#1e2d3d] transition"
        >
          Done
        </button>
      </div>
    );
  }

  return null;
};

export default VendorRiskReport;
