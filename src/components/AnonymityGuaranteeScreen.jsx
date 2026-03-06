import { useState } from "react";

const guaranteeItems = [
  "Your name is never attached to this report in our database",
  "Your report is encrypted with AES-256 military-grade encryption",
  "HR and management cannot see who submitted this report",
  "Only designated investigators have access to case details",
  "Retaliation against reporters is prohibited by company policy",
  'You can follow up on this report from "My Reports" without revealing your identity',
];

/**
 * AnonymityGuaranteeScreen
 *
 * Props:
 *   onContinue   - called when user clicks "I understand, continue anonymously"
 *                  If omitted the screen runs in info/read-only mode.
 *   onBack        - called when user clicks "← Go back" (only in normal mode)
 *   onClose       - called when user closes (used in info mode from the banner)
 *   infoMode      - boolean: if true, renders a close button instead of action buttons
 */
const AnonymityGuaranteeScreen = ({ onContinue, onBack, onClose, infoMode = false }) => {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const handleClose = () => {
    if (infoMode && onClose) onClose();
    else if (onBack) onBack();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={infoMode ? handleClose : undefined}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-lg bg-[#2D3E50] rounded-xl shadow-2xl overflow-y-auto max-h-[90vh]"
        style={{ fontFamily: "Sora, system-ui, sans-serif" }}
      >
        {/* Back / Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {infoMode ? "Close" : "Go back"}
        </button>

        <div className="px-6 pt-14 pb-6">
          {/* Shield icon + heading */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-xl bg-[#00BCD4]/10 flex items-center justify-center mb-4 border border-[#00BCD4]/20">
              <svg
                className="w-9 h-9 text-[#00BCD4]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Your Identity is Protected
            </h2>
            <p className="text-slate-400 text-sm mt-1.5 font-medium">
              Read this before you continue
            </p>
          </div>

          {/* Guarantee list */}
          <ul className="space-y-3 mb-6">
            {guaranteeItems.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-lg bg-[#00BCD4]/15 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-[#00BCD4]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-sm text-slate-200 leading-snug">{item}</span>
              </li>
            ))}
          </ul>

          {/* "How anonymity works" expandable */}
          <div className="mb-5 border border-slate-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setHowItWorksOpen((p) => !p)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
            >
              <span>How anonymity works</span>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  howItWorksOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {howItWorksOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-600">
                <p className="text-sm text-slate-300 leading-relaxed">
                  When you post anonymously, VoxWel replaces your identity with an encrypted
                  code. Even VoxWel administrators cannot see your name without a formal legal
                  process requiring court authorization and participation from your company's
                  Data Protection Officer.
                </p>
              </div>
            )}
          </div>

          {/* Legal note box */}
          <div className="mb-6 flex items-start gap-3 bg-amber-900/20 border border-amber-600/30 rounded-lg p-4">
            <span className="text-lg flex-shrink-0 mt-0.5">⚖️</span>
            <p className="text-xs text-amber-200 leading-relaxed">
              <strong className="font-semibold text-amber-100">Important legal note:</strong>{" "}
              In rare cases involving court orders, identity may be disclosed through a formal
              legal process. This requires both VoxWel approval and your company's Data
              Protection Officer. Every disclosure is permanently logged.
            </p>
          </div>

          {/* Bottom actions */}
          {!infoMode && (
            <div className="space-y-3">
              <button
                onClick={onContinue}
                className="w-full py-3 bg-[#00BCD4] text-white font-semibold rounded-lg hover:bg-[#0097a7] transition-colors text-sm"
              >
                I understand, continue anonymously →
              </button>
              <div className="text-center">
                <button
                  onClick={onBack}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Post without anonymity instead
                </button>
              </div>
            </div>
          )}
          {infoMode && (
            <button
              onClick={handleClose}
              className="w-full py-3 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors text-sm"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnonymityGuaranteeScreen;
