# Billing System Database Schema

## Overview
This document describes the Firestore collections and document structures for the Stripe billing system.

## Collections

### 1. subscriptions
Stores company subscription information and Stripe subscription details.

```javascript
{
  id: "auto-generated",
  companyId: "string",              // Reference to companies collection
  stripeCustomerId: "string",       // Stripe customer ID
  stripeSubscriptionId: "string",   // Stripe subscription ID
  stripePriceId: "string",          // Stripe price ID for the plan
  status: "string",                 // active, past_due, canceled, unpaid, trialing
  currentPeriodStart: Timestamp,
  currentPeriodEnd: Timestamp,
  cancelAtPeriodEnd: boolean,
  canceledAt: Timestamp | null,

  // Billing details
  pricePerUser: 1.00,               // $1 per user per month
  currency: "usd",

  // Usage tracking
  currentUserCount: number,         // Current active users
  lastBilledUserCount: number,      // User count from last invoice

  // Payment status
  paymentStatus: "string",          // paid, unpaid, failed, pending
  lastPaymentDate: Timestamp | null,
  nextPaymentDate: Timestamp,

  // Grace period
  gracePeriodEndsAt: Timestamp | null,  // Set when payment fails
  gracePeriodDays: 7,                    // Default grace period

  // Audit
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: "string",              // User ID
  updatedBy: "string"
}
```

### 2. invoices
Stores invoice records for all billing periods.

