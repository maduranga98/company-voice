/**
 * Company Admin API
 * HTTP callable functions for company billing management
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { isCompanyAdmin } = require('../utils/helpers');
const { createSubscription, createCheckoutSession, finalizeCheckoutSession, cancelSubscription, reactivateSubscription, updateDeclaredUserCount } = require('../services/subscriptionService');
const { countDistinctAcknowledgedEmployees } = require('../utils/policyAck');
const { getCompanyInvoices, getInvoiceById } = require('../services/invoiceService');
const { addPaymentMethod, getPaymentMethods, removePaymentMethod, getPaymentHistory } = require('../services/paymentService');
const { getCurrentPeriodUsageSummary } = require('../services/usageTrackingService');
const { db, COLLECTIONS } = require('../config/firebase');
const { stripeSecretKey, stripeWebhookSecret, initializeStripe } = require('../config/stripe');
const { PORTAL_ORIGINS } = require('../config/callableOptions');

/**
 * Create subscription for company
 */
const createCompanySubscription = onCall({
  cors: true,
  memory: '128MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, paymentMethodId, declaredUserCount, startTrial = false } = data;

  if (!companyId || !paymentMethodId) {
    throw new HttpsError('invalid-argument', 'Company ID and payment method ID are required');
  }

  if (!Number.isInteger(declaredUserCount) || declaredUserCount <= 0) {
    throw new HttpsError('invalid-argument', 'Declared employee count must be a positive integer');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth, companyId);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized to manage this company');
  }

  const userId = auth.uid;

  try {
    const result = await createSubscription({
      companyId,
      paymentMethodId,
      createdBy: userId,
      declaredUserCount,
      startTrial,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error creating subscription:', error);
    // 'internal' hides the message from the client; surface the real reason (e.g. card declined)
    throw new HttpsError('failed-precondition', error.message);
  }
});

/**
 * Start a Stripe-hosted Checkout Session; the client redirects the browser to the returned URL
 */
const createCompanyCheckoutSession = onCall({
  cors: true,
  memory: '256MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, declaredUserCount, returnOrigin } = data;

  if (!companyId) {
    throw new HttpsError('invalid-argument', 'Company ID is required');
  }
  if (!Number.isInteger(declaredUserCount) || declaredUserCount <= 0) {
    throw new HttpsError('invalid-argument', 'Declared employee count must be a positive integer');
  }
  if (!(await isCompanyAdmin(auth, companyId))) {
    throw new HttpsError('permission-denied', 'User is not authorized to manage this company');
  }

  // Only redirect back to our own origins (plus localhost for development)
  const isLocal = /^http:\/\/localhost:\d+$/.test(returnOrigin || '');
  const origin = PORTAL_ORIGINS.includes(returnOrigin) || isLocal ? returnOrigin : PORTAL_ORIGINS[0];

  try {
    const result = await createCheckoutSession({
      companyId,
      createdBy: auth.uid,
      declaredUserCount,
      returnUrl: `${origin}/company/billing`,
    });
    return { success: true, data: result };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new HttpsError('failed-precondition', error.message);
  }
});

/**
 * Record the subscription right after Stripe redirects back (the webhook may be slower)
 */
const syncCheckoutSession = onCall({
  cors: true,
  memory: '256MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { sessionId } = data;
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
    throw new HttpsError('invalid-argument', 'Checkout session ID is required');
  }

  try {
    const session = await initializeStripe().checkout.sessions.retrieve(sessionId);
    const companyId = session.metadata?.companyId;
    if (!companyId || !(await isCompanyAdmin(auth, companyId))) {
      throw new HttpsError('permission-denied', 'User is not authorized to manage this company');
    }
    const result = await finalizeCheckoutSession(sessionId);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Error syncing checkout session:', error);
    throw new HttpsError('failed-precondition', error.message);
  }
});

/**
 * Cancel company subscription
 */
