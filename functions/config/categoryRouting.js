/**
 * Constants for per-company submission categories and category routing.
 *
 * companies/{companyId}/categories/{categoryId}
 * companies/{companyId}/routingRules/{categoryId}   (doc id == categoryId: one rule per category)
 */

const CATEGORY_LIMITS = {
  nameMax: 60,
  descriptionMax: 200,
  maxPerCompany: 50,
};

// Vendor Risk is a fixed, system-defined case type. It is listed next to the editable
// categories but is never renamed, deactivated or reordered, and its structured fields
// (vendor name, risk severity, risk category, ...) are not part of this configuration.
const SYSTEM_CATEGORY_ID = 'vendor_risk';
const SYSTEM_CATEGORY_NAME = 'Vendor Risk';
// Sorts after every editable category.
const SYSTEM_CATEGORY_ORDER = 1000000;

// Roles a case can be routed to, and the only roles that may be named as an assignee.
const ASSIGNEE_TYPES = ['user', 'role'];
const ASSIGNABLE_ROLES = ['hr', 'company_admin'];

// The categories the public form offered before they became configurable. They keep their
// old ids so existing posts and legacy condition-based routing rules still line up, and
// keep their i18nKey so the translated labels keep working until an admin renames one.
// This list is read only by the seed/migration; the submission flow never uses it.
const DEFAULT_CATEGORIES = [
  { id: 'harassment', name: 'Harassment or bullying' },
  { id: 'discrimination', name: 'Discrimination' },
  { id: 'safety', name: 'Health and safety' },
  { id: 'fraud_ethics', name: 'Fraud or ethics' },
  { id: 'management', name: 'Management conduct' },
  { id: 'workplace_conditions', name: 'Workplace conditions' },
  { id: 'pay_benefits', name: 'Pay and benefits' },
  { id: 'other', name: 'Something else' },
];

module.exports = {
  CATEGORY_LIMITS,
  SYSTEM_CATEGORY_ID,
  SYSTEM_CATEGORY_NAME,
  SYSTEM_CATEGORY_ORDER,
  ASSIGNEE_TYPES,
  ASSIGNABLE_ROLES,
  DEFAULT_CATEGORIES,
};
