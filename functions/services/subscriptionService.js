/**
 * Subscription Management Service
 * Handles all subscription-related operations with Stripe and Firestore
 */

const admin = require('firebase-admin');
const { initializeStripe, PRICING, SUBSCRIPTION_STATUS } = require('../config/stripe');
const { db, COLLECTIONS, serverTimestamp } = require('../config/firebase');
const { logBillingEvent, getNextBillingDate, calculateGracePeriodEnd } = require('../utils/helpers');
const { BILLING_EVENT_TYPE } = require('../config/stripe');
const { countDistinctAcknowledgedEmployees } = require('../utils/policyAck');

/**
 * Calculate the billable seat count for a company.
 * Billable = max(declared, verified) so a company is never billed below its verified floor.
 * @param {string} companyId - Company ID
 * @param {number} declaredUserCount - Employee count declared by the Company Admin
 * @returns {Promise<{billableCount: number, verifiedCount: number}>}
 */
async function getBillableUserCount(companyId, declaredUserCount) {
  const verifiedCount = await countDistinctAcknowledgedEmployees(db, companyId);
  return {
    billableCount: Math.max(declaredUserCount || 0, verifiedCount),
    verifiedCount,
  };
}

/**
 * Create a new subscription for a company
 * @param {Object} params - Subscription parameters
 * @param {string} params.companyId - Company ID
 * @param {string} params.paymentMethodId - Stripe payment method ID
 * @param {string} params.createdBy - User ID who created subscription
 * @param {number} params.declaredUserCount - Employee count declared by the Company Admin
 * @param {boolean} params.startTrial - Whether to start with trial period
 * @returns {Promise<Object>} Created subscription data
 */
async function createSubscription({ companyId, paymentMethodId, createdBy, declaredUserCount, startTrial = false }) {
  const stripe = initializeStripe();

  try {
    if (!Number.isInteger(declaredUserCount) || declaredUserCount <= 0) {
      throw new Error('declaredUserCount must be a positive integer');
    }

    // Get company data
    const companyDoc = await db.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
    if (!companyDoc.exists) {
      throw new Error('Company not found');
    }

    // Validate the billable count before touching Stripe so a bad count doesn't leave a card attached
    const { billableCount: userCount, verifiedCount } = await getBillableUserCount(companyId, declaredUserCount);
    if (verifiedCount > declaredUserCount) {
      throw new Error(
        `Declared count (${declaredUserCount}) cannot be below the verified employee count (${verifiedCount}). Minimum allowed: ${verifiedCount}`
      );
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
      // Charge the saved card right away; if 3DS is needed the subscription stays
      // `incomplete` and the client confirms the returned clientSecret.
      payment_behavior: 'allow_incomplete',
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      metadata: {
        companyId,
      },
    };

    if (startTrial) {
      subscriptionParams.trial_period_days = PRICING.TRIAL_PERIOD_DAYS;
    }

    const stripeSubscription = await stripe.subscriptions.create(subscriptionParams);

    const paymentIntent = stripeSubscription.latest_invoice?.payment_intent;
    const setupIntent = stripeSubscription.pending_setup_intent;
    const pendingIntent = [paymentIntent, setupIntent].find(
      (intent) => intent && intent.status === 'requires_action'
    );

    // Card declined outright: roll back instead of storing a subscription that never started
    if (stripeSubscription.status === 'incomplete' && !pendingIntent) {
      await stripe.subscriptions.cancel(stripeSubscription.id).catch(() => {});
      throw new Error(
        paymentIntent?.last_payment_error?.message || 'Your card was declined. Please try another card.'
      );
    }

    const requiresAction = Boolean(pendingIntent);
    const initialStatus = requiresAction
      ? 'incomplete'
      : stripeSubscription.status === 'trialing'
        ? SUBSCRIPTION_STATUS.TRIAL
        : SUBSCRIPTION_STATUS.ACTIVE;

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
      status: initialStatus,
      currentPeriodStart: admin.firestore.Timestamp.fromDate(currentPeriodStart),
      currentPeriodEnd: admin.firestore.Timestamp.fromDate(currentPeriodEnd),
      cancelAtPeriodEnd: false,
      canceledAt: null,

      pricePerUser: PRICING.PRICE_PER_USER,
      currency: PRICING.CURRENCY,

      declaredUserCount,
      verifiedAcknowledgedCount: verifiedCount,
      lastVerifiedAt: serverTimestamp(),
      declaredUserCountUpdatedAt: serverTimestamp(),
      declaredUserCountUpdatedBy: createdBy,

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
      accountStatus: requiresAction ? 'pending_payment' : 'active',
      suspendedAt: null,
      suspensionReason: null,
    });

    // Log event
    await logBillingEvent({
      companyId,
      subscriptionId: subscriptionRef.id,
      eventType: BILLING_EVENT_TYPE.SUBSCRIPTION_CREATED,
      description: `Subscription created with ${userCount} billed users (declared: ${declaredUserCount}, verified: ${verifiedCount})${startTrial ? ' (trial period)' : ''}`,
      eventData: {
        userCount,
        declaredUserCount,
        verifiedCount,
        pricePerUser: PRICING.PRICE_PER_USER,
        startTrial,
      },
      performedBy: createdBy,
    });

    return {
      subscriptionId: subscriptionRef.id,
      stripeSubscriptionId: stripeSubscription.id,
      clientSecret: pendingIntent?.client_secret || null,
      requiresAction,
      isSetupIntent: pendingIntent === setupIntent,
      status: subscriptionData.status,
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
}

