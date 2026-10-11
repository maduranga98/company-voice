// Client mirror of functions/utils/caseTimers.js (EU Whistleblower Directive reminder
// timers). This is the same computation the public /c page shows the reporter, so HR
// sees the deadline the reporter sees. KEEP IN SYNC with the functions copy:
// functions/test/caseTimersParity.test.js fails if the two ever disagree.

export const ACKNOWLEDGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const FEEDBACK_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // ~3 months
export const TERMINAL_STATUSES = ["resolved", "closed", "rejected", "not_a_problem"];

export function computeCaseTimers(post, thread) {
  const createdAtMs = post && Number.isFinite(post.createdAtMs) ? post.createdAtMs : Date.now();
  const status = (post && post.status) || "open";
  const isAcknowledged = status !== "open";
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const hasInvestigatorReply = !!(thread && thread.lastInvestigatorActivity);
  const isFeedbackGiven = isTerminal || hasInvestigatorReply;

  return {
    acknowledgeDeadline: new Date(createdAtMs + ACKNOWLEDGE_WINDOW_MS).toISOString(),
    feedbackDeadline: new Date(createdAtMs + FEEDBACK_WINDOW_MS).toISOString(),
    isAcknowledged,
    isFeedbackGiven,
  };
}
