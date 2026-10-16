/**
 * Per-company submission categories and category -> assignee routing.
 *
 * Pure validators first (unit tested), then the Firestore helpers used by the callables
 * (functions/api/categoryRoutingApi.js) and by case creation (functions/api/publicReportApi.js).
 *
 * Resolution order for a new case (see resolveCategoryRouting):
 *   1. the category's own rule, if active and its assignee is still a valid active member
 *   2. the company default assignee, if still valid
 *   3. the first active company_admin
 *   4. null  -> the caller keeps its pre-existing "unrouted" behaviour
 * A case flagged involvesHR is never routed to an HR user at any step: it is restricted to
 * company admins, so routing it to HR would hand it to someone who cannot open it.
 */

const {
  CATEGORY_LIMITS,
  SYSTEM_CATEGORY_ID,
  ASSIGNEE_TYPES,
  ASSIGNABLE_ROLES,
} = require('../config/categoryRouting');
const { sanitizeText } = require('./publicReportValidation');

class CategoryValidationError extends Error {
  constructor(field, reason) {
    super(`invalid:${field}:${reason}`);
    this.field = field;
    this.reason = reason;
  }
}

/** Canonical form used for the uniqueness check: case-insensitive, whitespace collapsed. */
function toNameKey(name) {
  return name.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
}

/** @returns {{name: string, nameKey: string}} @throws {CategoryValidationError} */
function validateCategoryName(raw) {
  const name = sanitizeText(typeof raw === 'string' ? raw : '').replace(/\s+/g, ' ');
  if (!name) throw new CategoryValidationError('name', 'required');
  if (name.length > CATEGORY_LIMITS.nameMax) throw new CategoryValidationError('name', 'too_long');
  return { name, nameKey: toNameKey(name) };
}

/** Description is optional; returns '' when absent. */
function validateCategoryDescription(raw) {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') throw new CategoryValidationError('description', 'invalid');
  const description = sanitizeText(raw);
  if (description.length > CATEGORY_LIMITS.descriptionMax) {
    throw new CategoryValidationError('description', 'too_long');
  }
  return description;
}

/** Shape check only; whether the assignee really exists is checked against Firestore. */
function validateAssigneeShape(assigneeType, assigneeId) {
  if (!ASSIGNEE_TYPES.includes(assigneeType)) throw new CategoryValidationError('assigneeType', 'invalid');
  if (typeof assigneeId !== 'string' || !assigneeId || assigneeId.length > 128 || assigneeId.includes('/')) {
    throw new CategoryValidationError('assigneeId', 'invalid');
  }
  if (assigneeType === 'role' && !ASSIGNABLE_ROLES.includes(assigneeId)) {
    throw new CategoryValidationError('assigneeId', 'invalid_role');
  }
}

/** Existing convention in this codebase: a user with no status field is active. */
const isActiveUser = (data) => !!data && (data.status === undefined || data.status === 'active');

const userName = (data) => data.displayName || data.username || '';

/**
 * Resolves an assignee to concrete active users of `companyId`.
 * @returns {Promise<null | {type:'user', id:string, name:string, role:string} |
 *   {type:'role', role:string, userIds:string[]}>} null when it no longer resolves.
 */
async function resolveAssignee(db, companyId, assigneeType, assigneeId, { involvesHR = false } = {}) {
  if (!assigneeType || !assigneeId) return null;

  if (assigneeType === 'user') {
    const snap = await db.collection('users').doc(assigneeId).get();
    if (!snap.exists) return null;
    const user = snap.data();
    if (user.companyId !== companyId || !isActiveUser(user)) return null;
    if (!ASSIGNABLE_ROLES.includes(user.role)) return null;
    if (involvesHR && user.role === 'hr') return null;
    return { type: 'user', id: snap.id, name: userName(user), role: user.role };
  }

  if (assigneeType === 'role') {
    if (!ASSIGNABLE_ROLES.includes(assigneeId)) return null;
    if (involvesHR && assigneeId === 'hr') return null;
    const snap = await db
      .collection('users')
      .where('companyId', '==', companyId)
      .where('role', '==', assigneeId)
      .get();
    const userIds = snap.docs.filter((d) => isActiveUser(d.data())).map((d) => d.id);
    if (userIds.length === 0) return null;
    return { type: 'role', role: assigneeId, userIds };
  }

  return null;
}

