/**
 * Firebase Cloud Functions for Company Voice Platform
 * Stripe Billing System, Search, and Notifications
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

// Search API
const {
  advancedSearch,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
  useSavedSearch,
  getSearchAnalytics,
} = require('./api/searchApi');

// Notification API
const {
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotifications,
  markNotificationsAsRead,
  markNotificationsAsUnread,
  deleteNotifications,
  getUnreadCount,
} = require('./api/notificationApi');

// Auth API
const {
  generateAuthToken,
} = require('./api/authApi');

// Webhooks - COMMENTED OUT FOR NOW
// const { handleStripeWebhook } = require('./webhooks/stripeWebhook');

// Scheduled Jobs - COMMENTED OUT FOR NOW
// const {
//   monthlyBillingJob,
//   gracePeriodCheckJob,
//   paymentRetryJob,
//   trialExpirationCheckJob,
//   usageTrackingSyncJob,
// } = require('./scheduled/billingJobs');

const {
  dailyEmailDigestJob,
  weeklyEmailDigestJob,
} = require('./scheduled/notificationJobs');

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

// Export Webhooks - COMMENTED OUT FOR NOW
// exports.handleStripeWebhook = handleStripeWebhook;

// Export Scheduled Jobs - COMMENTED OUT FOR NOW
// exports.monthlyBillingJob = monthlyBillingJob;
// exports.gracePeriodCheckJob = gracePeriodCheckJob;
// exports.paymentRetryJob = paymentRetryJob;
// exports.trialExpirationCheckJob = trialExpirationCheckJob;
// exports.usageTrackingSyncJob = usageTrackingSyncJob;
exports.dailyEmailDigestJob = dailyEmailDigestJob;
exports.weeklyEmailDigestJob = weeklyEmailDigestJob;

// Export Search Functions
exports.advancedSearch = advancedSearch;
exports.saveSearch = saveSearch;
exports.getSavedSearches = getSavedSearches;
exports.deleteSavedSearch = deleteSavedSearch;
exports.useSavedSearch = useSavedSearch;
exports.getSearchAnalytics = getSearchAnalytics;

// Export Notification Functions
exports.getNotificationPreferences = getNotificationPreferences;
exports.updateNotificationPreferences = updateNotificationPreferences;
exports.getNotifications = getNotifications;
exports.markNotificationsAsRead = markNotificationsAsRead;
exports.markNotificationsAsUnread = markNotificationsAsUnread;
exports.deleteNotifications = deleteNotifications;
exports.getUnreadCount = getUnreadCount;

// Export Auth Functions
exports.generateAuthToken = generateAuthToken;