const cancelCompanySubscription = onCall({
  cors: true,
  memory: '128MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { subscriptionId, immediate = false } = data;

  if (!subscriptionId) {
    throw new HttpsError('invalid-argument', 'Subscription ID is required');
  }

  try {
    // Get subscription to verify company
    const subscriptionDoc = await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).get();
    if (!subscriptionDoc.exists) {
      throw new HttpsError('not-found', 'Subscription not found');
    }

    const subscriptionData = subscriptionDoc.data();

    // Verify user is company admin
    const isAuthorized = await isCompanyAdmin(auth, subscriptionData.companyId);
    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'User is not authorized to manage this subscription');
    }

    const userId = auth.uid;

    await cancelSubscription({
      subscriptionId,
      immediate,
      canceledBy: userId,
    });

    return { success: true };
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Reactivate canceled subscription
 */
const reactivateCompanySubscription = onCall({
  cors: true,
  memory: '128MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { subscriptionId } = data;

  if (!subscriptionId) {
    throw new HttpsError('invalid-argument', 'Subscription ID is required');
  }

  try {
    // Get subscription to verify company
    const subscriptionDoc = await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).get();
    if (!subscriptionDoc.exists) {
      throw new HttpsError('not-found', 'Subscription not found');
    }

    const subscriptionData = subscriptionDoc.data();

    // Verify user is company admin
    const isAuthorized = await isCompanyAdmin(auth, subscriptionData.companyId);
    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'User is not authorized to manage this subscription');
    }

    const userId = auth.uid;

    await reactivateSubscription({
      subscriptionId,
      reactivatedBy: userId,
    });

    return { success: true };
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Get company subscription details
 */
