import React, { useState } from "react";
import { Scale, X, AlertTriangle, FileText, Upload, Info, AlertCircle, CheckCircle } from "lucide-react";
import {
  LegalRequestType,
  LegalRequestTypeConfig,
} from "../utils/constants";
import { createLegalRequest } from "../services/legalRequestService";

const NAVY = "#2D3E50";
const TEAL = "#1ABC9C";

const LegalRequestModal = ({ isOpen, onClose, report, companyId, userData }) => {
  const [requestType, setRequestType] = useState(LegalRequestType.IDENTITY_DISCLOSURE);
  const [legalJustification, setLegalJustification] = useState("");
  const [courtOrderUrl, setCourtOrderUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload a PDF or image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCourtOrderUrl(reader.result);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error uploading file:", err);
      setError("Failed to upload file. Please try again.");
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    // Validate inputs
    if (!requestType) {
      setError("Please select a request type");
      return;
    }
    if (!legalJustification.trim()) {
      setError("Please provide legal justification");
      return;
    }
    if (legalJustification.trim().length < 100) {
      setError("Legal justification must be at least 100 characters");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const requestData = {
        companyId,
        requestedBy: userData.displayName || userData.username,
        requestedByUserId: userData.id,
        requestType,
        reportId: report.id,
        legalJustification: legalJustification.trim(),
        courtOrderUrl: courtOrderUrl || null,
      };

      await createLegalRequest(requestData);

      alert("Legal disclosure request submitted successfully. VoxWel will review your request.");
      onClose();
    } catch (err) {
      console.error("Error submitting legal request:", err);
      setError("Failed to submit legal request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${NAVY}10` }}
            >
              <Scale className="w-4.5 h-4.5" style={{ color: NAVY }} />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
              Request Legal Disclosure
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl p-2 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Warning Banner */}
          <div className="p-4 rounded-xl border border-amber-200" style={{ backgroundColor: "#FFFBEB" }}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Legal Disclosure Process</p>
                <p className="text-xs leading-relaxed">
                  This request will be reviewed by VoxWel's legal team. All requests must be
                  accompanied by valid legal documentation (court order, subpoena, etc.).
                  Frivolous or improper requests may result in penalties.
                </p>
              </div>
            </div>
          </div>

          {/* Report Information */}
          <div className="p-4 bg-gray-50/80 border border-gray-100 rounded-xl">
            <h3 className="font-medium text-sm mb-3" style={{ color: NAVY }}>
              Report Information
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400 text-xs">Report ID:</span>
                <p className="font-medium text-sm" style={{ color: NAVY }}>{report.id}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Content Type:</span>
                <p className="font-medium text-sm capitalize" style={{ color: NAVY }}>
                  {report.contentType}
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Reason:</span>
                <p className="font-medium text-sm capitalize" style={{ color: NAVY }}>
                  {report.reason}
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Status:</span>
                <p className="font-medium text-sm capitalize" style={{ color: NAVY }}>
                  {report.status}
                </p>
              </div>
            </div>
          </div>

          {/* Request Type */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: NAVY }}>
              Request Type <span className="text-red-500">*</span>
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              disabled={submitting}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 transition-shadow"
              style={{ color: NAVY, "--tw-ring-color": TEAL }}
            >
              {Object.values(LegalRequestType).map((type) => (
                <option key={type} value={type}>
                  {LegalRequestTypeConfig[type]?.icon} {LegalRequestTypeConfig[type]?.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              {LegalRequestTypeConfig[requestType]?.description}
            </p>
          </div>

          {/* Legal Justification */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: NAVY }}>
              Legal Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              value={legalJustification}
              onChange={(e) => setLegalJustification(e.target.value)}
              disabled={submitting}
              rows={6}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 transition-shadow"
              style={{ color: NAVY, "--tw-ring-color": TEAL }}
              placeholder="Provide detailed legal justification for this disclosure request. Include:&#10;- Case number and jurisdiction&#10;- Legal basis for the request&#10;- Specific information being requested&#10;- Relevant statutes or court orders&#10;&#10;Minimum 100 characters required."
            />
            <p className="text-xs text-gray-400 mt-1.5">
              {legalJustification.length} / 100 minimum characters
            </p>
          </div>

          {/* Court Order Upload */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: NAVY }}>
              Court Order / Legal Document
              <span className="text-gray-400 text-xs font-normal ml-2">(Optional, but recommended)</span>
            </label>

            {!courtOrderUrl ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-gray-300 transition-colors">
                <input
                  type="file"
                  id="court-order-upload"
                  accept=".pdf,image/jpeg,image/png,image/jpg"
                  onChange={handleFileUpload}
                  disabled={uploading || submitting}
                  className="hidden"
                />
                <label
                  htmlFor="court-order-upload"
                  className={`cursor-pointer ${
                    uploading || submitting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {uploading ? "Uploading..." : "Click to upload court order or legal document"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PDF, JPG, or PNG (max 10MB)
                  </p>
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 rounded-xl border" style={{ backgroundColor: `${TEAL}08`, borderColor: `${TEAL}30` }}>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" style={{ color: TEAL }} />
                  <span className="text-sm font-medium" style={{ color: NAVY }}>
                    Document uploaded successfully
                  </span>
                </div>
                <button
                  onClick={() => setCourtOrderUrl("")}
                  disabled={submitting}
                  className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Legal Notice */}
          <div className="p-4 rounded-xl border border-gray-100" style={{ backgroundColor: `${TEAL}08` }}>
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: TEAL }} />
              <div className="text-xs" style={{ color: NAVY }}>
                <p className="font-semibold mb-1.5">Important Legal Notice:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>All disclosure requests are logged and audited</li>
                  <li>False or fraudulent requests may result in legal action</li>
                  <li>VoxWel reserves the right to verify all legal documentation</li>
                  <li>Processing time typically 5-10 business days</li>
                  <li>You will be notified when your request is reviewed</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || legalJustification.length < 100}
              className="px-5 py-2.5 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              style={{ backgroundColor: submitting || legalJustification.length < 100 ? "#9CA3AF" : NAVY }}
            >
              {submitting ? "Submitting..." : "Submit Legal Request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalRequestModal;
