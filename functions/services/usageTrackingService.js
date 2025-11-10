/**
 * Usage Tracking Service
 * Tracks user additions, removals, and calculates proration
 */

const { db, COLLECTIONS, serverTimestamp } = require('../config/firebase');
const { USAGE_EVENT_TYPE, PRICING, BILLING_EVENT_TYPE } = require('../config/stripe');
const { calculateProration, logBillingEvent } = require('../utils/helpers');

/**
 * Record user addition to company
 * @param {Object} params - Usage record parameters
 * @param {string} params.companyId - Company ID
 * @param {string} params.userId - User ID being added
 * @param {string} params.userName - User name
 * @param {string} params.userEmail - User email
 * @param {string} params.performedBy - User ID who performed action
 * @returns {Promise<string>} Created usage record ID
 */
async function recordUserAddition({ companyId, userId, userName, userEmail, performedBy }) {
  try {
    // Get subscription
    const subscriptionsSnapshot = await db
      .collection(COLLECTIONS.SUBSCRIPTIONS)
      .where('companyId', '==', companyId)
      .where('status', 'in', ['active', 'trial', 'past_due'])
      .limit(1)
      .get();

    if (subscriptionsSnapshot.empty) {
      console.log('No active subscription found for company:', companyId);
      return null;
    }

    const subscriptionDoc = subscriptionsSnapshot.docs[0];
    const subscriptionData = subscriptionDoc.data();

    // Get current user count
    const usersSnapshot = await db
      .collection(COLLECTIONS.USERS)
      .where('companyId', '==', companyId)
      .where('status', '==', 'active')
      .count()
      .get();

    const userCountAfter = usersSnapshot.data().count;
    const userCountBefore = userCountAfter - 1;

    // Calculate proration for remaining billing period
    const now = new Date();
    const periodEnd = subscriptionData.currentPeriodEnd.toDate();
    const prorationAmount = calculateProration(PRICING.PRICE_PER_USER, now, periodEnd);

    // Create usage record
    const usageRecordData = {
      companyId,
      subscriptionId: subscriptionDoc.id,
      eventType: USAGE_EVENT_TYPE.USER_ADDED,
      userId,
      userName,
      userEmail,
      userCountBefore,
      userCountAfter,
      willAffectNextInvoice: true,
      prorationAmount,
      timestamp: serverTimestamp(),
      billingPeriodStart: subscriptionData.currentPeriodStart,
      billingPeriodEnd: subscriptionData.currentPeriodEnd,
      performedBy,
      notes: `User ${userName} (${userEmail}) added to company`,
    };

    const usageRecordRef = await db.collection(COLLECTIONS.USAGE_RECORDS).add(usageRecordData);

    // Update subscription user count
    await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionDoc.id).update({
      currentUserCount: userCountAfter,
      updatedAt: serverTimestamp(),
    });

    // Update user billing tracking
    await db.collection(COLLECTIONS.USERS).doc(userId).update({
      'billingImpact.addedAt': serverTimestamp(),
      'billingImpact.isActiveForBilling': true,
      'billingImpact.lastBilledAt': null,
    });

    // Log billing event
    await logBillingEvent({
      companyId,
      subscriptionId: subscriptionDoc.id,
      eventType: BILLING_EVENT_TYPE.USER_ADDED,
      description: `User added: ${userName} (${userEmail}). User count: ${userCountBefore} → ${userCountAfter}`,
      eventData: {
        userId,
        userName,
        userEmail,
        userCountBefore,
        userCountAfter,
        prorationAmount,
      },
      userId,
      performedBy,
    });

    return usageRecordRef.id;
  } catch (error) {
    console.error('Error recording user addition:', error);
    throw error;
  }
}

/**
 * Record user removal from company
 * @param {Object} params - Usage record parameters
 * @param {string} params.companyId - Company ID
 * @param {string} params.userId - User ID being removed
 * @param {string} params.userName - User name
 * @param {string} params.userEmail - User email
 * @param {string} params.performedBy - User ID who performed action
 * @returns {Promise<string>} Created usage record ID
 */
