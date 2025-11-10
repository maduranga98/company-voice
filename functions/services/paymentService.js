/**
 * Payment Service
 * Handles payment processing, retries, and payment method management
 */

const { initializeStripe, PAYMENT_STATUS, PRICING } = require('../config/stripe');
const { db, COLLECTIONS, serverTimestamp } = require('../config/firebase');
const { stripeCentsToDollars, logBillingEvent, retryWithBackoff } = require('../utils/helpers');
const { BILLING_EVENT_TYPE } = require('../config/stripe');
const { startGracePeriod } = require('./subscriptionService');

/**
 * Process payment for invoice
 * @param {Object} params - Payment parameters
 * @param {string} params.invoiceId - Invoice ID
 * @param {string} params.stripePaymentIntentId - Stripe payment intent ID
 * @returns {Promise<Object>} Payment result
 */
async function processPayment({ invoiceId, stripePaymentIntentId }) {
  const stripe = initializeStripe();
  const admin = require('firebase-admin');

  try {
    // Get invoice
    const invoiceDoc = await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      throw new Error('Invoice not found');
    }

    const invoiceData = invoiceDoc.data();

    // Get subscription
    const subscriptionDoc = await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(invoiceData.subscriptionId).get();
    const subscriptionData = subscriptionDoc.data();

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

    // Get payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);

    const paymentMethodDetails = {
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand || null,
      last4: paymentMethod.card?.last4 || paymentMethod.us_bank_account?.last4 || null,
      expiryMonth: paymentMethod.card?.exp_month || null,
      expiryYear: paymentMethod.card?.exp_year || null,
    };

    // Create payment record
    const paymentData = {
      companyId: invoiceData.companyId,
      subscriptionId: invoiceData.subscriptionId,
      invoiceId,
      stripePaymentIntentId,
      stripeChargeId: paymentIntent.charges?.data[0]?.id || null,
      stripePaymentMethodId: paymentIntent.payment_method,
      amount: stripeCentsToDollars(paymentIntent.amount),
      currency: paymentIntent.currency,
      status: paymentIntent.status === 'succeeded' ? PAYMENT_STATUS.SUCCEEDED : PAYMENT_STATUS.PENDING,
      paymentMethod: paymentMethodDetails,
      failureCode: null,
      failureMessage: null,
      attemptNumber: 1,
      maxAttempts: PRICING.MAX_PAYMENT_RETRIES,
      nextRetryDate: null,
      attemptedAt: serverTimestamp(),
      succeededAt: paymentIntent.status === 'succeeded' ? serverTimestamp() : null,
      failedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const paymentRef = await db.collection(COLLECTIONS.PAYMENTS).add(paymentData);

    // Log event
    await logBillingEvent({
      companyId: invoiceData.companyId,
      subscriptionId: invoiceData.subscriptionId,
      invoiceId,
      paymentId: paymentRef.id,
      eventType: BILLING_EVENT_TYPE.PAYMENT_SUCCEEDED,
      description: `Payment of $${paymentData.amount.toFixed(2)} initiated`,
      eventData: {
        amount: paymentData.amount,
        paymentIntentId: stripePaymentIntentId,
      },
    });

    return {
      paymentId: paymentRef.id,
      status: paymentData.status,
      amount: paymentData.amount,
    };
  } catch (error) {
    console.error('Error processing payment:', error);
    throw error;
  }
}

/**
 * Handle payment failure
 * @param {Object} params - Failure parameters
 * @param {string} params.paymentId - Payment ID (optional, can be null for first failure)
 * @param {string} params.stripePaymentIntentId - Stripe payment intent ID
 * @param {string} params.failureCode - Stripe failure code
 * @param {string} params.failureMessage - Failure message
 * @returns {Promise<void>}
 */
