import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";
import CryptoJS from "crypto-js";

const ANONYMOUS_SECRET = import.meta.env.VITE_ANONYMOUS_SECRET || "default-secret-key-change-in-production";

// ============================================
// KEY GENERATION
// ============================================

const generateFullKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

// ============================================
// KEY VAULT OPERATIONS
// ============================================

/**
 * Initialize the split-key vault for a company.
 *
 * Generates a 64-char hex AES key, splits it at position 32:
 *   - Part A (chars 0–31) is stored in Firestore: keyVault/{companyId}
 *   - Part B (chars 32–63) is returned to the caller for out-of-band delivery
 *     to the DPO — it is NEVER stored.
 * Also stores a wrappedSecret so KeyPartB can be verified during disclosure.
 *
 * @param {string} companyId     - Firestore company document ID
 * @param {string} dpoEmail      - Email of the company's Data Protection Officer
 * @param {string} currentUserId - ID of the super_admin performing the action
 * @returns {Promise<string>} keyPartB — must be delivered to DPO immediately
 */
export const initializeCompanyKeyVault = async (companyId, dpoEmail, currentUserId) => {
  const vaultRef = doc(db, "keyVault", companyId);
  const existing = await getDoc(vaultRef);

  if (existing.exists()) {
    throw new Error("Key Vault already initialized. Use Rotate Key to generate new keys.");
  }

  const fullKey = generateFullKey();
  const keyPartA = fullKey.slice(0, 32);
  const keyPartB = fullKey.slice(32);

  const wrappedSecret = CryptoJS.AES.encrypt(ANONYMOUS_SECRET, keyPartA + keyPartB).toString();

  await setDoc(vaultRef, {
    keyPartA,
    wrappedSecret,
    dpoEmail,
    keyVersion: 1,
    companyId,
    initializedBy: currentUserId,
    createdAt: serverTimestamp(),
    status: "active",
  });

  // keyPartB is returned to the caller and NEVER written to Firestore
  return keyPartB;
};

/**
 * Get vault status for a single company. Never returns keyPartA.
 *
 * @param {string} companyId
 * @returns {Promise<{exists: boolean, dpoEmail?, keyVersion?, createdAt?, status?, rotatedAt?, rotatedBy?}>}
 */
export const getKeyVaultStatus = async (companyId) => {
  const vaultRef = doc(db, "keyVault", companyId);
  const snap = await getDoc(vaultRef);

  if (!snap.exists()) {
    return { exists: false };
  }

  const data = snap.data();
  return {
    exists: true,
    dpoEmail: data.dpoEmail,
    keyVersion: data.keyVersion,
    createdAt: data.createdAt,
    status: data.status,
    rotatedAt: data.rotatedAt,
    rotatedBy: data.rotatedBy,
    hasWrappedSecret: !!data.wrappedSecret,
  };
};

/**
 * Get vault statuses for all companies, joined with company names.
 * Never returns keyPartA.
 *
 * @returns {Promise<Array<{companyId, companyName, dpoEmail, keyVersion, createdAt, status, rotatedAt}>>}
 */
export const getAllKeyVaultStatuses = async () => {
  const [vaultSnap, companiesSnap] = await Promise.all([
    getDocs(collection(db, "keyVault")),
    getDocs(collection(db, "companies")),
  ]);

  const companyMap = {};
  companiesSnap.forEach((docSnap) => {
    const data = docSnap.data();
    companyMap[docSnap.id] = data.companyName || data.name || docSnap.id;
  });

  const statuses = [];
  vaultSnap.forEach((docSnap) => {
    const data = docSnap.data();
    statuses.push({
      companyId: docSnap.id,
      companyName: companyMap[docSnap.id] || docSnap.id,
      dpoEmail: data.dpoEmail,
      keyVersion: data.keyVersion,
      createdAt: data.createdAt,
      status: data.status,
      rotatedAt: data.rotatedAt,
      hasWrappedSecret: !!data.wrappedSecret,
    });
  });

  return statuses;
};

/**
 * Rotate the company's key pair.
 *
 * Generates a new 64-char key, replaces keyPartA in Firestore, increments
 * keyVersion, records rotatedAt and rotatedBy, and returns the new keyPartB.
 * The new keyPartB is NEVER stored in Firestore.
 *
 * @param {string} companyId     - Company ID
 * @param {string} currentUserId - ID of the super_admin performing the rotation
 * @returns {Promise<string>} new keyPartB
 */
