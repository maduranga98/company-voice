# Firebase Security & Monitoring Setup Guide

This guide will help you set up Firebase Security Rules, App Check, Analytics, and Performance Monitoring for the Company Voice Platform.

## Table of Contents

1. [Firebase Security Rules](#firebase-security-rules)
2. [Firebase App Check](#firebase-app-check)
3. [Firebase Analytics](#firebase-analytics)
4. [Firebase Performance Monitoring](#firebase-performance-monitoring)
5. [Deployment](#deployment)
6. [Testing](#testing)
7. [Monitoring & Debugging](#monitoring--debugging)

---

## Firebase Security Rules

### Firestore Security Rules

The Firestore security rules are defined in `firestore.rules` and include:

- **Role-based access control** (Super Admin, Company Admin, HR, Employee)
- **Company-based data isolation** (users can only access data from their company)
- **Post and comment moderation** rules
- **Billing and subscription access controls**
- **Content moderation and reporting** rules
- **Rate limiting** helpers (actual enforcement done server-side)

### Storage Security Rules

The Storage security rules are defined in `storage.rules` and include:

- **User profile images** (max 5MB, images only)
- **Company logos** (max 5MB, images only, admin access)
- **Post attachments** (max 50MB, images and documents)
- **Discussion attachments** (max 50MB, images and documents)
- **Billing documents** (backend only, super admin read access)
- **Temporary uploads** (user-owned, auto-cleanup after 24 hours)
- **Analytics exports** (admin access only)

### Deploying Security Rules

To deploy the security rules to Firebase:

```bash
# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Deploy only Storage rules
firebase deploy --only storage:rules

# Deploy both Firestore and Storage rules
firebase deploy --only firestore:rules,storage:rules

# Deploy everything (rules + hosting + functions)
firebase deploy
```

### Testing Security Rules Locally

Use the Firebase Emulator Suite to test rules locally:

```bash
# Start the emulators
firebase emulators:start

# Access the Emulator UI at http://localhost:4000
# - Firestore emulator: http://localhost:8080
# - Storage emulator: http://localhost:9199
```

---

## Firebase App Check

Firebase App Check helps protect your backend resources from abuse by preventing unauthorized clients from accessing your backend.

### Setup Steps

#### 1. Enable App Check in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **App Check** in the left sidebar
4. Click **Get Started**

#### 2. Register Your App with reCAPTCHA v3

1. In the App Check page, click on your web app
2. Select **reCAPTCHA v3** as the provider
3. You'll need to register your site with Google reCAPTCHA:
   - Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
   - Click **+** to create a new site
   - Choose **reCAPTCHA v3**
   - Add your domains (e.g., `localhost`, `your-domain.com`)
   - Copy the **Site Key**

#### 3. Configure Environment Variables

Add the reCAPTCHA v3 site key to your `.env` file:

```env
VITE_FIREBASE_APP_CHECK_KEY=your_recaptcha_v3_site_key_here
```

#### 4. Enable App Check for Firebase Services

In the Firebase Console > App Check:

1. Enable enforcement for:
   - **Firestore**
   - **Storage**
   - **Cloud Functions**
   - **Realtime Database** (if used)

⚠️ **Important**: Start with "Unenforced" mode to monitor traffic without blocking requests. Once confident, switch to "Enforced" mode.

#### 5. Debug Token for Development

For local development, you can use debug tokens:

1. In your browser console, run:
   ```javascript
   self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
   ```
2. Reload the page
3. Copy the debug token from the console
4. Add it to Firebase Console > App Check > Apps > Your App > Debug Tokens

### App Check Configuration

The App Check configuration is in `src/config/firebase.js`:

```javascript
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

if (import.meta.env.VITE_FIREBASE_APP_CHECK_KEY) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_FIREBASE_APP_CHECK_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
```

---

## Firebase Analytics

Firebase Analytics provides insights into user behavior and app usage.

### Setup Steps

#### 1. Enable Analytics in Firebase Console

1. Go to Firebase Console > Analytics
2. Click **Enable Google Analytics**
3. Choose an existing Google Analytics account or create a new one
4. Complete the setup

#### 2. Get Your Measurement ID

1. Go to Firebase Console > Project Settings > General
2. Scroll down to "Your apps"
3. Copy the **Measurement ID** (starts with `G-`)

#### 3. Configure Environment Variables

Add the measurement ID to your `.env` file:

```env
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Using Analytics

The analytics utility is available in `src/utils/analytics.js`:

```javascript
import {
  logPageView,
  logUserLogin,
  logPostCreated,
  setAnalyticsUserId,
  setAnalyticsUserProperties,
} from '@/utils/analytics';

// Track page views
logPageView('/dashboard', 'Dashboard');

// Track user login
logUserLogin('email');

// Track post creation
logPostCreated('suggestion', false);

// Set user ID (on login)
setAnalyticsUserId(user.uid);

// Set user properties
setAnalyticsUserProperties({
  role: user.role,
  company: user.companyId,
  isPremium: user.isPremium,
});
```

### Available Analytics Events

The following events are pre-configured:

- **User Actions**: `login`, `sign_up`, `logout`
- **Content**: `post_created`, `comment_created`, `post_liked`, `post_viewed`
- **Search**: `search`, `filters_applied`
- **Admin**: `admin_action`, `moderation_action`
- **Engagement**: `page_view`, `user_engagement`, `feature_used`
- **Billing**: `subscription_started`, `payment_success`, `subscription_cancelled`
- **Errors**: `app_error`

### Viewing Analytics Data

1. Go to Firebase Console > Analytics
2. Explore the dashboards:
   - **Events**: See all logged events
   - **Realtime**: See current active users
   - **Engagement**: User engagement metrics
   - **Retention**: User retention over time
   - **Demographics**: User location and language

You can also connect to **Google Analytics 4** for more advanced analysis:
- Go to [analytics.google.com](https://analytics.google.com)
- Select your property
- Explore reports, create custom dashboards, and set up custom alerts

---

## Firebase Performance Monitoring

Performance Monitoring helps you understand your app's performance characteristics.

### Setup Steps

Performance Monitoring is automatically enabled when you initialize it in `src/config/firebase.js`. No additional configuration needed!

### Using Performance Monitoring

The performance utility is available in `src/utils/performance.js`:

```javascript
import {
  tracePageLoad,
  traceApiCall,
  traceFirestoreOperation,
  traceUserAction,
  traceFileUpload,
} from '@/utils/performance';

// Trace page loads
const trace = tracePageLoad('dashboard');
// ... page loads ...
trace.stop();

// Trace API calls
await traceApiCall('fetch_posts', async () => {
  return await fetchPosts();
});

// Trace Firestore operations
await traceFirestoreOperation('read_posts', async () => {
  return await getDocs(postsQuery);
});

// Trace file uploads
await traceFileUpload('profile.jpg', fileSize, async () => {
  return await uploadBytes(storageRef, file);
});
```

### Performance Monitoring Features

The utility provides automatic tracking for:

- **Page Load Times**: Track how long pages take to load
- **API Response Times**: Monitor backend API performance
- **Firestore Operations**: Track database read/write performance
- **File Uploads**: Monitor upload speed and success rate
- **User Actions**: Track time to complete user actions
- **Component Renders**: Monitor React component render times
- **Data Processing**: Track data transformation performance

### Viewing Performance Data

1. Go to Firebase Console > Performance
2. Explore the dashboards:
   - **Dashboard**: Overview of performance metrics
   - **Traces**: Custom traces you've created
   - **Network**: HTTP/S network requests
   - **Screen Rendering**: Page load performance

---

## Deployment

### Deploy All Firebase Resources

```bash
# Deploy everything (recommended for first deploy)
firebase deploy

# Deploy specific resources
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
firebase deploy --only hosting
firebase deploy --only functions
```

### Pre-Deployment Checklist

- [ ] Security rules are tested locally with emulators
- [ ] Environment variables are set correctly
- [ ] App Check is configured (if using)
- [ ] Analytics is enabled
- [ ] Build passes all tests: `npm run build`
- [ ] Lint passes: `npm run lint`

### Production Deployment Best Practices

1. **Test in staging first**: Deploy to a staging environment before production
2. **Use environment-specific configs**: Different Firebase projects for dev/staging/prod
3. **Enable App Check gradually**: Start with "Unenforced" mode, monitor, then enforce
4. **Monitor analytics**: Set up custom alerts for critical metrics
5. **Review security rules regularly**: Audit rules every quarter
6. **Rotate secrets**: Rotate API keys and secrets regularly
7. **Enable audit logging**: Enable Firebase audit logs for compliance

---

## Testing

### Testing Security Rules

#### Using Firebase Emulator Suite

```bash
# Start emulators
firebase emulators:start

# In another terminal, run your tests
npm test
```

#### Manual Testing in Emulator UI

1. Go to http://localhost:4000
2. Open Firestore or Storage emulator
3. Try operations with different user contexts
4. Verify that rules enforce access correctly

### Testing App Check

1. **Development Mode**:
   - Enable debug tokens
   - Test with debug token in browser

2. **Staging Mode**:
   - Use real reCAPTCHA in staging
   - Monitor App Check metrics in Firebase Console

3. **Production Mode**:
   - Enable enforcement gradually
   - Monitor for false positives
   - Have a rollback plan

### Testing Analytics

1. Go to Firebase Console > Analytics > DebugView
2. Enable debug mode in your app:
   ```javascript
   // Add this to your browser console
   localStorage.setItem('debug_mode', 'true');
   ```
3. Perform actions in your app
4. Verify events appear in DebugView

### Testing Performance Monitoring

1. Go to Firebase Console > Performance
2. Wait 10-15 minutes for data to appear
3. Verify custom traces are showing up
4. Check metrics are being recorded correctly

---

## Monitoring & Debugging

### Security Rules Debugging

If you encounter permission denied errors:

1. Check Firebase Console > Firestore/Storage > Rules Playground
2. Test the operation with the exact data and user context
3. Review the rules evaluation to see where it failed
4. Add temporary logging rules (remove before production):
   ```
   // Temporary debugging
   allow read: if debug() && isAuthenticated();

   function debug() {
     let data = request.resource.data;
     // This will show in Firebase logs
     return data.debug == true;
   }
   ```

### App Check Debugging

Monitor App Check in Firebase Console:

1. Go to App Check > Metrics
2. Check for:
   - Token verification success rate
   - Failed verification attempts
   - Suspicious traffic patterns

### Analytics Debugging

Use DebugView for real-time event monitoring:

1. Enable debug mode (see Testing section)
2. Go to Firebase Console > Analytics > DebugView
3. Watch events in real-time
4. Verify event parameters are correct

### Performance Monitoring Debugging

1. Go to Firebase Console > Performance > Dashboard
2. Look for:
   - Slow page loads (> 3 seconds)
   - Failed network requests
   - Long database operations
   - Large file upload times
3. Drill down into specific traces for details

### Common Issues

#### App Check token verification failed

**Solution**:
- Verify reCAPTCHA site key is correct
- Check domain is registered in reCAPTCHA console
- Use debug token for development

#### Analytics events not showing

**Solution**:
- Wait 10-15 minutes for data to appear
- Check that Measurement ID is correct
- Verify analytics is not blocked by ad blockers
- Check browser console for errors

#### Performance traces not appearing

**Solution**:
- Wait 10-15 minutes for data to appear
- Verify performance is initialized correctly
- Check that traces are being started and stopped
- Look for JavaScript errors in console

#### Security rules too restrictive

**Solution**:
- Test rules locally with emulators
- Use Rules Playground to debug
- Start with permissive rules, then restrict
- Add detailed comments explaining each rule

---

## Additional Resources

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/rules)
- [Firebase App Check Documentation](https://firebase.google.com/docs/app-check)
- [Firebase Analytics Documentation](https://firebase.google.com/docs/analytics)
- [Firebase Performance Monitoring Documentation](https://firebase.google.com/docs/perf-mon)
- [Google reCAPTCHA v3 Documentation](https://developers.google.com/recaptcha/docs/v3)

---

## Support

For issues or questions:
- Check Firebase Console > Support
- Visit [Firebase Community](https://firebase.google.com/community)
- Review [Stack Overflow firebase tag](https://stackoverflow.com/questions/tagged/firebase)

---

**Last Updated**: 2025-01-16
**Version**: 1.0.0