/** The company's first active company_admin: the always-resolvable last resort. */
async function resolveAdminFallback(db, companyId) {
  const snap = await db
    .collection('users')
    .where('companyId', '==', companyId)
    .where('role', '==', 'company_admin')
    .get();
  const admin = snap.docs.find((d) => isActiveUser(d.data()));
  if (!admin) return null;
  return { type: 'user', id: admin.id, name: userName(admin.data()), role: 'company_admin' };
}

function toRoutingMatch(resolved, { source, ruleId, ruleName }) {
  return {
    source,
    ruleId,
    ruleName,
    assignment: resolved.type === 'user' ? { type: 'user', id: resolved.id, name: resolved.name } : null,
    roleAssignment: resolved.type === 'role' ? { role: resolved.role, userIds: resolved.userIds } : null,
  };
}

/**
 * Resolves who a new case in `categoryId` goes to. Never throws: a routing lookup failure
 * must not block case creation, so callers get null and keep their unrouted behaviour.
 *
 * @returns {Promise<null | {source:'rule'|'default'|'admin_fallback', ruleId:string, ruleName:string,
 *   assignment: {type:'user', id:string, name:string} | null,
 *   roleAssignment: {role:string, userIds:string[]} | null}>}
 */
async function resolveCategoryRouting(db, companyId, { categoryId, categoryName = '', involvesHR = false }) {
  try {
    const companyRef = db.collection('companies').doc(companyId);

    if (typeof categoryId === 'string' && categoryId && !categoryId.includes('/')) {
      const ruleSnap = await companyRef.collection('routingRules').doc(categoryId).get();
      if (ruleSnap.exists && ruleSnap.data().isActive !== false) {
        const rule = ruleSnap.data();
        const resolved = await resolveAssignee(db, companyId, rule.assigneeType, rule.assigneeId, { involvesHR });
        if (resolved) {
          return toRoutingMatch(resolved, {
            source: 'rule',
            ruleId: ruleSnap.id,
            ruleName: categoryName ? `Category: ${categoryName}` : 'Category routing',
          });
        }
      }
    }

    const companySnap = await companyRef.get();
    if (companySnap.exists) {
      const company = companySnap.data();
      const resolved = await resolveAssignee(
        db,
        companyId,
        company.defaultRoutingAssigneeType,
        company.defaultRoutingAssigneeId,
        { involvesHR }
      );
      if (resolved) {
        return toRoutingMatch(resolved, { source: 'default', ruleId: 'default', ruleName: 'Default assignee' });
      }
    }

    const admin = await resolveAdminFallback(db, companyId);
    if (admin) {
      return toRoutingMatch(admin, { source: 'admin_fallback', ruleId: 'admin_fallback', ruleName: 'Company admin fallback' });
    }
    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('resolveCategoryRouting: lookup failed', { companyId });
    return null;
  }
}

/**
 * Active, user-selectable categories for the submission form, in display order.
 * Vendor Risk is excluded: it is a separate fixed case type, not a form category.
 */
async function getActiveCategories(db, companyId) {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('categories')
    .where('isActive', '==', true)
    .get();
  return snap.docs
    .filter((d) => d.data().isSystemDefined !== true)
    .sort((a, b) => (a.data().order ?? 0) - (b.data().order ?? 0))
    .map((d) => ({ id: d.id, name: d.data().name || '', i18nKey: d.data().i18nKey || null }));
}

/** A category a submission may use right now, or null (missing, inactive or system-defined). */
async function getSubmittableCategory(db, companyId, categoryId) {
  if (typeof categoryId !== 'string' || !categoryId || categoryId.includes('/')) return null;
  if (categoryId === SYSTEM_CATEGORY_ID) return null;
  const snap = await db.collection('companies').doc(companyId).collection('categories').doc(categoryId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data.isActive !== true || data.isSystemDefined === true) return null;
  return { id: snap.id, name: data.name || '' };
}

module.exports = {
  CategoryValidationError,
  toNameKey,
  validateCategoryName,
  validateCategoryDescription,
  validateAssigneeShape,
  isActiveUser,
  resolveAssignee,
  resolveAdminFallback,
  resolveCategoryRouting,
  getActiveCategories,
  getSubmittableCategory,
};
