import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import CryptoJS from "crypto-js";

// ============================================
// KEY GENERATION
// ============================================

/**
 * Generate a cryptographically random 64-character hex AES key.
 * 32 bytes of entropy → 64 hex characters.
 * @returns {string} 64-char hex key
 */
const generateFullKey = () => CryptoJS.lib.WordArray.random(32).toString();

// ============================================
// KEY VAULT OPERATIONS
// ============================================

/**
 * Initialize the split-key vault for a company.
 *
 * Generates a 64-char hex AES key, splits it at position 32:
 *   - Part A (chars 0–31) is stored in Firestore: keyVault/{companyId}
 *   - Part B (chars 32–63) is returned to the caller for out-of-band delivery
 *     to the DPO (e.g. via encrypted email — email delivery is out of scope here).
 *
 * Both parts are required together to decrypt an anonymous author ID.
 * Neither part alone is sufficient.
 *
 * Idempotent: if a vault already exists for the company it will NOT be
 * overwritten — call rotateKey() explicitly to replace the key.
 *
 * @param {string} companyId - Firestore company document ID
 * @param {string} dpoEmail  - Email address of the company's Data Protection Officer
 * @returns {Promise<{ keyPartB: string, existed: boolean }>}
 *          keyPartB MUST be delivered to the DPO immediately and is NOT stored.
 */
export const initializeCompanyKeyVault = async (companyId, dpoEmail) => {
  try {
    const vaultRef = doc(db, "keyVault", companyId);
    const existing = await getDoc(vaultRef);

    if (existing.exists()) {
      return { keyPartB: null, existed: true };
    }

    const fullKey = generateFullKey();           // 64 hex chars
    const keyPartA = fullKey.slice(0, 32);       // stored in Firestore
    const keyPartB = fullKey.slice(32);          // returned to caller

    await setDoc(vaultRef, {
      keyPartA,
      dpoEmail,
      keyVersion: 1,
      companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { keyPartB, existed: false };
  } catch (error) {
    console.error("Error initializing company key vault:", error);
    throw error;
  }
};

/**
 * Retrieve Key Part A for a company (super_admin access only — enforced at
 * the application layer since Firebase Auth is disabled on this project).
 *
 * @param {string} companyId - Company ID
 * @returns {Promise<{ keyPartA: string, dpoEmail: string, keyVersion: number } | null>}
 */
export const getKeyPartA = async (companyId) => {
  try {
    const vaultRef = doc(db, "keyVault", companyId);
    const snap = await getDoc(vaultRef);

    if (!snap.exists()) {
      return null;
    }

    const data = snap.data();
    return {
      keyPartA: data.keyPartA,
      dpoEmail: data.dpoEmail,
      keyVersion: data.keyVersion,
    };
  } catch (error) {
    console.error("Error fetching key part A:", error);
    throw error;
  }
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

/**
 * Rotate the company's key pair.
 *
 * Generates a new 64-char key, replaces keyPartA in Firestore, increments
 * keyVersion, and returns the new keyPartB for delivery to the DPO.
 *
 * WARNING: Rotation does NOT re-encrypt existing posts. Posts encrypted under
 * the old key can no longer be decrypted with the new key pair. Rotation
 * should only be used when the old key is compromised.
 *
 * @param {string} companyId - Company ID
 * @returns {Promise<{ keyPartB: string, keyVersion: number }>}
 */
export const rotateKey = async (companyId) => {
  try {
    const vaultRef = doc(db, "keyVault", companyId);
    const existing = await getDoc(vaultRef);

    if (!existing.exists()) {
      throw new Error(`No key vault found for company: ${companyId}`);
    }

    const currentVersion = existing.data().keyVersion || 1;

    const fullKey = generateFullKey();
    const keyPartA = fullKey.slice(0, 32);
    const keyPartB = fullKey.slice(32);
    const newVersion = currentVersion + 1;

    await updateDoc(vaultRef, {
      keyPartA,
      keyVersion: newVersion,
      updatedAt: serverTimestamp(),
    });

    return { keyPartB, keyVersion: newVersion };
  } catch (error) {
    console.error("Error rotating key:", error);
    throw error;
  }
};
