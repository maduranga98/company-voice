/**
 * SMTP mail for account notifications (nodemailer).
 * Config: secrets SMTP_USER / SMTP_PASS (`firebase functions:secrets:set`), params SMTP_HOST,
 * SMTP_PORT, SMTP_FROM, PORTAL_URL (functions/.env). Functions that send mail must list
 * MAIL_SECRETS in their `secrets` option.
 */

const nodemailer = require('nodemailer');
const logger = require('firebase-functions/logger');
const { defineSecret, defineString } = require('firebase-functions/params');

const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const SMTP_HOST = defineString('SMTP_HOST');
const SMTP_PORT = defineString('SMTP_PORT', { default: '587' });
const SMTP_FROM = defineString('SMTP_FROM', { default: '' });
const PORTAL_URL = defineString('PORTAL_URL', { default: 'https://portal.voxwel.com' });

const MAIL_SECRETS = [SMTP_USER, SMTP_PASS];

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function createTransport() {
  const port = Number(SMTP_PORT.value());
  return nodemailer.createTransport({
    host: SMTP_HOST.value(),
    port,
    secure: port === 465,
    auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
  });
}

/**
 * Emails a new or reset staff member their username and temporary password.
 * Never throws: returns false (and logs without the password) so account creation is unaffected.
 * @param {{to: string, displayName?: string, username: string, temporaryPassword: string, companyName?: string, reset?: boolean}} p
 */
async function sendCredentialsEmail({ to, displayName, username, temporaryPassword, companyName, reset = false }) {
  if (!to) return false;
  try {
    const loginUrl = PORTAL_URL.value();
    const subject = reset ? 'Your password has been reset' : 'Your account has been created';
    const intro = reset
      ? 'Your password was reset by an administrator.'
      : `An account has been created for you${companyName ? ` for ${companyName}` : ''}.`;
    const name = displayName || 'there';

    const text = [
      `Hello ${name},`,
      '',
      intro,
      '',
      `Login: ${loginUrl}`,
      `Username: ${username}`,
      `Temporary password: ${temporaryPassword}`,
      '',
      'You will be asked to choose a new password when you first sign in.',
    ].join('\n');

    const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
<h2 style="font-weight:600">${escapeHtml(subject)}</h2>
<p>Hello ${escapeHtml(name)},</p>
<p>${escapeHtml(intro)}</p>
<table style="border-collapse:collapse;margin:16px 0">
<tr><td style="padding:4px 12px 4px 0;color:#666">Username</td><td><b>${escapeHtml(username)}</b></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#666">Temporary password</td><td><code style="font-size:15px">${escapeHtml(temporaryPassword)}</code></td></tr>
</table>
<p><a href="${escapeHtml(loginUrl)}" style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Sign in</a></p>
<p style="color:#666;font-size:13px">You will be asked to choose a new password when you first sign in.</p>
</div>`;

    await createTransport().sendMail({
      from: SMTP_FROM.value() || SMTP_USER.value(),
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    logger.error('Failed to send credentials email', { message: err.message, code: err.code });
    return false;
  }
}

module.exports = { MAIL_SECRETS, sendCredentialsEmail };
