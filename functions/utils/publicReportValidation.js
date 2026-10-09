/**
 * Strict server-side validation for public report submissions.
 * Pure functions: no I/O, so they can be unit tested.
 */

const {
  REPORT_TYPES,
  CATEGORIES,
  LANGUAGES,
  LIMITS,
  MIME_EXTENSIONS,
  PENDING_PREFIX,
} = require('../config/publicReports');
const { SLUG_PATTERN } = require('./reportSlugs');

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_TAG = /<\/?[a-zA-Z!][^>]*>/g;
// C0/C1 controls (keeping \t \n \r, handled separately) and bidi override characters.
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;

class ValidationError extends Error {
  constructor(field) {
    super(`invalid:${field}`);
    this.field = field;
  }
}

function sanitizeText(value, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  let text = value.normalize('NFC').replace(HTML_TAG, '').replace(CONTROL_CHARS, '');
  if (multiline) {
    text = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
  } else {
    text = text.replace(/[\t\r\n]+/g, ' ');
  }
  return text.trim();
}

function validateContact(contact) {
  if (contact === undefined || contact === null) return null;
  if (typeof contact !== 'object' || Array.isArray(contact)) throw new ValidationError('contact');

  const name = sanitizeText(contact.name);
  const email = sanitizeText(contact.email);
  const phone = sanitizeText(contact.phone);

  if (name.length > LIMITS.maxContactName) throw new ValidationError('contact');
  if (email.length > LIMITS.maxContactEmail) throw new ValidationError('contact');
  if (phone.length > LIMITS.maxContactPhone) throw new ValidationError('contact');
  if (email && !EMAIL_PATTERN.test(email)) throw new ValidationError('contact');

  if (!name && !email && !phone) return null;
  return { name, email, phone };
}

function validateAttachments(attachments, uploadId) {
  if (attachments === undefined || attachments === null) return [];
  if (!Array.isArray(attachments) || attachments.length > LIMITS.maxFiles) {
    throw new ValidationError('attachments');
  }
  if (attachments.length > 0 && !TOKEN_PATTERN.test(uploadId || '')) {
    throw new ValidationError('uploadId');
  }

  const prefix = `${PENDING_PREFIX}${uploadId}/`;
  const seen = new Set();
  return attachments.map((item) => {
    const path = item && item.path;
    if (typeof path !== 'string' || !path.startsWith(prefix) || path.length > 256) {
      throw new ValidationError('attachments');
    }
    const fileName = path.slice(prefix.length);
    if (!fileName || fileName.includes('/') || fileName.includes('..') || seen.has(path)) {
      throw new ValidationError('attachments');
    }
    seen.add(path);
    return path;
  });
}

/**
 * @returns {object} normalized submission
 * @throws {ValidationError}
 */
function validateSubmission(data) {
  if (!data || typeof data !== 'object') throw new ValidationError('body');

  if (typeof data.slug !== 'string' || !SLUG_PATTERN.test(data.slug)) {
    throw new ValidationError('slug');
  }
  if (!Object.prototype.hasOwnProperty.call(REPORT_TYPES, data.type)) {
    throw new ValidationError('type');
  }
  if (!CATEGORIES.includes(data.category)) throw new ValidationError('category');

  const description = sanitizeText(data.description, { multiline: true });
  if (description.length < LIMITS.minDescription || description.length > LIMITS.maxDescription) {
    throw new ValidationError('description');
  }

  if (data.involvesHR !== undefined && typeof data.involvesHR !== 'boolean') {
    throw new ValidationError('involvesHR');
  }
  if (typeof data.idempotencyToken !== 'string' || !TOKEN_PATTERN.test(data.idempotencyToken)) {
    throw new ValidationError('idempotencyToken');
  }
  if (typeof data.turnstileToken !== 'string' || !data.turnstileToken || data.turnstileToken.length > 4096) {
    throw new ValidationError('turnstileToken');
  }

  return {
    slug: data.slug,
    type: data.type,
    category: data.category,
    description,
    involvesHR: data.involvesHR === true,
    contact: validateContact(data.contact),
    attachmentPaths: validateAttachments(data.attachments, data.uploadId),
    uploadId: data.uploadId,
    idempotencyToken: data.idempotencyToken,
    turnstileToken: data.turnstileToken,
    clientLang: LANGUAGES.includes(data.clientLang) ? data.clientLang : 'en',
  };
}

/** Title from the first ~80 characters of the description, cut at a word boundary. */
function deriveTitle(description) {
  const firstLine = description.split('\n').find((line) => line.trim()) || description;
  const flat = firstLine.replace(/\s+/g, ' ').trim();
  if (flat.length <= 80) return flat;
  const cut = flat.slice(0, 80);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Detect the real file type from magic bytes. Returns a MIME key or null. */
function sniffMime(buf) {
  if (!buf || buf.length < 12) return null;
  const ascii = (start, end) => buf.toString('latin1', start, end);
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(0, 4) === '%PDF') return 'application/pdf';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'audio/webm';
  if (ascii(4, 8) === 'ftyp') return 'audio/mp4';
  return null;
}

function isAllowedMime(mime) {
  return Object.prototype.hasOwnProperty.call(MIME_EXTENSIONS, mime);
}

module.exports = {
  ValidationError,
  sanitizeText,
  validateSubmission,
  deriveTitle,
  sniffMime,
  isAllowedMime,
};
