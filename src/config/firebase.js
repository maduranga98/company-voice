import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getPerformance } from "firebase/performance";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { isPublicReportRoute } from "../utils/publicRoute";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ============================================
// FIREBASE APP CHECK
// ============================================
// Required by the public report callables (enforceAppCheck) and, once enforcement is
// switched on in the console, Firestore and Storage. Set VITE_APPCHECK_SITE_KEY to a
// reCAPTCHA v3 site key. In development set VITE_APPCHECK_DEBUG_TOKEN to a debug token
// registered in the console (or leave it empty to have the SDK print a new one).
let appCheck = null;

const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
if (appCheckSiteKey) {
  if (import.meta.env.DEV) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.error("Error initializing Firebase App Check:", error);
  }
}

// ============================================
// CORE FIREBASE SERVICES
// ============================================
// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Initialize Functions with explicit region configuration
// us-central1 is the default region for Cloud Functions
export const functions = getFunctions(app, 'us-central1');

// ============================================
// FIREBASE ANALYTICS
// ============================================
// Analytics helps you understand how users interact with your app
// It automatically collects events and user properties
let analytics = null;

// Check if analytics is supported (not available in some environments like Node.js)
isAnalyticsSupported().then((supported) => {
  if (supported && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID && !isPublicReportRoute()) {
    try {
      analytics = getAnalytics(app);
    } catch (error) {
      console.error('Error initializing Firebase Analytics:', error);
    }
  }
}).catch((error) => {
  console.error('Error checking Analytics support:', error);
});

// ============================================
// FIREBASE PERFORMANCE MONITORING
// ============================================
// Performance Monitoring helps you gain insight into the performance
// characteristics of your web app
let performance = null;

if (!isPublicReportRoute()) {
  try {
    // Performance monitoring is automatically enabled when you initialize it
    performance = getPerformance(app);
  } catch (error) {
    console.error('Error initializing Firebase Performance Monitoring:', error);
  }
}

// Export the initialized services
export { analytics, performance, appCheck };
export default app;