```javascript
{
  id: "auto-generated",
  companyId: "string",
  subscriptionId: "string",         // Reference to subscriptions collection
  stripeInvoiceId: "string",        // Stripe invoice ID
  stripePaymentIntentId: "string",  // Stripe payment intent ID

  // Invoice details
  invoiceNumber: "string",          // INV-YYYY-MM-COMPANYID
  status: "string",                 // draft, open, paid, void, uncollectible

  // Amounts
  subtotal: number,                 // Base amount before tax
  tax: number,                      // Tax amount
  total: number,                    // Total amount
  amountDue: number,                // Amount still due
  amountPaid: number,               // Amount paid

  // Billing period
  periodStart: Timestamp,
  periodEnd: Timestamp,

  // User count
  userCount: number,                // Number of users billed

  // Line items
  lineItems: [
    {
      description: "string",        // e.g., "Monthly subscription"
      quantity: number,             // Number of users
      unitPrice: 1.00,              // $1 per user
      amount: number,               // quantity * unitPrice
      proration: boolean,           // Whether this is a proration
      prorationDate: Timestamp | null
    }
  ],

  // Dates
  dueDate: Timestamp,
  paidAt: Timestamp | null,
  voidedAt: Timestamp | null,

  // PDF
  invoicePdfUrl: "string",          // Stripe hosted invoice PDF URL

  // Audit
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 3. usageRecords
Tracks user additions and removals for proration calculations.

```javascript
{
  id: "auto-generated",
  companyId: "string",
  subscriptionId: "string",

  // Event details
  eventType: "string",              // user_added, user_removed, user_reactivated
  userId: "string",                 // Reference to users collection
  userName: "string",               // For display purposes
  userEmail: "string",

  // Counts
  userCountBefore: number,
  userCountAfter: number,

  // Billing impact
  willAffectNextInvoice: boolean,
  prorationAmount: number | null,   // Calculated proration (can be negative)

  // Timestamps
  timestamp: Timestamp,
  billingPeriodStart: Timestamp,
  billingPeriodEnd: Timestamp,

  // Audit
  performedBy: "string",            // User ID who made the change
  notes: "string"                   // Optional notes
}
```

### 4. payments
Records of all payment attempts and outcomes.

```javascript
{
  id: "auto-generated",
  companyId: "string",
  subscriptionId: "string",
  invoiceId: "string",

  // Stripe details
  stripePaymentIntentId: "string",
  stripeChargeId: "string",
  stripePaymentMethodId: "string",

  // Amount
  amount: number,
  currency: "usd",

  // Status
  status: "string",                 // succeeded, failed, pending, canceled

  // Payment method
  paymentMethod: {
    type: "string",                 // card, bank_account
    brand: "string",                // visa, mastercard, etc.
    last4: "string",                // Last 4 digits
    expiryMonth: number,
    expiryYear: number
  },

  // Failure details
  failureCode: "string" | null,
  failureMessage: "string" | null,

  // Retry information
  attemptNumber: number,            // 1, 2, 3, etc.
  maxAttempts: 3,
  nextRetryDate: Timestamp | null,

  // Timestamps
  attemptedAt: Timestamp,
  succeededAt: Timestamp | null,
  failedAt: Timestamp | null,

  // Audit
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 5. paymentMethods
Stores payment methods for each company.

```javascript
{
  id: "auto-generated",
  companyId: "string",
  stripePaymentMethodId: "string",

  // Payment method details
  type: "string",                   // card, bank_account
  isDefault: boolean,

  // Card details (if type === 'card')
  card: {
    brand: "string",                // visa, mastercard, amex, etc.
    last4: "string",
    expiryMonth: number,
    expiryYear: number,
    funding: "string"               // credit, debit, prepaid
  },

  // Bank account details (if type === 'bank_account')
  bankAccount: {
    bankName: "string",
    accountHolderType: "string",    // individual, company
    last4: "string",
    routingNumber: "string"
  },

  // Billing details
  billingDetails: {
    name: "string",
    email: "string",
    phone: "string",
    address: {
      line1: "string",
      line2: "string",
      city: "string",
      state: "string",
      postalCode: "string",
      country: "string"
    }
  },

  // Status
  status: "string",                 // active, expired, failed

  // Audit
  addedBy: "string",                // User ID
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 6. billingHistory
Audit trail of all billing-related events.

```javascript
{
  id: "auto-generated",
  companyId: "string",
  subscriptionId: "string" | null,

  // Event details
  eventType: "string",              // subscription_created, payment_succeeded,
                                    // payment_failed, subscription_canceled,
                                    // grace_period_started, account_suspended,
                                    // user_added, user_removed, etc.

  // Event data
  eventData: {
    // Flexible object containing event-specific data
  },

  // Related entities
  invoiceId: "string" | null,
  paymentId: "string" | null,
  userId: "string" | null,

  // Description
  description: "string",            // Human-readable description

  // Metadata
  metadata: {
    // Additional context
  },

  // Audit
  timestamp: Timestamp,
  performedBy: "string" | null      // User ID, null for automated events
}
```

### 7. pricingTiers (managed by Super Admin)
Defines available pricing tiers (future expansion).

```javascript
{
  id: "auto-generated",
  name: "string",                   // "Standard", "Premium", etc.
  stripePriceId: "string",

  // Pricing
  pricePerUser: number,             // Currently $1.00
  currency: "usd",
  billingInterval: "month",         // month, year

  // Features
  features: [
    "string"                        // List of included features
  ],

  // Limits
  maxUsers: number | null,          // null for unlimited

  // Status
  isActive: boolean,
  isDefault: boolean,

  // Audit
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: "string"
}
```

### 8. billingDisputes
Tracks billing disputes and resolutions (Super Admin).

```javascript
{
  id: "auto-generated",
  companyId: "string",
  invoiceId: "string",
  stripeDisputeId: "string" | null,

  // Dispute details
  reason: "string",                 // "billing_error", "subscription_canceled",
                                    // "duplicate_charge", "other"
  description: "string",
  amount: number,

  // Status
  status: "string",                 // open, in_review, resolved, closed
  resolution: "string" | null,      // refund_issued, credit_applied,
                                    // dispute_rejected

  // Resolution details
  resolutionNotes: "string" | null,
  refundAmount: number | null,

  // Communication
  messages: [
    {
      from: "string",               // User ID or "system"
      message: "string",
      timestamp: Timestamp,
      isInternal: boolean           // Internal notes vs customer-facing
    }
  ],

  // Dates
  openedAt: Timestamp,
  resolvedAt: Timestamp | null,
  closedAt: Timestamp | null,

  // Audit
  openedBy: "string",               // User ID
  resolvedBy: "string" | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 9. revenueReports (Super Admin analytics)
Pre-computed revenue reports for Super Admin dashboard.

```javascript
{
  id: "YYYY-MM",                    // Monthly report ID

  // Period
  periodStart: Timestamp,
  periodEnd: Timestamp,

  // Revenue metrics
  totalRevenue: number,
  totalInvoiced: number,
  totalPaid: number,
  totalOutstanding: number,
  totalRefunded: number,

  // Company metrics
  activeCompanies: number,
  newCompanies: number,
  canceledCompanies: number,
  companiesInGracePeriod: number,

  // User metrics
  totalActiveUsers: number,
  averageUsersPerCompany: number,

  // Payment metrics
  successfulPayments: number,
  failedPayments: number,
  paymentSuccessRate: number,       // Percentage

  // Breakdown by company
  companyBreakdown: [
    {
      companyId: "string",
      companyName: "string",
      userCount: number,
      revenue: number,
      status: "string"
    }
  ],

  // Audit
  generatedAt: Timestamp,
  generatedBy: "string"             // Usually "system"
}
```

## Updates to Existing Collections

### companies collection
Add billing-related fields:

```javascript
{
  // ... existing fields ...

  // Billing fields
  subscriptionStatus: "string",     // trial, active, past_due, canceled, suspended
  subscriptionId: "string" | null,  // Reference to subscriptions collection
  stripeCustomerId: "string" | null,

  // Trial information
  trialEndsAt: Timestamp | null,
  trialStartedAt: Timestamp | null,

  // Suspension
  suspendedAt: Timestamp | null,
  suspensionReason: "string" | null, // payment_failed, grace_period_expired

  // Last billing
  lastBillingDate: Timestamp | null,
  nextBillingDate: Timestamp | null,

  // Account status
  accountStatus: "string"           // active, suspended, canceled
}
```

### users collection
Add billing tracking:

```javascript
{
  // ... existing fields ...

  // Billing tracking
  billingImpact: {
    addedAt: Timestamp,             // When user was added to company
    lastBilledAt: Timestamp | null, // Last time this user was billed
    isActiveForBilling: boolean     // Whether user counts toward billing
  }
}
```

## Indexes

Required Firestore composite indexes:

1. `subscriptions`: companyId (ASC), status (ASC), currentPeriodEnd (ASC)
2. `invoices`: companyId (ASC), status (ASC), periodStart (DESC)
3. `usageRecords`: companyId (ASC), timestamp (DESC)
4. `payments`: companyId (ASC), status (ASC), attemptedAt (DESC)
5. `billingHistory`: companyId (ASC), timestamp (DESC)
6. `billingDisputes`: companyId (ASC), status (ASC), openedAt (DESC)

## Data Flow

### New User Added
1. User created in `users` collection
2. Record created in `usageRecords`
3. User count incremented on `subscriptions`
4. Proration calculated for next invoice
5. Event logged in `billingHistory`

### Monthly Billing Cycle
1. Scheduled function runs on billing date
2. Fetches current user count from company
3. Creates invoice in Stripe
4. Stores invoice in `invoices` collection
5. Attempts payment
6. Records payment in `payments` collection
7. Updates subscription status
8. Logs event in `billingHistory`

### Payment Failure
1. Payment fails in Stripe
2. Webhook received
3. `payments` record updated with failure
4. Grace period started on `subscriptions`
5. `companies.accountStatus` updated to "past_due"
6. Notification sent to Company Admin
7. Event logged in `billingHistory`

### Grace Period Expiration
1. Scheduled function checks grace periods
2. If expired and still unpaid:
   - `companies.accountStatus` set to "suspended"
   - `subscriptions.status` set to "canceled"
   - Access restricted in frontend
   - Event logged in `billingHistory`
