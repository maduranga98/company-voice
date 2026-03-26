/**
 * One-time setup script to create the default super admin user in Firestore.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json node scripts/setup-super-admin.js
 *
 * Or if running inside Firebase emulator / CI environment with ADC:
 *   node scripts/setup-super-admin.js
 *
 * This script is idempotent — running it multiple times will not create duplicates.
 */

const admin = require('firebase-admin');
const CryptoJS = require('crypto-js');

// Initialize with application default credentials (or service account via env var)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}

async function setupSuperAdmin() {
  const SUPER_ADMIN_USERNAME = 'superadmin';
  const SUPER_ADMIN_PASSWORD = 'Admin@123';
  const hashedPassword = hashPassword(SUPER_ADMIN_PASSWORD);

  console.log('Checking for existing super admin...');

  const existing = await db.collection('users')
    .where('username', '==', SUPER_ADMIN_USERNAME)
    .where('role', '==', 'super_admin')
    .limit(1)
    .get();

  if (!existing.empty) {
    console.log('Super admin already exists. No action needed.');
    process.exit(0);
  }

  console.log('Creating super admin user...');

  await db.collection('users').add({
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

  console.log('Super admin created successfully.');
  console.log('  Username: superadmin');
  console.log('  Password: Admin@123');
  process.exit(0);
}

setupSuperAdmin().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
