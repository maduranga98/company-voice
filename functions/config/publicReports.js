/**
 * Shared constants for the public (no-login) report line.
 */

const REPORT_TYPES = {
  concern: 'problem_report',
  idea: 'idea_suggestion',
  question: 'team_discussion',
  // Vendor reports are stored in vendorReports, not posts; the value is only a label.
  vendor: 'vendor_report',
};

const VENDOR_REPORT_TYPE = 'vendor';
const VENDOR_CATEGORIES = ['labor', 'data_privacy', 'safety', 'fraud', 'compliance', 'other'];
const VENDOR_SEVERITIES = ['low', 'medium', 'high'];

const CATEGORIES = [
  'harassment',
  'discrimination',
  'safety',
  'fraud_ethics',
  'management',
  'workplace_conditions',
  'pay_benefits',
  'other',
];

const LANGUAGES = ['en', 'es', 'fr', 'it', 'si'];

const LIMITS = {
  maxFiles: 5,
  maxFileMB: 10,
  minDescription: 20,
  maxDescription: 5000,
  maxVendorName: 150,
  maxContactName: 100,
  maxContactEmail: 200,
  maxContactPhone: 40,
};

// Allowed attachment types and the extension used for the stored copy.
const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
};

const PENDING_PREFIX = 'public-reports/pending/';

const SUBMISSION_LIMITS = {
  perIpPerHour: 5,
  perCompanyPerDay: 50,
  hourMs: 60 * 60 * 1000,
  dayMs: 24 * 60 * 60 * 1000,
  idempotencyTtlMs: 15 * 60 * 1000,
};

const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

module.exports = {
  REPORT_TYPES,
  VENDOR_REPORT_TYPE,
  VENDOR_CATEGORIES,
  VENDOR_SEVERITIES,
  CATEGORIES,
  LANGUAGES,
  LIMITS,
  MIME_EXTENSIONS,
  PENDING_PREFIX,
  SUBMISSION_LIMITS,
  PENDING_MAX_AGE_MS,
};
