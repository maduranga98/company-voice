/**
 * Firebase Cloud Functions for Company Voice Platform
 * Stripe Billing System
 */

// Company Admin API
const {
  createCompanySubscription,
  cancelCompanySubscription,
  reactivateCompanySubscription,
  getCompanySubscription,
  getInvoices,
  getInvoice,
  addCompanyPaymentMethod,
  getCompanyPaymentMethods,
  removeCompanyPaymentMethod,
  getCompanyPaymentHistory,
  getUsageSummary,
} = require('./api/companyAdminApi');

// Super Admin API
const {
  getAllSubscriptions,
  getSuperAdminInvoices,
  getRevenueReport,
  getBillingDisputes,
  resolveBillingDispute,
  getAllBillingHistory,
  updatePricingTier,
} = require('./api/superAdminApi');

// Webhooks
const { handleStripeWebhook } = require('./webhooks/stripeWebhook');

// Scheduled Jobs
const {
  monthlyBillingJob,
  gracePeriodCheckJob,
  paymentRetryJob,
  trialExpirationCheckJob,
  usageTrackingSyncJob,
} = require('./scheduled/billingJobs');

// Export Company Admin Functions
exports.createCompanySubscription = createCompanySubscription;
exports.cancelCompanySubscription = cancelCompanySubscription;
exports.reactivateCompanySubscription = reactivateCompanySubscription;
exports.getCompanySubscription = getCompanySubscription;
exports.getInvoices = getInvoices;
exports.getInvoice = getInvoice;
exports.addCompanyPaymentMethod = addCompanyPaymentMethod;
exports.getCompanyPaymentMethods = getCompanyPaymentMethods;
exports.removeCompanyPaymentMethod = removeCompanyPaymentMethod;
exports.getCompanyPaymentHistory = getCompanyPaymentHistory;
exports.getUsageSummary = getUsageSummary;

// Export Super Admin Functions
exports.getAllSubscriptions = getAllSubscriptions;
exports.getSuperAdminInvoices = getSuperAdminInvoices;
exports.getRevenueReport = getRevenueReport;
exports.getBillingDisputes = getBillingDisputes;
exports.resolveBillingDispute = resolveBillingDispute;
exports.getAllBillingHistory = getAllBillingHistory;
exports.updatePricingTier = updatePricingTier;

// Export Webhooks
exports.handleStripeWebhook = handleStripeWebhook;

// Export Scheduled Jobs
exports.monthlyBillingJob = monthlyBillingJob;
exports.gracePeriodCheckJob = gracePeriodCheckJob;
exports.paymentRetryJob = paymentRetryJob;
exports.trialExpirationCheckJob = trialExpirationCheckJob;
exports.usageTrackingSyncJob = usageTrackingSyncJob;