async function handlePaymentFailure({ paymentId = null, stripePaymentIntentId, failureCode, failureMessage }) {
  const admin = require('firebase-admin');

  try {
    let paymentDoc;
    let paymentData;

    if (paymentId) {
      paymentDoc = await db.collection(COLLECTIONS.PAYMENTS).doc(paymentId).get();
      paymentData = paymentDoc.data();
    } else {
      // Find payment by payment intent ID
      const snapshot = await db
        .collection(COLLECTIONS.PAYMENTS)
        .where('stripePaymentIntentId', '==', stripePaymentIntentId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        paymentDoc = snapshot.docs[0];
        paymentData = paymentDoc.data();
        paymentId = paymentDoc.id;
      } else {
        console.error('Payment record not found for payment intent:', stripePaymentIntentId);
        return;
      }
    }

    const attemptNumber = paymentData.attemptNumber || 1;

    // Update payment record
    const updates = {
      status: PAYMENT_STATUS.FAILED,
      failureCode,
      failureMessage,
      failedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Schedule retry if under max attempts
    if (attemptNumber < PRICING.MAX_PAYMENT_RETRIES) {
      const nextRetryDate = new Date();
      nextRetryDate.setDate(nextRetryDate.getDate() + 1); // Retry in 1 day
      updates.nextRetryDate = admin.firestore.Timestamp.fromDate(nextRetryDate);
    }

    await db.collection(COLLECTIONS.PAYMENTS).doc(paymentId).update(updates);

    // Update subscription payment status
    await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(paymentData.subscriptionId).update({
      paymentStatus: 'failed',
      updatedAt: serverTimestamp(),
    });

    // Start grace period if this is the last attempt
    if (attemptNumber >= PRICING.MAX_PAYMENT_RETRIES) {
      await startGracePeriod(paymentData.subscriptionId);
    }

    // Log event
    await logBillingEvent({
      companyId: paymentData.companyId,
      subscriptionId: paymentData.subscriptionId,
      invoiceId: paymentData.invoiceId,
      paymentId,
      eventType: BILLING_EVENT_TYPE.PAYMENT_FAILED,
      description: `Payment failed: ${failureMessage} (Attempt ${attemptNumber}/${PRICING.MAX_PAYMENT_RETRIES})`,
      eventData: {
        failureCode,
        failureMessage,
        attemptNumber,
        maxAttempts: PRICING.MAX_PAYMENT_RETRIES,
      },
    });
  } catch (error) {
    console.error('Error handling payment failure:', error);
    throw error;
  }
}

/**
 * Retry failed payment
 * @param {string} paymentId - Payment ID
 * @returns {Promise<Object>} Retry result
 */
async function retryPayment(paymentId) {
  const stripe = initializeStripe();

  try {
    const paymentDoc = await db.collection(COLLECTIONS.PAYMENTS).doc(paymentId).get();
    if (!paymentDoc.exists) {
      throw new Error('Payment not found');
    }

    const paymentData = paymentDoc.data();

    if (paymentData.attemptNumber >= PRICING.MAX_PAYMENT_RETRIES) {
      throw new Error('Maximum payment retry attempts reached');
    }

    // Attempt to confirm payment intent again
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentData.stripePaymentIntentId);

    if (paymentIntent.status === 'requires_payment_method') {
      // Try to retry with the default payment method
      await stripe.paymentIntents.confirm(paymentData.stripePaymentIntentId);
    }

    // Update attempt number
    await db.collection(COLLECTIONS.PAYMENTS).doc(paymentId).update({
      attemptNumber: paymentData.attemptNumber + 1,
      attemptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Log event
    await logBillingEvent({
      companyId: paymentData.companyId,
      subscriptionId: paymentData.subscriptionId,
      invoiceId: paymentData.invoiceId,
      paymentId,
      eventType: BILLING_EVENT_TYPE.PAYMENT_RETRY_SCHEDULED,
      description: `Payment retry attempted (${paymentData.attemptNumber + 1}/${PRICING.MAX_PAYMENT_RETRIES})`,
      eventData: {
        attemptNumber: paymentData.attemptNumber + 1,
      },
    });

    return {
      success: true,
      attemptNumber: paymentData.attemptNumber + 1,
    };
  } catch (error) {
    console.error('Error retrying payment:', error);
    throw error;
  }
}

/**
 * Add payment method for company
 * @param {Object} params - Payment method parameters
 * @param {string} params.companyId - Company ID
 * @param {string} params.stripePaymentMethodId - Stripe payment method ID
 * @param {boolean} params.setAsDefault - Set as default payment method
 * @param {string} params.addedBy - User ID who added the method
 * @returns {Promise<string>} Created payment method document ID
 */
async function addPaymentMethod({ companyId, stripePaymentMethodId, setAsDefault = false, addedBy }) {
  const stripe = initializeStripe();

  try {
    // Get company
    const companyDoc = await db.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
    if (!companyDoc.exists) {
      throw new Error('Company not found');
    }

    const companyData = companyDoc.data();

    // Get payment method details from Stripe
    const paymentMethod = await stripe.paymentMethods.retrieve(stripePaymentMethodId);

    // Build payment method data
    const paymentMethodData = {
      companyId,
      stripePaymentMethodId,
      type: paymentMethod.type,
      isDefault: setAsDefault,
      status: 'active',
      addedBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Add type-specific details
    if (paymentMethod.type === 'card') {
      paymentMethodData.card = {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expiryMonth: paymentMethod.card.exp_month,
        expiryYear: paymentMethod.card.exp_year,
        funding: paymentMethod.card.funding,
      };
    } else if (paymentMethod.type === 'us_bank_account') {
      paymentMethodData.bankAccount = {
        bankName: paymentMethod.us_bank_account.bank_name,
        accountHolderType: paymentMethod.us_bank_account.account_holder_type,
        last4: paymentMethod.us_bank_account.last4,
        routingNumber: paymentMethod.us_bank_account.routing_number,
      };
    }

    // Add billing details
    if (paymentMethod.billing_details) {
      paymentMethodData.billingDetails = {
        name: paymentMethod.billing_details.name,
        email: paymentMethod.billing_details.email,
        phone: paymentMethod.billing_details.phone,
        address: paymentMethod.billing_details.address,
      };
    }

    // If setting as default, unset other defaults
    if (setAsDefault) {
      const existingMethods = await db
        .collection(COLLECTIONS.PAYMENT_METHODS)
        .where('companyId', '==', companyId)
        .where('isDefault', '==', true)
        .get();

      const batch = db.batch();
      existingMethods.docs.forEach(doc => {
        batch.update(doc.ref, { isDefault: false });
      });
      await batch.commit();

      // Update Stripe customer default payment method
      if (companyData.stripeCustomerId) {
        await stripe.customers.update(companyData.stripeCustomerId, {
          invoice_settings: {
            default_payment_method: stripePaymentMethodId,
          },
        });
      }
    }

    // Create payment method document
    const paymentMethodRef = await db.collection(COLLECTIONS.PAYMENT_METHODS).add(paymentMethodData);

    // Log event
    await logBillingEvent({
      companyId,
      eventType: BILLING_EVENT_TYPE.PAYMENT_METHOD_ADDED,
      description: `Payment method added: ${paymentMethod.type} ending in ${paymentMethodData.card?.last4 || paymentMethodData.bankAccount?.last4}`,
      eventData: {
        type: paymentMethod.type,
        isDefault: setAsDefault,
      },
      performedBy: addedBy,
    });

    return paymentMethodRef.id;
  } catch (error) {
    console.error('Error adding payment method:', error);
    throw error;
  }
}

/**
 * Get payment methods for company
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Array of payment methods
 */
async function getPaymentMethods(companyId) {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.PAYMENT_METHODS)
      .where('companyId', '==', companyId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting payment methods:', error);
    throw error;
  }
}

/**
 * Remove payment method
 * @param {Object} params - Parameters
 * @param {string} params.paymentMethodId - Payment method ID
 * @param {string} params.removedBy - User ID who removed it
 * @returns {Promise<void>}
 */
async function removePaymentMethod({ paymentMethodId, removedBy }) {
  const stripe = initializeStripe();

  try {
    const paymentMethodDoc = await db.collection(COLLECTIONS.PAYMENT_METHODS).doc(paymentMethodId).get();
    if (!paymentMethodDoc.exists) {
      throw new Error('Payment method not found');
    }

    const paymentMethodData = paymentMethodDoc.data();

    if (paymentMethodData.isDefault) {
      throw new Error('Cannot remove default payment method. Set another payment method as default first.');
    }

    // Detach from Stripe
    await stripe.paymentMethods.detach(paymentMethodData.stripePaymentMethodId);

    // Mark as inactive in Firestore
    await db.collection(COLLECTIONS.PAYMENT_METHODS).doc(paymentMethodId).update({
      status: 'inactive',
      updatedAt: serverTimestamp(),
    });

    // Log event
    await logBillingEvent({
      companyId: paymentMethodData.companyId,
      eventType: BILLING_EVENT_TYPE.PAYMENT_METHOD_REMOVED,
      description: `Payment method removed: ${paymentMethodData.type}`,
      eventData: {
        type: paymentMethodData.type,
      },
      performedBy: removedBy,
    });
  } catch (error) {
    console.error('Error removing payment method:', error);
    throw error;
  }
}

/**
 * Get payment history for company
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Limit number of results
 * @returns {Promise<Array>} Array of payments
 */
async function getPaymentHistory(companyId, { limit = 50 } = {}) {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.PAYMENTS)
      .where('companyId', '==', companyId)
      .orderBy('attemptedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting payment history:', error);
    throw error;
  }
}

module.exports = {
  processPayment,
  handlePaymentFailure,
  retryPayment,
  addPaymentMethod,
  getPaymentMethods,
  removePaymentMethod,
  getPaymentHistory,
};
