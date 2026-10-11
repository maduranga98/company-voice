import { CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PostStatus, PostStatusConfig, PostPriorityConfig } from "../../utils/constants";
import { getDueInfo, formatShortDate } from "../../utils/caseDisplay";

// The single place status, priority and due-date chips are drawn. Colours come from
// PostStatusConfig / PostPriorityConfig (or the case type's own status config), so a
// badge looks identical in the HR inbox, "Assigned to me" and the handling panel.

const SIZES = {
  sm: "px-2 py-0.5 text-[11px] gap-1.5",
  md: "px-2.5 py-1 text-xs gap-1.5",
};

const BASE = "inline-flex items-center rounded-full font-semibold whitespace-nowrap";

export const StatusBadge = ({ status, config = PostStatusConfig, size = "sm", className = "" }) => {
  const cfg = config[status] || config[PostStatus.OPEN];
  const colors = cfg ? `${cfg.bgColor} ${cfg.textColor}` : "bg-gray-100 text-gray-800";
  return (
    <span className={`${BASE} ${SIZES[size]} ${colors} ${className}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {cfg?.label || status}
    </span>
  );
};

export const PriorityBadge = ({ priority, size = "sm", className = "" }) => {
  const cfg = PostPriorityConfig[priority];
  if (!cfg) return null;
  return (
    <span className={`${BASE} ${SIZES[size]} ${cfg.bgColor} ${cfg.textColor} ${className}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${cfg.badgeBg}`} />
      {cfg.label}
    </span>
  );
};

// Due date chip: red once past due, amber when due today/tomorrow. `closed` cases are
// never flagged overdue (nothing left to chase).
export const DueDateChip = ({ dueDate, closed = false, size = "sm", className = "" }) => {
  const { t, i18n } = useTranslation();
  const info = getDueInfo(dueDate);
  if (!info) return null;

  const overdue = info.isOverdue && !closed;
  const soon = !closed && (info.isToday || info.isSoon);
  const tone = overdue
    ? "bg-red-50 text-red-700 border-red-100"
    : soon
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : "bg-gray-50 text-gray-600 border-gray-100";
  const date = formatShortDate(info.date, i18n.language);
  const label = overdue
    ? t("casePanel.overdueOn", { date })
    : info.isToday && !closed
      ? t("casePanel.dueToday")
      : t("casePanel.dueOn", { date });

  return (
    <span className={`${BASE} border font-medium ${SIZES[size]} ${tone} ${className}`}>
      <CalendarClock aria-hidden="true" className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
};
