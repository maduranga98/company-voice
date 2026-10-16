/**
 * Pure helpers for sharing a finalized case with an outside lawyer through a private,
 * read-only link. No I/O, so they can be unit tested.
 *
 * Privacy: a snapshot is built from an explicit allow-list of fields. Reporter identity
 * (authorId, author name/email, encrypted contact details) is never copied.
 */

const crypto = require('crypto');

const SHARE_ID_PATTERN = /^[A-Za-z0-9]{20}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_TAG = /<\/?[a-zA-Z!][^>]*>/g;

const LIMITS = {
  maxEmail: 200,
  maxName: 100,
  maxMessage: 2000,
  maxNotes: 100,
  maxMessages: 500,
  minDays: 1,
  maxDays: 30,
  defaultDays: 14,
};

class ShareValidationError extends Error {
  constructor(field) {
    super(`invalid:${field}`);
    this.field = field;
  }
}

const clean = (value, max, { multiline = false } = {}) => {
  if (typeof value !== 'string') return '';
  let text = value.normalize('NFC').replace(HTML_TAG, '');
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  text = multiline ? text.replace(/\r\n?/g, '\n') : text.replace(/[\t\r\n]+/g, ' ');
  return text.trim().slice(0, max);
};

/** @throws {ShareValidationError} */
function validateShareInput(data) {
  if (!data || typeof data !== 'object') throw new ShareValidationError('body');
  if (!['post', 'vendor'].includes(data.caseType)) throw new ShareValidationError('caseType');
  if (typeof data.caseId !== 'string' || !data.caseId || data.caseId.length > 128 || data.caseId.includes('/')) {
    throw new ShareValidationError('caseId');
  }

  const recipientEmail = clean(data.recipientEmail, LIMITS.maxEmail).toLowerCase();
  if (!EMAIL_PATTERN.test(recipientEmail)) throw new ShareValidationError('recipientEmail');

  const days = data.expiresInDays === undefined ? LIMITS.defaultDays : Number(data.expiresInDays);
  if (!Number.isInteger(days) || days < LIMITS.minDays || days > LIMITS.maxDays) {
    throw new ShareValidationError('expiresInDays');
  }

  const include = data.include && typeof data.include === 'object' ? data.include : {};
  return {
    caseType: data.caseType,
    caseId: data.caseId,
    recipientEmail,
    recipientName: clean(data.recipientName, LIMITS.maxName),
    message: clean(data.message, LIMITS.maxMessage, { multiline: true }),
    expiresInDays: days,
    include: {
      notes: include.notes === true,
      conversation: include.conversation === true,
      attachments: include.attachments !== false,
    },
  };
}

// ── token ───────────────────────────────────────────────────────────────────

/** 256-bit URL-safe token (43 chars). Only its HMAC is stored. */
const generateToken = () => crypto.randomBytes(32).toString('base64url');

const hashToken = (token, pepper) => crypto.createHmac('sha256', pepper).update(`share:${token}`).digest('hex');

