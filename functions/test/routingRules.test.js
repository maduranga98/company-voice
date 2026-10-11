const test = require('node:test');
const assert = require('node:assert');
const { caseFacts, ruleMatches, orderedRules } = require('../utils/routingRules');

test('facts are normalised per case source', () => {
  assert.deepEqual(caseFacts('post', { priority: 'high', category: 'harassment', source: 'public_link', departmentId: 'd1' }),
    { caseType: 'post', priority: 'high', category: 'harassment', source: 'public_link', departmentId: 'd1' });
  assert.equal(caseFacts('post', {}).source, 'internal');
  assert.deepEqual(caseFacts('vendor', { severity: 'high', riskCategory: 'safety' }),
    { caseType: 'vendor', priority: 'high', category: 'safety', source: null, departmentId: null });
  assert.equal(caseFacts('vendor', { priority: 'low', severity: 'high' }).priority, 'low');
  assert.equal(caseFacts('moderation', { priority: 'critical', reason: 'harassment' }).category, 'harassment');
});

test('empty or missing conditions match everything', () => {
  const facts = caseFacts('post', { priority: 'low' });
  assert.equal(ruleMatches({}, facts), true);
  assert.equal(ruleMatches({ conditions: {} }, facts), true);
  assert.equal(ruleMatches({ conditions: { priorities: [], caseTypes: [] } }, facts), true);
});

test('keys are ANDed, values within a key are ORed', () => {
  const facts = caseFacts('post', { priority: 'high', category: 'safety', source: 'public_link' });
  assert.equal(ruleMatches({ conditions: { priorities: ['critical', 'high'] } }, facts), true);
  assert.equal(ruleMatches({ conditions: { priorities: ['high'], categories: ['pay'] } }, facts), false);
  assert.equal(ruleMatches({ conditions: { priorities: ['high'], categories: ['pay', 'safety'], sources: ['public_link'] } }, facts), true);
});

test('a constraint on a field the case does not have never matches', () => {
  const vendor = caseFacts('vendor', { severity: 'high' });
  assert.equal(ruleMatches({ conditions: { departmentIds: ['d1'] } }, vendor), false);
  assert.equal(ruleMatches({ conditions: { sources: ['public_link'] } }, vendor), false);
  assert.equal(ruleMatches({ conditions: { caseTypes: ['vendor'] } }, vendor), true);
});

test('orderedRules drops disabled / malformed rules and sorts by order then id', () => {
  const rules = [
    { id: 'c', order: 2, action: { type: 'user', id: 'u' } },
    { id: 'a', order: 1, action: { type: 'userTag', id: 't' } },
    { id: 'off', order: 0, enabled: false, action: { type: 'user', id: 'u' } },
    { id: 'bad', order: 0, action: { type: 'robot', id: 'u' } },
    { id: 'noid', order: 0, action: { type: 'user' } },
    { id: 'b', order: 1, action: { type: 'department', id: 'd' } },
  ];
  assert.deepEqual(orderedRules(rules).map((r) => r.id), ['a', 'b', 'c']);
});
