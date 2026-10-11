import { toDate } from "./caseTypes";

// Presentation helpers shared by the case lists and the case-handling panel.

// "YYYY-MM-DD" for <input type="date">; "" when there is no (valid) date.
export const toDateInputValue = (value) => {
  const date = toDate(value);
  return date ? date.toISOString().split("T")[0] : "";
};

/**
 * Describes a due date relative to today. The date is read the same way the date
 * input reads it (calendar day, not time of day), so what the list shows always
 * matches what the panel's input shows.
 * Returns null when there is no due date.
 */
export const getDueInfo = (value, now = new Date()) => {
  const iso = toDateInputValue(value);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((date - today) / 86400000);
  return { date, iso, daysLeft, isOverdue: daysLeft < 0, isToday: daysLeft === 0, isSoon: daysLeft === 1 };
};

export const formatShortDate = (date, locale) => {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(locale, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
};
