import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Flag,
  User,
  AlertTriangle,
  FileText,
  Scale,
  Download,
  Shield,
  Clock,
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle,
  Hash,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  getReportById,
  reviewReport,
} from "../services/moderationService";
import {
  ReportReasonConfig,
  ReportStatusConfig,
  ModerationActionType,
  ModerationActionConfig,
  ReportableContentType,
  UserRole,
} from "../utils/constants";
import { downloadEvidencePackageWithFormat } from "../services/legalEvidenceService";
import LegalRequestModal from "../components/LegalRequestModal";
import { showSuccess, showError, showWarning } from "../services/toastService";

const ACTION_STYLES = {
  [ModerationActionType.DISMISS]: {
    label: "Dismiss",
    description: "No violation found",
    icon: "✓",
    card: "bg-slate-50 border border-slate-200 hover:border-slate-400 hover:bg-slate-100",
    confirm: "bg-slate-700 hover:bg-slate-800 text-white",
    badge: "bg-slate-100 text-slate-700",
  },
  [ModerationActionType.REMOVE_CONTENT]: {
    label: "Remove",
    description: "Remove without strike",
    icon: "🗑️",
    card: "bg-orange-50 border border-orange-200 hover:border-orange-400 hover:bg-orange-100",
    confirm: "bg-orange-600 hover:bg-orange-700 text-white",
    badge: "bg-orange-100 text-orange-700",
  },
  [ModerationActionType.REMOVE_AND_WARN]: {
    label: "Remove & Warn",
    description: "Remove + issue strike",
    icon: "⚠️",
    card: "bg-amber-50 border border-amber-200 hover:border-amber-400 hover:bg-amber-100",
    confirm: "bg-amber-600 hover:bg-amber-700 text-white",
    badge: "bg-amber-100 text-amber-700",
  },
  [ModerationActionType.ESCALATE]: {
    label: "Escalate",
    description: "Send to Super Admin",
    icon: "⬆️",
    card: "bg-purple-50 border border-purple-200 hover:border-purple-400 hover:bg-purple-100",
    confirm: "bg-purple-600 hover:bg-purple-700 text-white",
    badge: "bg-purple-100 text-purple-700",
  },
  [ModerationActionType.REMOVE_AND_SUSPEND]: {
    label: "Suspend",
    description: "Remove + suspend 30 days",
    icon: "🔒",
    card: "bg-red-50 border border-red-200 hover:border-red-400 hover:bg-red-100",
    confirm: "bg-red-600 hover:bg-red-700 text-white",
    badge: "bg-red-100 text-red-700",
  },
};

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  reviewing: "bg-blue-50 text-blue-700 border border-blue-200",
  resolved: "bg-green-50 text-green-700 border border-green-200",
  dismissed: "bg-slate-50 text-slate-600 border border-slate-200",
  escalated: "bg-purple-50 text-purple-700 border border-purple-200",
};

