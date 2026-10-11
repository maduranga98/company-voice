/**
 * Pure helpers for the public policy acknowledgement line: input validation, employee
 * identity normalization, deterministic dedupe ids, roster parsing and the Firestore
 * transaction body that records an acknowledgement exactly once per employee per
 * policy version. No I/O except through the `tx` handed in, so it is unit testable.
 */

const crypto = require('crypto');
const { sanitizeText } = require('./publicReportValidation');
const { SLUG_PATTERN } = require('./reportSlugs');
const { RESPONSES, LIMITS, MIN_FILL_MS } = require('../config/policyAck');
const { LANGUAGES } = require('../config/publicReports');

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
// Letters/digits first, then letters, digits, space, dot, underscore, hyphen. No slash, so the
// normalized key is always a legal Firestore document id.
const EMPLOYEE_ID_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;

class PolicyAckValidationError extends Error {
  constructor(field) {
    super(`invalid:${field}`);
    this.field = field;
  }
}

/** Display form: sanitized and trimmed, spaces inside kept. Returns '' when unusable. */
function cleanEmployeeId(raw) {
  return sanitizeText(raw).normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/**
 * Identity key used for dedupe and as the roster document id: lower-cased with every
 * whitespace removed, so "EMP 0042", "emp0042" and " Emp0042 " are one employee.
 */
function normalizeEmployeeId(raw) {
  return cleanEmployeeId(raw).replace(/\s+/g, '').toLowerCase();
}

function isValidEmployeeId(cleaned) {
  return (
    cleaned.length >= LIMITS.minEmployeeId &&
    cleaned.length <= LIMITS.maxEmployeeId &&
    EMPLOYEE_ID_PATTERN.test(cleaned)
  );
}

/** Deterministic id: one acknowledgement per employee per policy version, however many tries. */
function ackDocId({ policyId, policyVersion, employeeKey }) {
  return crypto
    .createHash('sha256')
    .update(`${policyId}\u0000${policyVersion}\u0000${employeeKey}`)
    .digest('hex');
}

/**
 * @returns {object} normalized submission
 * @throws {PolicyAckValidationError}
 */
function validateAckSubmission(data) {
  if (!data || typeof data !== 'object') throw new PolicyAckValidationError('body');

  if (typeof data.slug !== 'string' || !SLUG_PATTERN.test(data.slug)) {
    throw new PolicyAckValidationError('slug');
  }

  const employeeId = cleanEmployeeId(data.employeeId);
  if (!isValidEmployeeId(employeeId)) throw new PolicyAckValidationError('employeeId');
  const employeeKey = normalizeEmployeeId(employeeId);

  const employeeName = sanitizeText(data.employeeName);
  if (employeeName.length < LIMITS.minEmployeeName || employeeName.length > LIMITS.maxEmployeeName) {
    throw new PolicyAckValidationError('employeeName');
  }

  if (!RESPONSES.includes(data.response)) throw new PolicyAckValidationError('response');

  let concernText = '';
  if (data.response === 'concern') {
    concernText = sanitizeText(data.concernText, { multiline: true });
    if (concernText.length < LIMITS.minConcern || concernText.length > LIMITS.maxConcern) {
      throw new PolicyAckValidationError('concernText');
    }
  }

  const policyVersion = sanitizeText(data.policyVersion);
  if (!policyVersion || policyVersion.length > LIMITS.maxVersion) {
    throw new PolicyAckValidationError('policyVersion');
  }

  if (typeof data.idempotencyToken !== 'string' || !TOKEN_PATTERN.test(data.idempotencyToken)) {
    throw new PolicyAckValidationError('idempotencyToken');
  }
  // Bot traps, same idea as the report form: a filled honeypot or an instant submit.
  // Scripts can forge both, so they only cut casual spam.
  if (data.website !== undefined && data.website !== '') throw new PolicyAckValidationError('honeypot');
  if (
    typeof data.elapsedMs !== 'number' ||
    !Number.isFinite(data.elapsedMs) ||
    data.elapsedMs < MIN_FILL_MS
  ) {
    throw new PolicyAckValidationError('elapsedMs');
  }

  return {
    slug: data.slug,
    employeeId,
    employeeKey,
    employeeName,
    response: data.response,
    concernText,
    policyVersion,
    idempotencyToken: data.idempotencyToken,
    clientLang: LANGUAGES.includes(data.clientLang) ? data.clientLang : 'en',
  };
}

/**
 * Parse a pasted roster: one employee per line, "ID, Name" (comma, semicolon or tab).
 * A line with a single value is treated as an ID with no name. Duplicate IDs (after
 * normalization) keep the first occurrence. A header line such as "employee id, name" is
 * skipped. Returns { employees, rejected } where rejected holds 1-based line numbers.
 */
function parseRosterText(text) {
  const employees = [];
  const rejected = [];
  if (typeof text !== 'string') return { employees, rejected };

  const seen = new Set();
  const lines = text.split(/\r\n|\r|\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const [idPart, ...rest] = line.split(/[,;\t]/);
    const employeeId = cleanEmployeeId(idPart);
    const name = sanitizeText(rest.join(' ')).slice(0, LIMITS.maxEmployeeName);

    if (index === 0 && /^(employee\s*)?(id|number|no\.?)$/i.test(employeeId)) return;
    if (!isValidEmployeeId(employeeId)) {
      rejected.push(index + 1);
      return;
    }
    const key = normalizeEmployeeId(employeeId);
    if (seen.has(key)) return;
    seen.add(key);
    employees.push({ employeeId, employeeKey: key, name });
  });
  return { employees, rejected };
}

