import React, { useState } from "react";
import { Scale, XCircle, AlertTriangle, FileText, Upload } from "lucide-react";
import {
  LegalRequestType,
  LegalRequestTypeConfig,
} from "../utils/constants";
import { createLegalRequest } from "../services/legalRequestService";

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
      // In a real implementation, you would upload to Firebase Storage
      // For now, we'll just store a placeholder URL
      // This is a simplified version - in production, implement proper file upload

      // Example Firebase Storage upload:
      // const storage = getStorage();
      // const storageRef = ref(storage, `court-orders/${companyId}/${Date.now()}-${file.name}`);
      // const snapshot = await uploadBytes(storageRef, file);
      // const downloadURL = await getDownloadURL(snapshot.ref);
      // setCourtOrderUrl(downloadURL);

      // For now, create a data URL (not recommended for production)
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Scale className="w-6 h-6 text-indigo-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">
                Request Legal Disclosure
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Warning Banner */}
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg mb-6">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-orange-800">
                <p className="font-medium mb-1">Legal Disclosure Process</p>
                <p>
                  This request will be reviewed by VoxWel's legal team. All requests must be
                  accompanied by valid legal documentation (court order, subpoena, etc.).
                  Frivolous or improper requests may result in penalties.
                </p>
              </div>
            </div>
          </div>

          {/* Report Information */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3">Report Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Report ID:</span>
                <span className="ml-2 font-medium text-gray-900">{report.id}</span>
              </div>
              <div>
                <span className="text-gray-600">Content Type:</span>
                <span className="ml-2 font-medium text-gray-900 capitalize">
                  {report.contentType}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Reason:</span>
                <span className="ml-2 font-medium text-gray-900 capitalize">
                  {report.reason}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <span className="ml-2 font-medium text-gray-900 capitalize">
                  {report.status}
                </span>
              </div>
            </div>
          </div>

          {/* Request Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Request Type <span className="text-red-500">*</span>
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {Object.values(LegalRequestType).map((type) => (
                <option key={type} value={type}>
                  {LegalRequestTypeConfig[type]?.icon} {LegalRequestTypeConfig[type]?.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {LegalRequestTypeConfig[requestType]?.description}
            </p>
          </div>

          {/* Legal Justification */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Legal Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              value={legalJustification}
              onChange={(e) => setLegalJustification(e.target.value)}
              disabled={submitting}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="Provide detailed legal justification for this disclosure request. Include:&#10;- Case number and jurisdiction&#10;- Legal basis for the request&#10;- Specific information being requested&#10;- Relevant statutes or court orders&#10;&#10;Minimum 100 characters required."
            />
            <p className="text-xs text-gray-500 mt-1">
              {legalJustification.length} / 100 minimum characters
            </p>
          </div>

          {/* Court Order Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Court Order / Legal Document
              <span className="text-gray-500 text-xs ml-2">(Optional, but recommended)</span>
            </label>

            {!courtOrderUrl ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
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
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {uploading ? "Uploading..." : "Click to upload court order or legal document"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF, JPG, or PNG (max 10MB)
                  </p>
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-sm text-green-800 font-medium">
                    Document uploaded successfully
                  </span>
                </div>
                <button
                  onClick={() => setCourtOrderUrl("")}
                  disabled={submitting}
                  className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Legal Notice */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">Important Legal Notice:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>All disclosure requests are logged and audited</li>
                <li>False or fraudulent requests may result in legal action</li>
                <li>VoxWel reserves the right to verify all legal documentation</li>
                <li>Processing time typically 5-10 business days</li>
                <li>You will be notified when your request is reviewed</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || legalJustification.length < 100}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
