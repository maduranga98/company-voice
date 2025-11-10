/**
 * Firebase Admin Configuration
 * Initializes Firebase Admin SDK for backend operations
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Get Firestore instance
const db = admin.firestore();

// Configure Firestore settings
db.settings({
  ignoreUndefinedProperties: true,
});

/**
 * Collection references
 */
const COLLECTIONS = {
  USERS: 'users',
  COMPANIES: 'companies',
  SUBSCRIPTIONS: 'subscriptions',
  INVOICES: 'invoices',
  USAGE_RECORDS: 'usageRecords',
  PAYMENTS: 'payments',
  PAYMENT_METHODS: 'paymentMethods',
  BILLING_HISTORY: 'billingHistory',
  PRICING_TIERS: 'pricingTiers',
  BILLING_DISPUTES: 'billingDisputes',
  REVENUE_REPORTS: 'revenueReports',
};

/**
 * User roles
 */
const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  HR: 'HR',
  EMPLOYEE: 'EMPLOYEE',
};

/**
 * Get collection reference
 * @param {string} collectionName - Name of the collection
 * @returns {FirebaseFirestore.CollectionReference}
 */
function getCollection(collectionName) {
  return db.collection(collectionName);
}

/**
 * Get document reference
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {FirebaseFirestore.DocumentReference}
 */
function getDocument(collectionName, docId) {
  return db.collection(collectionName).doc(docId);
}

/**
 * Get server timestamp
 * @returns {FirebaseFirestore.FieldValue}
 */
function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

/**
 * Get increment value
 * @param {number} value - Value to increment by
 * @returns {FirebaseFirestore.FieldValue}
 */
function increment(value) {
  return admin.firestore.FieldValue.increment(value);
}

module.exports = {
  admin,
  db,
  COLLECTIONS,
  ROLES,
  getCollection,
  getDocument,
  serverTimestamp,
  increment,
};