async function getOrCreateStripeCustomer(stripe, companyId, companyData) {
  if (companyData.stripeCustomerId) return companyData.stripeCustomerId;
  const customer = await stripe.customers.create({
    metadata: { companyId, companyName: companyData.name },
    email: companyData.email,
    name: companyData.name,
  });
  return customer.id;
}

async function getOrCreatePriceId(stripe) {
  const prices = await stripe.prices.list({ lookup_keys: ['standard_monthly_per_user'], limit: 1 });
  if (prices.data.length > 0) return prices.data[0].id;
  const price = await stripe.prices.create({
    unit_amount: Math.round(PRICING.PRICE_PER_USER * 100),
    currency: PRICING.CURRENCY,
    recurring: { interval: PRICING.BILLING_INTERVAL },
    product_data: { name: 'Company Voice Platform - Per User' },
    lookup_key: 'standard_monthly_per_user',
  });
  return price.id;
}

/**
 * Create a Stripe-hosted Checkout Session so the company enters card details on Stripe's page.
 * The Firestore subscription record is written by finalizeCheckoutSession (webhook / return sync).
 * @param {Object} params
 * @param {string} params.companyId - Company ID
 * @param {string} params.createdBy - User ID starting the subscription
 * @param {number} params.declaredUserCount - Employee count declared by the Company Admin
 * @param {boolean} params.startTrial - Whether to start with a trial period
 * @param {string} params.returnUrl - Billing page URL Stripe returns to
 * @returns {Promise<{url: string, sessionId: string}>}
 */