const getCompanySubscription = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId } = data;

  if (!companyId) {
    throw new HttpsError('invalid-argument', 'Company ID is required');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth, companyId);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized to view this company');
  }

  try {
    const subscriptionsSnapshot = await db
      .collection(COLLECTIONS.SUBSCRIPTIONS)
      .where('companyId', '==', companyId)
      .limit(1)
      .get();

    if (subscriptionsSnapshot.empty) {
      return { success: true, data: null };
    }

    const subscriptionDoc = subscriptionsSnapshot.docs[0];
    const liveVerifiedAcknowledgedCount = await countDistinctAcknowledgedEmployees(db, companyId);
    return {
      success: true,
      data: {
        id: subscriptionDoc.id,
        ...subscriptionDoc.data(),
        liveVerifiedAcknowledgedCount,
      },
    };
  } catch (error) {
    console.error('Error getting subscription:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Update the declared employee count for a company's subscription
 */
const updateDeclaredEmployeeCount = onCall({
  cors: true,
  memory: '128MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, declaredUserCount } = data;

  if (!companyId) {
    throw new HttpsError('invalid-argument', 'Company ID is required');
  }

  if (!Number.isInteger(declaredUserCount) || declaredUserCount <= 0) {
    throw new HttpsError('invalid-argument', 'Declared employee count must be a positive integer');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth, companyId);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized to manage this company');
  }

  try {
    const subscriptionsSnapshot = await db
      .collection(COLLECTIONS.SUBSCRIPTIONS)
      .where('companyId', '==', companyId)
      .limit(1)
      .get();

    if (subscriptionsSnapshot.empty) {
      throw new HttpsError('not-found', 'No subscription found for this company');
    }

    const result = await updateDeclaredUserCount({
      subscriptionId: subscriptionsSnapshot.docs[0].id,
      declaredUserCount,
      updatedBy: auth.uid,
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Error updating declared employee count:', error);
    if (/declared count/i.test(error.message)) {
      throw new HttpsError('failed-precondition', error.message);
    }
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Get company invoices
 */
const getInvoices = onCall({
  cors: true,
  memory: '128MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, status = null, limit = 50 } = data;

  if (!companyId) {
    throw new HttpsError('invalid-argument', 'Company ID is required');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth, companyId);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized to view this company');
  }

  try {
    const invoices = await getCompanyInvoices(companyId, { status, limit });
    return { success: true, data: invoices };
  } catch (error) {
    console.error('Error getting invoices:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Get specific invoice details
 */
const getInvoice = onCall({
  cors: true,
  memory: '128MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { invoiceId } = data;

  if (!invoiceId) {
    throw new HttpsError('invalid-argument', 'Invoice ID is required');
  }

  try {
    const invoice = await getInvoiceById(invoiceId);

    if (!invoice) {
      throw new HttpsError('not-found', 'Invoice not found');
    }

    // Verify user is company admin
    const isAuthorized = await isCompanyAdmin(auth, invoice.companyId);
    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'User is not authorized to view this invoice');
    }

    return { success: true, data: invoice };
  } catch (error) {
    console.error('Error getting invoice:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Add payment method
 */
const addCompanyPaymentMethod = onCall({
  cors: true,
  memory: '128MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, stripePaymentMethodId, setAsDefault = false } = data;

  if (!companyId || !stripePaymentMethodId) {
    throw new HttpsError('invalid-argument', 'Company ID and payment method ID are required');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth, companyId);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized to manage this company');
  }

  const userId = auth.uid;

  try {
    const paymentMethodId = await addPaymentMethod({
      companyId,
      stripePaymentMethodId,
      setAsDefault,
      addedBy: userId,
    });

    return { success: true, data: { paymentMethodId } };
  } catch (error) {
    console.error('Error adding payment method:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Get payment methods
 */
const getCompanyPaymentMethods = onCall({
  cors: true,
  memory: '128MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId } = data;

  if (!companyId) {
    throw new HttpsError('invalid-argument', 'Company ID is required');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth, companyId);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized to view this company');
  }

  try {
    const paymentMethods = await getPaymentMethods(companyId);
    return { success: true, data: paymentMethods };
  } catch (error) {
    console.error('Error getting payment methods:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Remove payment method
 */
const removeCompanyPaymentMethod = onCall({
  cors: true,
  memory: '128MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { paymentMethodId } = data;

  if (!paymentMethodId) {
    throw new HttpsError('invalid-argument', 'Payment method ID is required');
  }

  try {
    // Get payment method to verify company
    const paymentMethodDoc = await db.collection(COLLECTIONS.PAYMENT_METHODS).doc(paymentMethodId).get();
    if (!paymentMethodDoc.exists) {
      throw new HttpsError('not-found', 'Payment method not found');
    }

    const paymentMethodData = paymentMethodDoc.data();

    // Verify user is company admin
    const isAuthorized = await isCompanyAdmin(auth, paymentMethodData.companyId);
    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'User is not authorized to manage this payment method');
    }

    const userId = auth.uid;

    await removePaymentMethod({
      paymentMethodId,
      removedBy: userId,
    });

    return { success: true };
  } catch (error) {
    console.error('Error removing payment method:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Get payment history
 */
const getCompanyPaymentHistory = onCall({
  cors: true,
  memory: '128MiB',
  secrets: [stripeSecretKey]
}, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, limit = 50 } = data;

  if (!companyId) {
    throw new HttpsError('invalid-argument', 'Company ID is required');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth, companyId);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized to view this company');
  }

  try {
    const payments = await getPaymentHistory(companyId, { limit });
    return { success: true, data: payments };
  } catch (error) {
    console.error('Error getting payment history:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Get usage summary for current billing period
 */
const getUsageSummary = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId } = data;

  if (!companyId) {
    throw new HttpsError('invalid-argument', 'Company ID is required');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth, companyId);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized to view this company');
  }

  try {
    const usageSummary = await getCurrentPeriodUsageSummary(companyId);
    return { success: true, data: usageSummary };
  } catch (error) {
    console.error('Error getting usage summary:', error);
    throw new HttpsError('internal', error.message);
  }
});

module.exports = {
  createCompanySubscription,
  createCompanyCheckoutSession,
  syncCheckoutSession,
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
};
