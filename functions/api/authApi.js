/**
 * Authentication API
 * HTTP callable functions for authentication management
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { admin, db, COLLECTIONS } = require('../config/firebase');
const CryptoJS = require('crypto-js');

/**
 * Hash password
 */
function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}

/**
 * Generate custom auth token for user
 * This allows users who authenticate with custom credentials
 * to also be authenticated in Firebase Auth
 */
const generateAuthToken = onCall({ cors: true, memory: '128MiB' }, async (request) => {
  const { data } = request;
  const { username, password } = data;

  if (!username || !password) {
    throw new HttpsError('invalid-argument', 'Username and password are required');
  }

  try {
    // Hash the password
    const hashedPassword = hashPassword(password);

    // Query users collection
    const usersSnapshot = await db.collection(COLLECTIONS.USERS)
      .where('username', '==', username.toLowerCase())
      .where('password', '==', hashedPassword)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      throw new HttpsError('unauthenticated', 'Invalid username or password');
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    // Update last login
    await db.collection(COLLECTIONS.USERS).doc(userId).update({
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create custom token for Firebase Auth
    const customToken = await admin.auth().createCustomToken(userId, {
      companyId: userData.companyId,
      role: userData.role,
    });

    // Return user data and custom token
    const userResponse = {
      id: userId,
      ...userData,
    };
    delete userResponse.password;

    return {
      success: true,
      data: {
        user: userResponse,
        customToken,
      },
    };
  } catch (error) {
    console.error('Error generating auth token:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Initialize super admin user (one-time setup)
 * Creates the default super admin account if it does not already exist.
 * This callable function is idempotent — safe to call multiple times.
 */
const setupSuperAdmin = onCall({ cors: true, memory: '128MiB' }, async () => {
  try {
    const SUPER_ADMIN_USERNAME = 'superadmin';
    const SUPER_ADMIN_PASSWORD = 'Admin@123';
    const hashedPassword = hashPassword(SUPER_ADMIN_PASSWORD);

    // Check if super admin already exists
    const existing = await db.collection(COLLECTIONS.USERS)
      .where('username', '==', SUPER_ADMIN_USERNAME)
      .where('role', '==', 'super_admin')
      .limit(1)
      .get();

    if (!existing.empty) {
      return { success: true, message: 'Super admin already exists' };
    }

    // Create super admin user
    await db.collection(COLLECTIONS.USERS).add({
      username: SUPER_ADMIN_USERNAME,
      password: hashedPassword,
      displayName: 'Super Admin',
      email: 'superadmin@companyvoice.app',
      role: 'super_admin',
      status: 'active',
      companyId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null,
    });

    return { success: true, message: 'Super admin created successfully' };
  } catch (error) {
    console.error('Error setting up super admin:', error);
    throw new HttpsError('internal', error.message);
  }
});

module.exports = {
  generateAuthToken,
  setupSuperAdmin,
};
