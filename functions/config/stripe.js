/**
 * Stripe Configuration
 * Initializes Stripe SDK with environment-specific settings
 */

const { defineSecret } = require('firebase-functions/params');

// Define secrets for Stripe API keys
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

/**
 * Initialize Stripe with secret key
 * @returns {Stripe} Stripe instance
 */
function initializeStripe() {
  const Stripe = require('stripe');
  return Stripe(stripeSecretKey.value(), {
    apiVersion: '2024-10-28.acacia', // Use latest stable API version
  });
}

/**
 * Get webhook secret
 * @returns {string} Webhook signing secret
 */
function getWebhookSecret() {
  return stripeWebhookSecret.value();
}

/**
 * Stripe pricing configuration
 */
const PRICING = {
  PRICE_PER_USER: 1.00, // $1 per user per month
  CURRENCY: 'usd',
  BILLING_INTERVAL: 'month',
  GRACE_PERIOD_DAYS: 7,
  MAX_PAYMENT_RETRIES: 3,
  TRIAL_PERIOD_DAYS: 14,
};

/**
 * Subscription statuses
 */
const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  UNPAID: 'unpaid',
  SUSPENDED: 'suspended',
};

/**
 * Invoice statuses
 */
const INVOICE_STATUS = {
  DRAFT: 'draft',
  OPEN: 'open',
  PAID: 'paid',
  VOID: 'void',
  UNCOLLECTIBLE: 'uncollectible',
};

/**
 * Payment statuses
 */
const PAYMENT_STATUS = {
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  PENDING: 'pending',
  CANCELED: 'canceled',
};

/**
 * Usage event types
 */
const USAGE_EVENT_TYPE = {
  USER_ADDED: 'user_added',
  USER_REMOVED: 'user_removed',
  USER_REACTIVATED: 'user_reactivated',
};

/**
 * Billing event types
 */
const BILLING_EVENT_TYPE = {
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_UPDATED: 'subscription_updated',
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
  PAYMENT_SUCCEEDED: 'payment_succeeded',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_RETRY_SCHEDULED: 'payment_retry_scheduled',
  GRACE_PERIOD_STARTED: 'grace_period_started',
  GRACE_PERIOD_ENDED: 'grace_period_ended',
  ACCOUNT_SUSPENDED: 'account_suspended',
  ACCOUNT_REACTIVATED: 'account_reactivated',
  INVOICE_CREATED: 'invoice_created',
  INVOICE_PAID: 'invoice_paid',
  USER_ADDED: 'user_added',
  USER_REMOVED: 'user_removed',
  PAYMENT_METHOD_ADDED: 'payment_method_added',
  PAYMENT_METHOD_UPDATED: 'payment_method_updated',
  PAYMENT_METHOD_REMOVED: 'payment_method_removed',
};

module.exports = {
  initializeStripe,
  getWebhookSecret,
  stripeSecretKey, // Export for function config
  stripeWebhookSecret, // Export for function config
  PRICING,
  SUBSCRIPTION_STATUS,
  INVOICE_STATUS,
  PAYMENT_STATUS,
  USAGE_EVENT_TYPE,
  BILLING_EVENT_TYPE,
};
