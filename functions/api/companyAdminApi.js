/**
 * Company Admin API
 * HTTP callable functions for company billing management
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { isCompanyAdmin } = require('../utils/helpers');
const { createSubscription, cancelSubscription, reactivateSubscription } = require('../services/subscriptionService');
const { getCompanyInvoices, getInvoiceById } = require('../services/invoiceService');
const { addPaymentMethod, getPaymentMethods, removePaymentMethod, getPaymentHistory } = require('../services/paymentService');
const { getCurrentPeriodUsageSummary } = require('../services/usageTrackingService');
const { db, COLLECTIONS } = require('../config/firebase');

/**
 * Create subscription for company
 */
const createCompanySubscription = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, paymentMethodId, startTrial = false } = data;

  if (!companyId || !paymentMethodId) {
    throw new HttpsError('invalid-argument', 'Company ID and payment method ID are required');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth.uid, companyId);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized to manage this company');
  }

  try {
    const result = await createSubscription({
      companyId,
      paymentMethodId,
      createdBy: auth.uid,
      startTrial,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Cancel company subscription
 */
const cancelCompanySubscription = onCall({ cors: true, memory: '128MiB' }, async (request) => {
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
    const isAuthorized = await isCompanyAdmin(auth.uid, subscriptionData.companyId);
    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'User is not authorized to manage this subscription');
    }

    await cancelSubscription({
      subscriptionId,
      immediate,
      canceledBy: auth.uid,
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
const reactivateCompanySubscription = onCall({ cors: true, memory: '128MiB' }, async (request) => {
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
    const isAuthorized = await isCompanyAdmin(auth.uid, subscriptionData.companyId);
    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'User is not authorized to manage this subscription');
    }

    await reactivateSubscription({
      subscriptionId,
      reactivatedBy: auth.uid,
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
  const isAuthorized = await isCompanyAdmin(auth.uid, companyId);
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
    return {
      success: true,
      data: {
        id: subscriptionDoc.id,
        ...subscriptionDoc.data(),
      },
    };
  } catch (error) {
    console.error('Error getting subscription:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Get company invoices
 */
const getInvoices = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, status = null, limit = 50 } = data;

  if (!companyId) {
    throw new HttpsError('invalid-argument', 'Company ID is required');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth.uid, companyId);
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
const getInvoice = onCall({ cors: true, memory: '128MiB' }, async (request) => {
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
    const isAuthorized = await isCompanyAdmin(auth.uid, invoice.companyId);
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
const addCompanyPaymentMethod = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, stripePaymentMethodId, setAsDefault = false } = data;

  if (!companyId || !stripePaymentMethodId) {
    throw new HttpsError('invalid-argument', 'Company ID and payment method ID are required');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth.uid, companyId);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized to manage this company');
  }

  try {
    const paymentMethodId = await addPaymentMethod({
      companyId,
      stripePaymentMethodId,
      setAsDefault,
      addedBy: auth.uid,
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
const getCompanyPaymentMethods = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId } = data;

  if (!companyId) {
    throw new HttpsError('invalid-argument', 'Company ID is required');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth.uid, companyId);
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
const removeCompanyPaymentMethod = onCall({ cors: true, memory: '128MiB' }, async (request) => {
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
    const isAuthorized = await isCompanyAdmin(auth.uid, paymentMethodData.companyId);
    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'User is not authorized to manage this payment method');
    }

    await removePaymentMethod({
      paymentMethodId,
      removedBy: auth.uid,
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
const getCompanyPaymentHistory = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, limit = 50 } = data;

  if (!companyId) {
    throw new HttpsError('invalid-argument', 'Company ID is required');
  }

  // Verify user is company admin
  const isAuthorized = await isCompanyAdmin(auth.uid, companyId);
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
  const isAuthorized = await isCompanyAdmin(auth.uid, companyId);
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
};
