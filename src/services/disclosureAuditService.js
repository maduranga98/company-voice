import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import CryptoJS from "crypto-js";

// ============================================
// BLOCKCHAIN-STYLE HASH CHAINING
// (mirrors the pattern in auditService.js)
// ============================================

const lastDisclosureHashCache = {};

const calculateDisclosureHash = (entryData, previousHash, timestamp) => {
  try {
    const dataString = JSON.stringify({ entryData, previousHash, timestamp });
    return CryptoJS.SHA256(dataString).toString();
  } catch (error) {
    console.error("Error calculating disclosure hash:", error);
    return null;
  }
};

const getLastDisclosureHash = async (companyId) => {
  try {
    if (lastDisclosureHashCache[companyId]) {
      return lastDisclosureHashCache[companyId];
    }

    const q = query(
      collection(db, "disclosureAuditLog"),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return "DISCLOSURE_GENESIS";
    }

    const last = snapshot.docs[0].data();
    const hash = last.currentHash || "DISCLOSURE_GENESIS";
    lastDisclosureHashCache[companyId] = hash;
    return hash;
  } catch (error) {
    console.error("Error fetching last disclosure hash:", error);
    return "DISCLOSURE_GENESIS";
  }
};

// ============================================
// DISCLOSURE AUDIT LOGGING
// ============================================

/**
 * Log an identity disclosure event. IMMUTABLE — no update or delete is
 * permitted on disclosureAuditLog documents (enforced in firestore.rules).
 *
 * Produces a SHA256 hash chain linking each disclosure event to the previous
 * one for tamper detection.
 *
 * @param {string} requestId      - Legal request Firestore document ID
 * @param {string} postId         - Post / report ID whose author was disclosed
 * @param {string} companyId      - Company ID
 * @param {string} approvedBy     - displayName of the super_admin who performed the disclosure
 * @param {string} approvedById   - uid of the super_admin
 * @param {string} dpoEmail       - DPO email (key holder confirmation)
 * @param {string} legalBasis     - Legal justification text from the request
 * @param {string} deliveryMethod - How the disclosed identity was delivered (free-form)
 * @returns {Promise<{ success: boolean, auditId: string, hash: string }>}
 */
export const logDisclosure = async (
  requestId,
  postId,
  companyId,
  approvedBy,
  approvedById,
  dpoEmail,
  legalBasis,
  deliveryMethod
) => {
  try {
    const previousHash = await getLastDisclosureHash(companyId);
    const timestamp = new Date().toISOString();

    const entryData = {
      requestId,
      postId,
      companyId,
      approvedBy,
      approvedById,
      dpoEmail,
      legalBasis,
      deliveryMethod,
    };

    const currentHash = calculateDisclosureHash(entryData, previousHash, timestamp);

    const docRef = await addDoc(collection(db, "disclosureAuditLog"), {
      ...entryData,
      previousHash,
      currentHash,
      disclosedAt: timestamp,
      createdAt: serverTimestamp(),
      // Immutability marker — firestore.rules blocks updates/deletes
      immutable: true,
      retentionYears: 7,
      legalHold: true,
    });

    lastDisclosureHashCache[companyId] = currentHash;

    return { success: true, auditId: docRef.id, hash: currentHash };
  } catch (error) {
    console.error("Error logging disclosure:", error);
    throw error;
  }
};

/**
 * Fetch all disclosure audit log entries for a company.
 *
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Entries ordered newest-first
 */
export const getDisclosureLogs = async (companyId) => {
  try {
    const q = query(
      collection(db, "disclosureAuditLog"),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate
        ? doc.data().createdAt.toDate()
        : doc.data().createdAt,
    }));
  } catch (error) {
    console.error("Error fetching disclosure logs:", error);
    return [];
  }
};
