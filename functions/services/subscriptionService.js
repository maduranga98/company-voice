/**
 * Subscription Management Service
 * Handles all subscription-related operations with Stripe and Firestore
 */

const admin = require('firebase-admin');
const { initializeStripe, PRICING, SUBSCRIPTION_STATUS } = require('../config/stripe');
const { db, COLLECTIONS, serverTimestamp } = require('../config/firebase');
const { logBillingEvent, getActiveUserCount, getNextBillingDate, calculateGracePeriodEnd } = require('../utils/helpers');
const { BILLING_EVENT_TYPE } = require('../config/stripe');

/**
 * Create a new subscription for a company
 * @param {Object} params - Subscription parameters
 * @param {string} params.companyId - Company ID
 * @param {string} params.paymentMethodId - Stripe payment method ID
 * @param {string} params.createdBy - User ID who created subscription
 * @param {boolean} params.startTrial - Whether to start with trial period
 * @returns {Promise<Object>} Created subscription data
 */
async function createSubscription({ companyId, paymentMethodId, createdBy, startTrial = false }) {
  const stripe = initializeStripe();

  try {
    // Get company data
    const companyDoc = await db.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
    if (!companyDoc.exists) {
      throw new Error('Company not found');
    }

    const companyData = companyDoc.data();
    let stripeCustomerId = companyData.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        metadata: {
          companyId,
          companyName: companyData.name,
        },
        email: companyData.email,
        name: companyData.name,
      });
      stripeCustomerId = customer.id;
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });

    // Set as default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Get current user count
    const userCount = await getActiveUserCount(companyId);

    // Create or retrieve price in Stripe
    let stripePriceId;
    const prices = await stripe.prices.list({
      lookup_keys: ['standard_monthly_per_user'],
      limit: 1,
    });

    if (prices.data.length > 0) {
      stripePriceId = prices.data[0].id;
    } else {
      const price = await stripe.prices.create({
        unit_amount: Math.round(PRICING.PRICE_PER_USER * 100), // Convert to cents
        currency: PRICING.CURRENCY,
        recurring: { interval: PRICING.BILLING_INTERVAL },
        product_data: {
          name: 'Company Voice Platform - Per User',
        },
        lookup_key: 'standard_monthly_per_user',
      });
      stripePriceId = price.id;
    }

    // Create Stripe subscription
    const subscriptionParams = {
      customer: stripeCustomerId,
      items: [
        {
          price: stripePriceId,
          quantity: userCount,
        },
      ],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        companyId,
      },
    };

    if (startTrial) {
      subscriptionParams.trial_period_days = PRICING.TRIAL_PERIOD_DAYS;
    }

    const stripeSubscription = await stripe.subscriptions.create(subscriptionParams);

    // Calculate dates
    const now = new Date();
    const currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    const nextBillingDate = getNextBillingDate(currentPeriodEnd);

    // Create subscription document in Firestore
    const subscriptionData = {
      companyId,
      stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId,
      status: startTrial ? SUBSCRIPTION_STATUS.TRIAL : SUBSCRIPTION_STATUS.ACTIVE,
      currentPeriodStart: admin.firestore.Timestamp.fromDate(currentPeriodStart),
      currentPeriodEnd: admin.firestore.Timestamp.fromDate(currentPeriodEnd),
      cancelAtPeriodEnd: false,
      canceledAt: null,

      pricePerUser: PRICING.PRICE_PER_USER,
      currency: PRICING.CURRENCY,

      currentUserCount: userCount,
      lastBilledUserCount: userCount,

      paymentStatus: 'pending',
      lastPaymentDate: null,
      nextPaymentDate: admin.firestore.Timestamp.fromDate(nextBillingDate),

      gracePeriodEndsAt: null,
      gracePeriodDays: PRICING.GRACE_PERIOD_DAYS,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy,
      updatedBy: createdBy,
    };

    const subscriptionRef = await db.collection(COLLECTIONS.SUBSCRIPTIONS).add(subscriptionData);

    // Update company with subscription info
    await db.collection(COLLECTIONS.COMPANIES).doc(companyId).update({
      subscriptionStatus: subscriptionData.status,
      subscriptionId: subscriptionRef.id,
      stripeCustomerId,
      trialStartedAt: startTrial ? serverTimestamp() : null,
      trialEndsAt: startTrial ? admin.firestore.Timestamp.fromDate(currentPeriodEnd) : null,
      lastBillingDate: admin.firestore.Timestamp.fromDate(currentPeriodStart),
      nextBillingDate: admin.firestore.Timestamp.fromDate(nextBillingDate),
      accountStatus: 'active',
      suspendedAt: null,
      suspensionReason: null,
    });

    // Log event
    await logBillingEvent({
      companyId,
      subscriptionId: subscriptionRef.id,
      eventType: BILLING_EVENT_TYPE.SUBSCRIPTION_CREATED,
      description: `Subscription created with ${userCount} users${startTrial ? ' (trial period)' : ''}`,
      eventData: {
        userCount,
        pricePerUser: PRICING.PRICE_PER_USER,
        startTrial,
      },
      performedBy: createdBy,
    });

    return {
      subscriptionId: subscriptionRef.id,
      stripeSubscriptionId: stripeSubscription.id,
      clientSecret: stripeSubscription.latest_invoice?.payment_intent?.client_secret,
      status: subscriptionData.status,
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
}

