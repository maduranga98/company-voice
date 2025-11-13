/**
 * Billing Service
 * Frontend service for interacting with billing Firebase Functions
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe (publishable key should be in environment variables)
let stripePromise = null;
if (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
  stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
}

/**
 * Get Stripe instance
 * @returns {Promise<Stripe>}
 */
export async function getStripe() {
  if (!stripePromise) {
    throw new Error('Stripe publishable key not configured');
  }
  return await stripePromise;
}

// ============================================
// COMPANY ADMIN FUNCTIONS
// ============================================

/**
 * Create subscription for company
 * @param {Object} params - Subscription parameters
 * @param {string} params.companyId - Company ID
 * @param {string} params.paymentMethodId - Stripe payment method ID
 * @param {boolean} params.startTrial - Whether to start with trial
 * @returns {Promise<Object>} Subscription result
 */
export async function createSubscription({ companyId, paymentMethodId, startTrial = false }) {
  const createCompanySubscription = httpsCallable(functions, 'createCompanySubscription');
  const result = await createCompanySubscription({ companyId, paymentMethodId, startTrial });
  return result.data;
}

/**
 * Cancel company subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {boolean} immediate - Cancel immediately or at period end
 * @returns {Promise<Object>} Result
 */
export async function cancelSubscription(subscriptionId, immediate = false) {
  const cancelCompanySubscription = httpsCallable(functions, 'cancelCompanySubscription');
  const result = await cancelCompanySubscription({ subscriptionId, immediate });
  return result.data;
}

/**
 * Reactivate canceled subscription
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Result
 */
export async function reactivateSubscription(subscriptionId) {
  const reactivateCompanySubscription = httpsCallable(functions, 'reactivateCompanySubscription');
  const result = await reactivateCompanySubscription({ subscriptionId });
  return result.data;
}

/**
 * Get company subscription details
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Subscription data
 */
export async function getSubscription(companyId) {
  const getCompanySubscription = httpsCallable(functions, 'getCompanySubscription');
  const result = await getCompanySubscription({ companyId });
  return result.data;
}

/**
 * Get company invoices
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of invoices
 */
export async function getInvoices(companyId, options = {}) {
  const getInvoicesFunc = httpsCallable(functions, 'getInvoices');
  const result = await getInvoicesFunc({ companyId, ...options });
  return result.data;
}

/**
 * Get specific invoice
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Object>} Invoice data
 */
export async function getInvoice(invoiceId) {
  const getInvoiceFunc = httpsCallable(functions, 'getInvoice');
  const result = await getInvoiceFunc({ invoiceId });
  return result.data;
}

/**
 * Add payment method
 * @param {Object} params - Payment method parameters
 * @returns {Promise<Object>} Result
 */
export async function addPaymentMethod({ companyId, stripePaymentMethodId, setAsDefault = false }) {
  const addCompanyPaymentMethod = httpsCallable(functions, 'addCompanyPaymentMethod');
  const result = await addCompanyPaymentMethod({ companyId, stripePaymentMethodId, setAsDefault });
  return result.data;
}

/**
 * Get payment methods
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Array of payment methods
 */
export async function getPaymentMethods(companyId) {
  const getCompanyPaymentMethods = httpsCallable(functions, 'getCompanyPaymentMethods');
  const result = await getCompanyPaymentMethods({ companyId });
  return result.data;
}

/**
 * Remove payment method
 * @param {string} paymentMethodId - Payment method ID
 * @returns {Promise<Object>} Result
 */
export async function removePaymentMethod(paymentMethodId) {
  const removeCompanyPaymentMethod = httpsCallable(functions, 'removeCompanyPaymentMethod');
  const result = await removeCompanyPaymentMethod({ paymentMethodId });
  return result.data;
}

/**
 * Get payment history
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of payments
 */
export async function getPaymentHistory(companyId, options = {}) {
  const getCompanyPaymentHistory = httpsCallable(functions, 'getCompanyPaymentHistory');
  const result = await getCompanyPaymentHistory({ companyId, ...options });
  return result.data;
}

/**
 * Get usage summary for current billing period
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Usage summary
 */
export async function getUsageSummary(companyId) {
  const getUsageSummaryFunc = httpsCallable(functions, 'getUsageSummary');
  const result = await getUsageSummaryFunc({ companyId });
  return result.data;
}