async function createCheckoutSession({ companyId, createdBy, declaredUserCount, startTrial = false, returnUrl }) {
  const stripe = initializeStripe();

  if (!Number.isInteger(declaredUserCount) || declaredUserCount <= 0) {
    throw new Error('declaredUserCount must be a positive integer');
  }

  const companyDoc = await db.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
  if (!companyDoc.exists) throw new Error('Company not found');
  const companyData = companyDoc.data();

  const existing = companyData.subscriptionId
    ? await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(companyData.subscriptionId).get()
    : null;
  if (existing?.exists && ['active', 'trial', 'past_due'].includes(existing.data().status)) {
    throw new Error('This company already has a subscription');
  }

  const { billableCount, verifiedCount } = await getBillableUserCount(companyId, declaredUserCount);
  if (verifiedCount > declaredUserCount) {
    throw new Error(
      `Declared count (${declaredUserCount}) cannot be below the verified employee count (${verifiedCount}). Minimum allowed: ${verifiedCount}`
    );
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(stripe, companyId, companyData);
  if (!companyData.stripeCustomerId) {
    await db.collection(COLLECTIONS.COMPANIES).doc(companyId).update({ stripeCustomerId });
  }
  const stripePriceId = await getOrCreatePriceId(stripe);

  const metadata = {
    companyId,
    createdBy,
    declaredUserCount: String(declaredUserCount),
    startTrial: String(Boolean(startTrial)),
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: stripePriceId, quantity: billableCount }],
    subscription_data: {
      metadata,
      ...(startTrial ? { trial_period_days: PRICING.TRIAL_PERIOD_DAYS } : {}),
    },
    metadata,
    client_reference_id: companyId,
    success_url: `${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}?checkout=canceled`,
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Write the Firestore subscription record for a completed Checkout Session.
 * Idempotent: called from both the webhook and the post-redirect sync.
 * @param {string} sessionId - Stripe Checkout Session ID
 * @returns {Promise<{subscriptionId: string|null, created: boolean}>}
 */
async function finalizeCheckoutSession(sessionId) {
  const stripe = initializeStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });

  const stripeSubscription = session.subscription;
  const companyId = session.metadata?.companyId;
  if (!stripeSubscription || !companyId) return { subscriptionId: null, created: false };
  if (!['active', 'trialing'].includes(stripeSubscription.status)) {
    return { subscriptionId: null, created: false };
  }

  const duplicate = await db
    .collection(COLLECTIONS.SUBSCRIPTIONS)
    .where('stripeSubscriptionId', '==', stripeSubscription.id)
    .limit(1)
    .get();
  if (!duplicate.empty) return { subscriptionId: duplicate.docs[0].id, created: false };

  const createdBy = session.metadata.createdBy;
  const declaredUserCount = parseInt(session.metadata.declaredUserCount, 10);
  const startTrial = session.metadata.startTrial === 'true';
  const { billableCount: userCount, verifiedCount } = await getBillableUserCount(companyId, declaredUserCount);

  const currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
  const nextBillingDate = getNextBillingDate(currentPeriodEnd);
  const status = stripeSubscription.status === 'trialing' ? SUBSCRIPTION_STATUS.TRIAL : SUBSCRIPTION_STATUS.ACTIVE;

  const subscriptionRef = await db.collection(COLLECTIONS.SUBSCRIPTIONS).add({
    companyId,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: stripeSubscription.items.data[0].price.id,
    status,
    currentPeriodStart: admin.firestore.Timestamp.fromDate(currentPeriodStart),
    currentPeriodEnd: admin.firestore.Timestamp.fromDate(currentPeriodEnd),
    cancelAtPeriodEnd: false,
    canceledAt: null,

    pricePerUser: PRICING.PRICE_PER_USER,
    currency: PRICING.CURRENCY,

    declaredUserCount,
    verifiedAcknowledgedCount: verifiedCount,
    lastVerifiedAt: serverTimestamp(),
    declaredUserCountUpdatedAt: serverTimestamp(),
    declaredUserCountUpdatedBy: createdBy,

    currentUserCount: userCount,
    lastBilledUserCount: userCount,

    paymentStatus: status === SUBSCRIPTION_STATUS.TRIAL ? 'pending' : 'paid',
    lastPaymentDate: null,
    nextPaymentDate: admin.firestore.Timestamp.fromDate(nextBillingDate),

    gracePeriodEndsAt: null,
    gracePeriodDays: PRICING.GRACE_PERIOD_DAYS,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy,
    updatedBy: createdBy,
  });

  await db.collection(COLLECTIONS.COMPANIES).doc(companyId).update({
    subscriptionStatus: status,
    subscriptionId: subscriptionRef.id,
    stripeCustomerId: session.customer,
    trialStartedAt: startTrial ? serverTimestamp() : null,
    trialEndsAt: startTrial ? admin.firestore.Timestamp.fromDate(currentPeriodEnd) : null,
    lastBillingDate: admin.firestore.Timestamp.fromDate(currentPeriodStart),
    nextBillingDate: admin.firestore.Timestamp.fromDate(nextBillingDate),
    accountStatus: 'active',
    suspendedAt: null,
    suspensionReason: null,
  });

  await logBillingEvent({
    companyId,
    subscriptionId: subscriptionRef.id,
    eventType: BILLING_EVENT_TYPE.SUBSCRIPTION_CREATED,
    description: `Subscription created via Stripe Checkout with ${userCount} billed users (declared: ${declaredUserCount}, verified: ${verifiedCount})${startTrial ? ' (trial period)' : ''}`,
    eventData: { userCount, declaredUserCount, verifiedCount, pricePerUser: PRICING.PRICE_PER_USER, startTrial },
    performedBy: createdBy,
  });

  return { subscriptionId: subscriptionRef.id, created: true };
}

/**
 * Update subscription quantity based on declared and verified employee counts.
 * Billable quantity = max(declared, verified). If verified overtakes declared,
 * the declared count is bumped up automatically (never down).
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} [options] - Optional parameters
 * @param {number} [options.declaredUserCount] - New declared count (defaults to stored value)
 * @param {string} [options.updatedBy] - User ID who explicitly set the declared count
 * @returns {Promise<Object>} { declaredUserCount, verifiedAcknowledgedCount, currentUserCount, autoAdjusted }
 */