async function recordUserRemoval({ companyId, userId, userName, userEmail, performedBy }) {
  try {
    // Get subscription
    const subscriptionsSnapshot = await db
      .collection(COLLECTIONS.SUBSCRIPTIONS)
      .where('companyId', '==', companyId)
      .where('status', 'in', ['active', 'trial', 'past_due'])
      .limit(1)
      .get();

    if (subscriptionsSnapshot.empty) {
      console.log('No active subscription found for company:', companyId);
      return null;
    }

    const subscriptionDoc = subscriptionsSnapshot.docs[0];
    const subscriptionData = subscriptionDoc.data();

    // Get current user count
    const usersSnapshot = await db
      .collection(COLLECTIONS.USERS)
      .where('companyId', '==', companyId)
      .where('status', '==', 'active')
      .count()
      .get();

    const userCountAfter = usersSnapshot.data().count;
    const userCountBefore = userCountAfter + 1;

    // Calculate proration (negative for removal)
    const now = new Date();
    const periodEnd = subscriptionData.currentPeriodEnd.toDate();
    const prorationAmount = -calculateProration(PRICING.PRICE_PER_USER, now, periodEnd);

    // Create usage record
    const usageRecordData = {
      companyId,
      subscriptionId: subscriptionDoc.id,
      eventType: USAGE_EVENT_TYPE.USER_REMOVED,
      userId,
      userName,
      userEmail,
      userCountBefore,
      userCountAfter,
      willAffectNextInvoice: true,
      prorationAmount,
      timestamp: serverTimestamp(),
      billingPeriodStart: subscriptionData.currentPeriodStart,
      billingPeriodEnd: subscriptionData.currentPeriodEnd,
      performedBy,
      notes: `User ${userName} (${userEmail}) removed from company`,
    };

    const usageRecordRef = await db.collection(COLLECTIONS.USAGE_RECORDS).add(usageRecordData);

    // Update subscription user count
    await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionDoc.id).update({
      currentUserCount: userCountAfter,
      updatedAt: serverTimestamp(),
    });

    // Update user billing tracking
    await db.collection(COLLECTIONS.USERS).doc(userId).update({
      'billingImpact.isActiveForBilling': false,
    });

    // Log billing event
    await logBillingEvent({
      companyId,
      subscriptionId: subscriptionDoc.id,
      eventType: BILLING_EVENT_TYPE.USER_REMOVED,
      description: `User removed: ${userName} (${userEmail}). User count: ${userCountBefore} → ${userCountAfter}`,
      eventData: {
        userId,
        userName,
        userEmail,
        userCountBefore,
        userCountAfter,
        prorationAmount,
      },
      userId,
      performedBy,
    });

    return usageRecordRef.id;
  } catch (error) {
    console.error('Error recording user removal:', error);
    throw error;
  }
}

/**
 * Get usage records for a company
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date filter
 * @param {Date} options.endDate - End date filter
 * @param {number} options.limit - Limit number of records
 * @returns {Promise<Array>} Array of usage records
 */
async function getUsageRecords(companyId, { startDate = null, endDate = null, limit = 100 } = {}) {
  try {
    let query = db
      .collection(COLLECTIONS.USAGE_RECORDS)
      .where('companyId', '==', companyId)
      .orderBy('timestamp', 'desc');

    if (startDate) {
      query = query.where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate));
    }

    if (endDate) {
      query = query.where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate));
    }

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting usage records:', error);
    throw error;
  }
}

/**
 * Calculate total proration amount for billing period
 * @param {string} companyId - Company ID
 * @param {Date} periodStart - Billing period start
 * @param {Date} periodEnd - Billing period end
 * @returns {Promise<number>} Total proration amount
 */
async function calculatePeriodProration(companyId, periodStart, periodEnd) {
  try {
    const usageRecordsSnapshot = await db
      .collection(COLLECTIONS.USAGE_RECORDS)
      .where('companyId', '==', companyId)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(periodStart))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(periodEnd))
      .where('willAffectNextInvoice', '==', true)
      .get();

    let totalProration = 0;
    usageRecordsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalProration += data.prorationAmount || 0;
    });

    return totalProration;
  } catch (error) {
    console.error('Error calculating period proration:', error);
    throw error;
  }
}

/**
 * Get current billing period usage summary
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Usage summary
 */
async function getCurrentPeriodUsageSummary(companyId) {
  try {
    // Get subscription
    const subscriptionsSnapshot = await db
      .collection(COLLECTIONS.SUBSCRIPTIONS)
      .where('companyId', '==', companyId)
      .where('status', 'in', ['active', 'trial', 'past_due'])
      .limit(1)
      .get();

    if (subscriptionsSnapshot.empty) {
      return null;
    }

    const subscriptionData = subscriptionsSnapshot.docs[0].data();
    const periodStart = subscriptionData.currentPeriodStart.toDate();
    const periodEnd = subscriptionData.currentPeriodEnd.toDate();

    // Get usage records for period
    const usageRecords = await getUsageRecords(companyId, { startDate: periodStart, endDate: periodEnd });

    // Calculate metrics
    const usersAdded = usageRecords.filter(r => r.eventType === USAGE_EVENT_TYPE.USER_ADDED).length;
    const usersRemoved = usageRecords.filter(r => r.eventType === USAGE_EVENT_TYPE.USER_REMOVED).length;
    const totalProration = await calculatePeriodProration(companyId, periodStart, periodEnd);

    return {
      periodStart,
      periodEnd,
      currentUserCount: subscriptionData.currentUserCount,
      usersAdded,
      usersRemoved,
      totalProration,
      usageRecords: usageRecords.map(r => ({
        id: r.id,
        eventType: r.eventType,
        userName: r.userName,
        userEmail: r.userEmail,
        timestamp: r.timestamp,
        prorationAmount: r.prorationAmount,
      })),
    };
  } catch (error) {
    console.error('Error getting usage summary:', error);
    throw error;
  }
}

const admin = require('firebase-admin');

module.exports = {
  recordUserAddition,
  recordUserRemoval,
  getUsageRecords,
  calculatePeriodProration,
  getCurrentPeriodUsageSummary,
};