export const rotateKey = async (companyId, currentUserId) => {
  const vaultRef = doc(db, "keyVault", companyId);
  const existing = await getDoc(vaultRef);

  if (!existing.exists()) {
    throw new Error("Key vault not initialized for this company");
  }

  const fullKey = generateFullKey();
  const newKeyPartA = fullKey.slice(0, 32);
  const newKeyPartB = fullKey.slice(32);

  const wrappedSecret = CryptoJS.AES.encrypt(ANONYMOUS_SECRET, newKeyPartA + newKeyPartB).toString();

  await updateDoc(vaultRef, {
    keyPartA: newKeyPartA,
    wrappedSecret,
    keyVersion: increment(1),
    rotatedAt: serverTimestamp(),
    rotatedBy: currentUserId,
  });

  // newKeyPartB is returned to the caller and NEVER written to Firestore
  return newKeyPartB;
};

/**
 * Retrieve Key Part A for a company.
 * Used during legal disclosure decryption.
 * Only call this from super_admin-gated code paths.
 *
 * @param {string} companyId - Company ID
 * @returns {Promise<string>} keyPartA
 */
export const getKeyPartA = async (companyId) => {
  const vaultRef = doc(db, "keyVault", companyId);
  const snap = await getDoc(vaultRef);

  if (!snap.exists()) {
    throw new Error("Key vault not found for this company");
  }

  return snap.data().keyPartA;
};

/**
 * Verify Key Part B via the wrappedSecret, then decrypt the anonymous author ID
 * using ANONYMOUS_SECRET (the same key used to encrypt it at post creation time).
 *
 * @param {string} companyId         - Company ID
 * @param {string} encryptedAuthorId - CryptoJS AES-encrypted author ID
 * @param {string} keyPartB          - Key Part B (provided by the DPO)
 * @returns {Promise<string>} Decrypted userId
 */
export const combineAndDecrypt = async (companyId, encryptedAuthorId, keyPartB) => {
  const vaultRef = doc(db, "keyVault", companyId);
  const vaultSnap = await getDoc(vaultRef);

  if (!vaultSnap.exists()) {
    throw new Error("Key Vault not initialized for this company. Please initialize it in Key Vault Management first.");
  }

  const { keyPartA, wrappedSecret } = vaultSnap.data();

  // Step 1: Verify KeyPartB by unwrapping the secret — recover the original secret
  let recoveredSecret;
  try {
    const unwrappedBytes = CryptoJS.AES.decrypt(wrappedSecret, keyPartA + keyPartB);
    recoveredSecret = unwrappedBytes.toString(CryptoJS.enc.Utf8);
    if (!recoveredSecret || recoveredSecret.length < 8) {
      throw new Error("Invalid Key Part B. Please verify with the DPO and try again.");
    }
  } catch (e) {
    throw new Error("Invalid Key Part B. Please verify with the DPO and try again.");
  }

  // Step 2: Decrypt the authorId using the recovered secret (not the constant)
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedAuthorId, recoveredSecret);
    const userId = bytes.toString(CryptoJS.enc.Utf8);
    console.log('VoxWel decrypt - recoveredSecret length:', recoveredSecret.length);
    console.log('VoxWel decrypt - userId result:', userId ? 'success ✓' : 'empty ✗');
    if (!userId || userId.length < 5) {
      throw new Error("Decryption produced invalid result. The post may use a different key version.");
    }
    return userId;
  } catch (e) {
    throw new Error("Could not decrypt reporter identity. " + e.message);
  }
};

/**
 * Re-initialize an existing vault (overwrites keys). Use when a vault is missing
 * the wrappedSecret field (created before that field existed).
 *
 * @param {string} companyId     - Firestore company document ID
 * @param {string} dpoEmail      - DPO email for this company
 * @param {string} currentUserId - ID of the super_admin performing the action
 * @returns {Promise<string>} new keyPartB — must be delivered to DPO immediately
 */
export const reinitializeKeyVault = async (companyId, dpoEmail, currentUserId) => {
  const vaultRef = doc(db, "keyVault", companyId);

  const fullKey = generateFullKey();
  const keyPartA = fullKey.slice(0, 32);
  const newKeyPartB = fullKey.slice(32);

  const wrappedSecret = CryptoJS.AES.encrypt(ANONYMOUS_SECRET, keyPartA + newKeyPartB).toString();

  await setDoc(vaultRef, {
    keyPartA,
    wrappedSecret,
    dpoEmail,
    keyVersion: 1,
    companyId,
    initializedBy: currentUserId,
    createdAt: serverTimestamp(),
    status: "active",
  });

  // newKeyPartB is returned to the caller and NEVER written to Firestore
  return newKeyPartB;
};