/**
 * Update subscription quantity based on current user count
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<void>}
 */
async function updateSubscriptionQuantity(subscriptionId) {
  const stripe = initializeStripe();

  try {
    const subscriptionDoc = await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).get();
    if (!subscriptionDoc.exists) {
      throw new Error('Subscription not found');
    }

    const subscriptionData = subscriptionDoc.data();
    const currentUserCount = await getActiveUserCount(subscriptionData.companyId);

    // Only update if user count changed
    if (currentUserCount === subscriptionData.currentUserCount) {
      return;
    }

    // Update Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionData.stripeSubscriptionId);
    await stripe.subscriptions.update(subscriptionData.stripeSubscriptionId, {
      items: [
        {
          id: stripeSubscription.items.data[0].id,
          quantity: currentUserCount,
        },
      ],
      proration_behavior: 'always_invoice', // Create proration invoice
    });

    // Update Firestore
    await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).update({
      currentUserCount,
      updatedAt: serverTimestamp(),
    });

    // Log event
    await logBillingEvent({
      companyId: subscriptionData.companyId,
      subscriptionId,
      eventType: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
      description: `User count updated from ${subscriptionData.currentUserCount} to ${currentUserCount}`,
      eventData: {
        oldUserCount: subscriptionData.currentUserCount,
        newUserCount: currentUserCount,
      },
    });
  } catch (error) {
    console.error('Error updating subscription quantity:', error);
    throw error;
  }
}

/**
 * Cancel subscription
 * @param {Object} params - Cancellation parameters
 * @param {string} params.subscriptionId - Subscription ID
 * @param {boolean} params.immediate - Whether to cancel immediately or at period end
 * @param {string} params.canceledBy - User ID who canceled
 * @returns {Promise<void>}
 */
async function cancelSubscription({ subscriptionId, immediate = false, canceledBy }) {
  const stripe = initializeStripe();

  try {
    const subscriptionDoc = await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).get();
    if (!subscriptionDoc.exists) {
      throw new Error('Subscription not found');
    }

    const subscriptionData = subscriptionDoc.data();

    if (immediate) {
      // Cancel immediately in Stripe
      await stripe.subscriptions.cancel(subscriptionData.stripeSubscriptionId);

      // Update Firestore
      await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).update({
        status: SUBSCRIPTION_STATUS.CANCELED,
        canceledAt: serverTimestamp(),
        cancelAtPeriodEnd: false,
        updatedAt: serverTimestamp(),
        updatedBy: canceledBy,
      });

      // Update company
      await db.collection(COLLECTIONS.COMPANIES).doc(subscriptionData.companyId).update({
        subscriptionStatus: SUBSCRIPTION_STATUS.CANCELED,
        accountStatus: 'canceled',
        updatedAt: serverTimestamp(),
      });

      // Log event
      await logBillingEvent({
        companyId: subscriptionData.companyId,
        subscriptionId,
        eventType: BILLING_EVENT_TYPE.SUBSCRIPTION_CANCELED,
        description: 'Subscription canceled immediately',
        eventData: { immediate: true },
        performedBy: canceledBy,
      });
    } else {
      // Cancel at period end
      await stripe.subscriptions.update(subscriptionData.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update Firestore
      await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).update({
        cancelAtPeriodEnd: true,
        updatedAt: serverTimestamp(),
        updatedBy: canceledBy,
      });

      // Log event
      await logBillingEvent({
        companyId: subscriptionData.companyId,
        subscriptionId,
        eventType: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
        description: 'Subscription set to cancel at period end',
        eventData: {
          cancelAtPeriodEnd: true,
          periodEnd: subscriptionData.currentPeriodEnd,
        },
        performedBy: canceledBy,
      });
    }
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

