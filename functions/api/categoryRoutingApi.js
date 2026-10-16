/**
 * Category & routing configuration API (company_admin and hr only).
 *
 * Every write to companies/{id}/categories, companies/{id}/routingRules and the company's
 * default routing assignee goes through these callables; Firestore rules deny client writes.
 * That is deliberate: name uniqueness, "assignee belongs to this company and is active" and
 * "never leave the form with no active category" cannot be expressed in security rules.
 *
 * The company is always taken from the caller's token claims, never from the request body,
 * so a staff member cannot name another company.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { db, serverTimestamp } = require('../config/firebase');
const { BASE_OPTIONS } = require('../config/callableOptions');
const { assertRole } = require('../utils/authz');
const { CATEGORY_LIMITS } = require('../config/categoryRouting');
const {
  CategoryValidationError,
  validateCategoryName,
  validateCategoryDescription,
  validateAssigneeShape,
  resolveAssignee,
} = require('../utils/categoryRouting');
const { seedCompany, ensureSeeded } = require('../utils/categorySeed');

const CONFIG_ROLES = ['company_admin', 'hr'];

const companyRef = (companyId) => db.collection('companies').doc(companyId);
const categoriesRef = (companyId) => companyRef(companyId).collection('categories');
const rulesRef = (companyId) => companyRef(companyId).collection('routingRules');

/**
 * Wraps a handler: authenticates company_admin/hr, makes sure the company is seeded,
 * and maps validation errors to a stable `invalid-argument` with { field, reason } details.
 */
function configCallable(handler, options = {}) {
  return onCall({ ...BASE_OPTIONS, ...options }, async (request) => {
    const caller = assertRole(request, CONFIG_ROLES);
    if (!caller.companyId) throw new HttpsError('permission-denied', 'Not allowed.');

    try {
      const snap = await companyRef(caller.companyId).get();
      if (!snap.exists) throw new HttpsError('not-found', 'Company not found.');
      await ensureSeeded(db, caller.companyId, snap.data(), serverTimestamp());
      return await handler({ caller, companyId: caller.companyId, data: request.data || {} });
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof CategoryValidationError) {
        throw new HttpsError('invalid-argument', error.message, { field: error.field, reason: error.reason });
      }
      logger.error('categoryRouting: failed', { code: error && error.code, name: error && error.name });
      throw new HttpsError('internal', 'Could not save changes.');
    }
  });
}

const requireString = (value, field) => {
  if (typeof value !== 'string' || !value || value.length > 128 || value.includes('/')) {
    throw new CategoryValidationError(field, 'invalid');
  }
  return value;
};

// ============================================
// Categories
// ============================================

const createCategory = configCallable(async ({ caller, companyId, data }) => {
  const { name, nameKey } = validateCategoryName(data.name);
  const description = validateCategoryDescription(data.description);

  const id = await db.runTransaction(async (tx) => {
    const all = await tx.get(categoriesRef(companyId));
    if (all.size >= CATEGORY_LIMITS.maxPerCompany) {
      throw new HttpsError('failed-precondition', 'Category limit reached.', { reason: 'limit' });
    }
    if (all.docs.some((d) => d.data().nameKey === nameKey)) {
      throw new HttpsError('already-exists', 'A category with this name already exists.', {
        field: 'name',
        reason: 'duplicate',
      });
    }
    const editable = all.docs.filter((d) => d.data().isSystemDefined !== true);
    const nextOrder = editable.reduce((max, d) => Math.max(max, d.data().order ?? 0), -1) + 1;

    const ref = categoriesRef(companyId).doc();
    tx.set(ref, {
      name,
      nameKey,
      description,
      isActive: true,
      isSystemDefined: false,
      order: nextOrder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: caller.uid,
    });
    return ref.id;
  });

  return { id };
});

const updateCategory = configCallable(async ({ caller, companyId, data }) => {
  const categoryId = requireString(data.categoryId, 'categoryId');
  const hasName = data.name !== undefined;
  const hasDescription = data.description !== undefined;
  const hasActive = data.isActive !== undefined;
  if (!hasName && !hasDescription && !hasActive) throw new CategoryValidationError('body', 'empty');
  if (hasActive && typeof data.isActive !== 'boolean') throw new CategoryValidationError('isActive', 'invalid');

  const parsedName = hasName ? validateCategoryName(data.name) : null;
  const description = hasDescription ? validateCategoryDescription(data.description) : null;

  await db.runTransaction(async (tx) => {
    const all = await tx.get(categoriesRef(companyId));
    const current = all.docs.find((d) => d.id === categoryId);
    if (!current) throw new HttpsError('not-found', 'Category not found.');
    const category = current.data();
    if (category.isSystemDefined === true) {
      throw new HttpsError('permission-denied', 'This category is system-defined and cannot be changed.', {
        reason: 'system_defined',
      });
    }

    const update = { updatedAt: serverTimestamp(), updatedBy: caller.uid };

    if (parsedName && parsedName.nameKey !== category.nameKey) {
      if (all.docs.some((d) => d.id !== categoryId && d.data().nameKey === parsedName.nameKey)) {
        throw new HttpsError('already-exists', 'A category with this name already exists.', {
          field: 'name',
          reason: 'duplicate',
        });
      }
      update.name = parsedName.name;
      update.nameKey = parsedName.nameKey;
      // A renamed category must show its new name, not the translation of the old one.
      update.i18nKey = null;
    } else if (parsedName && parsedName.name !== category.name) {
      // Same canonical name, different casing/spacing: a rename that keeps its translation key out.
      update.name = parsedName.name;
      update.i18nKey = null;
    }
    if (description !== null) update.description = description;

    if (hasActive && data.isActive !== (category.isActive === true)) {
      if (data.isActive === false) {
        const otherActive = all.docs.filter(
          (d) => d.id !== categoryId && d.data().isActive === true && d.data().isSystemDefined !== true
        );
        if (otherActive.length === 0) {
          throw new HttpsError('failed-precondition', 'At least one category must stay active.', {
            reason: 'last_active',
          });
        }
      }
      update.isActive = data.isActive;
    }

    tx.update(categoriesRef(companyId).doc(categoryId), update);
  });

  return { id: categoryId };
});

