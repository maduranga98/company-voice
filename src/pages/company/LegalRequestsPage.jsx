import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Scale,
  Upload,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  createLegalRequest,
  getCompanyLegalRequests,
} from "../../services/legalRequestService";
import {
  LegalRequestType,
  LegalRequestTypeConfig,
  LegalRequestStatus,
  LegalRequestStatusConfig,
} from "../../utils/constants";
import { uploadCourtOrder } from "../../services/legalEvidenceService";
import BackButton from "../../components/BackButton";

const LegalRequestsPage = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    requestType: LegalRequestType.COURT_ORDER,
    reportId: "",
    legalJustification: "",
    courtOrderFile: null,
  });

  useEffect(() => {
    if (userData?.companyId) {
      fetchRequests();
    }
  }, [userData]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getCompanyLegalRequests(userData.companyId);
      setRequests(data);
    } catch (err) {
      console.error("Error fetching legal requests:", err);
      setError("Failed to load legal requests");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type (PDF only)
      if (file.type !== "application/pdf") {
        setError("Only PDF files are allowed for court orders");
        e.target.value = "";
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        e.target.value = "";
        return;
      }
      setFormData((prev) => ({
        ...prev,
        courtOrderFile: file,
      }));
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      let courtOrderUrl = null;

      // Upload court order document if provided
      if (formData.courtOrderFile) {
        courtOrderUrl = await uploadCourtOrder(
          formData.courtOrderFile,
          userData.companyId
        );
      }

      // Create legal request
      const requestData = {
        requestType: formData.requestType,
        companyId: userData.companyId,
        reportId: formData.reportId,
        legalJustification: formData.legalJustification,
        courtOrderUrl: courtOrderUrl,
        requestedBy: userData.displayName || userData.username,
        requestedByUserId: userData.id,
      };

      await createLegalRequest(requestData);

      setSuccess("Legal request submitted successfully!");
      setShowCreateModal(false);
      setFormData({
        requestType: LegalRequestType.COURT_ORDER,
        reportId: "",
        legalJustification: "",
        courtOrderFile: null,
      });
      fetchRequests();

      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      console.error("Error submitting legal request:", err);
      setError(err.message || "Failed to submit legal request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderRequestsList = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-gray-600 mt-2">Loading requests...</p>
        </div>
      );
    }

    if (requests.length === 0) {
      return (
        <div className="text-center py-12">
          <Scale className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Legal Requests Yet
          </h3>
          <p className="text-gray-600 mb-4">
            Submit a request when you need to disclose information for legal purposes
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {requests.map((request) => {
          const statusConfig = LegalRequestStatusConfig[request.status];
          const typeConfig = LegalRequestTypeConfig[request.requestType];
          const createdDate = request.createdAt?.toDate
            ? request.createdAt.toDate()
            : new Date(request.createdAt);

          return (
            <div
              key={request.id}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{typeConfig?.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {typeConfig?.label}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Request ID: {request.id}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 ${statusConfig.bgColor} ${statusConfig.textColor} text-sm font-medium rounded-full`}
                >
                  {statusConfig.label}
                </span>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Report ID</p>
                  <p className="text-sm font-medium text-gray-900">
                    {request.reportId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Submitted By</p>
                  <p className="text-sm font-medium text-gray-900">
                    {request.requestedBy}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Submitted Date</p>
                  <p className="text-sm font-medium text-gray-900">
                    {createdDate.toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Justification */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Legal Justification</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                  {request.legalJustification}
                </p>
              </div>

              {/* Review Info */}
              {request.reviewedBy && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded mb-4">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Reviewed by: {request.reviewedBy}
                  </p>
                  <p className="text-xs text-blue-700">
                    {request.reviewedAt?.toDate
                      ? request.reviewedAt.toDate().toLocaleString()
                      : "N/A"}
                  </p>
                  {request.approvalNotes && (
                    <p className="text-sm text-blue-800 mt-2">
                      Notes: {request.approvalNotes}
                    </p>
                  )}
                  {request.rejectionReason && (
                    <p className="text-sm text-red-800 mt-2">
                      Reason: {request.rejectionReason}
                    </p>
                  )}
                </div>
              )}

              {/* Court Order Link */}
              {request.courtOrderUrl && (
                <div className="flex items-center pt-3 border-t border-gray-200">
                  <button
                    onClick={() => window.open(request.courtOrderUrl, "_blank")}
                    className="flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded hover:bg-blue-200 transition-colors"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    View Court Order
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <BackButton to="/company/dashboard" label="Back to Dashboard" />
        </div>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center mb-2">
              <Scale className="w-8 h-8 text-indigo-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">
                Legal Disclosure Requests
              </h1>
            </div>
            <p className="text-gray-600">
              Submit and track court-ordered information disclosure requests
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Request
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Requests List */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Your Legal Requests
          </h2>
          {renderRequestsList()}
        </div>
      </div>

      {/* Create Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Submit Legal Disclosure Request
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setError("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Info Box */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Important Information:</p>
                    <p>
                      Legal disclosure requests are reviewed by VoxWel administrators.
                      You must provide a valid court order and legal justification.
                      Only approved requests will result in information disclosure.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Request Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Request Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="requestType"
                    value={formData.requestType}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Object.values(LegalRequestType).map((type) => (
                      <option key={type} value={type}>
                        {LegalRequestTypeConfig[type]?.icon}{" "}
                        {LegalRequestTypeConfig[type]?.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Report ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report/Post ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="reportId"
                    value={formData.reportId}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter the report or post ID"
                  />
                </div>

                {/* Legal Justification */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Legal Justification <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="legalJustification"
                    value={formData.legalJustification}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Provide detailed legal justification for this request, including case number, court jurisdiction, and specific information needed..."
                  />
                </div>

                {/* Court Order Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Court Order Document (PDF) <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                        >
                          <span>Upload a file</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            accept=".pdf"
                            required
                            className="sr-only"
                            onChange={handleFileChange}
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PDF up to 10MB</p>
                      {formData.courtOrderFile && (
                        <p className="text-sm text-green-600 mt-2">
                          ✓ {formData.courtOrderFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setError("");
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegalRequestsPage;
