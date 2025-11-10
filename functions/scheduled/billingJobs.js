/**
 * Scheduled Billing Jobs
 * Automated tasks for billing management
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { db, COLLECTIONS } = require('../config/firebase');
const { createInvoice } = require('../services/invoiceService');
const { updateSubscriptionQuantity, suspendAccount } = require('../services/subscriptionService');
const { retryPayment } = require('../services/paymentService');
const { isInGracePeriod, getNextBillingDate } = require('../utils/helpers');

/**
 * Monthly billing job
 * Runs daily at 2 AM UTC to check for subscriptions due for billing
 */
const monthlyBillingJob = onSchedule(
  {
    schedule: '0 2 * * *', // Daily at 2 AM UTC
    timeZone: 'UTC',
    memory: '512MiB',
  },
  async (event) => {
    console.log('Running monthly billing job...');

    try {
      const now = new Date();
      const admin = require('firebase-admin');

      // Get subscriptions due for billing
      const subscriptionsSnapshot = await db
        .collection(COLLECTIONS.SUBSCRIPTIONS)
        .where('status', 'in', ['active', 'trial'])
        .where('nextPaymentDate', '<=', admin.firestore.Timestamp.fromDate(now))
        .get();

      console.log(`Found ${subscriptionsSnapshot.size} subscriptions due for billing`);

      for (const subscriptionDoc of subscriptionsSnapshot.docs) {
        const subscriptionData = subscriptionDoc.data();
        const subscriptionId = subscriptionDoc.id;

        try {
          console.log(`Processing subscription ${subscriptionId} for company ${subscriptionData.companyId}`);

          // Update user count before creating invoice
          await updateSubscriptionQuantity(subscriptionId);

          // Get updated subscription data
          const updatedDoc = await subscriptionDoc.ref.get();
          const updatedData = updatedDoc.data();

          // Calculate billing period
          const periodStart = updatedData.currentPeriodStart.toDate();
          const periodEnd = updatedData.currentPeriodEnd.toDate();

          // Create invoice
          const invoiceResult = await createInvoice({
            subscriptionId,
            periodStart,
            periodEnd,
          });

          console.log(`Invoice created: ${invoiceResult.invoiceNumber}`);

          // Update subscription dates for next period
          const nextPeriodStart = new Date(periodEnd);
          nextPeriodStart.setDate(nextPeriodStart.getDate() + 1);
          const nextPeriodEnd = getNextBillingDate(periodEnd);
          const nextPaymentDate = getNextBillingDate(nextPeriodEnd);

          await subscriptionDoc.ref.update({
            currentPeriodStart: admin.firestore.Timestamp.fromDate(nextPeriodStart),
            currentPeriodEnd: admin.firestore.Timestamp.fromDate(nextPeriodEnd),
            nextPaymentDate: admin.firestore.Timestamp.fromDate(nextPaymentDate),
            lastBilledUserCount: updatedData.currentUserCount,
          });

          console.log(`Subscription ${subscriptionId} updated for next billing period`);
        } catch (error) {
          console.error(`Error processing subscription ${subscriptionId}:`, error);
          // Continue with next subscription
        }
      }

      console.log('Monthly billing job completed');
    } catch (error) {
      console.error('Error in monthly billing job:', error);
      throw error;
    }
  }
);

/**
 * Grace period check job
 * Runs daily at 3 AM UTC to check for expired grace periods
 */
const gracePeriodCheckJob = onSchedule(
  {
    schedule: '0 3 * * *', // Daily at 3 AM UTC
    timeZone: 'UTC',
    memory: '256MiB',
  },
  async (event) => {
    console.log('Running grace period check job...');

    try {
      const now = new Date();
      const admin = require('firebase-admin');

      // Get subscriptions with expired grace periods
      const subscriptionsSnapshot = await db
        .collection(COLLECTIONS.SUBSCRIPTIONS)
        .where('status', '==', 'past_due')
        .where('gracePeriodEndsAt', '<=', admin.firestore.Timestamp.fromDate(now))
        .get();

      console.log(`Found ${subscriptionsSnapshot.size} subscriptions with expired grace periods`);

      for (const subscriptionDoc of subscriptionsSnapshot.docs) {
        const subscriptionData = subscriptionDoc.data();
        const subscriptionId = subscriptionDoc.id;

        try {
          console.log(`Suspending account for subscription ${subscriptionId}`);

          // Suspend account
          await suspendAccount(subscriptionId);

          console.log(`Account suspended for subscription ${subscriptionId}`);
        } catch (error) {
          console.error(`Error suspending account for subscription ${subscriptionId}:`, error);
          // Continue with next subscription
        }
      }

      console.log('Grace period check job completed');
    } catch (error) {
      console.error('Error in grace period check job:', error);
      throw error;
    }
  }
);

