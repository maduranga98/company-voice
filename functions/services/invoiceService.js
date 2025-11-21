/**
 * Invoice Service
 * Handles invoice generation and management
 */

const admin = require('firebase-admin');
const { initializeStripe, INVOICE_STATUS, PRICING } = require('../config/stripe');
const { db, COLLECTIONS, serverTimestamp } = require('../config/firebase');
const {
  generateInvoiceNumber,
  dollarsToStripeCents,
  stripeCentsToDollars,
  logBillingEvent,
  getActiveUserCount,
} = require('../utils/helpers');
const { BILLING_EVENT_TYPE } = require('../config/stripe');
const { calculatePeriodProration } = require('./usageTrackingService');

/**
 * Create invoice for subscription billing period
 * @param {Object} params - Invoice parameters
 * @param {string} params.subscriptionId - Subscription ID
 * @param {Date} params.periodStart - Billing period start
 * @param {Date} params.periodEnd - Billing period end
 * @returns {Promise<Object>} Created invoice data
 */
async function createInvoice({ subscriptionId, periodStart, periodEnd }) {
  const stripe = initializeStripe();

  try {
    // Get subscription
    const subscriptionDoc = await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).get();
    if (!subscriptionDoc.exists) {
      throw new Error('Subscription not found');
    }

    const subscriptionData = subscriptionDoc.data();
    const { companyId, stripeCustomerId, currentUserCount, pricePerUser } = subscriptionData;

    // Calculate base amount
    const baseAmount = currentUserCount * pricePerUser;

    // Calculate proration adjustments
    const prorationAmount = await calculatePeriodProration(companyId, periodStart, periodEnd);

    // Calculate totals
    const subtotal = baseAmount + prorationAmount;
    const tax = 0; // TODO: Implement tax calculation if needed
    const total = subtotal + tax;

    // Build line items
    const lineItems = [
      {
        description: `Monthly subscription (${currentUserCount} users)`,
        quantity: currentUserCount,
        unitPrice: pricePerUser,
        amount: baseAmount,
        proration: false,
        prorationDate: null,
      },
    ];

    // Add proration line item if applicable
    if (prorationAmount !== 0) {
      lineItems.push({
        description: prorationAmount > 0 ? 'User additions (prorated)' : 'User removals (prorated credit)',
        quantity: 1,
        unitPrice: prorationAmount,
        amount: prorationAmount,
        proration: true,
        prorationDate: admin.firestore.Timestamp.fromDate(new Date()),
      });
    }

    // Create invoice in Stripe
    const stripeInvoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: 'charge_automatically',
      auto_advance: true,
      metadata: {
        companyId,
        subscriptionId,
      },
    });

    // Add line items to Stripe invoice
    for (const item of lineItems) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: stripeInvoice.id,
        amount: dollarsToStripeCents(item.amount),
        currency: PRICING.CURRENCY,
        description: item.description,
      });
    }

    // Finalize invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(stripeInvoice.id);

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber(companyId, periodStart);

    // Calculate due date (7 days from creation)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    // Create invoice document in Firestore
    const invoiceData = {
      companyId,
      subscriptionId,
      stripeInvoiceId: finalizedInvoice.id,
      stripePaymentIntentId: finalizedInvoice.payment_intent,
      invoiceNumber,
      status: INVOICE_STATUS.OPEN,
      subtotal,
      tax,
      total,
      amountDue: total,
      amountPaid: 0,
      periodStart: admin.firestore.Timestamp.fromDate(periodStart),
      periodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
      userCount: currentUserCount,
      lineItems,
      dueDate: admin.firestore.Timestamp.fromDate(dueDate),
      paidAt: null,
      voidedAt: null,
      invoicePdfUrl: finalizedInvoice.invoice_pdf || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const invoiceRef = await db.collection(COLLECTIONS.INVOICES).add(invoiceData);

    // Update subscription with last billed count
    await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).update({
      lastBilledUserCount: currentUserCount,
      updatedAt: serverTimestamp(),
    });

    // Log event
    await logBillingEvent({
      companyId,
      subscriptionId,
      invoiceId: invoiceRef.id,
      eventType: BILLING_EVENT_TYPE.INVOICE_CREATED,
      description: `Invoice ${invoiceNumber} created for ${currentUserCount} users ($${total.toFixed(2)})`,
      eventData: {
        invoiceNumber,
        userCount: currentUserCount,
        subtotal,
        total,
        prorationAmount,
      },
    });

    return {
      invoiceId: invoiceRef.id,
      stripeInvoiceId: finalizedInvoice.id,
      invoiceNumber,
      total,
      paymentIntentClientSecret: finalizedInvoice.payment_intent?.client_secret,
    };
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
}

/**
 * Mark invoice as paid
 * @param {string} invoiceId - Invoice ID
 * @param {string} stripePaymentIntentId - Stripe payment intent ID
 * @returns {Promise<void>}
 */
