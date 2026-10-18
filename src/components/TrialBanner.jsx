import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Sparkles } from "lucide-react";
import { db } from "../config/firebase";

const DAY_MS = 86400000;

/**
 * Top-of-page banner for companies on a super-admin-granted trial.
 * Shows the days left and sends company admins to billing to subscribe.
 */
const TrialBanner = ({ companyId, canSubscribe, onSubscribe }) => {
  const [trialEndsAt, setTrialEndsAt] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      doc(db, "companies", companyId),
      (snap) => {
        const data = snap.data();
        const end = data?.subscriptionStatus === "trial" ? data.trialEndsAt?.toDate?.() : null;
        setTrialEndsAt(end || null);
      },
      () => setTrialEndsAt(null)
    );
  }, [companyId]);

  if (!trialEndsAt) return null;

  const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / DAY_MS));
  const expired = trialEndsAt.getTime() <= Date.now();
  const urgent = expired || daysLeft <= 3;

  const message = expired
    ? "Your free trial has ended."
    : `Your free trial ends in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}.`;

  return (
    <div
      role="status"
      className={`lg:ml-64 border-b px-4 py-2 lg:px-8 ${
        urgent ? "border-rose-200 bg-rose-50 text-rose-800" : "border-brand-100 bg-brand-50 text-brand-800"
      }`}
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 text-[13px] font-medium">
        <span className="flex min-w-0 items-center gap-2">
          <Sparkles size={15} className="flex-shrink-0" />
          <span className="truncate sm:whitespace-normal">
            {message}{" "}
            <span className="hidden sm:inline">
              {canSubscribe ? "Subscribe to keep uninterrupted access." : "Ask your company admin to subscribe."}
            </span>
          </span>
        </span>
        {canSubscribe && (
          <button
            onClick={onSubscribe}
            className={`flex-shrink-0 rounded-md px-3 py-1 text-xs font-semibold text-white transition-colors ${
              urgent ? "bg-rose-600 hover:bg-rose-700" : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            Subscribe
          </button>
        )}
      </div>
    </div>
  );
};

export default TrialBanner;