// ============================================
// SUPER ADMIN FUNCTIONS
// ============================================

/**
 * Get all subscriptions (Super Admin)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of subscriptions
 */
export async function getAllSubscriptions(options = {}) {
  const getAllSubscriptionsFunc = httpsCallable(functions, 'getAllSubscriptions');
  const result = await getAllSubscriptionsFunc(options);
  return result.data;
}

/**
 * Get all invoices (Super Admin)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of invoices
 */
export async function getSuperAdminInvoices(options = {}) {
  const getSuperAdminInvoicesFunc = httpsCallable(functions, 'getSuperAdminInvoices');
  const result = await getSuperAdminInvoicesFunc(options);
  return result.data;
}

/**
 * Get revenue report (Super Admin)
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<Object>} Revenue report
 */
export async function getRevenueReport(month = null, year = null) {
  const getRevenueReportFunc = httpsCallable(functions, 'getRevenueReport');
  const result = await getRevenueReportFunc({ month, year });
  return result.data;
}

/**
 * Get billing disputes (Super Admin)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of disputes
 */
export async function getBillingDisputes(options = {}) {
  const getBillingDisputesFunc = httpsCallable(functions, 'getBillingDisputes');
  const result = await getBillingDisputesFunc(options);
  return result.data;
}

/**
 * Resolve billing dispute (Super Admin)
 * @param {Object} params - Dispute resolution parameters
 * @returns {Promise<Object>} Result
 */
export async function resolveBillingDispute(params) {
  const resolveBillingDisputeFunc = httpsCallable(functions, 'resolveBillingDispute');
  const result = await resolveBillingDisputeFunc(params);
  return result.data;
}

/**
 * Get all billing history (Super Admin)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of billing events
 */
export async function getAllBillingHistory(options = {}) {
  const getAllBillingHistoryFunc = httpsCallable(functions, 'getAllBillingHistory');
  const result = await getAllBillingHistoryFunc(options);
  return result.data;
}

/**
 * Update pricing tier (Super Admin)
 * @param {Object} params - Pricing tier parameters
 * @returns {Promise<Object>} Result
 */
export async function updatePricingTier(params) {
  const updatePricingTierFunc = httpsCallable(functions, 'updatePricingTier');
  const result = await updatePricingTierFunc(params);
  return result.data;
}

// ============================================
// STRIPE HELPERS
// ============================================

/**
 * Create payment method with Stripe Elements
 * @param {Object} cardElement - Stripe card element
 * @param {Object} billingDetails - Billing details
 * @returns {Promise<Object>} Payment method result
 */
export async function createPaymentMethod(cardElement, billingDetails) {
  const stripe = await getStripe();
  const result = await stripe.createPaymentMethod({
    type: 'card',
    card: cardElement,
    billing_details: billingDetails,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.paymentMethod;
}

/**
 * Confirm payment with client secret
 * @param {string} clientSecret - Payment intent client secret
 * @param {string} paymentMethodId - Payment method ID
 * @returns {Promise<Object>} Payment result
 */
export async function confirmPayment(clientSecret, paymentMethodId) {
  const stripe = await getStripe();
  const result = await stripe.confirmCardPayment(clientSecret, {
    payment_method: paymentMethodId,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.paymentIntent;
}

/**
 * Format currency amount
 * @param {number} amount - Amount in dollars
 * @param {string} currency - Currency code
 * @returns {string} Formatted amount
 */
export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format date
 * @param {Date|string|Object} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDate(date) {
  if (!date) return '-';

  let dateObj;
  if (date.toDate) {
    // Firestore Timestamp
    dateObj = date.toDate();
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
}

/**
 * Get subscription status badge color
 * @param {string} status - Subscription status
 * @returns {string} Tailwind color class
 */
export function getStatusColor(status) {
  const colors = {
    active: 'bg-green-100 text-green-800',
    trial: 'bg-blue-100 text-blue-800',
    past_due: 'bg-yellow-100 text-yellow-800',
    canceled: 'bg-gray-100 text-gray-800',
    suspended: 'bg-red-100 text-red-800',
    unpaid: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get payment status badge color
 * @param {string} status - Payment status
 * @returns {string} Tailwind color class
 */
export function getPaymentStatusColor(status) {
  const colors = {
    succeeded: 'bg-green-100 text-green-800',
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    open: 'bg-blue-100 text-blue-800',
    void: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