async function markInvoiceAsPaid(invoiceId, stripePaymentIntentId) {
  try {
    const invoiceDoc = await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      throw new Error('Invoice not found');
    }

    const invoiceData = invoiceDoc.data();

    // Update invoice
    await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).update({
      status: INVOICE_STATUS.PAID,
      amountPaid: invoiceData.total,
      amountDue: 0,
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update subscription payment status
    await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(invoiceData.subscriptionId).update({
      paymentStatus: 'paid',
      lastPaymentDate: serverTimestamp(),
      gracePeriodEndsAt: null, // Clear grace period if any
      updatedAt: serverTimestamp(),
    });

    // Log event
    await logBillingEvent({
      companyId: invoiceData.companyId,
      subscriptionId: invoiceData.subscriptionId,
      invoiceId,
      eventType: BILLING_EVENT_TYPE.INVOICE_PAID,
      description: `Invoice ${invoiceData.invoiceNumber} paid ($${invoiceData.total.toFixed(2)})`,
      eventData: {
        invoiceNumber: invoiceData.invoiceNumber,
        amount: invoiceData.total,
        stripePaymentIntentId,
      },
    });
  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    throw error;
  }
}

/**
 * Get invoices for a company
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options
 * @param {string} options.status - Filter by status
 * @param {number} options.limit - Limit number of results
 * @returns {Promise<Array>} Array of invoices
 */
async function getCompanyInvoices(companyId, { status = null, limit = 50 } = {}) {
  try {
    let query = db
      .collection(COLLECTIONS.INVOICES)
      .where('companyId', '==', companyId);

    // Only add status filter if provided to avoid needing composite index
    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('periodStart', 'desc');

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting company invoices:', error);
    throw error;
  }
}

/**
 * Get invoice by ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Object|null>} Invoice data or null
 */
async function getInvoiceById(invoiceId) {
  try {
    const invoiceDoc = await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).get();

    if (!invoiceDoc.exists) {
      return null;
    }

    return {
      id: invoiceDoc.id,
      ...invoiceDoc.data(),
    };
  } catch (error) {
    console.error('Error getting invoice:', error);
    throw error;
  }
}

/**
 * Get invoice by Stripe invoice ID
 * @param {string} stripeInvoiceId - Stripe invoice ID
 * @returns {Promise<Object|null>} Invoice data or null
 */
async function getInvoiceByStripeId(stripeInvoiceId) {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.INVOICES)
      .where('stripeInvoiceId', '==', stripeInvoiceId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    };
  } catch (error) {
    console.error('Error getting invoice by Stripe ID:', error);
    throw error;
  }
}

/**
 * Void invoice
 * @param {string} invoiceId - Invoice ID
 * @param {string} reason - Reason for voiding
 * @returns {Promise<void>}
 */
async function voidInvoice(invoiceId, reason) {
  const stripe = initializeStripe();

  try {
    const invoiceDoc = await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      throw new Error('Invoice not found');
    }

    const invoiceData = invoiceDoc.data();

    // Void invoice in Stripe
    await stripe.invoices.voidInvoice(invoiceData.stripeInvoiceId);

    // Update invoice
    await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).update({
      status: INVOICE_STATUS.VOID,
      voidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Log event
    await logBillingEvent({
      companyId: invoiceData.companyId,
      subscriptionId: invoiceData.subscriptionId,
      invoiceId,
      eventType: BILLING_EVENT_TYPE.INVOICE_CREATED, // Using generic event
      description: `Invoice ${invoiceData.invoiceNumber} voided: ${reason}`,
      eventData: {
        invoiceNumber: invoiceData.invoiceNumber,
        reason,
      },
    });
  } catch (error) {
    console.error('Error voiding invoice:', error);
    throw error;
  }
}

/**
 * Get all invoices (Super Admin)
 * @param {Object} options - Query options
 * @param {string} options.status - Filter by status
 * @param {Date} options.startDate - Filter by start date
 * @param {Date} options.endDate - Filter by end date
 * @param {number} options.limit - Limit number of results
 * @returns {Promise<Array>} Array of invoices
 */
async function getAllInvoices({ status = null, startDate = null, endDate = null, limit = 100 } = {}) {
  try {
    // Build query - only use status filter in query to avoid needing composite indexes
    let query = db.collection(COLLECTIONS.INVOICES);

    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('createdAt', 'desc');

    // Apply limit to query
    if (limit) {
      query = query.limit(limit * 2); // Get more to account for filtering
    }

    const snapshot = await query.get();

    // Get company names and apply date filters in memory
    let invoices = await Promise.all(
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

    // Apply date filters in memory
    if (startDate) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
      invoices = invoices.filter(invoice => invoice.createdAt >= startTimestamp);
    }

    if (endDate) {
      const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
      invoices = invoices.filter(invoice => invoice.createdAt <= endTimestamp);
    }

    // Apply limit after filtering
    if (limit && invoices.length > limit) {
      invoices = invoices.slice(0, limit);
    }

    return invoices;
  } catch (error) {
    console.error('Error getting all invoices:', error);
    throw error;
  }
}

module.exports = {
  createInvoice,
  markInvoiceAsPaid,
  getCompanyInvoices,
  getInvoiceById,
  getInvoiceByStripeId,
  voidInvoice,
  getAllInvoices,
};
