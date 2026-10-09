/**
 * Cloudflare Turnstile server-side verification. Fails closed.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;

async function verifyTurnstile(token, secret) {
  if (!secret || typeof token !== 'string' || !token) return false;

  // Test seam: only honoured inside the Functions emulator.
  const url =
    process.env.FUNCTIONS_EMULATOR === 'true' && process.env.TURNSTILE_VERIFY_URL
      ? process.env.TURNSTILE_VERIFY_URL
      : VERIFY_URL;

  try {
    // The reporter's IP is deliberately not forwarded to Cloudflare.
    const response = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true;
  } catch {
    return false;
  }
}

module.exports = { verifyTurnstile };
