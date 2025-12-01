import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Flag, User, Calendar, AlertTriangle, FileText, Scale, Download } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  getReportById,
  reviewReport,
  getUserModerationHistory,
} from "../services/moderationService";
import {
  ReportReasonConfig,
  ReportStatusConfig,
  ModerationActionType,
  ModerationActionConfig,
  ReportableContentType,
  StrikeConfig,
  UserRole,
} from "../utils/constants";
import { downloadEvidencePackageWithFormat } from "../services/legalEvidenceService";
import LegalRequestModal from "../components/LegalRequestModal";

const ReportDetailView = () => {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);

  // Action modal state
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [moderatorNotes, setModeratorNotes] = useState("");
  const [violationType, setViolationType] = useState("");
  const [explanation, setExplanation] = useState("");

  // Legal request modal state
  const [showLegalRequestModal, setShowLegalRequestModal] = useState(false);

  // Evidence export state
  const [exportingEvidence, setExportingEvidence] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [reportId]);

  const fetchReport = async () => {
    setLoading(true);
    setError("");

    try {
      const reportData = await getReportById(reportId);
      setReport(reportData);
    } catch (err) {
      console.error("Error fetching report:", err);
      setError("Failed to load report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (actionType) => {
    setSelectedAction(actionType);
    setShowActionModal(true);
  };

  const handleSubmitAction = async () => {
    if (!selectedAction) return;

    // Validation
    if (!moderatorNotes.trim()) {
      alert("Please provide moderator notes");
      return;
    }

    if (
      [
        ModerationActionType.REMOVE_AND_WARN,
        ModerationActionType.REMOVE_AND_SUSPEND,
      ].includes(selectedAction)
    ) {
      if (!violationType.trim()) {
        alert("Please specify the violation type");
        return;
      }
      if (!explanation.trim()) {
        alert("Please provide an explanation for the user");
        return;
      }
    }

    setActionInProgress(true);

    try {
      await reviewReport({
        reportId: report.id,
        actionType: selectedAction,
        moderatorId: userData.uid,
        moderatorNotes: moderatorNotes.trim(),
        violationType: violationType.trim(),
        explanation: explanation.trim(),
      });

      alert("Action completed successfully");
      navigate("/moderation");
    } catch (err) {
      console.error("Error taking action:", err);
      alert("Failed to complete action. Please try again.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleExportEvidence = async (format) => {
    if (!userData?.companyId || !report?.id) return;

    setExportingEvidence(true);

    try {
      await downloadEvidencePackageWithFormat(
        report.id,
        userData.companyId,
        format
      );
    } catch (err) {
      console.error("Error exporting evidence:", err);
      alert("Failed to export evidence package. Please try again.");
    } finally {
      setExportingEvidence(false);
    }
  };

  // Check if user can request legal disclosure
  const canRequestLegalDisclosure = () => {
    return [UserRole.COMPANY_ADMIN, UserRole.HR].includes(userData?.role);
  };

  const renderActionModal = () => {
    if (!showActionModal || !selectedAction) return null;

    const actionConfig = ModerationActionConfig[selectedAction];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {actionConfig.label}
            </h2>
            <p className="text-gray-600 mt-1">{actionConfig.description}</p>
          </div>

          <div className="p-6 space-y-4">
            {/* Moderator Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Moderator Notes *
              </label>
              <textarea
                rows={3}
                value={moderatorNotes}
                onChange={(e) => setModeratorNotes(e.target.value)}
                placeholder="Internal notes for the moderation team..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Violation Type (for warnings/suspensions) */}
            {[
              ModerationActionType.REMOVE_AND_WARN,
              ModerationActionType.REMOVE_AND_SUSPEND,
            ].includes(selectedAction) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Violation Type *
                  </label>
                  <input
                    type="text"
                    value={violationType}
                    onChange={(e) => setViolationType(e.target.value)}
                    placeholder="e.g., Harassment, Inappropriate Content"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Explanation for User *
                  </label>
                  <textarea
                    rows={3}
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="This will be sent to the user in their notification..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Strike Info */}
                {selectedAction === ModerationActionType.REMOVE_AND_WARN && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> This will issue a strike to the content author.
                    </p>
                    <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                      <li>• Strike 1: Warning notification</li>
                      <li>• Strike 2: 7-day posting restriction</li>
                      <li>• Strike 3: 30-day account suspension</li>
                    </ul>
                  </div>
                )}

                {/* Suspension Info */}
                {selectedAction === ModerationActionType.REMOVE_AND_SUSPEND && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      <strong>Warning:</strong> This will immediately suspend the user's account
                      for 30 days, bypassing the strike system.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Escalation Notes */}
            {selectedAction === ModerationActionType.ESCALATE && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-800">
                  This report will be forwarded to Super Admins for review. Your notes will be
                  included.
                </p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 flex gap-3">
            <button
              onClick={() => {
                setShowActionModal(false);
                setSelectedAction(null);
                setModeratorNotes("");
                setViolationType("");
                setExplanation("");
              }}
              disabled={actionInProgress}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitAction}
              disabled={actionInProgress}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {actionInProgress ? "Processing..." : "Confirm Action"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="text-gray-600 mt-4">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">{error || "Report not found"}</p>
          <button
            onClick={() => navigate("/moderation")}
            className="mt-4 text-indigo-600 hover:text-indigo-700"
          >
            Back to Moderation Dashboard
          </button>
        </div>
      </div>
    );
  }

  const reasonConfig = ReportReasonConfig[report.reason];
  const statusConfig = ReportStatusConfig[report.status];
  const createdDate = report.createdAt?.toDate
    ? report.createdAt.toDate()
    : new Date(report.createdAt);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <button
          onClick={() => navigate("/moderation")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          {/* Report Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{reasonConfig.icon}</span>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{reasonConfig.label}</h1>
                  <p className="text-gray-600 mt-1">
                    Reported on {createdDate.toLocaleDateString()} at{" "}
                    {createdDate.toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <span
                className={`px-4 py-2 text-sm font-medium rounded-full ${statusConfig.bgColor} ${statusConfig.textColor}`}
              >
                {statusConfig.label}
              </span>
            </div>
          </div>

          {/* Report Details */}
          <div className="p-6 space-y-6">
            {/* Content Preview */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Reported Content
              </h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {report.contentType === ReportableContentType.POST ? "Post" : "Comment"}
                  </span>
                  {report.totalReportsForContent > 1 && (
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                      {report.totalReportsForContent} reports
                    </span>
                  )}
                </div>
                <p className="text-gray-900">{report.contentPreview}</p>
                {report.content && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-sm text-gray-600">
                      Full content available in context below
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Reporter Notes */}
            {report.description && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Flag className="w-5 h-5" />
                  Reporter's Explanation
                </h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-gray-900">{report.description}</p>
                </div>
              </div>
            )}

            {/* Content Author Info */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-5 h-5" />
                Content Author Information
              </h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-900 font-medium">{report.contentAuthorName}</p>
                {report.authorHistory && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Moderation History:
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        Total Strikes: {report.authorHistory.currentStrikeCount}/3
                      </p>
                      {report.authorHistory.strikes.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            Previous Violations:
                          </p>
                          {report.authorHistory.strikes.slice(0, 3).map((strike, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-gray-600 bg-white p-2 rounded"
                            >
                              Strike {strike.strikeLevel}: {strike.violationType}
                            </div>
                          ))}
                        </div>
                      )}
                      {report.authorHistory.activeRestrictions.length > 0 && (
                        <p className="text-sm text-red-600 font-medium">
                          ⚠️ Currently has active restrictions
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {report.status !== "resolved" && report.status !== "dismissed" && (
            <div className="p-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Moderator Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <button
                  onClick={() => handleActionClick(ModerationActionType.DISMISS)}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors text-sm font-medium"
                >
                  ✓ Dismiss
                </button>
                <button
                  onClick={() => handleActionClick(ModerationActionType.REMOVE_CONTENT)}
                  className="px-4 py-3 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-lg transition-colors text-sm font-medium"
                >
                  🗑️ Remove
                </button>
                <button
                  onClick={() => handleActionClick(ModerationActionType.REMOVE_AND_WARN)}
                  className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors text-sm font-medium"
                >
                  ⚠️ Remove & Warn
                </button>
                <button
                  onClick={() => handleActionClick(ModerationActionType.ESCALATE)}
                  className="px-4 py-3 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg transition-colors text-sm font-medium"
                >
                  ⬆️ Escalate
                </button>
                <button
                  onClick={() => handleActionClick(ModerationActionType.REMOVE_AND_SUSPEND)}
                  className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  🔒 Suspend
                </button>
              </div>
            </div>
          )}

          {/* Legal & Evidence Actions */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Legal & Evidence Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Export Evidence Buttons */}
              <button
                onClick={() => handleExportEvidence("json")}
                disabled={exportingEvidence}
                className="flex items-center justify-center px-4 py-3 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-2" />
                {exportingEvidence ? "Exporting..." : "Export Evidence (JSON)"}
              </button>

              <button
                onClick={() => handleExportEvidence("pdf")}
                disabled={exportingEvidence}
                className="flex items-center justify-center px-4 py-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                <FileText className="w-4 h-4 mr-2" />
                {exportingEvidence ? "Exporting..." : "Export Evidence (PDF)"}
              </button>

              {/* Legal Request Button (only for company admins and HR) */}
              {canRequestLegalDisclosure() && (
                <button
                  onClick={() => setShowLegalRequestModal(true)}
                  className="flex items-center justify-center px-4 py-3 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg transition-colors text-sm font-medium"
                >
                  <Scale className="w-4 h-4 mr-2" />
                  Request Legal Disclosure
                </button>
              )}
            </div>

            {report.legalHold && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-900">Legal Hold Active</p>
                    <p className="text-orange-800">
                      This report is under legal hold and must be retained for {report.retentionYears || 7} years.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Modal */}
      {renderActionModal()}

      {/* Legal Request Modal */}
      <LegalRequestModal
        isOpen={showLegalRequestModal}
        onClose={() => setShowLegalRequestModal(false)}
        report={report}
        companyId={userData?.companyId}
        userData={userData}
      />
    </div>
  );
};

export default ReportDetailView;
