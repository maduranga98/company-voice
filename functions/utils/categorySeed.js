/**
 * Seeds a company with editable category documents and a default routing assignee.
 *
 * Used by the one-time migration (callable `migrateCategoryRouting` and
 * scripts/seedCategoriesRouting.js) and, lazily, by the public report flow for companies
 * created after the migration ran. Idempotent: the categories are seeded once (guarded by
 * companies/{id}.categoriesSeededAt) and the default assignee is only filled in when missing,
 * so re-running never overwrites an admin's edits.
 */

const {
  DEFAULT_CATEGORIES,
  SYSTEM_CATEGORY_ID,
  SYSTEM_CATEGORY_NAME,
  SYSTEM_CATEGORY_ORDER,
} = require('../config/categoryRouting');
const { toNameKey, isActiveUser } = require('./categoryRouting');

const SYSTEM_ACTOR = 'system';

function categoryDoc(def, order, now, extra = {}) {
  return {
    name: def.name,
    nameKey: toNameKey(def.name),
    description: '',
    isActive: true,
    isSystemDefined: false,
    order,
    createdAt: now,
    updatedAt: now,
    createdBy: SYSTEM_ACTOR,
    ...extra,
  };
}

/**
 * The company's existing HR staff (all active HR users, as a role) or, when there are none,
 * its first active company admin.
 */
async function pickDefaultAssignee(read, db, companyId) {
  const hr = await read(db.collection('users').where('companyId', '==', companyId).where('role', '==', 'hr'));
  if (hr.docs.some((d) => isActiveUser(d.data()))) return { type: 'role', id: 'hr' };

  const admins = await read(
    db.collection('users').where('companyId', '==', companyId).where('role', '==', 'company_admin')
  );
  const admin = admins.docs.find((d) => isActiveUser(d.data()));
  return admin ? { type: 'user', id: admin.id } : null;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} companyId
 * @param {{ now: *, dryRun?: boolean }} options `now` is a server timestamp sentinel.
 * @returns {Promise<{companyId: string, categoriesSeeded: number, defaultAssignee: object|null, skipped?: string}>}
 */
async function seedCompany(db, companyId, { now, dryRun = false }) {
  const companyRef = db.collection('companies').doc(companyId);

  return db.runTransaction(async (tx) => {
    const read = (query) => tx.get(query);

    const companySnap = await tx.get(companyRef);
    if (!companySnap.exists) {
      return { companyId, categoriesSeeded: 0, defaultAssignee: null, skipped: 'company_not_found' };
    }
    const company = companySnap.data();
    const needsCategories = !company.categoriesSeededAt;
    const needsDefault = !company.defaultRoutingAssigneeType || !company.defaultRoutingAssigneeId;

    let existingIds = new Set();
    if (needsCategories) {
      const existing = await tx.get(companyRef.collection('categories'));
      existingIds = new Set(existing.docs.map((d) => d.id));
    }
    const assignee = needsDefault ? await pickDefaultAssignee(read, db, companyId) : null;

    const toCreate = [];
    if (needsCategories) {
      DEFAULT_CATEGORIES.forEach((def, index) => {
        if (!existingIds.has(def.id)) {
          toCreate.push({ id: def.id, data: categoryDoc(def, index, now, { i18nKey: def.id }) });
        }
      });
      if (!existingIds.has(SYSTEM_CATEGORY_ID)) {
        toCreate.push({
          id: SYSTEM_CATEGORY_ID,
          data: categoryDoc({ name: SYSTEM_CATEGORY_NAME }, SYSTEM_CATEGORY_ORDER, now, { isSystemDefined: true }),
        });
      }
    }

    const summary = { companyId, categoriesSeeded: toCreate.length, defaultAssignee: assignee };
    if (dryRun) return summary;

    toCreate.forEach(({ id, data }) => tx.set(companyRef.collection('categories').doc(id), data));

    const companyUpdate = {};
    if (needsCategories) companyUpdate.categoriesSeededAt = now;
    if (needsDefault) {
      // Left null when the company has no active HR or admin; the submission flow then
      // falls back to its pre-existing behaviour until an admin picks one in the UI.
      companyUpdate.defaultRoutingAssigneeType = assignee ? assignee.type : null;
      companyUpdate.defaultRoutingAssigneeId = assignee ? assignee.id : null;
    }
    if (Object.keys(companyUpdate).length > 0) tx.update(companyRef, companyUpdate);

    return summary;
  });
}

/** Lazy hook for request paths: a no-op unless this company has not been seeded yet. */
async function ensureSeeded(db, companyId, company, now) {
  const seeded = !!company.categoriesSeededAt;
  const hasDefault = !!company.defaultRoutingAssigneeType && !!company.defaultRoutingAssigneeId;
  if (seeded && hasDefault) return;
  await seedCompany(db, companyId, { now });
}

module.exports = { seedCompany, ensureSeeded, pickDefaultAssignee };
