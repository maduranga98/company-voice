/**
 * Shared constants for the public (no-login) policy acknowledgement line.
 */

const RESPONSES = ['acknowledged', 'concern'];

const LIMITS = {
  minEmployeeId: 1,
  maxEmployeeId: 40,
  minEmployeeName: 2,
  maxEmployeeName: 100,
  minConcern: 10,
  maxConcern: 2000,
  maxVersion: 30,
  maxRoster: 3000,
};

// Minimum time on the page before a submission counts as human (policy text has to be read).
const MIN_FILL_MS = 2000;

// Rate limits. Office networks put many employees behind one IP when a policy is rolled
// out, so the per-IP caps are far higher than the anonymous report line's.
const RATE_LIMITS = {
  viewPerIpPerHour: 200,
  submitPerIpPerHour: 60,
  submitPerLinkPerDay: 5000,
  concernPerEmployeePerDay: 5,
  hourMs: 60 * 60 * 1000,
  dayMs: 24 * 60 * 60 * 1000,
  idempotencyTtlMs: 15 * 60 * 1000,
};

module.exports = { RESPONSES, LIMITS, MIN_FILL_MS, RATE_LIMITS };