const reorderCategories = configCallable(async ({ caller, companyId, data }) => {
  const orderedIds = data.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.length > CATEGORY_LIMITS.maxPerCompany) {
    throw new CategoryValidationError('orderedIds', 'invalid');
  }
  orderedIds.forEach((id) => requireString(id, 'orderedIds'));
  if (new Set(orderedIds).size !== orderedIds.length) throw new CategoryValidationError('orderedIds', 'invalid');

  await db.runTransaction(async (tx) => {
    const all = await tx.get(categoriesRef(companyId));
    const editableIds = all.docs.filter((d) => d.data().isSystemDefined !== true).map((d) => d.id);
    const sameSet = editableIds.length === orderedIds.length && editableIds.every((id) => orderedIds.includes(id));
    if (!sameSet) {
      // The list changed under the admin (e.g. a category was added in another tab).
      throw new HttpsError('failed-precondition', 'The category list changed. Reload and try again.', {
        reason: 'stale',
      });
    }
    orderedIds.forEach((id, index) => {
      tx.update(categoriesRef(companyId).doc(id), { order: index, updatedAt: serverTimestamp(), updatedBy: caller.uid });
    });
  });

  return { count: orderedIds.length };
});

// ============================================
// Routing rules
// ============================================

async function assertAssigneeResolves(companyId, assigneeType, assigneeId) {
  validateAssigneeShape(assigneeType, assigneeId);
  // Looks the assignee up in Firestore: it must belong to THIS company, be active, and hold
  // an assignable role. A role must have at least one active member.
  const resolved = await resolveAssignee(db, companyId, assigneeType, assigneeId);
  if (!resolved) {
    throw new HttpsError('failed-precondition', 'The selected assignee is not an active member of your company.', {
      field: 'assigneeId',
      reason: 'assignee_invalid',
    });
  }
}

const setCategoryRoutingRule = configCallable(async ({ caller, companyId, data }) => {
  const categoryId = requireString(data.categoryId, 'categoryId');
  const { assigneeType, assigneeId } = data;
  await assertAssigneeResolves(companyId, assigneeType, assigneeId);

  const categorySnap = await categoriesRef(companyId).doc(categoryId).get();
  if (!categorySnap.exists) throw new HttpsError('not-found', 'Category not found.');
  const category = categorySnap.data();
  if (category.isSystemDefined !== true && category.isActive !== true) {
    throw new HttpsError('failed-precondition', 'Activate the category before routing it.', { reason: 'inactive' });
  }

  const ruleRef = rulesRef(companyId).doc(categoryId);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ruleRef);
    const base = { categoryId, assigneeType, assigneeId, isActive: true, updatedAt: serverTimestamp(), updatedBy: caller.uid };
    tx.set(
      ruleRef,
      existing.exists ? base : { ...base, createdAt: serverTimestamp(), createdBy: caller.uid },
      { merge: true }
    );
  });

  return { id: categoryId };
});

const removeCategoryRoutingRule = configCallable(async ({ companyId, data }) => {
  const categoryId = requireString(data.categoryId, 'categoryId');
  await rulesRef(companyId).doc(categoryId).delete();
  return { id: categoryId };
});

const setDefaultRoutingAssignee = configCallable(async ({ caller, companyId, data }) => {
  const { assigneeType, assigneeId } = data;
  await assertAssigneeResolves(companyId, assigneeType, assigneeId);

  await companyRef(companyId).update({
    defaultRoutingAssigneeType: assigneeType,
    defaultRoutingAssigneeId: assigneeId,
    defaultRoutingUpdatedAt: serverTimestamp(),
    defaultRoutingUpdatedBy: caller.uid,
  });
  return { assigneeType, assigneeId };
});

// ============================================
// One-time migration (super_admin)
// ============================================

/**
 * Seeds existing companies with their former hard-coded categories as editable documents and
 * sets each company's default routing assignee (its HR staff, else its company admin).
 * Dry run unless `dryRun: false` is passed. Pass `companyId` to do a single company.
 * Idempotent: companies already seeded are left alone.
 */
const migrateCategoryRouting = onCall(
  { ...BASE_OPTIONS, timeoutSeconds: 540, memory: '512MiB' },
  async (request) => {
    assertRole(request, ['super_admin']);
    const { companyId, dryRun } = request.data || {};
    const isDryRun = dryRun !== false;
    if (companyId !== undefined && (typeof companyId !== 'string' || !companyId || companyId.includes('/'))) {
      throw new HttpsError('invalid-argument', 'Invalid companyId.');
    }

    const ids = companyId
      ? [companyId]
      : (await db.collection('companies').select().get()).docs.map((d) => d.id);

    const results = [];
    for (const id of ids) {
      try {
        results.push(await seedCompany(db, id, { now: serverTimestamp(), dryRun: isDryRun }));
      } catch (error) {
        logger.error('migrateCategoryRouting: company failed', { companyId: id, code: error && error.code });
        results.push({ companyId: id, error: true });
      }
    }
    return { dryRun: isDryRun, companies: results.length, failed: results.filter((r) => r.error).length, results };
  }
);

module.exports = {
  createCategory,
  updateCategory,
  reorderCategories,
  setCategoryRoutingRule,
  removeCategoryRoutingRule,
  setDefaultRoutingAssignee,
  migrateCategoryRouting,
};
