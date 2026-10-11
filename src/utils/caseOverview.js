import { PostPriorityConfig } from "./constants";
import { CaseType, getCaseAdapter } from "./caseTypes";
import { computeCaseTimers } from "./caseTimers";

// Cross-case-type "work queue" model: normalise posts / vendorReports / contentReports
// into one shape, work out each case's SLA state, and sort/filter it.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const AT_RISK_WINDOW_MS = 2 * DAY_MS;

// Only cases that came in through the public report link have a reporter-facing
// deadline (/c shows the same timers). Policy-link concerns and internal posts do not.
export const PUBLIC_REPORT_SOURCE = "public_link";

export const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value.seconds) return value.seconds * 1000;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * EU Directive timers for a public-report post, or null when they don't apply.
 * Returns the same fields as computeCaseTimers plus the pending deadlines in ms.
 */
export const getPostTimers = (post, thread) => {
  if (post.source !== PUBLIC_REPORT_SOURCE) return null;
  const createdAtMs = toMillis(post.createdAt) || undefined;
  const timers = computeCaseTimers({ status: post.status, createdAtMs }, thread);
  return {
    ...timers,
    acknowledgeMs: new Date(timers.acknowledgeDeadline).getTime(),
    feedbackMs: new Date(timers.feedbackDeadline).getTime(),
  };
};

// The earliest unmet deadline, e.g. { kind: "acknowledge", dueMs }, or null.
export const getPendingTimer = (timers) => {
  if (!timers) return null;
  const pending = [];
  if (!timers.isAcknowledged) pending.push({ kind: "acknowledge", dueMs: timers.acknowledgeMs });
  if (!timers.isFeedbackGiven) pending.push({ kind: "feedback", dueMs: timers.feedbackMs });
  return pending.sort((a, b) => a.dueMs - b.dueMs)[0] || null;
};

export const getSlaState = (dueMs, now = Date.now()) => {
  if (!dueMs) return "none";
  if (dueMs < now) return "overdue";
  if (dueMs - now <= AT_RISK_WINDOW_MS) return "atRisk";
  return "ok";
};

/** Whole-day distance for display: { overdue, days } (days >= 0; 0 means "today"). */
export const describeDistance = (dueMs, now = Date.now()) => {
  const diff = dueMs - now;
  if (diff >= 0) return { overdue: false, days: Math.floor(diff / DAY_MS) };
  return { overdue: true, days: Math.floor(-diff / DAY_MS) };
};

/**
 * @param {string} caseType
 * @param {object} doc    Firestore doc data with `id`
 * @param {object} [thread] anonymousThreads doc for the post (timers only)
 */
export const toOverviewCase = (caseType, doc, thread = null, now = Date.now()) => {
  const adapter = getCaseAdapter(caseType);
  const status = doc.status || adapter.defaultStatus;
  const priority = adapter.getPriority(doc);
  const assignedDueMs = toMillis(doc.dueDate) || null;
  const timers = caseType === CaseType.POST ? getPostTimers(doc, thread) : null;
  const pendingTimer = getPendingTimer(timers);

  // One "needs attention by" date: the sooner of the assigned due date and the
  // reporter-facing EU deadline.
  const candidates = [
    assignedDueMs && { source: "assigned", dueMs: assignedDueMs },
    pendingTimer && { source: pendingTimer.kind, dueMs: pendingTimer.dueMs },
  ].filter(Boolean);
  const sla = candidates.sort((a, b) => a.dueMs - b.dueMs)[0] || null;

  return {
    key: `${caseType}:${doc.id}`,
    caseType,
    id: doc.id,
    title: adapter.getTitle(doc),
    status,
    priority,
    priorityLevel: PostPriorityConfig[priority]?.level || 0,
    assignedTo: doc.assignedTo || null,
    createdAtMs: toMillis(adapter.getCreatedAt(doc)),
    isOpen: !adapter.closedStatuses.includes(status),
    timers,
    pendingTimer,
    slaDueMs: sla ? sla.dueMs : null,
    slaSource: sla ? sla.source : null,
    slaState: getSlaState(sla ? sla.dueMs : null, now),
  };
};

// Due soonest first (no date last), then higher priority, then oldest.
export const compareOverviewCases = (a, b) => {
  if (a.slaDueMs !== b.slaDueMs) {
    if (!a.slaDueMs) return 1;
    if (!b.slaDueMs) return -1;
    return a.slaDueMs - b.slaDueMs;
  }
  if (a.priorityLevel !== b.priorityLevel) return b.priorityLevel - a.priorityLevel;
  return a.createdAtMs - b.createdAtMs;
};

export const summarizeOverview = (cases) => ({
  open: cases.length,
  overdue: cases.filter((c) => c.slaState === "overdue").length,
  atRisk: cases.filter((c) => c.slaState === "atRisk").length,
  unassigned: cases.filter((c) => !c.assignedTo).length,
});
