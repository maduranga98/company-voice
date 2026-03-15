import React, { useState } from "react";
import { X, Flag, AlertCircle, CheckCircle, Info } from "lucide-react";
import {
  ReportReason,
  ReportReasonConfig,
  ReportableContentType,
} from "../utils/constants";
import { createContentReport } from "../services/moderationService";
import { useAuth } from "../contexts/AuthContext";

const NAVY = "#2D3E50";
const TEAL = "#1ABC9C";

const ReportContentModal = ({
  isOpen,
  onClose,
  contentType,
  contentId,
  companyId,
}) => {
  const { userData } = useAuth();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!reason) {
      setError("Please select a reason for reporting this content");
      return;
    }

    if (reason === ReportReason.OTHER && !description.trim()) {
      setError("Please provide a description when selecting 'Other'");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!userData?.id) {
        setError("You must be logged in to report content");
        setIsSubmitting(false);
        return;
      }

      await createContentReport({
        contentType,
        contentId,
        reason,
        description: description.trim(),
        reportedBy: userData.id,
        companyId,
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        // Reset form
        setReason("");
        setDescription("");
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Error submitting report:", err);
      setError(err.message || "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason("");
      setDescription("");
      setError("");
      setSuccess(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${NAVY}10` }}
            >
              <Flag className="w-4.5 h-4.5" style={{ color: NAVY }} />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
              Report{" "}
              {contentType === ReportableContentType.POST ? "Post" : "Comment"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl p-2 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mx-6 mt-5 p-4 rounded-xl border border-emerald-200" style={{ backgroundColor: "#f0fdf9" }}>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: TEAL }} />
              <p className="text-sm font-medium" style={{ color: NAVY }}>
                Thank you. This has been reported to moderators.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="p-6">
            {/* Reason Selection */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2.5" style={{ color: NAVY }}>
                Why are you reporting this content? *
              </label>
              <div className="space-y-2">
                {Object.values(ReportReason).map((reasonKey) => {
                  const config = ReportReasonConfig[reasonKey];
                  return (
                    <label
                      key={reasonKey}
                      className={`flex items-start p-3.5 border rounded-xl cursor-pointer transition-all ${
                        reason === reasonKey
                          ? "border-[#1ABC9C] bg-[#1ABC9C]/5 shadow-sm"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={reasonKey}
                        checked={reason === reasonKey}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-1 h-4 w-4 rounded-full"
                        style={{ accentColor: TEAL }}
                        disabled={isSubmitting}
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{config.icon}</span>
                          <span className="font-medium text-sm" style={{ color: NAVY }}>
                            {config.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {config.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div className="mb-5">
              <label
                htmlFor="description"
                className="block text-sm font-medium mb-2"
                style={{ color: NAVY }}
              >
                Additional details {reason === ReportReason.OTHER && "*"}
                <span className="text-gray-400 font-normal ml-1">
                  (500 characters max)
                </span>
              </label>
              <textarea
                id="description"
                rows={4}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                placeholder="Provide any additional context that might help moderators review this report..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed transition-shadow"
                style={{ "--tw-ring-color": TEAL }}
              />
              <div className="text-xs text-gray-400 mt-1.5 text-right">
                {description.length}/500
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="mb-6 p-3.5 rounded-xl border border-gray-100" style={{ backgroundColor: `${TEAL}08` }}>
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4 flex-shrink-0" style={{ color: TEAL }} />
                <p className="text-xs" style={{ color: NAVY }}>
                  Reports are reviewed by company moderators. You will be notified
                  when action is taken.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !reason}
                className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                style={{ backgroundColor: isSubmitting || !reason ? "#9CA3AF" : "#EF4444" }}
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportContentModal;
