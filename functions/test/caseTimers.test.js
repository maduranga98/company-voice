const test = require('node:test');
const assert = require('node:assert');
const { computeCaseTimers, ACKNOWLEDGE_WINDOW_MS, FEEDBACK_WINDOW_MS } = require('../utils/caseTimers');

const DAY = 24 * 60 * 60 * 1000;

test('a fresh open case is neither acknowledged nor given feedback', () => {
  const createdAtMs = Date.now();
  const timers = computeCaseTimers({ status: 'open', createdAtMs }, null);
  assert.equal(timers.isAcknowledged, false);
  assert.equal(timers.isFeedbackGiven, false);
  assert.equal(new Date(timers.acknowledgeDeadline).getTime(), createdAtMs + ACKNOWLEDGE_WINDOW_MS);
  assert.equal(new Date(timers.feedbackDeadline).getTime(), createdAtMs + FEEDBACK_WINDOW_MS);
});

test('any non-open status counts as acknowledged', () => {
  const timers = computeCaseTimers({ status: 'acknowledged', createdAtMs: Date.now() }, null);
  assert.equal(timers.isAcknowledged, true);
});

test('an investigator reply counts as feedback given, even mid-investigation', () => {
  const timers = computeCaseTimers(
    { status: 'under_review', createdAtMs: Date.now() },
    { lastInvestigatorActivity: { toMillis: () => Date.now() } }
  );
  assert.equal(timers.isFeedbackGiven, true);
});

test('a terminal status counts as feedback given even with no reply recorded', () => {
  for (const status of ['resolved', 'closed', 'rejected', 'not_a_problem']) {
    const timers = computeCaseTimers({ status, createdAtMs: Date.now() }, null);
    assert.equal(timers.isFeedbackGiven, true, `expected ${status} to be feedback-given`);
  }
});

test('an in-progress case with no reply yet is not feedback-given', () => {
  const timers = computeCaseTimers({ status: 'in_progress', createdAtMs: Date.now() }, null);
  assert.equal(timers.isFeedbackGiven, false);
});

test('deadlines land 7 days and ~90 days after creation', () => {
  const createdAtMs = Date.now() - 10 * DAY;
  const timers = computeCaseTimers({ status: 'open', createdAtMs }, null);
  assert.equal(new Date(timers.acknowledgeDeadline).getTime() - createdAtMs, 7 * DAY);
  assert.equal(new Date(timers.feedbackDeadline).getTime() - createdAtMs, 90 * DAY);
});

test('missing createdAtMs falls back to now instead of throwing', () => {
  assert.doesNotThrow(() => computeCaseTimers({ status: 'open' }, null));
});