/**
 * Reactivate canceled subscription
 * @param {Object} params - Reactivation parameters
 * @param {string} params.subscriptionId - Subscription ID
 * @param {string} params.reactivatedBy - User ID who reactivated
 * @returns {Promise<void>}
 */
async function reactivateSubscription({ subscriptionId, reactivatedBy }) {
  const stripe = initializeStripe();

  try {
    const subscriptionDoc = await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).get();
    if (!subscriptionDoc.exists) {
      throw new Error('Subscription not found');
    }

    const subscriptionData = subscriptionDoc.data();

    // Remove cancel_at_period_end flag
    await stripe.subscriptions.update(subscriptionData.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update Firestore
    await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).update({
      cancelAtPeriodEnd: false,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      updatedAt: serverTimestamp(),
      updatedBy: reactivatedBy,
    });

    // Update company
    await db.collection(COLLECTIONS.COMPANIES).doc(subscriptionData.companyId).update({
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      accountStatus: 'active',
      suspendedAt: null,
      suspensionReason: null,
      updatedAt: serverTimestamp(),
    });

    // Log event
    await logBillingEvent({
      companyId: subscriptionData.companyId,
      subscriptionId,
      eventType: BILLING_EVENT_TYPE.ACCOUNT_REACTIVATED,
      description: 'Subscription reactivated',
      eventData: {},
      performedBy: reactivatedBy,
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    throw error;
  }
}

/**
 * Start grace period for failed payment
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<void>}
 */
async function startGracePeriod(subscriptionId) {
  try {
    const subscriptionDoc = await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).get();
    if (!subscriptionDoc.exists) {
      throw new Error('Subscription not found');
    }

    const subscriptionData = subscriptionDoc.data();
    const gracePeriodEnd = calculateGracePeriodEnd(new Date(), PRICING.GRACE_PERIOD_DAYS);

    // Update subscription
    await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).update({
      status: SUBSCRIPTION_STATUS.PAST_DUE,
      gracePeriodEndsAt: admin.firestore.Timestamp.fromDate(gracePeriodEnd),
      updatedAt: serverTimestamp(),
    });

    // Update company
    await db.collection(COLLECTIONS.COMPANIES).doc(subscriptionData.companyId).update({
      subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE,
      accountStatus: 'past_due',
      updatedAt: serverTimestamp(),
    });

    // Log event
    await logBillingEvent({
      companyId: subscriptionData.companyId,
      subscriptionId,
      eventType: BILLING_EVENT_TYPE.GRACE_PERIOD_STARTED,
      description: `Grace period started, expires ${gracePeriodEnd.toLocaleDateString()}`,
      eventData: {
        gracePeriodDays: PRICING.GRACE_PERIOD_DAYS,
        gracePeriodEndsAt: gracePeriodEnd.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error starting grace period:', error);
    throw error;
  }
}

/**
 * Suspend account after grace period expiration
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<void>}
 */
async function suspendAccount(subscriptionId) {
  try {
    const subscriptionDoc = await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).get();
    if (!subscriptionDoc.exists) {
      throw new Error('Subscription not found');
    }

    const subscriptionData = subscriptionDoc.data();

    // Update subscription
    await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).update({
      status: SUBSCRIPTION_STATUS.SUSPENDED,
      gracePeriodEndsAt: null,
      updatedAt: serverTimestamp(),
    });

    // Update company
    await db.collection(COLLECTIONS.COMPANIES).doc(subscriptionData.companyId).update({
      subscriptionStatus: SUBSCRIPTION_STATUS.SUSPENDED,
      accountStatus: 'suspended',
      suspendedAt: serverTimestamp(),
      suspensionReason: 'grace_period_expired',
      updatedAt: serverTimestamp(),
    });

    // Log event
    await logBillingEvent({
      companyId: subscriptionData.companyId,
      subscriptionId,
      eventType: BILLING_EVENT_TYPE.ACCOUNT_SUSPENDED,
      description: 'Account suspended due to payment failure',
      eventData: {
        reason: 'grace_period_expired',
      },
    });
  } catch (error) {
    console.error('Error suspending account:', error);
    throw error;
  }
}

module.exports = {
  createSubscription,
  updateSubscriptionQuantity,
  cancelSubscription,
  reactivateSubscription,
  startGracePeriod,
  suspendAccount,
};
