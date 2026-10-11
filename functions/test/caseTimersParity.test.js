const test = require('node:test');
const assert = require('node:assert');
const server = require('../utils/caseTimers');

// The HR UI uses an ES-module copy of computeCaseTimers (src/utils/caseTimers.js) so the
// deadlines HR sees match what the reporter sees on /c. Fail loudly if they drift apart.
test('client caseTimers matches functions/utils/caseTimers', async () => {
  const client = await import('../../src/utils/caseTimers.js');

  assert.equal(client.ACKNOWLEDGE_WINDOW_MS, server.ACKNOWLEDGE_WINDOW_MS);
  assert.equal(client.FEEDBACK_WINDOW_MS, server.FEEDBACK_WINDOW_MS);
  assert.deepEqual(client.TERMINAL_STATUSES, server.TERMINAL_STATUSES);

  const createdAtMs = Date.UTC(2026, 0, 15, 9, 30);
  const threads = [null, { lastInvestigatorActivity: null }, { lastInvestigatorActivity: { toMillis: () => 1 } }];
  const statuses = [undefined, 'open', 'acknowledged', 'in_progress', 'under_review', 'resolved', 'closed', 'rejected', 'not_a_problem'];
  for (const status of statuses) {
    for (const thread of threads) {
      const post = { status, createdAtMs };
      assert.deepEqual(client.computeCaseTimers(post, thread), server.computeCaseTimers(post, thread), `${status}/${JSON.stringify(thread)}`);
    }
  }
});
