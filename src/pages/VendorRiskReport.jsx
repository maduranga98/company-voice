import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import {
  submitVendorReport,
  submitCorroboration,
  validateReferenceCode,
} from "../services/vendorRiskService";
import {
  Shield, AlertTriangle, Users, ArrowLeft, Upload, Lock,
  CheckCircle, X, FileText, Image, Copy, Info, CloudUpload,
} from "lucide-react";

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
        { val: "low", label: "Low", activeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
        { val: "medium", label: "Medium", activeClass: "bg-amber-50 text-amber-700 border-amber-200" },
        { val: "high", label: "High", activeClass: "bg-red-50 text-red-700 border-red-200" },
      ].map(({ val, label, activeClass }) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
            value === val ? activeClass : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const FileList = ({ files, onRemove }) => (
    <div className="mt-3 space-y-2">
      {files.map((file, i) => (
        <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
          {file.type === "application/pdf" ? (
            <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
          ) : (
            <Image className="w-4 h-4 text-blue-500 flex-shrink-0" />
          )}
          <span className="flex-1 text-xs text-gray-700 truncate font-medium">{file.name}</span>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="text-gray-300 hover:text-red-500 transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );

  const UploadArea = ({ files, onFilesChange }) => (
    <div>
      <label className="block border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center cursor-pointer hover:border-[#1ABC9C] hover:bg-teal-50/30 transition-all">
        <CloudUpload className="w-7 h-7 text-gray-300 mx-auto mb-2" />
        <span className="text-sm text-gray-500 font-medium">Tap to upload files</span>
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
    <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <Lock className="w-4 h-4 text-teal-600" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-bold text-teal-700">Submitting anonymously</div>
        <div className="text-xs text-teal-600">Your identity is encrypted and protected</div>
      </div>
    </div>
  );

  // CHOICE SCREEN
  if (mode === "choice") {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24">
        {/* Header */}
        <div className="bg-[#2D3E50] text-white rounded-b-3xl px-6 py-10 -mx-4">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-[#1ABC9C]/20 rounded-2xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-[#1ABC9C]" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-center">Report a Vendor Concern</h1>
          <p className="text-sm text-white/60 text-center mt-2">All submissions are anonymous and encrypted</p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {/* New Report Card */}
          <button
            onClick={() => setMode("new")}
            className="bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer hover:border-[#1ABC9C] hover:shadow-md transition-all text-left flex items-center gap-4 shadow-sm"
          >
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#2D3E50]">Report a new concern</div>
              <div className="text-xs text-gray-500 mt-1">Submit a new anonymous report about a vendor or supplier</div>
            </div>
          </button>

          {/* Corroborate Card */}
          <button
            onClick={() => setMode("corroborate")}
            className="bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer hover:border-[#1ABC9C] hover:shadow-md transition-all text-left flex items-center gap-4 shadow-sm"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#2D3E50]">Add to an existing report</div>
              <div className="text-xs text-gray-500 mt-1">Have information about an existing concern? Enter the reference code.</div>
            </div>
          </button>
        </div>

        {/* Privacy notice */}
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 mt-6 flex items-start gap-3">
          <Lock className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-teal-700">Your identity is never revealed. All reports are encrypted and anonymous.</span>
        </div>
      </div>
    );
  }

  // NEW REPORT FORM
  if (mode === "new") {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
        <button
          onClick={() => { resetNewForm(); setMode("choice"); }}
          className="text-sm text-gray-500 flex items-center gap-1.5 mb-5 hover:text-[#2D3E50] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h2 className="text-lg font-bold text-[#2D3E50] mb-1">New Vendor Report</h2>
        <p className="text-sm text-gray-500 mb-5">Provide details about the vendor concern</p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          {/* Vendor Name */}
          <div>
            <label className="block text-sm font-semibold text-[#2D3E50] mb-1.5">Vendor or Supplier Name</label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. ABC Logistics Pvt Ltd"
              className="w-full border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C]/20 bg-gray-50/50"
            />
          </div>

          {/* Risk Category */}
          <div>
            <label className="block text-sm font-semibold text-[#2D3E50] mb-1.5">Risk Category</label>
            <select
              value={riskCategory}
              onChange={(e) => setRiskCategory(e.target.value)}
              className="w-full border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C]/20 bg-gray-50/50"
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
            <label className="block text-sm font-semibold text-[#2D3E50] mb-2">Severity Level</label>
            <SeverityPills value={severity} onChange={setSeverity} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-[#2D3E50] mb-1.5">Describe your concern</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Provide as much detail as possible. Describe what you observed, when it happened, and any relevant context..."
              className="w-full border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C]/20 resize-none bg-gray-50/50"
            />
            <div className="text-xs text-gray-400 text-right mt-1">
              {description.length} characters (minimum 50)
            </div>
          </div>

          {/* Evidence Upload */}
          <div>
            <label className="block text-sm font-semibold text-[#2D3E50] mb-1.5">Attach Evidence (optional)</label>
            <p className="text-xs text-gray-400 mb-2">Images or PDFs only -- Max 5 files -- 10MB each</p>
            <UploadArea files={selectedFiles} onFilesChange={setSelectedFiles} />
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-3">
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
          className="mt-4 w-full bg-[#2D3E50] text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#24333f] transition-colors"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Submitting...
            </>
          ) : (
            "Submit Report Anonymously"
          )}
        </button>
      </div>
    );
  }

  // SUCCESS - NEW REPORT
  if (mode === "success_new") {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24 pt-12 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-[#2D3E50] mt-5">Report Submitted</h2>
        <p className="text-sm text-gray-500 mt-2">Your concern has been recorded anonymously.</p>

        <div className="bg-[#2D3E50] text-white rounded-2xl p-6 mt-6 text-left">
          <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">Your Reference Code</div>
          <div className="text-2xl font-mono font-bold text-[#1ABC9C] mt-2 text-center">{submittedCode}</div>

          <div className="border-t border-white/10 my-5" />

          <div className="text-sm font-bold text-white">Save this code.</div>
          <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
            If you know colleagues who witnessed the same issue, share this code with them.
            They can add their accounts anonymously using this code, which strengthens the report.
          </p>

          <button
            onClick={() => {
              navigator.clipboard.writeText(submittedCode);
              toast.success("Code copied!");
            }}
            className="mt-5 w-full border border-white/30 text-white rounded-xl py-3 text-sm font-semibold hover:bg-white/10 transition flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Code
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <button
            onClick={() => { resetNewForm(); setSubmittedCode(null); setMode("choice"); }}
            className="w-full border border-gray-100 text-gray-700 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50 transition shadow-sm"
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

  // CORROBORATE FORM
  if (mode === "corroborate") {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
        <button
          onClick={() => { resetCorrForm(); setMode("choice"); }}
          className="text-sm text-gray-500 flex items-center gap-1.5 mb-5 hover:text-[#2D3E50] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h2 className="text-lg font-bold text-[#2D3E50] mb-1">Add to Existing Report</h2>
        <p className="text-sm text-gray-500 mb-5">Corroborate an existing vendor concern</p>

        {/* Explanation */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            Enter the reference code shared with you by the original reporter. You will submit your account completely independently — you will not see the original report.
          </p>
        </div>

        {/* Reference Code Input */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <label className="block text-sm font-semibold text-[#2D3E50] mb-1">Reference Code</label>
          <p className="text-xs text-gray-400 mb-3">Format: VXW-YYYY-NNNN</p>

          <div className="flex gap-2">
            <input
              type="text"
              value={refCodeInput}
              onChange={(e) => setRefCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. VXW-2025-0047"
              className="flex-1 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C]/20 font-mono bg-gray-50/50"
            />
            <button
              onClick={handleVerifyCode}
              disabled={refCodeInput.length < 8 || refCodeChecking}
              className="bg-[#2D3E50] text-white px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-[#24333f] transition-colors"
            >
              {refCodeChecking ? "..." : "Verify"}
            </button>
          </div>

          {/* Validation feedback */}
          <div className="mt-3">
            {refCodeChecking && (
              <p className="text-sm text-gray-400">Checking...</p>
            )}
            {refCodeValid === true && !refCodeChecking && (
              <p className="text-sm text-emerald-600 flex items-center gap-1.5 font-medium">
                <CheckCircle className="w-4 h-4" />
                Valid reference code — report found
              </p>
            )}
            {refCodeValid === false && !refCodeChecking && (
              <p className="text-sm text-red-500 flex items-center gap-1.5 font-medium">
                <X className="w-4 h-4" />
                Code not found for your company. Check the code and try again.
              </p>
            )}
          </div>
        </div>

        {/* Corroboration form - only if code is valid */}
        {refCodeValid === true && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-4 space-y-5">
            {/* Privacy reminder */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                You are submitting independently. You will not see the original report or other submissions.
              </p>
            </div>

            {/* Relationship */}
            <div>
              <label className="block text-sm font-semibold text-[#2D3E50] mb-1.5">Your Relationship to This Incident</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C]/20 bg-gray-50/50"
              >
                <option value="">Select...</option>
                <option value="witness">I witnessed this directly</option>
                <option value="directly_affected">I was directly affected</option>
                <option value="heard_from_others">I heard about this from others</option>
              </select>
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-semibold text-[#2D3E50] mb-1.5">Describe what you know</label>
              <p className="text-xs text-gray-400 mb-1.5">Describe your own independent account. Do not reference the original report.</p>
              <textarea
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                rows={4}
                placeholder="What did you observe or experience?..."
                className="w-full border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C]/20 resize-none bg-gray-50/50"
              />
              <div className="text-xs text-gray-400 text-right mt-1">
                {account.length} characters (minimum 30)
              </div>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-semibold text-[#2D3E50] mb-2">In your view, how serious is this?</label>
              <SeverityPills value={corrSeverity} onChange={setCorrSeverity} />
            </div>

            {/* Evidence upload */}
            <div>
              <label className="block text-sm font-semibold text-[#2D3E50] mb-1.5">Attach Evidence (optional)</label>
              <p className="text-xs text-gray-400 mb-2">Images or PDFs only -- Max 5 files -- 10MB each</p>
              <UploadArea files={corrFiles} onFilesChange={setCorrFiles} />
            </div>

            <AnonymousBadge />

            <button
              onClick={handleSubmitCorroboration}
              disabled={loading || !relationship || account.length < 30}
              className="w-full bg-[#2D3E50] text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#24333f] transition-colors"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
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

  // SUCCESS - CORROBORATION
  if (mode === "success_corr") {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24 pt-12 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-[#2D3E50] mt-5">Account Submitted</h2>
        <p className="text-sm text-gray-500 mt-2">Your information has been added to the report anonymously.</p>

        <div className="bg-[#2D3E50] rounded-2xl p-6 mt-6 text-left">
          <div className="text-sm font-bold text-white">What happens next?</div>
          <ul className="text-xs text-white/70 mt-3 space-y-2.5">
            <li className="flex items-start gap-2"><span className="text-[#1ABC9C] mt-0.5">--</span> HR will review all submissions independently</li>
            <li className="flex items-start gap-2"><span className="text-[#1ABC9C] mt-0.5">--</span> If 3 or more people report the same concern, it is automatically escalated</li>
            <li className="flex items-start gap-2"><span className="text-[#1ABC9C] mt-0.5">--</span> No submitter's identity is ever revealed</li>
            <li className="flex items-start gap-2"><span className="text-[#1ABC9C] mt-0.5">--</span> You will not receive updates (to protect your anonymity)</li>
          </ul>
        </div>

        <button
          onClick={() => navigate("/feed/problems")}
          className="mt-6 w-full bg-[#2D3E50] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#24333f] transition"
        >
          Done
        </button>
      </div>
    );
  }

  return null;
};

export default VendorRiskReport;
