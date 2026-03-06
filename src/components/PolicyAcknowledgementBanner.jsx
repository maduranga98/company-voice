import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import AnonymityGuaranteeScreen from "./AnonymityGuaranteeScreen";

const POLICY_VERSION = "1.0";

/**
 * PolicyAcknowledgementBanner
 *
 * Props:
 *   companyId    - company ID from userData
 *   userId       - user's Firestore document ID
 *   onAcknowledged - optional callback after user acknowledges
 */
const PolicyAcknowledgementBanner = ({ companyId, userId, onAcknowledged }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [showGuarantee, setShowGuarantee] = useState(false);

  const docId = companyId && userId ? `${companyId}_${userId}` : null;

  useEffect(() => {
    if (!docId) {
      setLoading(false);
      return;
    }
    const check = async () => {
      try {
        const ref = doc(db, "policyAcknowledgements", docId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setVisible(true);
        }
      } catch (err) {
        console.error("PolicyAcknowledgementBanner check error:", err);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [docId]);

  const handleAcknowledge = async () => {
    if (!docId) return;
    setAcknowledging(true);
    try {
      const ref = doc(db, "policyAcknowledgements", docId);
      await setDoc(ref, {
        userId,
        companyId,
        acknowledgedAt: serverTimestamp(),
        policyVersion: POLICY_VERSION,
      });
      setVisible(false);
      if (onAcknowledged) onAcknowledged();
    } catch (err) {
      console.error("PolicyAcknowledgementBanner acknowledge error:", err);
    } finally {
      setAcknowledging(false);
    }
  };

  if (loading || !visible) return null;

  return (
    <>
      {showGuarantee && (
        <AnonymityGuaranteeScreen
          infoMode
          onClose={() => setShowGuarantee(false)}
        />
      )}

      <div className="mx-4 sm:mx-6 mt-4 flex items-center justify-between gap-4 bg-[#2D3E50] text-white rounded-lg px-4 py-3 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          {/* Shield icon */}
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#00BCD4]/15 flex items-center justify-center">
            <svg
              className="w-4.5 h-4.5 text-[#00BCD4]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </span>
          <p className="text-sm text-slate-200 truncate">
            VoxWel's anonymous reporting protects your identity.{" "}
            <button
              onClick={() => setShowGuarantee(true)}
              className="text-[#00BCD4] underline underline-offset-2 hover:text-[#4dd9ec] transition-colors whitespace-nowrap"
            >
              Learn how it works →
            </button>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className="px-3 py-1.5 bg-[#00BCD4] text-white text-xs font-semibold rounded-lg hover:bg-[#0097a7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {acknowledging ? "Saving…" : "Got it"}
          </button>
          <button
            onClick={() => setVisible(false)}
            className="text-slate-400 hover:text-white transition-colors p-1"
            aria-label="Dismiss banner"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
};

export default PolicyAcknowledgementBanner;
