/**
 * EU Whistleblower Directive reminder timers for a case: acknowledge within 7 days,
 * give feedback within ~3 months. Pure function so it can be unit tested without Firestore.
 */

const ACKNOWLEDGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const FEEDBACK_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // ~3 months
const TERMINAL_STATUSES = ['resolved', 'closed', 'rejected', 'not_a_problem'];

/**
 * @param {{status?: string, createdAtMs: number}} post
 * @param {{lastInvestigatorActivity?: unknown}} [thread]
 */
function computeCaseTimers(post, thread) {
  const createdAtMs = post && Number.isFinite(post.createdAtMs) ? post.createdAtMs : Date.now();
  const status = (post && post.status) || 'open';
  const isAcknowledged = status !== 'open';
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

module.exports = { ACKNOWLEDGE_WINDOW_MS, FEEDBACK_WINDOW_MS, TERMINAL_STATUSES, computeCaseTimers };
