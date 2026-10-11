import { useTranslation } from "react-i18next";
import { getCaseAdapter } from "../../utils/caseTypes";
import { ModerationActionConfig } from "../../utils/constants";

const formatDate = (ms) =>
  ms ? new Date(ms).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

const toDateLabel = (value) => {
  if (!value) return "";
  const date = value.toDate ? value.toDate() : value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};

// One line of text per entry; strings live under caseDetail.activity.*
const describe = (entry, adapter, t) => {
  const m = entry.metadata || {};
  const statusLabel = (value) => adapter.statusConfig[value]?.label || value || "—";
  const params = { actor: entry.actorName || t("caseDetail.activity.someone") };

  switch (entry.type) {
    case "created":
    case "report_created":
      return t("caseDetail.activity.created", params);
    case "status_changed":
      return t("caseDetail.activity.statusChanged", { ...params, from: statusLabel(m.oldStatus), to: statusLabel(m.newStatus) });
    case "priority_changed":
      return t("caseDetail.activity.priorityChanged", { ...params, from: m.oldPriority || "—", to: m.newPriority || "—" });
    case "assigned":
      return t("caseDetail.activity.assigned", { ...params, assignee: m.assignedToName || "—" });
    case "unassigned":
      return t("caseDetail.activity.unassigned", params);
    case "due_date_set":
    case "due_date_changed":
      return m.newDueDate
        ? t("caseDetail.activity.dueDateSet", { ...params, date: toDateLabel(m.newDueDate) })
        : t("caseDetail.activity.dueDateCleared", params);
    case "admin_comment":
      return t("caseDetail.activity.noteAdded", params);
    case "report_reviewed":
      return t("caseDetail.activity.reviewed", {
        ...params,
        action: ModerationActionConfig[m.actionType]?.label || m.actionType || "—",
      });
    default:
      return t("caseDetail.activity.other", { ...params, type: String(entry.type || "").replace(/_/g, " ") });
  }
};

/**
 * Chronological case history (newest first).
 * entries: output of caseTimelineService.getCaseTimeline
 */
const CaseTimeline = ({ caseType, entries }) => {
  const { t } = useTranslation();
  const adapter = getCaseAdapter(caseType);

  if (!entries.length) {
    return <p className="text-sm text-gray-400">{t("caseDetail.timeline.empty")}</p>;
  }

  return (
    <ol className="relative border-l border-gray-200 ml-1.5 space-y-4">
      {entries.map((entry) => {
        const note = entry.metadata?.comment;
        return (
          <li key={entry.id} className="ml-4">
            <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#1ABC9C]" />
            <p className="text-sm text-[#2D3E50]">{describe(entry, adapter, t)}</p>
            {note && (
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{note}</p>
            )}
            <p className="mt-0.5 text-[11px] text-gray-400">{formatDate(entry.at)}</p>
          </li>
        );
      })}
    </ol>
  );
};

export default CaseTimeline;
