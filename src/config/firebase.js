import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getPerformance } from "firebase/performance";
// App Check commented out - requires domain setup
// import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

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
// FIREBASE APP CHECK - Security Layer (DISABLED - requires domain)
// ============================================
// App Check helps protect your backend resources from abuse by preventing
// unauthorized clients from accessing your backend resources.
// It works with reCAPTCHA v3 for web apps.
// COMMENTED OUT: Requires a domain to be set up
/*
let appCheck = null;

if (import.meta.env.VITE_FIREBASE_APP_CHECK_KEY) {
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(import.meta.env.VITE_FIREBASE_APP_CHECK_KEY),
      // Optional: Set to true for development/testing to use debug tokens
      isTokenAutoRefreshEnabled: true,
    });
    console.log('Firebase App Check initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase App Check:', error);
  }
}

// For development/debugging, you can use debug tokens
// In development, enable debug mode by running:
// self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
// in your browser console before the app loads
*/
let appCheck = null;

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
  if (supported && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
    try {
      analytics = getAnalytics(app);
      console.log('Firebase Analytics initialized successfully');
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

try {
  // Performance monitoring is automatically enabled when you initialize it
  performance = getPerformance(app);
  console.log('Firebase Performance Monitoring initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Performance Monitoring:', error);
}

// Export the initialized services
export { analytics, performance, appCheck };
export default app;
