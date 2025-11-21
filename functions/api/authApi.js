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

module.exports = {
  generateAuthToken,
};
