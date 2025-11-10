# Stripe Billing System - Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing and deploying the Stripe billing system for the Company Voice Platform. The system includes:

- **$1/user/month** billing calculation
- Automated invoice generation
- Payment failure handling with grace periods
- Usage tracking with proration for mid-month additions/removals
- Super Admin revenue monitoring
- Company Admin subscription management

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Stripe Setup](#stripe-setup)
3. [Firebase Configuration](#firebase-configuration)
4. [Environment Variables](#environment-variables)
5. [Deployment](#deployment)
6. [Testing](#testing)
7. [Usage Guide](#usage-guide)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

- **Stripe Account**: Sign up at [stripe.com](https://stripe.com)
- **Firebase Project**: Already configured
- **Node.js**: Version 20+ installed

### Required Tools

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Install frontend dependencies
npm install

# Install functions dependencies
cd functions && npm install && cd ..
```

---

## Stripe Setup

### 1. Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and sign up
2. Complete business verification (can use test mode initially)
3. Navigate to **Developers** → **API keys**

### 2. Get API Keys

You'll need two sets of keys:

**Test Mode** (for development):
- Publishable key: `pk_test_...`
- Secret key: `sk_test_...`
- Webhook signing secret: `whsec_test_...`

**Live Mode** (for production):
- Publishable key: `pk_live_...`
- Secret key: `sk_live_...`
- Webhook signing secret: `whsec_live_...`

### 3. Create Product and Price

```bash
# Using Stripe CLI (or do this in Stripe Dashboard)
stripe products create \
  --name="Company Voice Platform - Per User" \
  --description="Monthly subscription per user"

stripe prices create \
  --product=<PRODUCT_ID> \
  --unit-amount=100 \
  --currency=usd \
  --recurring[interval]=month \
  --lookup-key=standard_monthly_per_user
```

**Or via Stripe Dashboard:**
1. Go to **Products** → **Add product**
2. Name: "Company Voice Platform - Per User"
3. Pricing model: Standard pricing
4. Price: $1.00 USD
5. Billing period: Monthly
6. Add lookup key: `standard_monthly_per_user`

---

## Firebase Configuration

### 1. Set Firebase Secrets

Firebase Functions use Secret Manager to store sensitive values:

```bash
# Set Stripe secret key
firebase functions:secrets:set STRIPE_SECRET_KEY
# Paste your sk_test_... or sk_live_... key when prompted

# Set Stripe webhook secret (get this after setting up webhook)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Paste your whsec_... key when prompted
```

### 2. Configure Webhook in Stripe

After deploying functions (see [Deployment](#deployment)), you'll get a webhook URL:

```
https://us-central1-<PROJECT_ID>.cloudfunctions.net/handleStripeWebhook
```

**Setup in Stripe:**
1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. URL: `https://us-central1-<PROJECT_ID>.cloudfunctions.net/handleStripeWebhook`
4. Select events to listen for:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_method.attached`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Update Firebase secret:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # Paste the whsec_... key
   ```

---

## Environment Variables

### Frontend (.env)

Create `/home/user/company-voice/.env`:

```bash
# Firebase (existing)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Stripe (NEW)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...  # or pk_live_... for production

# Anonymous post encryption (existing)
VITE_ANONYMOUS_SECRET=your_secret_key

# Environment
VITE_ENV=development
VITE_DEBUG=true
```

### Backend (Firebase Functions)

Secrets are managed via Firebase Secret Manager (already set above):
- `STRIPE_SECRET_KEY` - Set via `firebase functions:secrets:set`
- `STRIPE_WEBHOOK_SECRET` - Set via `firebase functions:secrets:set`

---

## Deployment

### 1. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 2. Deploy Firebase Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:handleStripeWebhook
firebase deploy --only functions:monthlyBillingJob
```

**Expected output:**
```
✔  functions: Finished running predeploy script.
✔  functions[handleStripeWebhook(us-central1)] Successful create operation.
✔  functions[monthlyBillingJob(us-central1)] Successful create operation.
✔  functions[createCompanySubscription(us-central1)] Successful create operation.
... (20+ functions will be deployed)

Function URL (handleStripeWebhook): https://us-central1-<PROJECT_ID>.cloudfunctions.net/handleStripeWebhook
```

Copy the webhook URL and configure it in Stripe (see [Configure Webhook](#2-configure-webhook-in-stripe)).

### 3. Deploy Frontend

```bash
# Install Stripe dependencies
npm install

# Build
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## Testing

### 1. Test with Stripe Test Mode

Use Stripe test cards:

**Successful payment:**
- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

**Failed payment:**
- Card: `4000 0000 0000 0002`
- This will trigger payment failure and grace period logic

**3D Secure (requires authentication):**
- Card: `4000 0025 0000 3155`

### 2. Test Webhook Events

Use Stripe CLI to forward events locally:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward events to local emulator
stripe listen --forward-to http://localhost:5001/<PROJECT_ID>/us-central1/handleStripeWebhook

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger invoice.payment_failed
```

### 3. Test Scheduled Functions Locally

```bash
# Start Firebase emulators
firebase emulators:start

# In another terminal, trigger scheduled function
curl -X POST \
  http://localhost:5001/<PROJECT_ID>/us-central1/monthlyBillingJob \
  -H "Authorization: Bearer $(firebase auth:token)"
```

### 4. Manual Testing Checklist

**Company Admin Flow:**
1. ✅ Create subscription with test card
2. ✅ View subscription details
3. ✅ Add/remove employees (check proration in usage summary)
4. ✅ View invoices
5. ✅ View payment history
6. ✅ Add additional payment method
7. ✅ Cancel subscription
8. ✅ Reactivate subscription

**Super Admin Flow:**
1. ✅ View all subscriptions
2. ✅ View all invoices
3. ✅ Generate revenue report
4. ✅ View billing history
5. ✅ Check companies in grace period

**Automated Flows:**
1. ✅ Monthly billing job creates invoices
2. ✅ Payment failure triggers grace period
3. ✅ Grace period expiration suspends account
4. ✅ User addition/removal records usage events
5. ✅ Proration calculated correctly

---

## Usage Guide

### For Company Admins

#### Setting Up Subscription

1. Navigate to **Billing** page
2. Click **Start Subscription**
3. Enter payment card details
4. Choose trial option (optional)
5. Click **Subscribe**

#### Managing Subscription

**View Details:**
- Current user count
- Next billing date
- Current billing amount
- Subscription status

**Add/Remove Employees:**
- Users are tracked automatically
- Proration calculated for mid-month changes
- View usage summary to see impact

**View Invoices:**
- All past invoices
- Download PDF
- View payment status

**Payment Methods:**
- Add backup cards
- Set default payment method
- Remove old cards

**Cancel Subscription:**
- Cancel immediately (prorated refund)
- Cancel at period end (continue until end date)

### For Super Admins

#### Dashboard Overview

Navigate to **Super Admin** → **Billing Dashboard**

**Metrics:**
- Total monthly recurring revenue (MRR)
- Active subscriptions
- Companies in grace period
- Payment success rate
- Total active users across platform

#### Revenue Reports

**Generate Report:**
1. Select month and year
2. Click **Generate Report**
3. View:
   - Total revenue
   - Company breakdown
   - Payment metrics
   - User growth

**Export:**
- Download as CSV
- Export to PDF

#### Managing Disputes

1. View open disputes
2. Review dispute details
3. Resolve with:
   - Refund issued
   - Credit applied
   - Dispute rejected
4. Add resolution notes

#### Monitoring Subscriptions

**View All Subscriptions:**
- Filter by status (active, past_due, canceled)
- Sort by company, date, revenue
- See user counts and amounts

**View Billing History:**
- All billing events across platform
- Filter by company or event type
- Audit trail for compliance

---

## Architecture Overview

### Backend (Firebase Functions)

**Services:**
- `subscriptionService.js` - Subscription lifecycle management
- `invoiceService.js` - Invoice generation and tracking
- `usageTrackingService.js` - User addition/removal tracking
- `paymentService.js` - Payment processing and retries

**API Endpoints:**
- `companyAdminApi.js` - 10 functions for company billing
- `superAdminApi.js` - 7 functions for platform management

**Webhooks:**
- `stripeWebhook.js` - Handles Stripe events

**Scheduled Jobs:**
- `monthlyBillingJob` - Daily at 2 AM UTC
- `gracePeriodCheckJob` - Daily at 3 AM UTC
- `paymentRetryJob` - Daily at 4 AM UTC
- `trialExpirationCheckJob` - Daily at 1 AM UTC
- `usageTrackingSyncJob` - Every hour

### Database (Firestore)

**Collections:**
- `subscriptions` - Company subscriptions
- `invoices` - Generated invoices
- `usageRecords` - User addition/removal events
- `payments` - Payment attempts and status
- `paymentMethods` - Stored payment methods
- `billingHistory` - Audit trail
- `pricingTiers` - Pricing plans
- `billingDisputes` - Dispute tracking
- `revenueReports` - Monthly reports

---

## Pricing Configuration

### Current Pricing

- **$1.00 per user per month**
- Prorated for mid-month additions
- Credit for mid-month removals
- 7-day grace period for failed payments
- 3 payment retry attempts

### Changing Pricing

**To change the per-user price:**

1. Create new price in Stripe:
   ```bash
   stripe prices create \
     --product=<PRODUCT_ID> \
     --unit-amount=200 \  # $2.00 in cents
     --currency=usd \
     --recurring[interval]=month \
     --lookup-key=standard_monthly_per_user_v2
   ```

2. Update `functions/config/stripe.js`:
   ```javascript
   const PRICING = {
     PRICE_PER_USER: 2.00,  // Update amount
     // ...
   };
   ```

3. Update existing subscriptions (run migration script)

4. Redeploy functions:
   ```bash
   firebase deploy --only functions
   ```

---

## Monitoring & Alerts

### Firebase Console

**View Function Logs:**
1. Go to Firebase Console → Functions
2. Click on function name
3. View **Logs** tab
4. Filter by severity (Error, Warning, Info)

**Check Scheduled Jobs:**
1. Go to Firebase Console → Functions
2. Look for scheduled functions
3. Check execution history

### Stripe Dashboard

**Monitor Payments:**
1. Stripe Dashboard → Payments
2. View successful/failed payments
3. Check dispute rate

**View Webhooks:**
1. Developers → Webhooks
2. Check delivery success rate
3. View recent events

### Set Up Alerts

**Firebase Monitoring:**
```bash
# Set up error alerts
firebase functions:config:set alerts.email="your-email@example.com"
```

**Stripe Notifications:**
1. Stripe Dashboard → Settings → Email notifications
2. Enable:
   - Failed payments
   - Successful payments (optional)
   - Disputed payments

---

## Troubleshooting

### Common Issues

#### 1. Webhook not receiving events

**Symptoms:** Payments succeed in Stripe but not reflected in app

**Solutions:**
- Check webhook URL is correct
- Verify webhook secret is set correctly
- Check function logs for errors
- Test webhook with Stripe CLI:
  ```bash
  stripe trigger payment_intent.succeeded
  ```

#### 2. Functions deployment fails

**Symptoms:** Error during `firebase deploy --only functions`

**Solutions:**
- Check Node.js version (should be 20)
- Verify secrets are set:
  ```bash
  firebase functions:secrets:access STRIPE_SECRET_KEY
  ```
- Check functions logs:
  ```bash
  firebase functions:log
  ```

#### 3. Payment fails with "No payment method"

**Symptoms:** Subscription created but payment not processed

**Solutions:**
- Verify payment method is attached to customer
- Check Stripe dashboard for customer
- Ensure payment method is set as default

#### 4. Proration not calculating

**Symptoms:** User added but no proration line item

**Solutions:**
- Check usage tracking job is running
- Verify `updateSubscriptionQuantity` is called
- Check Firestore for usage records
- Review function logs

#### 5. Grace period not triggering

**Symptoms:** Payment fails but account not in grace period

**Solutions:**
- Check `gracePeriodCheckJob` is scheduled
- Verify payment failure webhook is received
- Check subscription status in Firestore
- Review `startGracePeriod` function logs

### Debug Mode

Enable detailed logging:

```bash
# Set debug flag in functions
firebase functions:config:set debug.enabled=true

# Redeploy
firebase deploy --only functions
```

### Support

For issues related to:
- **Stripe**: [stripe.com/support](https://stripe.com/support)
- **Firebase**: [firebase.google.com/support](https://firebase.google.com/support)
- **Platform**: Check `BILLING_DATABASE_SCHEMA.md` and `ARCHITECTURE.md`

---

## Security Considerations

### PCI Compliance

- **Never store card details** in Firestore
- Use Stripe.js for card collection
- Cards tokenized before sending to server
- Only payment method IDs stored

### API Security

- All Firebase Functions require authentication
- Role-based access control (RBAC)
- Firestore rules prevent unauthorized access
- Webhook signature verification

### Secret Management

- Stripe keys stored in Firebase Secret Manager
- Never commit secrets to Git
- Rotate keys regularly
- Use different keys for test/production

---

## Maintenance

### Monthly Tasks

- [ ] Review revenue reports
- [ ] Check failed payment rate
- [ ] Verify scheduled jobs ran
- [ ] Review billing disputes

### Quarterly Tasks

- [ ] Audit user counts vs. billing
- [ ] Review pricing strategy
- [ ] Update documentation
- [ ] Test disaster recovery

### Annual Tasks

- [ ] Rotate Stripe API keys
- [ ] Review compliance requirements
- [ ] Update Terms of Service
- [ ] Audit billing code

---

## Next Steps

1. ✅ Deploy all functions
2. ✅ Configure Stripe webhook
3. ✅ Test with test cards
4. ✅ Create Super Admin user
5. ✅ Add pricing tiers (if needed)
6. ✅ Test full billing cycle
7. ✅ Enable production mode
8. ✅ Monitor first billing cycle

---

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Firebase Functions](https://firebase.google.com/docs/functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)

---

## Changelog

### Version 1.0.0 (Initial Release)

- Stripe integration with $1/user/month pricing
- Automated invoice generation
- Payment failure handling with 7-day grace period
- Usage tracking with proration
- Super Admin revenue dashboard
- Company Admin billing management
- Webhook handling for payment events
- Scheduled jobs for billing automation
- Comprehensive Firestore security rules
- 27+ Firebase Functions deployed
