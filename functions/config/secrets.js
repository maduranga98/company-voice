/**
 * Functions secrets shared across APIs (set with `firebase functions:secrets:set NAME`).
 */

const { defineSecret } = require('firebase-functions/params');

module.exports = {
  ANONYMOUS_SECRET: defineSecret('ANONYMOUS_SECRET'),
  TURNSTILE_SECRET: defineSecret('TURNSTILE_SECRET'),
  CASE_KEY_PEPPER: defineSecret('CASE_KEY_PEPPER'),
  IP_HASH_SALT: defineSecret('IP_HASH_SALT'),
};