/**
 * Transaction body: record one acknowledgement and keep the distinct-employee roster.
 *
 * - `ackRef`'s id is deterministic per (policy, version, employee), so a second call is a no-op.
 * - `employeeRef` (companies/{id}/policyEmployees/{employeeKey}) holds one doc per distinct
 *   employee who ever acknowledged anything: its collection count is the billing quantity.
 *
 * @returns {Promise<{created: boolean}>}
 */
async function recordAcknowledgement(tx, { ackRef, employeeRef, ack, employee, now }) {
  const [ackSnap, employeeSnap] = await Promise.all([tx.get(ackRef), tx.get(employeeRef)]);
  if (ackSnap.exists) return { created: false };

  tx.set(ackRef, ack);
  if (employeeSnap.exists) {
    const existing = employeeSnap.data();
    tx.update(employeeRef, {
      employeeName: employee.employeeName,
      lastAcknowledgedAt: now,
      lastPolicyId: ack.policyId,
      acknowledgementCount: (existing.acknowledgementCount || 0) + 1,
      onRoster: employee.onRoster,
    });
  } else {
    tx.set(employeeRef, {
      employeeKey: employee.employeeKey,
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      onRoster: employee.onRoster,
      firstAcknowledgedAt: now,
      lastAcknowledgedAt: now,
      lastPolicyId: ack.policyId,
      acknowledgementCount: 1,
    });
  }
  return { created: true };
}

/**
 * Step 5 billing hook: how many distinct employees ever acknowledged a policy at this
 * company (one aggregation query over the roster, no document reads).
 * Pass `{ sinceMs }` to count only employees who acknowledged within the window.
 */
async function countDistinctAcknowledgedEmployees(db, companyId, { sinceMs } = {}) {
  let query = db.collection('companies').doc(companyId).collection('policyEmployees');
  if (sinceMs) query = query.where('lastAcknowledgedAt', '>=', new Date(sinceMs));
  const snap = await query.count().get();
  return snap.data().count;
}

module.exports = {
  PolicyAckValidationError,
  cleanEmployeeId,
  normalizeEmployeeId,
  isValidEmployeeId,
  ackDocId,
  validateAckSubmission,
  parseRosterText,
  recordAcknowledgement,
  countDistinctAcknowledgedEmployees,
};
