import React, { useState, useEffect } from "react";
import {
  Scale,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  getAllLegalRequests,
  getLegalRequest,
  reviewLegalRequest,
  fulfillLegalRequest,
  getLegalRequestStats,
} from "../../services/legalRequestService";
import {
  LegalRequestStatus,
  LegalRequestStatusConfig,
  LegalRequestTypeConfig,
  DisclosureMethod,
  DisclosureMethodConfig,
} from "../../utils/constants";
import { downloadEvidencePackageWithFormat } from "../../services/legalEvidenceService";

const SuperAdminLegalRequests = () => {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [disclosureMethod, setDisclosureMethod] = useState(DisclosureMethod.ENCRYPTED_EMAIL);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      // Map active tab to status
      let status = null;
      if (activeTab === "pending") status = LegalRequestStatus.PENDING;
      else if (activeTab === "under_review") status = LegalRequestStatus.UNDER_REVIEW;
      else if (activeTab === "approved") status = LegalRequestStatus.APPROVED;
      else if (activeTab === "rejected") status = LegalRequestStatus.REJECTED;
      else if (activeTab === "fulfilled") status = LegalRequestStatus.FULFILLED;

      const requestsData = await getAllLegalRequests(status);
      setRequests(requestsData);

      // Fetch stats
      const statsData = await getLegalRequestStats();
      setStats(statsData);
    } catch (err) {
      console.error("Error fetching legal requests:", err);
      setError("Failed to load legal requests. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequest = async (requestId) => {
    try {
      const request = await getLegalRequest(requestId);
      setSelectedRequest(request);
    } catch (err) {
      console.error("Error fetching request details:", err);
      alert("Failed to load request details");
    }
  };

  const openReviewModal = (request, action) => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewNotes("");
    setRejectionReason("");
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setSelectedRequest(null);
    setReviewAction(null);
    setReviewNotes("");
    setRejectionReason("");
  };

  const handleSubmitReview = async () => {
    if (!selectedRequest || !reviewAction) return;

    // Validate inputs
    if (reviewAction === "approve" && !reviewNotes.trim()) {
      alert("Please provide approval notes");
      return;
    }
    if (reviewAction === "reject" && !rejectionReason.trim()) {
      alert("Please provide rejection reason");
      return;
    }

    setSubmitting(true);

    try {
      const reviewData = {
        reviewedBy: userData.displayName || userData.username,
        reviewedByUserId: userData.id,
        status: reviewAction === "approve" ? LegalRequestStatus.APPROVED : LegalRequestStatus.REJECTED,
        approvalNotes: reviewAction === "approve" ? reviewNotes : null,
        rejectionReason: reviewAction === "reject" ? rejectionReason : null,
        disclosureMethod: reviewAction === "approve" ? disclosureMethod : null,
      };

      await reviewLegalRequest(selectedRequest.id, reviewData);

      alert(
        reviewAction === "approve"
          ? "Legal request approved successfully"
          : "Legal request rejected"
      );

      closeReviewModal();
      fetchData();
    } catch (err) {
      console.error("Error submitting review:", err);
      alert("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadCourtOrder = (url) => {
    if (url) {
      window.open(url, "_blank");
    } else {
      alert("No court order document available");
    }
  };

  const handleDownloadEvidencePackage = async (request, format = "json") => {
    try {
      await downloadEvidencePackageWithFormat(
        request.reportId,
        request.companyId,
        format
      );
    } catch (err) {
      console.error("Error downloading evidence package:", err);
      alert("Failed to download evidence package");
    }
  };

  const renderStats = () => {
    if (!stats) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <FileText className="w-6 h-6 text-gray-500" />
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">Pending</p>
              <p className="text-2xl font-bold text-yellow-900 mt-1">{stats.pending}</p>
            </div>
            <Clock className="w-6 h-6 text-yellow-500" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Under Review</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{stats.underReview}</p>
            </div>
            <Eye className="w-6 h-6 text-blue-500" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Approved</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{stats.approved}</p>
            </div>
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Rejected</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{stats.rejected}</p>
            </div>
            <XCircle className="w-6 h-6 text-red-500" />
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-600 font-medium">Fulfilled</p>
              <p className="text-2xl font-bold text-indigo-900 mt-1">{stats.fulfilled}</p>
            </div>
            <Shield className="w-6 h-6 text-indigo-500" />
          </div>
        </div>
      </div>
    );
  };

  const renderRequestsList = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-gray-600 mt-2">Loading legal requests...</p>
        </div>
      );
    }

    if (requests.length === 0) {
      return (
        <div className="text-center py-12">
          <Scale className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No requests in this category</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {requests.map((request) => {
          const statusConfig = LegalRequestStatusConfig[request.status];
          const typeConfig = LegalRequestTypeConfig[request.requestType];
          const createdDate = request.createdAt;

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

              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Requested By</p>
                  <p className="text-sm font-medium text-gray-900">
                    {request.requestedBy}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Company ID</p>
                  <p className="text-sm font-medium text-gray-900">
                    {request.companyId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Report ID</p>
                  <p className="text-sm font-medium text-gray-900">
                    {request.reportId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Created Date</p>
                  <p className="text-sm font-medium text-gray-900">
                    {createdDate?.toLocaleDateString() || "N/A"}
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

              {/* Review Info (if reviewed) */}
              {request.reviewedBy && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Reviewed by: {request.reviewedBy}
                  </p>
                  <p className="text-xs text-blue-700">
                    {request.reviewedAt?.toLocaleString() || "N/A"}
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

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex space-x-2">
                  {request.courtOrderUrl && (
                    <button
                      onClick={() => handleDownloadCourtOrder(request.courtOrderUrl)}
                      className="flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded hover:bg-blue-200 transition-colors"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      View Court Order
                    </button>
                  )}
                  <button
                    onClick={() => handleDownloadEvidencePackage(request, "pdf")}
                    className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download Evidence (PDF)
                  </button>
                </div>

                <div className="flex space-x-2">
                  {request.status === LegalRequestStatus.PENDING && (
                    <>
                      <button
                        onClick={() => openReviewModal(request, "approve")}
                        className="flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </button>
                      <button
                        onClick={() => openReviewModal(request, "reject")}
                        className="flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderReviewModal = () => {
    if (!showReviewModal || !selectedRequest) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {reviewAction === "approve" ? "Approve" : "Reject"} Legal Request
              </h2>
              <button
                onClick={closeReviewModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Request Summary */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
              <h3 className="font-medium text-gray-900 mb-2">Request Summary</h3>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-gray-600">Type:</span>{" "}
                  <span className="font-medium">
                    {LegalRequestTypeConfig[selectedRequest.requestType]?.label}
                  </span>
                </p>
                <p>
                  <span className="text-gray-600">Requested By:</span>{" "}
                  <span className="font-medium">{selectedRequest.requestedBy}</span>
                </p>
                <p>
                  <span className="text-gray-600">Report ID:</span>{" "}
                  <span className="font-medium">{selectedRequest.reportId}</span>
                </p>
              </div>
            </div>

            {/* Review Form */}
            {reviewAction === "approve" ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approval Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Provide justification for approval and any conditions..."
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Disclosure Method
                  </label>
                  <select
                    value={disclosureMethod}
                    onChange={(e) => setDisclosureMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {Object.values(DisclosureMethod).map((method) => (
                      <option key={method} value={method}>
                        {DisclosureMethodConfig[method]?.icon}{" "}
                        {DisclosureMethodConfig[method]?.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded mb-4">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                    <div className="text-sm text-green-800">
                      <p className="font-medium mb-1">Important:</p>
                      <p>
                        By approving this request, you authorize the disclosure of sensitive information.
                        Ensure all legal requirements are met before proceeding.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Explain why this request is being rejected..."
                  />
                </div>

                <div className="p-4 bg-red-50 border border-red-200 rounded mb-4">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                    <div className="text-sm text-red-800">
                      <p className="font-medium mb-1">Note:</p>
                      <p>
                        The requesting company will be notified of this rejection and the reason provided.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeReviewModal}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submitting}
                className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                  reviewAction === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {submitting ? "Submitting..." : reviewAction === "approve" ? "Approve Request" : "Reject Request"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <Scale className="w-8 h-8 text-indigo-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">
              Legal Disclosure Requests
            </h1>
          </div>
          <p className="text-gray-600">
            Review and manage court-ordered information disclosure requests
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Stats */}
        {renderStats()}

        {/* Tabs */}
        <div className="bg-white border border-gray-200 rounded-lg mb-6">
          <nav className="flex -mb-px">
            {[
              { id: "pending", label: "Pending", count: stats?.pending },
              { id: "under_review", label: "Under Review", count: stats?.underReview },
              { id: "approved", label: "Approved", count: stats?.approved },
              { id: "rejected", label: "Rejected", count: stats?.rejected },
              { id: "fulfilled", label: "Fulfilled", count: stats?.fulfilled },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Requests List */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          {renderRequestsList()}
        </div>

        {/* Review Modal */}
        {renderReviewModal()}
      </div>
    </div>
  );
};

export default SuperAdminLegalRequests;
