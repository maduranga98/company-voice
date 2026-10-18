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
  updateDeclaredEmployeeCount,
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
  login,
  changeOwnPassword,
} = require('./api/authApi');

// User management API
const {
  createStaffUser,
  createCompanyWithAdmin,
  setUserStatus,
  changeUserRole,
  resetStaffPassword,
  deleteRemovedUsers,
  deleteCompany,
} = require('./api/userManagementApi');

// Public Report API (no-login report line)
const {
  getPublicReportConfig,
  submitPublicReport,
  ensureReportSlug,
  setReportingEnabled,
  updateCompanySettings,
} = require('./api/publicReportApi');

// Category & routing configuration (company_admin / hr), plus the one-time migration (super_admin)
const {
  createCategory,
  updateCategory,
  reorderCategories,
  setCategoryRoutingRule,
  removeCategoryRoutingRule,
  setDefaultRoutingAssignee,
  migrateCategoryRouting,
} = require('./api/categoryRoutingApi');

const { cleanupPublicReports } = require('./scheduled/publicReportJobs');

// Case sharing with outside counsel (private read-only link, no login for the lawyer)
const { createCaseShare, revokeCaseShare, getSharedCase } = require('./api/caseShareApi');

// Check My Case API (no-login case status and private replies)
const { getCaseStatus, submitCaseReply } = require('./api/caseAccessApi');

// Policy Acknowledgement API (no-login policy acknowledgement links)
const {
  getPolicyForLink,
  submitPolicyAcknowledgement,
  ensurePolicyLink,
  ensurePolicyBundleLink,
  setPolicyLinkActive,
  setPolicyLinkRoster,
} = require('./api/policyAckApi');

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
exports.updateDeclaredEmployeeCount = updateDeclaredEmployeeCount;

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
exports.createCaseShare = createCaseShare;
exports.revokeCaseShare = revokeCaseShare;
exports.getSharedCase = getSharedCase;

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
exports.login = login;
exports.changeOwnPassword = changeOwnPassword;

// Export User Management Functions
exports.createStaffUser = createStaffUser;
exports.createCompanyWithAdmin = createCompanyWithAdmin;
exports.setUserStatus = setUserStatus;
exports.changeUserRole = changeUserRole;
exports.resetStaffPassword = resetStaffPassword;
exports.deleteRemovedUsers = deleteRemovedUsers;
exports.deleteCompany = deleteCompany;

// Export Public Report Functions
exports.getPublicReportConfig = getPublicReportConfig;
exports.submitPublicReport = submitPublicReport;
exports.ensureReportSlug = ensureReportSlug;
exports.setReportingEnabled = setReportingEnabled;
exports.updateCompanySettings = updateCompanySettings;
exports.cleanupPublicReports = cleanupPublicReports;

// Export Category & Routing Functions
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.reorderCategories = reorderCategories;
exports.setCategoryRoutingRule = setCategoryRoutingRule;
exports.removeCategoryRoutingRule = removeCategoryRoutingRule;
exports.setDefaultRoutingAssignee = setDefaultRoutingAssignee;
exports.migrateCategoryRouting = migrateCategoryRouting;

// Export Check My Case Functions
exports.getCaseStatus = getCaseStatus;
exports.submitCaseReply = submitCaseReply;

// Export Policy Acknowledgement Functions
exports.getPolicyForLink = getPolicyForLink;
exports.submitPolicyAcknowledgement = submitPolicyAcknowledgement;
exports.ensurePolicyLink = ensurePolicyLink;
exports.ensurePolicyBundleLink = ensurePolicyBundleLink;
exports.setPolicyLinkActive = setPolicyLinkActive;
exports.setPolicyLinkRoster = setPolicyLinkRoster;