function verifyToken(token, storedHash, pepper) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token) || typeof storedHash !== 'string') return false;
  const a = Buffer.from(hashToken(token, pepper), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const addDays = (from, days) => new Date(from + days * 24 * 60 * 60 * 1000);

/** 'active' | 'revoked' | 'expired' */
function shareState(share, now = Date.now()) {
  if (!share) return 'revoked';
  if (share.revoked === true) return 'revoked';
  const expires = share.expiresAt && share.expiresAt.toMillis ? share.expiresAt.toMillis() : Number(share.expiresAt);
  if (!Number.isFinite(expires) || expires <= now) return 'expired';
  return 'active';
}

// ── snapshot ────────────────────────────────────────────────────────────────

const iso = (ts) => {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const text = (value, max = 20000) => (typeof value === 'string' ? value.slice(0, max) : '');

function noteList(notes, include) {
  if (!include.notes || !Array.isArray(notes)) return [];
  return notes.slice(0, LIMITS.maxNotes).map((n) => ({
    author: text(n.authorName, 100) || 'Staff',
    text: text(n.text || n.content, 5000),
    createdAt: iso(n.createdAt),
  }));
}

function messageList(thread, include) {
  if (!include.conversation || !thread || !Array.isArray(thread.messages)) return [];
  return thread.messages
    .filter((m) => typeof m.content === 'string')
    .slice(0, LIMITS.maxMessages)
    .map((m) => ({
      sender: m.sender === 'reporter' ? 'Reporter (anonymous)' : 'Investigator',
      content: text(m.content, 5000),
      timestamp: m.timestamp || null,
    }));
}

/**
 * @param {'post'|'vendor'} caseType
 * @param {object} data       the case document
 * @param {{notes?: object[], thread?: object, corroborations?: object[]}} extras
 * @param {{notes: boolean, conversation: boolean, attachments: boolean}} include
 */
function buildSnapshot(caseType, data, extras, include) {
  const base = {
    caseType,
    status: text(data.status, 40) || 'open',
    priority: text(data.priority, 40) || 'medium',
    description: text(data.description || data.content),
    submittedAt: iso(data.submittedAt || data.createdAt),
    notes: noteList(extras.notes, include),
    conversation: messageList(extras.thread, include),
  };

  if (caseType === 'vendor') {
    return {
      ...base,
      title: `Vendor report: ${text(data.vendorName, 150)}`,
      reference: text(data.referenceCode, 40),
      vendorName: text(data.vendorName, 150),
      riskCategory: text(data.riskCategory, 40),
      severity: text(data.severity, 20),
      corroborationCount: Number(data.corroborationCount) || 0,
      corroborations: (extras.corroborations || []).slice(0, LIMITS.maxNotes).map((c) => ({
        relationship: text(c.relationship, 40),
        account: text(c.account, 5000),
        severity: text(c.severity, 20),
        submittedAt: iso(c.submittedAt),
      })),
      // Vendor evidence is stored as ready-made download URLs.
      attachments: include.attachments
        ? (Array.isArray(data.attachmentUrls) ? data.attachmentUrls : [])
            .filter((u) => typeof u === 'string' && u.startsWith('https://'))
            .map((url, i) => ({ name: `evidence-${i + 1}`, url }))
        : [],
    };
  }

  return {
    ...base,
    title: text(data.title, 200) || 'Report',
    reference: '',
    category: text(data.category, 40),
    type: text(data.type, 40),
    involvesHR: data.involvesHR === true,
    // Public-report evidence is stored by path; it gets a short-lived link on every view.
    attachments: include.attachments
      ? (Array.isArray(data.attachments) ? data.attachments : [])
          .filter((a) => a && typeof a.path === 'string')
          .map((a) => ({ name: text(a.name, 100) || 'evidence', path: a.path, type: text(a.type, 60) }))
      : [],
  };
}

// ── email ───────────────────────────────────────────────────────────────────

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buildShareEmail({ companyName, recipientName, senderName, message, link, expiresAt, title }) {
  const greeting = recipientName ? `Dear ${esc(recipientName)},` : 'Hello,';
  const expiry = expiresAt.toISOString().slice(0, 10);
  const subject = `Confidential: case file shared by ${companyName || 'a client'}`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#2D3E50;line-height:1.5">
<p>${greeting}</p>
<p>${esc(senderName || 'A representative')} of <strong>${esc(companyName || 'your client')}</strong> has shared a confidential case file with you${title ? `: <em>${esc(title)}</em>` : ''}.</p>
${message ? `<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #1ABC9C;white-space:pre-wrap">${esc(message)}</blockquote>` : ''}
<p><a href="${esc(link)}" style="display:inline-block;background:#2D3E50;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open the case file</a></p>
<p style="font-size:13px;color:#6b7280">No account or login is needed. The link is private, read-only and expires on ${expiry}. You can download a PDF copy from that page. Please do not forward this email.</p>
</body></html>`;
  return { subject, html };
}

module.exports = {
  SHARE_ID_PATTERN,
  TOKEN_PATTERN,
  LIMITS,
  ShareValidationError,
  validateShareInput,
  generateToken,
  hashToken,
  verifyToken,
  addDays,
  shareState,
  buildSnapshot,
  buildShareEmail,
};
