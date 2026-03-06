import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import CryptoJS from "crypto-js";

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
    throw new Error("Key vault already initialized for this company");
  }

  const fullKey = generateFullKey();
  const keyPartA = fullKey.substring(0, 32);
  const keyPartB = fullKey.substring(32);

  await setDoc(vaultRef, {
    keyPartA,
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
  const keyPartA = fullKey.substring(0, 32);
  const keyPartB = fullKey.substring(32);
  const newVersion = (existing.data().keyVersion || 1) + 1;

  await updateDoc(vaultRef, {
    keyPartA,
    keyVersion: newVersion,
    rotatedAt: serverTimestamp(),
    rotatedBy: currentUserId,
  });

  // keyPartB is returned to the caller and NEVER written to Firestore
  return keyPartB;
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
 * Combine both key halves and decrypt an anonymous author ID.
 *
 * The encrypted author ID was produced by:
 *   CryptoJS.AES.encrypt(userId, fullKey).toString()
 * where fullKey = keyPartA + keyPartB.
 *
 * @param {string} encryptedAuthorId - CryptoJS AES-encrypted author ID
 * @param {string} partA             - Key Part A (from Firestore via getKeyPartA)
 * @param {string} partB             - Key Part B (provided by the DPO)
 * @returns {string | null} Decrypted userId, or null if decryption fails
 */
export const combineAndDecrypt = (encryptedAuthorId, partA, partB) => {
  try {
    if (!partA || !partB || !encryptedAuthorId) return null;

    const fullKey = partA + partB;
    const bytes = CryptoJS.AES.decrypt(encryptedAuthorId, fullKey);
    const userId = bytes.toString(CryptoJS.enc.Utf8);

    if (!userId || userId.length === 0) return null;
    return userId;
  } catch (error) {
    console.error("Error combining keys and decrypting:", error);
    return null;
  }
};