const ReportDetailView = () => {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);

  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [moderatorNotes, setModeratorNotes] = useState("");
  const [violationType, setViolationType] = useState("");
  const [explanation, setExplanation] = useState("");

  const [showLegalRequestModal, setShowLegalRequestModal] = useState(false);
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
    setModeratorNotes("");
    setViolationType("");
    setExplanation("");
    setShowActionModal(true);
  };

  const handleSubmitAction = async () => {
    if (!selectedAction) return;
    if (!moderatorNotes.trim()) {
      showWarning("Please provide moderator notes");
      return;
    }
    if (
      [ModerationActionType.REMOVE_AND_WARN, ModerationActionType.REMOVE_AND_SUSPEND].includes(selectedAction)
    ) {
      if (!violationType.trim()) {
        showWarning("Please specify the violation type");
        return;
      }
      if (!explanation.trim()) {
        showWarning("Please provide an explanation for the user");
        return;
      }
    }

    setActionInProgress(true);
    try {
      await reviewReport({
        reportId: report.id,
        actionType: selectedAction,
        moderatorId: userData.id || userData.uid,
        moderatorName: userData.displayName,
        companyId: userData.companyId,
        moderatorNotes: moderatorNotes.trim(),
        violationType: violationType.trim(),
        explanation: explanation.trim(),
      });
      showSuccess("Action completed successfully");
      navigate("/moderation");
    } catch (err) {
      console.error("Error taking action:", err);
      showError(err.message || "Failed to complete action. Please try again.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleExportEvidence = async (format) => {
    if (!userData?.companyId || !report?.id) return;
    setExportingEvidence(true);
    try {
      await downloadEvidencePackageWithFormat(report.id, userData.companyId, format);
      showSuccess(`Evidence package exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error("Error exporting evidence:", err);
      showError(err.message || "Failed to export evidence package.");
    } finally {
      setExportingEvidence(false);
    }
  };

  const canRequestLegalDisclosure = () =>
    [UserRole.COMPANY_ADMIN, UserRole.HR].includes(userData?.role);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#1ABC9C] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-900 font-semibold mb-1">{error || "Report not found"}</p>
          <button
            onClick={() => navigate("/moderation")}
            className="text-sm text-[#1ABC9C] hover:text-[#17a589] font-medium"
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
  const isActioned = ["resolved", "dismissed"].includes(report.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

        {/* Back button */}
        <button
          onClick={() => navigate("/moderation")}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl">
              {reasonConfig?.icon || "🚩"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{reasonConfig?.label || "Report"}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">
                  {createdDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  {" · "}
                  {createdDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          </div>
          <span className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex-shrink-0 ${STATUS_STYLES[report.status] || "bg-gray-100 text-gray-600"}`}>
            {statusConfig?.label || report.status}
          </span>
        </div>

        <div className="space-y-4">

          {/* Reported Content Card */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Reported Content</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg font-medium">
                  {report.contentType === ReportableContentType.POST ? "Post" : "Comment"}
                </span>
                {report.totalReportsForContent > 0 && (
                  <span className="text-xs px-2.5 py-1 bg-red-50 text-red-600 rounded-lg font-medium">
                    {report.totalReportsForContent} report{report.totalReportsForContent !== 1 ? "s" : ""}
                    {report.previouslyActionedForContent > 0 && ` · ${report.previouslyActionedForContent} actioned`}
                  </span>
                )}
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-800 leading-relaxed">{report.contentPreview}</p>

              {/* Full post content */}
              {report.content && report.contentType === ReportableContentType.POST && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Full Post</p>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{report.content.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
                    {report.content.description || report.content.content}
                  </p>
                  {report.content.tags && report.content.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {report.content.tags.map((tag, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-lg">
                          <Hash className="w-2.5 h-2.5" />{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {report.content && report.contentType !== ReportableContentType.POST && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Full Comment</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {report.content.text}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reporter's Explanation */}
          {report.description && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Flag className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Reporter's Explanation</h2>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-700 leading-relaxed">{report.description}</p>
              </div>
            </div>
          )}

          {/* Content Author Card */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Content Author</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {(report.contentAuthorName || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{report.contentAuthorName || "Unknown"}</p>
                  {report.authorHistory?.currentStrikeCount > 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-0.5">
                      {report.authorHistory.currentStrikeCount}/3 strikes
                    </p>
                  )}
                </div>
              </div>

              {report.authorHistory && (
                <>
                  {report.authorHistory.activeRestrictions?.length > 0 && (
                    <div className="mb-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-xs font-medium text-red-700">Account currently has active restrictions</p>
                    </div>
                  )}

                  {report.authorHistory.strikes?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Strike History
                      </p>
                      <div className="space-y-1.5">
                        {report.authorHistory.strikes.slice(0, 3).map((strike, idx) => (
                          <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl">
                            <span className="text-xs font-bold text-amber-700">Strike {strike.strikeLevel}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-600">{strike.violationType}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Moderator Actions */}
          {!isActioned && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Moderator Actions</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    ModerationActionType.DISMISS,
                    ModerationActionType.REMOVE_CONTENT,
                    ModerationActionType.REMOVE_AND_WARN,
                    ModerationActionType.ESCALATE,
                    ModerationActionType.REMOVE_AND_SUSPEND,
                  ].map((actionType) => {
                    const style = ACTION_STYLES[actionType];
                    const config = ModerationActionConfig[actionType];
                    return (
                      <button
                        key={actionType}
                        onClick={() => handleActionClick(actionType)}
                        className={`w-full p-4 rounded-2xl text-left transition-all group ${style.card}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base">{style.icon}</span>
                              <span className="text-sm font-semibold text-gray-900">{style.label}</span>
                            </div>
                            <p className="text-xs text-gray-500">{style.description}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-0.5 transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Legal & Evidence Card */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Scale className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Legal & Evidence</h2>
            </div>
            <div className="p-5">
              {report.legalHold && (
                <div className="mb-4 flex items-start gap-3 p-3.5 bg-orange-50 border border-orange-200 rounded-2xl">
                  <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-orange-900">Legal Hold Active</p>
                    <p className="text-xs text-orange-700 mt-0.5">
                      Retained for {report.retentionYears || 7} years
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleExportEvidence("json")}
                  disabled={exportingEvidence}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-2xl transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {exportingEvidence ? "Exporting..." : "Export JSON"}
                </button>

                <button
                  onClick={() => handleExportEvidence("pdf")}
                  disabled={exportingEvidence}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-2xl transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  {exportingEvidence ? "Exporting..." : "Export PDF"}
                </button>

                {canRequestLegalDisclosure() && (
                  <button
                    onClick={() => setShowLegalRequestModal(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-2xl transition-colors text-sm font-medium"
                  >
                    <Scale className="w-4 h-4" />
                    Legal Disclosure
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Action Modal */}
      {showActionModal && selectedAction && (() => {
        const style = ACTION_STYLES[selectedAction];
        const actionConfig = ModerationActionConfig[selectedAction];
        const needsExtra = [ModerationActionType.REMOVE_AND_WARN, ModerationActionType.REMOVE_AND_SUSPEND].includes(selectedAction);
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between p-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{style.icon}</span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{actionConfig.label}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{actionConfig.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowActionModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Moderator Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Moderator Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={moderatorNotes}
                    onChange={(e) => setModeratorNotes(e.target.value)}
                    placeholder="Internal notes for the moderation team..."
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] focus:border-transparent placeholder-gray-400 resize-none"
                  />
                </div>

                {/* Violation Type & Explanation (warns/suspensions) */}
                {needsExtra && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Violation Type <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={violationType}
                        onChange={(e) => setViolationType(e.target.value)}
                        placeholder="e.g., Harassment, Inappropriate Content"
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] focus:border-transparent placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Explanation for User <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={explanation}
                        onChange={(e) => setExplanation(e.target.value)}
                        placeholder="This will be sent to the user in their notification..."
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] focus:border-transparent placeholder-gray-400 resize-none"
                      />
                    </div>

                    {selectedAction === ModerationActionType.REMOVE_AND_WARN && (
                      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                        <p className="text-xs font-semibold text-amber-800 mb-1.5">Strike consequences:</p>
                        <ul className="space-y-1 text-xs text-amber-700">
                          <li>• Strike 1: Warning notification</li>
                          <li>• Strike 2: 7-day posting restriction</li>
                          <li>• Strike 3: 30-day account suspension</li>
                        </ul>
                      </div>
                    )}

                    {selectedAction === ModerationActionType.REMOVE_AND_SUSPEND && (
                      <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl">
                        <p className="text-xs font-semibold text-red-800 mb-1">
                          Immediate 30-day suspension
                        </p>
                        <p className="text-xs text-red-700">
                          This bypasses the strike system and immediately suspends the user's account.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {selectedAction === ModerationActionType.ESCALATE && (
                  <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl">
                    <p className="text-xs text-purple-800">
                      This report will be forwarded to Super Admins for review along with your notes.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 p-5 border-t border-gray-100">
                <button
                  onClick={() => setShowActionModal(false)}
                  disabled={actionInProgress}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAction}
                  disabled={actionInProgress}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2 ${style.confirm}`}
                >
                  {actionInProgress ? (
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Confirm Action"
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
