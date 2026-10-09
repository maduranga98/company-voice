/**
 * Report link slugs: reportSlugs/{slug} -> { companyId, active, createdAt }.
 * A slug is the slugified company name plus 4 random base32 characters, so
 * links can't be guessed from the company name alone.
 */

const { randomChars } = require('./caseKeys');

const SLUG_PATTERN = /^[a-z0-9-]{6,48}$/;
const MAX_NAME_PART = 30;
const MAX_ATTEMPTS = 5;

function slugifyName(name) {
  const base = String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NAME_PART)
    .replace(/-+$/g, '');
  return base || 'company';
}

function buildSlug(name) {
  return `${slugifyName(name)}-${randomChars(4).toLowerCase()}`;
}

/**
 * Create (or rotate) the report slug of a company inside one transaction.
 * @returns {Promise<{slug: string, created: boolean}>}
 */
async function issueReportSlug(db, serverTimestamp, { companyId, rotate = false }) {
  const companyRef = db.collection('companies').doc(companyId);

  return db.runTransaction(async (tx) => {
    const companySnap = await tx.get(companyRef);
    if (!companySnap.exists) {
      const err = new Error('company-not-found');
      err.code = 'company-not-found';
      throw err;
    }
    const company = companySnap.data();

    if (company.reportSlug && !rotate) {
      return { slug: company.reportSlug, created: false };
    }

    let slug = null;
    for (let i = 0; i < MAX_ATTEMPTS && !slug; i++) {
      const candidate = buildSlug(company.name);
      const taken = await tx.get(db.collection('reportSlugs').doc(candidate));
      if (!taken.exists) slug = candidate;
    }
    if (!slug) {
      const err = new Error('slug-collision');
      err.code = 'slug-collision';
      throw err;
    }

    if (company.reportSlug) {
      tx.update(db.collection('reportSlugs').doc(company.reportSlug), {
        active: false,
        deactivatedAt: serverTimestamp(),
      });
    }
    tx.set(db.collection('reportSlugs').doc(slug), {
      companyId,
      active: true,
      createdAt: serverTimestamp(),
    });
    tx.update(companyRef, {
      reportSlug: slug,
      reportingEnabled: company.reportingEnabled !== false,
    });
    return { slug, created: true };
  });
}

module.exports = { SLUG_PATTERN, slugifyName, buildSlug, issueReportSlug };