/**
 * Payment retry job
 * Runs daily at 4 AM UTC to retry failed payments
 */
const paymentRetryJob = onSchedule(
  {
    schedule: '0 4 * * *', // Daily at 4 AM UTC
    timeZone: 'UTC',
    memory: '256MiB',
  },
  async (event) => {
    console.log('Running payment retry job...');

    try {
      const now = new Date();
      const admin = require('firebase-admin');

      // Get payments scheduled for retry
      const paymentsSnapshot = await db
        .collection(COLLECTIONS.PAYMENTS)
        .where('status', '==', 'failed')
        .where('nextRetryDate', '<=', admin.firestore.Timestamp.fromDate(now))
        .get();

      console.log(`Found ${paymentsSnapshot.size} payments to retry`);

      for (const paymentDoc of paymentsSnapshot.docs) {
        const paymentData = paymentDoc.data();
        const paymentId = paymentDoc.id;

        try {
          if (paymentData.attemptNumber >= paymentData.maxAttempts) {
            console.log(`Payment ${paymentId} has reached max retry attempts, skipping`);
            continue;
          }

          console.log(`Retrying payment ${paymentId} (attempt ${paymentData.attemptNumber + 1})`);

          await retryPayment(paymentId);

          console.log(`Payment ${paymentId} retry initiated`);
        } catch (error) {
          console.error(`Error retrying payment ${paymentId}:`, error);
          // Continue with next payment
        }
      }

      console.log('Payment retry job completed');
    } catch (error) {
      console.error('Error in payment retry job:', error);
      throw error;
    }
  }
);

/**
 * Trial expiration check job
 * Runs daily at 1 AM UTC to check for expiring trials
 */
const trialExpirationCheckJob = onSchedule(
  {
    schedule: '0 1 * * *', // Daily at 1 AM UTC
    timeZone: 'UTC',
    memory: '256MiB',
  },
  async (event) => {
    console.log('Running trial expiration check job...');

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const admin = require('firebase-admin');

      // Get companies with trials expiring in next 24 hours
      const companiesSnapshot = await db
        .collection(COLLECTIONS.COMPANIES)
        .where('subscriptionStatus', '==', 'trial')
        .where('trialEndsAt', '<=', admin.firestore.Timestamp.fromDate(tomorrow))
        .get();

      console.log(`Found ${companiesSnapshot.size} trials expiring soon`);

      for (const companyDoc of companiesSnapshot.docs) {
        const companyData = companyDoc.data();
        const companyId = companyDoc.id;

        try {
          // TODO: Send notification to company admin about trial expiration
          console.log(`Trial expiring for company ${companyId}: ${companyData.name}`);

          // You could create a notification document here
          // or trigger an email notification
        } catch (error) {
          console.error(`Error processing trial expiration for company ${companyId}:`, error);
          // Continue with next company
        }
      }

      console.log('Trial expiration check job completed');
    } catch (error) {
      console.error('Error in trial expiration check job:', error);
      throw error;
    }
  }
);

/**
 * Usage tracking sync job
 * Runs every hour to sync user counts with subscriptions
 */
const usageTrackingSyncJob = onSchedule(
  {
    schedule: '0 * * * *', // Every hour
    timeZone: 'UTC',
    memory: '256MiB',
  },
  async (event) => {
    console.log('Running usage tracking sync job...');

    try {
      // Get all active subscriptions
      const subscriptionsSnapshot = await db
        .collection(COLLECTIONS.SUBSCRIPTIONS)
        .where('status', 'in', ['active', 'trial'])
        .get();

      console.log(`Syncing user counts for ${subscriptionsSnapshot.size} subscriptions`);

      for (const subscriptionDoc of subscriptionsSnapshot.docs) {
        const subscriptionId = subscriptionDoc.id;

        try {
          await updateSubscriptionQuantity(subscriptionId);
        } catch (error) {
          console.error(`Error syncing subscription ${subscriptionId}:`, error);
          // Continue with next subscription
        }
      }

      console.log('Usage tracking sync job completed');
    } catch (error) {
      console.error('Error in usage tracking sync job:', error);
      throw error;
    }
  }
);

module.exports = {
  monthlyBillingJob,
  gracePeriodCheckJob,
  paymentRetryJob,
  trialExpirationCheckJob,
  usageTrackingSyncJob,
};
