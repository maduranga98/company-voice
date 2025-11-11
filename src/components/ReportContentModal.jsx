import React, { useState } from "react";
import { X } from "lucide-react";
import { ReportReason, ReportReasonConfig, ReportableContentType } from "../utils/constants";
import { createContentReport } from "../services/moderationService";
import { useAuth } from "../contexts/AuthContext";

const ReportContentModal = ({ isOpen, onClose, contentType, contentId, companyId }) => {
  const { currentUser } = useAuth();
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
      await createContentReport({
        contentType,
        contentId,
        reason,
        description: description.trim(),
        reportedBy: currentUser.uid,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Report {contentType === ReportableContentType.POST ? "Post" : "Comment"}
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mx-6 mt-4 p-4 bg-green-100 border border-green-300 rounded-lg">
            <p className="text-green-800 font-medium">
              Thank you. This has been reported to moderators.
            </p>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="p-6">
            {/* Reason Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Why are you reporting this content? *
              </label>
              <div className="space-y-2">
                {Object.values(ReportReason).map((reasonKey) => {
                  const config = ReportReasonConfig[reasonKey];
                  return (
                    <label
                      key={reasonKey}
                      className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                        reason === reasonKey
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={reasonKey}
                        checked={reason === reasonKey}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                        disabled={isSubmitting}
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{config.icon}</span>
                          <span className="font-medium text-gray-900">{config.label}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{config.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Description (Optional/Required for "Other") */}
            <div className="mb-4">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Additional details {reason === ReportReason.OTHER && "*"}
                <span className="text-gray-500 font-normal ml-1">(500 characters max)</span>
              </label>
              <textarea
                id="description"
                rows={4}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                placeholder="Provide any additional context that might help moderators review this report..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                {description.length}/500
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Info */}
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Reports are reviewed by company moderators. You will be notified when action is
                taken.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !reason}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
