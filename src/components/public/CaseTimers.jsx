import { CheckCircle2, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

const DAY_MS = 24 * 60 * 60 * 1000;

const Row = ({ done, doneLabel, pendingLabel, overdueLabel, deadline }) => {
  const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / DAY_MS);
  const overdue = !done && daysLeft < 0;

  return (
    <div className="flex items-start gap-2.5">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1ABC9C]" aria-hidden="true" />
      ) : (
        <Clock className={`mt-0.5 h-4 w-4 shrink-0 ${overdue ? "text-[#FF6B6B]" : "text-gray-400"}`} aria-hidden="true" />
      )}
      <p className={`text-sm ${overdue ? "text-[#FF6B6B]" : "text-gray-600"}`}>
        {done ? doneLabel : overdue ? overdueLabel : pendingLabel(Math.max(daysLeft, 0))}
      </p>
    </div>
  );
};

/** Reporter-facing view of the EU Directive reminder timers computed server-side. */
const CaseTimers = ({ timers }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2.5 rounded-2xl border border-gray-200 bg-white p-4">
      <Row
        done={timers.isAcknowledged}
        doneLabel={t("report.checkCase.timers.acknowledged")}
        overdueLabel={t("report.checkCase.timers.acknowledgeOverdue")}
        pendingLabel={(days) => t("report.checkCase.timers.acknowledgePending", { count: days })}
        deadline={timers.acknowledgeDeadline}
      />
      <Row
        done={timers.isFeedbackGiven}
        doneLabel={t("report.checkCase.timers.feedbackGiven")}
        overdueLabel={t("report.checkCase.timers.feedbackOverdue")}
        pendingLabel={(days) => t("report.checkCase.timers.feedbackPending", { count: days })}
        deadline={timers.feedbackDeadline}
      />
    </div>
  );
};

export default CaseTimers;
