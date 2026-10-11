/**
 * Rule-based case routing: pure matching logic (no Firestore), shared by the creation
 * triggers and unit tests.
 *
 * Rule document (companies/{companyId}/routingRules/{ruleId}):
 *   name        string
 *   enabled     boolean
 *   order       number   lower runs first; the first rule that matches AND resolves wins
 *   conditions  { caseTypes, priorities, categories, sources, departmentIds }
 *               each an array of strings; missing/empty = "any"; keys are ANDed, values within a key ORed
 *   action      { type: 'user' | 'department' | 'userTag', id, name }
 *
 * Rules only ever set the INITIAL assignee, at creation time. A case that already has an
 * assignee is left alone, and any later manual change in the case panel is never overridden.
 */

const CASE_TYPES = ['post', 'vendor', 'moderation'];
const CONDITION_KEYS = ['caseTypes', 'priorities', 'categories', 'sources', 'departmentIds'];
const ACTION_TYPES = ['user', 'department', 'userTag'];

const str = (value) => (typeof value === 'string' && value ? value : null);

/**
 * The comparable facts of a case, normalised across the three case sources.
 * Fields a source does not have are null and can only match a rule that does not constrain them.
 */
function caseFacts(caseType, data) {
  const d = data || {};
  if (caseType === 'vendor') {
    return {
      caseType,
      priority: str(d.priority) || str(d.severity),
      category: str(d.riskCategory),
      source: null,
      departmentId: null,
    };
  }
  if (caseType === 'moderation') {
    return { caseType, priority: str(d.priority), category: str(d.reason), source: null, departmentId: null };
  }
  return {
    caseType: 'post',
    priority: str(d.priority),
    category: str(d.category),
    // 'public_link' (/r reports) or a policy concern; internal posts have no source field
    source: str(d.source) || 'internal',
    departmentId: str(d.departmentId),
  };
}

const allows = (list, value) =>
  !Array.isArray(list) || list.length === 0 || (value !== null && list.includes(value));

/** True when every constraint the rule sets is satisfied by the case's facts. */
function ruleMatches(rule, facts) {
  const c = (rule && rule.conditions) || {};
  return (
    allows(c.caseTypes, facts.caseType) &&
    allows(c.priorities, facts.priority) &&
    allows(c.categories, facts.category) &&
    allows(c.sources, facts.source) &&
    allows(c.departmentIds, facts.departmentId)
  );
}

/** Enabled, well-formed rules in evaluation order. */
function orderedRules(rules) {
  return (rules || [])
    .filter((r) => r && r.enabled !== false && r.action && ACTION_TYPES.includes(r.action.type) && str(r.action.id))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id)));
}

module.exports = { CASE_TYPES, CONDITION_KEYS, ACTION_TYPES, caseFacts, ruleMatches, orderedRules };
