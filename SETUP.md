# Company Voice Platform - Setup Guide

This guide will help you configure and deploy the Company Voice platform with Sentry error tracking and Stripe billing.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Variables Setup](#environment-variables-setup)
3. [Sentry Configuration](#sentry-configuration)
4. [Stripe Configuration](#stripe-configuration)
5. [Firebase Functions Deployment](#firebase-functions-deployment)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have:
- Node.js 20+ installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- A Firebase project created
- A Stripe account (for billing features)
- A Sentry account (optional, for error tracking)

## Environment Variables Setup

### 1. Frontend Environment Variables

A `.env` file has been created in the root directory with your Firebase configuration. You need to update the following:

```bash
# Required: Get your Stripe publishable key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE

# Optional: Configure Sentry for error tracking
VITE_SENTRY_DSN=https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/YOUR_PROJECT_ID

# Optional: Set environment name
VITE_ENVIRONMENT=development
```

### 2. Backend Secrets (Firebase Functions)

Cloud Functions use Firebase Secret Manager for sensitive data. You need to set these secrets:

```bash
# Set Stripe secret key
firebase functions:secrets:set STRIPE_SECRET_KEY

# Set Stripe webhook secret (after creating webhook in Stripe Dashboard)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

When prompted, paste your keys from the Stripe Dashboard.

## Sentry Configuration

### Step 1: Create a Sentry Project

1. Go to [https://sentry.io](https://sentry.io)
2. Create a new account or sign in
3. Create a new project and select "React"
4. Copy the DSN (Data Source Name) from the project settings

### Step 2: Add Sentry DSN to .env

```bash
VITE_SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
VITE_ENVIRONMENT=development
```

### Step 3: Test Sentry Integration

Restart your development server:
```bash
npm run dev
```

Sentry should now be tracking errors. You can test it by triggering an error in your application.

### Optional: Disable Sentry in Development

If you don't want to use Sentry during development, simply leave `VITE_SENTRY_DSN` empty:
```bash
VITE_SENTRY_DSN=
```

You'll see a warning in the console, but the app will work normally.

## Stripe Configuration

### Step 1: Get Stripe Keys

1. Go to [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)

### Step 2: Configure Frontend (Publishable Key)

Add to `.env`:
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

### Step 3: Configure Backend (Secret Key)

Set the secret key in Firebase:
```bash
# Login to Firebase if you haven't already
firebase login

# Set the Stripe secret key
firebase functions:secrets:set STRIPE_SECRET_KEY
# When prompted, paste your sk_test_... key

# Set the webhook secret (we'll get this after creating the webhook)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

### Step 4: Configure Stripe Webhooks

After deploying your Cloud Functions (see next section), you need to set up webhooks:

1. Go to [https://dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. Enter your webhook URL:
   ```
   https://us-central1-company-voice-ba26f.cloudfunctions.net/handleStripeWebhook
   ```
4. Select these events to listen to:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_`)
7. Update the webhook secret in Firebase:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # Paste the whsec_... secret
   ```
8. Redeploy your functions (see next section)

## Firebase Functions Deployment

### **IMPORTANT: Current Issue**

The CORS configuration has been added to the code, but **the Cloud Functions need to be deployed** to production for the changes to take effect.

### Deploy Cloud Functions

```bash
# Make sure you're in the project root directory
cd /home/user/company-voice

# Deploy only the functions (faster)
firebase deploy --only functions

# Or deploy everything (hosting + functions)
firebase deploy
```

This will deploy all Cloud Functions with the CORS configuration, which should fix the CORS errors you're seeing.

### Verify Deployment

After deployment, test your functions:

1. Open your app in the browser
2. Try to access a billing page or feature that uses Cloud Functions
3. Check the browser console - CORS errors should be gone
4. Check for 401 (Unauthorized) errors - these indicate authentication issues

### Alternative: Use Firebase Emulators for Local Development

Instead of deploying to production every time you make changes, you can use Firebase Emulators:

```bash
# Start the emulators
firebase emulators:start

# In another terminal, start your dev server
npm run dev
```

Then update your `src/config/firebase.js` to use emulators in development:

```javascript
import { connectFunctionsEmulator } from 'firebase/functions';

// ... existing code ...

// Use emulators in development
if (import.meta.env.DEV) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

## Troubleshooting

### Issue: "Sentry DSN not configured. Error tracking disabled."

**Solution:** This is just a warning. Add your Sentry DSN to `.env` or leave it empty to disable error tracking:
```bash
VITE_SENTRY_DSN=
```

### Issue: "You may test your Stripe.js integration over HTTP."

**Solution:** This is normal for local development. Stripe allows HTTP for testing with test keys. In production, make sure you're using HTTPS.

### Issue: CORS errors when calling Cloud Functions

**Solution:**
1. Make sure the functions are deployed: `firebase deploy --only functions`
2. Verify all functions have `cors: true` in their configuration
3. Check that you're calling functions from an allowed origin

### Issue: 401 Unauthorized errors

**Solution:**
1. Make sure you're logged in before accessing protected features
2. Check that Firebase Auth is properly initialized
3. Verify the auth token is being sent with function calls
4. Check Cloud Functions logs: `firebase functions:log`

### Issue: "Cannot read properties of undefined (reading 'match')"

**Solution:** This error typically occurs when:
1. A required environment variable is missing or undefined
2. A function is trying to process a string that's null/undefined
3. Check your `.env` file has all required variables set

Common variables that might cause this:
- `VITE_STRIPE_PUBLISHABLE_KEY`
- Firebase configuration variables
- Check the browser console for which component is throwing the error

### Issue: Stripe functions not working

**Solution:**
1. Verify `VITE_STRIPE_PUBLISHABLE_KEY` is set in `.env`
2. Verify `STRIPE_SECRET_KEY` is set in Firebase Secret Manager:
   ```bash
   firebase functions:secrets:access STRIPE_SECRET_KEY
   ```
3. Check Cloud Functions logs for errors:
   ```bash
   firebase functions:log
   ```

### Issue: Functions work locally but not in production

**Solution:**
1. Deploy your functions: `firebase deploy --only functions`
2. Make sure secrets are set in production:
   ```bash
   firebase functions:secrets:access STRIPE_SECRET_KEY
   firebase functions:secrets:access STRIPE_WEBHOOK_SECRET
   ```
3. Check the deployed function URLs match what you're calling in your app

## Quick Start Checklist

- [ ] Copy `.env.example` to `.env` (already done)
- [ ] Add Firebase configuration to `.env` (already done)
- [ ] Add Stripe publishable key to `.env`
- [ ] Set up Sentry (optional)
- [ ] Login to Firebase: `firebase login`
- [ ] Set Stripe secret key: `firebase functions:secrets:set STRIPE_SECRET_KEY`
- [ ] Deploy Cloud Functions: `firebase deploy --only functions`
- [ ] Set up Stripe webhooks
- [ ] Set webhook secret: `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`
- [ ] Redeploy functions: `firebase deploy --only functions`
- [ ] Test the application

## Deployment Commands Reference

```bash
# Deploy only functions (recommended for quick updates)
firebase deploy --only functions

# Deploy only hosting (frontend)
firebase deploy --only hosting

# Deploy everything
firebase deploy

# View function logs
firebase functions:log

# View function logs for a specific function
firebase functions:log --only getCompanySubscription

# Set a secret
firebase functions:secrets:set SECRET_NAME

# View a secret (will show if it's set, but not the actual value)
firebase functions:secrets:access SECRET_NAME

# List all secrets
firebase functions:secrets:list
```

## Need Help?

If you encounter issues not covered in this guide:

1. Check Firebase Functions logs: `firebase functions:log`
2. Check browser console for detailed error messages
3. Verify all environment variables are set correctly
4. Make sure all secrets are configured in Firebase
5. Ensure functions are deployed with latest code

## Production Deployment

Before deploying to production:

1. Get production keys from Stripe (starting with `pk_live_` and `sk_live_`)
2. Set `VITE_ENVIRONMENT=production` in your hosting platform
3. Use production Firebase project
4. Set up production Sentry project (optional)
5. Configure production webhooks in Stripe
6. Enable HTTPS only
7. Review and tighten security rules

---

**Last Updated:** 2025-11-13
