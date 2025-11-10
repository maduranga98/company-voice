/**
 * Stripe Webhook Handler
 * Processes Stripe webhook events for billing automation
 */

const { onRequest } = require('firebase-functions/v2/https');
const { initializeStripe, getWebhookSecret, stripeWebhookSecret } = require('../config/stripe');
const { markInvoiceAsPaid, getInvoiceByStripeId } = require('../services/invoiceService');
const { handlePaymentFailure, processPayment } = require('../services/paymentService');
const { updateSubscriptionQuantity } = require('../services/subscriptionService');
const { logBillingEvent } = require('../utils/helpers');
const { BILLING_EVENT_TYPE } = require('../config/stripe');

/**
 * Handle invoice.payment_succeeded event
 * @param {Object} invoice - Stripe invoice object
 */
async function handleInvoicePaymentSucceeded(invoice) {
  try {
    const invoiceData = await getInvoiceByStripeId(invoice.id);

    if (!invoiceData) {
      console.log('Invoice not found in database:', invoice.id);
      return;
    }

    await markInvoiceAsPaid(invoiceData.id, invoice.payment_intent);

    console.log('Invoice marked as paid:', invoiceData.invoiceNumber);
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed event
 * @param {Object} invoice - Stripe invoice object
 */
async function handleInvoicePaymentFailed(invoice) {
  try {
    const invoiceData = await getInvoiceByStripeId(invoice.id);

    if (!invoiceData) {
      console.log('Invoice not found in database:', invoice.id);
      return;
    }

    const failureMessage = invoice.last_finalization_error?.message || 'Payment failed';

    await handlePaymentFailure({
      stripePaymentIntentId: invoice.payment_intent,
      failureCode: invoice.last_finalization_error?.code || 'unknown',
      failureMessage,
    });

    console.log('Payment failure handled for invoice:', invoiceData.invoiceNumber);
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
    throw error;
  }
}

/**
 * Handle payment_intent.succeeded event
 * @param {Object} paymentIntent - Stripe payment intent object
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    console.log('Payment intent succeeded:', paymentIntent.id);

    // Log event for tracking
    if (paymentIntent.metadata?.companyId) {
      await logBillingEvent({
        companyId: paymentIntent.metadata.companyId,
        eventType: BILLING_EVENT_TYPE.PAYMENT_SUCCEEDED,
        description: `Payment of $${(paymentIntent.amount / 100).toFixed(2)} succeeded`,
        eventData: {
          amount: paymentIntent.amount / 100,
          paymentIntentId: paymentIntent.id,
        },
      });
    }
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
    throw error;
  }
}

/**
 * Handle payment_intent.payment_failed event
 * @param {Object} paymentIntent - Stripe payment intent object
 */
async function handlePaymentIntentFailed(paymentIntent) {
  try {
    console.log('Payment intent failed:', paymentIntent.id);

    const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';

    await handlePaymentFailure({
      stripePaymentIntentId: paymentIntent.id,
      failureCode: paymentIntent.last_payment_error?.code || 'unknown',
      failureMessage,
    });
  } catch (error) {
    console.error('Error handling payment intent failed:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.updated event
 * @param {Object} subscription - Stripe subscription object
 */
async function handleSubscriptionUpdated(subscription) {
  try {
    console.log('Subscription updated:', subscription.id);

    if (subscription.metadata?.companyId) {
      await logBillingEvent({
        companyId: subscription.metadata.companyId,
        eventType: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
        description: `Subscription updated - Status: ${subscription.status}`,
        eventData: {
          status: subscription.status,
          subscriptionId: subscription.id,
        },
      });
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.deleted event
 * @param {Object} subscription - Stripe subscription object
 */
async function handleSubscriptionDeleted(subscription) {
  try {
    console.log('Subscription deleted:', subscription.id);

    if (subscription.metadata?.companyId) {
      await logBillingEvent({
        companyId: subscription.metadata.companyId,
        eventType: BILLING_EVENT_TYPE.SUBSCRIPTION_CANCELED,
        description: 'Subscription canceled in Stripe',
        eventData: {
          subscriptionId: subscription.id,
          canceledAt: new Date(subscription.canceled_at * 1000).toISOString(),
        },
      });
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
    throw error;
  }
}

/**
 * Handle payment_method.attached event
 * @param {Object} paymentMethod - Stripe payment method object
 */
async function handlePaymentMethodAttached(paymentMethod) {
  try {
    console.log('Payment method attached:', paymentMethod.id);
    // Additional logic if needed
  } catch (error) {
    console.error('Error handling payment method attached:', error);
    throw error;
  }
}

/**
 * Stripe webhook endpoint
 */
const handleStripeWebhook = onRequest(
  {
    secrets: [stripeWebhookSecret],
    cors: false,
  },
  async (req, res) => {
    const stripe = initializeStripe();
    const webhookSecret = getWebhookSecret();

    let event;

    try {
      const signature = req.headers['stripe-signature'];

      // Verify webhook signature
      event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);

      console.log('Webhook received:', event.type);

      // Handle different event types
      switch (event.type) {
        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object);
          break;

        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event.data.object);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;

        case 'payment_method.attached':
          await handlePaymentMethodAttached(event.data.object);
          break;

        default:
          console.log('Unhandled event type:', event.type);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error.message);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
);

module.exports = {
  handleStripeWebhook,
};
