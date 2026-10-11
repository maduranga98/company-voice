import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { describeDistance, getSlaState } from "../../utils/caseOverview";

const TONE = {
  overdue: "bg-red-50 text-red-700 border-red-100",
  atRisk: "bg-amber-50 text-amber-700 border-amber-100",
  ok: "bg-gray-50 text-gray-600 border-gray-100",
};

/**
 * One deadline as a small badge: "Acknowledge due in 2 days", "Feedback overdue by 5 days",
 * or (kind "assigned") "Due in 3 days".
 *
 * kind: "acknowledge" | "feedback" | "assigned"
 */
const CaseSlaBadge = ({ kind, dueMs, now, className = "" }) => {
  const { t } = useTranslation();
  if (!dueMs) return null;

  const at = now || Date.now();
  const state = getSlaState(dueMs, at);
  const { overdue, days } = describeDistance(dueMs, at);
  const base = kind === "assigned" ? "caseOverview.sla.assigned" : "caseOverview.sla";
  const key = overdue ? (days === 0 ? "overdue" : "overdueBy") : days === 0 ? "dueToday" : "dueIn";
  const label = kind === "assigned" ? undefined : t(`caseOverview.sla.label.${kind}`);
  const text = t(`${base}.${key}`, { count: days, label });

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${TONE[state] || TONE.ok} ${className}`}
    >
      <Clock size={10} />
      {text}
    </span>
  );
};

export default CaseSlaBadge;