async function updateSubscriptionQuantity(subscriptionId, { declaredUserCount, updatedBy } = {}) {
  const stripe = initializeStripe();

  try {
    const subscriptionRef = db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId);
    const subscriptionDoc = await subscriptionRef.get();
    if (!subscriptionDoc.exists) {
      throw new Error('Subscription not found');
    }

    const subscriptionData = subscriptionDoc.data();
    const previousDeclared = subscriptionData.declaredUserCount || 0;
    let nextDeclaredCount = declaredUserCount !== undefined ? declaredUserCount : previousDeclared;

    const { billableCount, verifiedCount } = await getBillableUserCount(
      subscriptionData.companyId,
      nextDeclaredCount
    );

    let autoAdjusted = false;
    if (verifiedCount > nextDeclaredCount) {
      nextDeclaredCount = verifiedCount;
      autoAdjusted = true;
    }

    const quantityChanged = billableCount !== subscriptionData.currentUserCount;

    if (quantityChanged) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionData.stripeSubscriptionId);
      await stripe.subscriptions.update(subscriptionData.stripeSubscriptionId, {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            quantity: billableCount,
          },
        ],
        proration_behavior: 'always_invoice', // Create proration invoice
      });
    }

    const updates = {
      declaredUserCount: nextDeclaredCount,
      verifiedAcknowledgedCount: verifiedCount,
      lastVerifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (quantityChanged) {
      updates.currentUserCount = billableCount;
    }
    if (updatedBy) {
      updates.declaredUserCountUpdatedAt = serverTimestamp();
      updates.declaredUserCountUpdatedBy = updatedBy;
    }
    await subscriptionRef.update(updates);

    if (quantityChanged) {
      await logBillingEvent({
        companyId: subscriptionData.companyId,
        subscriptionId,
        eventType: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
        description: `Billed user count updated from ${subscriptionData.currentUserCount} to ${billableCount}`,
        eventData: {
          oldUserCount: subscriptionData.currentUserCount,
          newUserCount: billableCount,
          declaredUserCount: nextDeclaredCount,
          verifiedCount,
        },
        performedBy: updatedBy,
      });
    }

    if (autoAdjusted) {
      await logBillingEvent({
        companyId: subscriptionData.companyId,
        subscriptionId,
        eventType: BILLING_EVENT_TYPE.DECLARED_COUNT_AUTO_ADJUSTED,
        description: `Declared count auto-adjusted from ${declaredUserCount !== undefined ? declaredUserCount : previousDeclared} to ${verifiedCount} to match verified employees`,
        eventData: {
          oldDeclaredCount: previousDeclared,
          newDeclaredCount: nextDeclaredCount,
          verifiedCount,
        },
      });
    } else if (updatedBy && declaredUserCount !== undefined) {
      await logBillingEvent({
        companyId: subscriptionData.companyId,
        subscriptionId,
        eventType: BILLING_EVENT_TYPE.DECLARED_COUNT_UPDATED,
        description: `Declared employee count updated from ${previousDeclared} to ${nextDeclaredCount}`,
        eventData: {
          oldDeclaredCount: previousDeclared,
          newDeclaredCount: nextDeclaredCount,
          verifiedCount,
        },
        performedBy: updatedBy,
      });
    }

    return {
      declaredUserCount: nextDeclaredCount,
      verifiedAcknowledgedCount: verifiedCount,
      currentUserCount: quantityChanged ? billableCount : subscriptionData.currentUserCount,
      autoAdjusted,
    };
  } catch (error) {
    console.error('Error updating subscription quantity:', error);
    throw error;
  }
}

/**
 * Update the declared employee count (Company Admin action)
 * @param {Object} params - Parameters
 * @param {string} params.subscriptionId - Subscription ID
 * @param {number} params.declaredUserCount - New declared employee count
 * @param {string} params.updatedBy - User ID performing the update
 * @returns {Promise<Object>} Result of updateSubscriptionQuantity
 */
async function updateDeclaredUserCount({ subscriptionId, declaredUserCount, updatedBy }) {
  if (!Number.isInteger(declaredUserCount) || declaredUserCount <= 0) {
    throw new Error('Declared count must be a positive integer');
  }

  const subscriptionDoc = await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).get();
  if (!subscriptionDoc.exists) {
    throw new Error('Subscription not found');
  }

  const verifiedCount = await countDistinctAcknowledgedEmployees(db, subscriptionDoc.data().companyId);
  if (declaredUserCount < verifiedCount) {
    throw new Error(
      `Declared count cannot be below the verified employee count. Minimum allowed: ${verifiedCount}`
    );
  }

  return updateSubscriptionQuantity(subscriptionId, { declaredUserCount, updatedBy });
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
  createCheckoutSession,
  finalizeCheckoutSession,
  updateSubscriptionQuantity,
  updateDeclaredUserCount,
  getBillableUserCount,
  cancelSubscription,
  reactivateSubscription,
  startGracePeriod,
  suspendAccount,
};
