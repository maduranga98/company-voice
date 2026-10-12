/**
 * Server-side twin of src/utils/routingRules.js (matchRule/findMatchingRule).
 * Keep the matching logic identical in both files — there is no shared build
 * between src/ and functions/, so a change here must be mirrored there too.
 */

const CASE_TYPE_POST = 'post';
const CASE_TYPE_VENDOR = 'vendor';

function matchRule(rule, caseType, caseData) {
  if (!rule.enabled) return false;
  if (!Array.isArray(rule.appliesTo) || !rule.appliesTo.includes(caseType)) return false;
  const c = rule.conditions || {};

  if (caseType === CASE_TYPE_POST) {
    if (Array.isArray(c.postTypes) && c.postTypes.length > 0 && !c.postTypes.includes(caseData.type)) {
      return false;
    }
    if (Array.isArray(c.categories) && c.categories.length > 0 && !c.categories.includes(caseData.category)) {
      return false;
    }
    if (c.involvesHR === 'yes' && caseData.involvesHR !== true) return false;
    if (c.involvesHR === 'no' && caseData.involvesHR !== false) return false;
    return true;
  }

  if (caseType === CASE_TYPE_VENDOR) {
    if (
      Array.isArray(c.vendorCategories) &&
      c.vendorCategories.length > 0 &&
      !c.vendorCategories.includes(caseData.riskCategory)
    ) {
      return false;
    }
    if (
      Array.isArray(c.vendorSeverities) &&
      c.vendorSeverities.length > 0 &&
      !c.vendorSeverities.includes(caseData.severity)
    ) {
      return false;
    }
    return true;
  }

  return false;
}

function findMatchingRule(rules, caseType, caseData) {
  const sorted = [...rules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const rule of sorted) {
    if (matchRule(rule, caseType, caseData)) return rule;
  }
  return null;
}

/**
 * Loads a company's enabled routing rules and returns the first match for a
 * freshly-created case, or null. Never throws: a routing-rule lookup failure
 * must not block case creation, so callers get null and fall back to the
 * un-routed (broadcast-to-staff) behaviour.
 */
async function resolveRoutingAssignment(db, companyId, caseType, caseData) {
  try {
    const snap = await db
      .collection('routingRules')
      .where('companyId', '==', companyId)
      .where('enabled', '==', true)
      .get();
    const rules = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const rule = findMatchingRule(rules, caseType, caseData);
    if (!rule || !rule.action || !rule.action.id) return null;
    return {
      ruleId: rule.id,
      ruleName: rule.name || '',
      assignment: {
        type: rule.action.type,
        id: rule.action.id,
        name: rule.action.name || '',
      },
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('resolveRoutingAssignment: lookup failed', { companyId, caseType });
    return null;
  }
}

module.exports = { matchRule, findMatchingRule, resolveRoutingAssignment };
