/**
 * Utility Helper Functions
 * Common utilities used across billing services
 */

const { db, COLLECTIONS, serverTimestamp } = require('../config/firebase');

/**
 * Generate invoice number
 * @param {string} companyId - Company ID
 * @param {Date} date - Invoice date
 * @returns {string} Invoice number (e.g., INV-2025-01-ABC123)
 */
function generateInvoiceNumber(companyId, date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const companyShort = companyId.substring(0, 6).toUpperCase();
  return `INV-${year}-${month}-${companyShort}`;
}

/**
 * Calculate proration amount
 * @param {number} pricePerUser - Price per user per month
 * @param {Date} startDate - Start date of proration period
 * @param {Date} endDate - End date of billing period
 * @returns {number} Prorated amount
 */
function calculateProration(pricePerUser, startDate, endDate) {
  const totalDays = getDaysInMonth(endDate);
  const remainingDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  return (pricePerUser / totalDays) * remainingDays;
}

/**
 * Get days in month
 * @param {Date} date - Date in the month
 * @returns {number} Number of days in month
 */
function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Calculate next billing date
 * @param {Date} currentDate - Current billing date
 * @returns {Date} Next billing date (same day next month)
 */
function getNextBillingDate(currentDate = new Date()) {
  const nextDate = new Date(currentDate);
  nextDate.setMonth(nextDate.getMonth() + 1);
  return nextDate;
}

/**
 * Check if date is in grace period
 * @param {Date} gracePeriodEndsAt - Grace period end date
 * @returns {boolean} True if in grace period
 */
function isInGracePeriod(gracePeriodEndsAt) {
  if (!gracePeriodEndsAt) return false;
  return new Date() < new Date(gracePeriodEndsAt);
}

/**
 * Calculate grace period end date
 * @param {Date} startDate - Start date of grace period
 * @param {number} days - Number of grace period days
 * @returns {Date} Grace period end date
 */
function calculateGracePeriodEnd(startDate = new Date(), days = 7) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);
  return endDate;
}

/**
 * Get active user count for company
 * @param {string} companyId - Company ID
 * @returns {Promise<number>} Count of active users
 */
async function getActiveUserCount(companyId) {
  const usersSnapshot = await db
    .collection(COLLECTIONS.USERS)
    .where('companyId', '==', companyId)
    .where('status', '==', 'active')
    .count()
    .get();

  return usersSnapshot.data().count;
}

/**
 * Format currency amount
 * @param {number} amount - Amount in dollars
 * @param {string} currency - Currency code (default: 'usd')
 * @returns {string} Formatted amount
 */
function formatCurrency(amount, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

/**
 * Convert Stripe amount to dollars
 * Stripe stores amounts in cents
 * @param {number} stripeAmount - Amount in cents
 * @returns {number} Amount in dollars
 */
function stripeCentsToDollars(stripeAmount) {
  return stripeAmount / 100;
}

/**
 * Convert dollars to Stripe cents
 * @param {number} dollars - Amount in dollars
 * @returns {number} Amount in cents
 */
function dollarsToStripeCents(dollars) {
  return Math.round(dollars * 100);
}

/**
 * Log billing event to billing history
 * @param {Object} params - Event parameters
 * @param {string} params.companyId - Company ID
 * @param {string} params.eventType - Type of billing event
 * @param {string} params.description - Human-readable description
 * @param {Object} params.eventData - Event-specific data
 * @param {string} params.subscriptionId - Subscription ID (optional)
 * @param {string} params.invoiceId - Invoice ID (optional)
 * @param {string} params.paymentId - Payment ID (optional)
 * @param {string} params.userId - User ID (optional)
 * @param {string} params.performedBy - User who performed action (optional)
 * @returns {Promise<string>} Created document ID
 */
async function logBillingEvent({
  companyId,
  eventType,
  description,
  eventData = {},
  subscriptionId = null,
  invoiceId = null,
  paymentId = null,
  userId = null,
  performedBy = null,
  metadata = {},
}) {
  const eventDoc = {
    companyId,
    subscriptionId,
    eventType,
    eventData,
    invoiceId,
    paymentId,
    userId,
    description,
    metadata,
    timestamp: serverTimestamp(),
    performedBy,
  };

  const docRef = await db.collection(COLLECTIONS.BILLING_HISTORY).add(eventDoc);
  return docRef.id;
}

/**
 * Validate user has required role
 * @param {string} userId - User ID
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Promise<boolean>} True if user has required role
 */
async function validateUserRole(userId, allowedRoles) {
  const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();

  if (!userDoc.exists) {
    return false;
  }

  const userData = userDoc.data();
  return allowedRoles.includes(userData.role);
}

/**
 * Check if user is super admin
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user is super admin
 */
async function isSuperAdmin(userId) {
  return validateUserRole(userId, ['SUPER_ADMIN']);
}

/**
 * Check if user is company admin
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Promise<boolean>} True if user is company admin for this company
 */
async function isCompanyAdmin(userId, companyId) {
  const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();

  if (!userDoc.exists) {
    return false;
  }

  const userData = userDoc.data();
  return (
    userData.companyId === companyId &&
    (userData.role === 'COMPANY_ADMIN' || userData.role === 'SUPER_ADMIN')
  );
}

/**
 * Get company by ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object|null>} Company data or null
 */
async function getCompany(companyId) {
  const companyDoc = await db.collection(COLLECTIONS.COMPANIES).doc(companyId).get();

  if (!companyDoc.exists) {
    return null;
  }

  return {
    id: companyDoc.id,
    ...companyDoc.data(),
  };
}

/**
 * Retry logic with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} Result of function
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

module.exports = {
  generateInvoiceNumber,
  calculateProration,
  getDaysInMonth,
  getNextBillingDate,
  isInGracePeriod,
  calculateGracePeriodEnd,
  getActiveUserCount,
  formatCurrency,
  stripeCentsToDollars,
  dollarsToStripeCents,
  logBillingEvent,
  validateUserRole,
  isSuperAdmin,
  isCompanyAdmin,
  getCompany,
  retryWithBackoff,
};
