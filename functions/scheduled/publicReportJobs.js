/**
 * Scheduled cleanup for the public report line:
 * - pending evidence uploads older than 24h that were never attached to a report
 * - expired rate-limit and idempotency documents
 *
 * Also enable a Firestore TTL policy on rateLimits.expiresAt (see STEP1_NOTES.md);
 * this job is the fallback.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { admin, db } = require('../config/firebase');
const { PENDING_PREFIX, PENDING_MAX_AGE_MS } = require('../config/publicReports');

const BATCH_SIZE = 400;

async function deleteStalePendingFiles(now = Date.now()) {
  const bucket = admin.storage().bucket();
  let deleted = 0;
  let pageToken;

  do {
    const [files, nextQuery] = await bucket.getFiles({
      prefix: PENDING_PREFIX,
      autoPaginate: false,
      maxResults: 500,
      pageToken,
    });
    for (const file of files) {
      const created = Date.parse(file.metadata.timeCreated);
      if (Number.isFinite(created) && now - created > PENDING_MAX_AGE_MS) {
        await file.delete({ ignoreNotFound: true });
        deleted++;
      }
    }
    pageToken = nextQuery && nextQuery.pageToken;
  } while (pageToken);

  return deleted;
}

async function deleteExpiredRateLimits(now = new Date()) {
  let deleted = 0;
  for (;;) {
    const expired = await db
      .collection('rateLimits')
      .where('expiresAt', '<', now)
      .limit(BATCH_SIZE)
      .get();
    if (expired.empty) break;

    const batch = db.batch();
    expired.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += expired.size;
    if (expired.size < BATCH_SIZE) break;
  }
  return deleted;
}

const cleanupPublicReports = onSchedule(
  { schedule: 'every 6 hours', timeZone: 'UTC', memory: '256MiB' },
  async () => {
    const files = await deleteStalePendingFiles();
    const limits = await deleteExpiredRateLimits();
    logger.info('cleanupPublicReports: done', { files, limits });
  }
);

module.exports = { cleanupPublicReports, deleteStalePendingFiles, deleteExpiredRateLimits };
