# Billing System - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install Dependencies

```bash
# Frontend
npm install

# Functions
cd functions && npm install && cd ..
```

### 2. Configure Stripe

```bash
# Get your keys from https://dashboard.stripe.com/test/apikeys
firebase functions:secrets:set STRIPE_SECRET_KEY
# Paste: sk_test_...

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Paste: whsec_test_... (get after deploying webhook)
```

### 3. Update .env

```bash
# Add to .env file
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 4. Deploy

```bash
# Deploy functions
firebase deploy --only functions

# Deploy rules
firebase deploy --only firestore:rules

# Deploy frontend
npm run build
firebase deploy --only hosting
```

### 5. Configure Webhook

1. Copy webhook URL from deployment output
2. Go to https://dashboard.stripe.com/test/webhooks
3. Add endpoint with URL
4. Select events: `invoice.*`, `payment_intent.*`, `customer.subscription.*`
5. Update webhook secret:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

---

## 📋 API Cheat Sheet

### Company Admin Functions

```javascript
import * as billing from './services/billingService';

// Create subscription
await billing.createSubscription({
  companyId: 'xxx',
  paymentMethodId: 'pm_xxx',
  startTrial: true
});

// Get subscription
await billing.getSubscription(companyId);

// Get invoices
await billing.getInvoices(companyId);

// Get usage summary
await billing.getUsageSummary(companyId);

// Cancel subscription
await billing.cancelSubscription(subscriptionId, immediate = false);

// Add payment method
await billing.addPaymentMethod({
  companyId,
  stripePaymentMethodId: 'pm_xxx',
  setAsDefault: true
});
```

### Super Admin Functions

```javascript
// Get all subscriptions
await billing.getAllSubscriptions({ status: 'active' });

// Get revenue report
await billing.getRevenueReport(month, year);

// Get all invoices
await billing.getSuperAdminInvoices({
  status: 'paid',
  startDate: new Date('2025-01-01'),
  limit: 100
});

// Get billing disputes
await billing.getBillingDisputes({ status: 'open' });
```

---

## 🧪 Test Cards

**Success:**
- `4242 4242 4242 4242` - Visa

**Failure:**
- `4000 0000 0000 0002` - Card declined

**3D Secure:**
- `4000 0025 0000 3155` - Requires authentication

All cards: Any future expiry, any CVC, any ZIP

---

## 📊 Database Collections

| Collection | Purpose | Access |
|------------|---------|--------|
| `subscriptions` | Company subscriptions | Company Admin, Super Admin |
| `invoices` | Generated invoices | Company Admin, Super Admin |
| `usageRecords` | User add/remove tracking | Company Admin, Super Admin |
| `payments` | Payment attempts | Company Admin, Super Admin |
| `paymentMethods` | Stored payment cards | Company Admin, Super Admin |
| `billingHistory` | Audit trail | Company Admin, Super Admin |
| `billingDisputes` | Dispute tracking | Company Admin, Super Admin |
| `revenueReports` | Monthly reports | Super Admin only |

---

## ⏰ Scheduled Jobs

| Function | Schedule | Purpose |
|----------|----------|---------|
| `monthlyBillingJob` | Daily 2 AM UTC | Create monthly invoices |
| `gracePeriodCheckJob` | Daily 3 AM UTC | Suspend overdue accounts |
| `paymentRetryJob` | Daily 4 AM UTC | Retry failed payments |
| `trialExpirationCheckJob` | Daily 1 AM UTC | Notify trial expiration |
| `usageTrackingSyncJob` | Every hour | Sync user counts |

---

## 🔧 Common Tasks

### Change Price Per User

1. Update `functions/config/stripe.js`:
   ```javascript
   PRICE_PER_USER: 2.00  // Change from 1.00
   ```

2. Redeploy:
   ```bash
   firebase deploy --only functions
   ```

### Change Grace Period

1. Update `functions/config/stripe.js`:
   ```javascript
   GRACE_PERIOD_DAYS: 14  // Change from 7
   ```

2. Redeploy:
   ```bash
   firebase deploy --only functions
   ```

### View Logs

```bash
# All functions
firebase functions:log

# Specific function
firebase functions:log --only monthlyBillingJob

# Follow in real-time
firebase functions:log --follow
```

### Test Webhook Locally

```bash
# Forward to emulator
stripe listen --forward-to http://localhost:5001/PROJECT_ID/us-central1/handleStripeWebhook

# Trigger test event
stripe trigger payment_intent.succeeded
```

---

## 🐛 Quick Troubleshooting

**Webhook not working?**
```bash
# Check secret is set
firebase functions:secrets:access STRIPE_WEBHOOK_SECRET

# Check logs
firebase functions:log --only handleStripeWebhook
```

**Billing not running?**
```bash
# Check scheduled function status
firebase functions:list | grep billingJob

# Manually trigger
curl -X POST https://REGION-PROJECT.cloudfunctions.net/monthlyBillingJob
```

**Proration not calculating?**
```bash
# Check usage records in Firestore
# Verify updateSubscriptionQuantity is called
# Check function logs for errors
```

---

## 📞 Support

- **Stripe Docs**: https://stripe.com/docs
- **Firebase Docs**: https://firebase.google.com/docs
- **Full Guide**: See `BILLING_IMPLEMENTATION_GUIDE.md`
- **Schema**: See `BILLING_DATABASE_SCHEMA.md`

---

## ✅ Pre-Launch Checklist

- [ ] Stripe account verified
- [ ] API keys configured (test mode)
- [ ] Webhook endpoint added
- [ ] Functions deployed
- [ ] Security rules deployed
- [ ] Test subscription created
- [ ] Payment flow tested
- [ ] Failed payment tested
- [ ] Grace period tested
- [ ] User proration tested
- [ ] Invoice generation verified
- [ ] Super Admin dashboard tested
- [ ] Ready for production!

---

## 🎯 Key Metrics to Monitor

1. **Monthly Recurring Revenue (MRR)**
2. **Payment Success Rate** (should be >95%)
3. **Companies in Grace Period** (should be <5%)
4. **Average Users per Company**
5. **Churn Rate** (canceled subscriptions)

---

## 💡 Pro Tips

1. **Use test mode** for development
2. **Monitor webhook delivery** in Stripe dashboard
3. **Check scheduled jobs daily** in Firebase console
4. **Keep Stripe keys secure** - never commit to Git
5. **Test proration** before going live
6. **Set up alerts** for failed payments
7. **Review revenue reports** monthly

---

## 🔄 Deployment Checklist

```bash
# 1. Deploy functions
firebase deploy --only functions

# 2. Deploy rules
firebase deploy --only firestore:rules

# 3. Build frontend
npm run build

# 4. Deploy frontend
firebase deploy --only hosting

# 5. Verify
curl https://YOUR_APP.web.app
```

---

**Need Help?** Read the full implementation guide: `BILLING_IMPLEMENTATION_GUIDE.md`
