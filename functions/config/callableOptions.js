/**
 * Options shared by the v2 callables that browsers call directly:
 * App Check enforced, CORS limited to the portal origins (any origin in the emulator).
 */

const PORTAL_ORIGINS = [
  'https://portal.voxwel.com',
  'https://voxwel.com',
  ...(process.env.GCLOUD_PROJECT
    ? [`https://${process.env.GCLOUD_PROJECT}.web.app`, `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`]
    : []),
];

const BASE_OPTIONS = {
  cors: process.env.FUNCTIONS_EMULATOR === 'true' ? true : PORTAL_ORIGINS,
  enforceAppCheck: true,
};

/** Best-effort client address for rate limiting. Callers must hash it; never store or log it. */
function clientIp(request) {
  const raw = request.rawRequest;
  if (!raw) return 'unknown';
  return raw.ip || (raw.headers && String(raw.headers['x-forwarded-for'] || '').split(',')[0].trim()) || 'unknown';
}

module.exports = { PORTAL_ORIGINS, BASE_OPTIONS, clientIp };
