/**
 * Per-company settings: companies/{id}.settings (a nested map so future toggles share one home).
 * Every flag is opt-out: a missing value means "on", so companies that existed before a flag
 * was introduced keep the behaviour they already had.
 */

const DEFAULT_COMPANY_SETTINGS = Object.freeze({ allowCaseProgressCheck: true, allowVendorRisk: true });

/** True unless the company has explicitly turned the /c "check my case" feature off. */
function isCaseProgressCheckAllowed(company) {
  return !(company && company.settings && company.settings.allowCaseProgressCheck === false);
}

/** True unless the company has explicitly turned the Vendor Risk report type off. */
function isVendorRiskAllowed(company) {
  return !(company && company.settings && company.settings.allowVendorRisk === false);
}

/**
 * Validates an updateCompanySettings payload and returns Firestore dot-path updates.
 * Unknown keys are rejected so the callable can't be used to write arbitrary fields.
 */
function buildSettingsUpdate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('settings must be an object');
  }
  const keys = Object.keys(input);
  if (keys.length === 0) throw new TypeError('no settings provided');

  const updates = {};
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_COMPANY_SETTINGS, key)) {
      throw new TypeError(`unknown setting: ${key}`);
    }
    if (typeof input[key] !== 'boolean') throw new TypeError(`${key} must be a boolean`);
    updates[`settings.${key}`] = input[key];
  }
  return updates;
}

module.exports = { DEFAULT_COMPANY_SETTINGS, isCaseProgressCheckAllowed, isVendorRiskAllowed, buildSettingsUpdate };
