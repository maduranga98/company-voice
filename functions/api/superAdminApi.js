/**
 * Super Admin API
 * HTTP callable functions for platform billing management
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { isSuperAdmin } = require('../utils/helpers');
const { getAllInvoices } = require('../services/invoiceService');
const { db, COLLECTIONS, serverTimestamp } = require('../config/firebase');

/**
 * Get all company subscriptions
 */
const getAllSubscriptions = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify user is super admin
  const isAuthorized = await isSuperAdmin(auth.uid);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized');
  }

  try {
    const { status = null, limit = 100 } = data || {};

    let query = db.collection(COLLECTIONS.SUBSCRIPTIONS).orderBy('createdAt', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();

    // Enrich with company data
    const subscriptions = await Promise.all(
      snapshot.docs.map(async doc => {
        const data = doc.data();
        const companyDoc = await db.collection(COLLECTIONS.COMPANIES).doc(data.companyId).get();
        const companyName = companyDoc.exists ? companyDoc.data().name : 'Unknown';

        return {
          id: doc.id,
          ...data,
          companyName,
        };
      })
    );

    return { success: true, data: subscriptions };
  } catch (error) {
    console.error('Error getting all subscriptions:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Get all invoices (Super Admin)
 */
const getSuperAdminInvoices = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify user is super admin
  const isAuthorized = await isSuperAdmin(auth.uid);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized');
  }

  try {
    const { status = null, startDate = null, endDate = null, limit = 100 } = data || {};

    const invoices = await getAllInvoices({
      status,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      limit,
    });

    return { success: true, data: invoices };
  } catch (error) {
    console.error('Error getting all invoices:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Get revenue report
 */
const getRevenueReport = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify user is super admin
  const isAuthorized = await isSuperAdmin(auth.uid);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized');
  }

  try {
    const { month, year } = data || {};
    const reportId = month && year ? `${year}-${String(month).padStart(2, '0')}` : null;

    if (reportId) {
      // Get specific month report
      const reportDoc = await db.collection(COLLECTIONS.REVENUE_REPORTS).doc(reportId).get();

      if (reportDoc.exists) {
        return {
          success: true,
          data: {
            id: reportDoc.id,
            ...reportDoc.data(),
          },
        };
      }
    }

    // Generate on-the-fly report
    const report = await generateRevenueReport(month, year);
    return { success: true, data: report };
  } catch (error) {
    console.error('Error getting revenue report:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Generate revenue report for a period
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<Object>} Revenue report
 */
async function generateRevenueReport(month, year) {
  const admin = require('firebase-admin');
  const now = new Date();
  const reportMonth = month || now.getMonth() + 1;
  const reportYear = year || now.getFullYear();

  // Calculate period
  const periodStart = new Date(reportYear, reportMonth - 1, 1);
  const periodEnd = new Date(reportYear, reportMonth, 0, 23, 59, 59);

  // Get all invoices for period
  const invoicesSnapshot = await db
    .collection(COLLECTIONS.INVOICES)
    .where('periodStart', '>=', admin.firestore.Timestamp.fromDate(periodStart))
    .where('periodStart', '<=', admin.firestore.Timestamp.fromDate(periodEnd))
    .get();

  const invoices = invoicesSnapshot.docs.map(doc => doc.data());

  // Calculate metrics
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amountPaid, 0);
  const totalOutstanding = invoices.filter(inv => inv.status === 'open').reduce((sum, inv) => sum + inv.amountDue, 0);

  // Get active subscriptions
  const subscriptionsSnapshot = await db
    .collection(COLLECTIONS.SUBSCRIPTIONS)
    .where('status', 'in', ['active', 'trial', 'past_due'])
    .get();

  const activeCompanies = subscriptionsSnapshot.size;
  const totalActiveUsers = subscriptionsSnapshot.docs.reduce((sum, doc) => sum + doc.data().currentUserCount, 0);
  const averageUsersPerCompany = activeCompanies > 0 ? totalActiveUsers / activeCompanies : 0;

  // Get payment metrics
  const paymentsSnapshot = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where('attemptedAt', '>=', admin.firestore.Timestamp.fromDate(periodStart))
    .where('attemptedAt', '<=', admin.firestore.Timestamp.fromDate(periodEnd))
    .get();

  const payments = paymentsSnapshot.docs.map(doc => doc.data());
  const successfulPayments = payments.filter(p => p.status === 'succeeded').length;
  const failedPayments = payments.filter(p => p.status === 'failed').length;
  const paymentSuccessRate = payments.length > 0 ? (successfulPayments / payments.length) * 100 : 0;

  // Company breakdown
  const companyBreakdown = await Promise.all(
    subscriptionsSnapshot.docs.map(async doc => {
      const subData = doc.data();
      const companyDoc = await db.collection(COLLECTIONS.COMPANIES).doc(subData.companyId).get();
      const companyData = companyDoc.data();

      // Get revenue for this company in period
      const companyInvoices = invoices.filter(inv => inv.companyId === subData.companyId);
      const revenue = companyInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);

      return {
        companyId: subData.companyId,
        companyName: companyData?.name || 'Unknown',
        userCount: subData.currentUserCount,
        revenue,
        status: subData.status,
      };
    })
  );

  return {
    periodStart,
    periodEnd,
    totalRevenue: totalPaid,
    totalInvoiced,
    totalPaid,
    totalOutstanding,
    totalRefunded: 0, // TODO: Calculate from refunds
    activeCompanies,
    newCompanies: 0, // TODO: Calculate new companies in period
    canceledCompanies: 0, // TODO: Calculate canceled in period
    companiesInGracePeriod: subscriptionsSnapshot.docs.filter(doc => doc.data().gracePeriodEndsAt).length,
    totalActiveUsers,
    averageUsersPerCompany: Math.round(averageUsersPerCompany * 10) / 10,
    successfulPayments,
    failedPayments,
    paymentSuccessRate: Math.round(paymentSuccessRate * 10) / 10,
    companyBreakdown,
    generatedAt: new Date(),
  };
}

/**
 * Get billing disputes
 */
const getBillingDisputes = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify user is super admin
  const isAuthorized = await isSuperAdmin(auth.uid);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized');
  }

  try {
    const { status = null, limit = 50 } = data || {};

    let query = db.collection(COLLECTIONS.BILLING_DISPUTES).orderBy('openedAt', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();

    // Enrich with company data
    const disputes = await Promise.all(
      snapshot.docs.map(async doc => {
        const data = doc.data();
        const companyDoc = await db.collection(COLLECTIONS.COMPANIES).doc(data.companyId).get();
        const companyName = companyDoc.exists ? companyDoc.data().name : 'Unknown';

        return {
          id: doc.id,
          ...data,
          companyName,
        };
      })
    );

    return { success: true, data: disputes };
  } catch (error) {
    console.error('Error getting billing disputes:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Resolve billing dispute
 */
const resolveBillingDispute = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify user is super admin
  const isAuthorized = await isSuperAdmin(auth.uid);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized');
  }

  try {
    const { disputeId, resolution, resolutionNotes, refundAmount = null } = data;

    if (!disputeId || !resolution) {
      throw new HttpsError('invalid-argument', 'Dispute ID and resolution are required');
    }

    await db.collection(COLLECTIONS.BILLING_DISPUTES).doc(disputeId).update({
      status: 'resolved',
      resolution,
      resolutionNotes,
      refundAmount,
      resolvedAt: serverTimestamp(),
      resolvedBy: auth.uid,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error resolving dispute:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Get billing history for all companies
 */
const getAllBillingHistory = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify user is super admin
  const isAuthorized = await isSuperAdmin(auth.uid);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized');
  }

  try {
    const { companyId = null, eventType = null, limit = 100 } = data || {};

    let query = db.collection(COLLECTIONS.BILLING_HISTORY).orderBy('timestamp', 'desc');

    if (companyId) {
      query = query.where('companyId', '==', companyId);
    }

    if (eventType) {
      query = query.where('eventType', '==', eventType);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();

    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { success: true, data: history };
  } catch (error) {
    console.error('Error getting billing history:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Update pricing tier
 */
const updatePricingTier = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify user is super admin
  const isAuthorized = await isSuperAdmin(auth.uid);
  if (!isAuthorized) {
    throw new HttpsError('permission-denied', 'User is not authorized');
  }

  try {
    const { tierId, pricePerUser, features, isActive } = data;

    if (!tierId) {
      throw new HttpsError('invalid-argument', 'Tier ID is required');
    }

    const updates = {
      updatedAt: serverTimestamp(),
    };

    if (pricePerUser !== undefined) updates.pricePerUser = pricePerUser;
    if (features !== undefined) updates.features = features;
    if (isActive !== undefined) updates.isActive = isActive;

    await db.collection(COLLECTIONS.PRICING_TIERS).doc(tierId).update(updates);

    return { success: true };
  } catch (error) {
    console.error('Error updating pricing tier:', error);
    throw new HttpsError('internal', error.message);
  }
});

module.exports = {
  getAllSubscriptions,
  getSuperAdminInvoices,
  getRevenueReport,
  getBillingDisputes,
  resolveBillingDispute,
  getAllBillingHistory,
  updatePricingTier,
};
