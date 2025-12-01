import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { logSystemActivity } from "./auditService";
import { LegalRequestStatus } from "../utils/constants";

// ============================================
// LEGAL REQUEST CRUD OPERATIONS
// ============================================

/**
 * Create a new legal request
 * @param {Object} requestData - Legal request data
 * @returns {Promise<string>} Request ID
 */
export const createLegalRequest = async (requestData) => {
  try {
    const {
      companyId,
      requestedBy,
      requestedByUserId,
      requestType,
      reportId,
      legalJustification,
      courtOrderUrl,
    } = requestData;

    // Validate required fields
    if (
      !companyId ||
      !requestedBy ||
      !requestedByUserId ||
      !requestType ||
      !reportId ||
      !legalJustification
    ) {
      throw new Error("Missing required fields for legal request");
    }

    // Create the legal request
    const legalRequestRef = await addDoc(collection(db, "legalRequests"), {
      companyId,
      requestedBy,
      requestedByUserId,
      requestType,
      reportId,
      legalJustification,
      courtOrderUrl: courtOrderUrl || null,
      status: LegalRequestStatus.PENDING,
      reviewedBy: null,
      reviewedByUserId: null,
      reviewedAt: null,
      approvalNotes: null,
      rejectionReason: null,
      disclosedData: null,
      disclosureMethod: null,
      fulfilledAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Log the activity
    await logSystemActivity(companyId, "legal_request_created", {
      requestId: legalRequestRef.id,
      requestType,
      reportId,
      requestedBy,
      requestedByUserId,
    });

    return legalRequestRef.id;
  } catch (error) {
    console.error("Error creating legal request:", error);
    throw error;
  }
};

/**
 * Get a legal request by ID
 * @param {string} requestId - Legal request ID
 * @returns {Promise<Object>} Legal request data
 */
export const getLegalRequest = async (requestId) => {
  try {
    const requestRef = doc(db, "legalRequests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      throw new Error("Legal request not found");
    }

    return {
      id: requestSnap.id,
      ...requestSnap.data(),
      createdAt: requestSnap.data().createdAt?.toDate(),
      updatedAt: requestSnap.data().updatedAt?.toDate(),
      reviewedAt: requestSnap.data().reviewedAt?.toDate(),
      fulfilledAt: requestSnap.data().fulfilledAt?.toDate(),
    };
  } catch (error) {
    console.error("Error fetching legal request:", error);
    throw error;
  }
};

/**
 * Get all legal requests for a company
 * @param {string} companyId - Company ID
 * @param {string} status - Filter by status (optional)
 * @returns {Promise<Array>} List of legal requests
 */
export const getCompanyLegalRequests = async (companyId, status = null) => {
  try {
    let q;

    if (status) {
      q = query(
        collection(db, "legalRequests"),
        where("companyId", "==", companyId),
        where("status", "==", status),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(
        collection(db, "legalRequests"),
        where("companyId", "==", companyId),
        orderBy("createdAt", "desc")
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      reviewedAt: doc.data().reviewedAt?.toDate(),
      fulfilledAt: doc.data().fulfilledAt?.toDate(),
    }));
  } catch (error) {
    console.error("Error fetching company legal requests:", error);
    return [];
  }
};

/**
 * Get all legal requests (super admin view)
 * @param {string} status - Filter by status (optional)
 * @returns {Promise<Array>} List of all legal requests
 */
export const getAllLegalRequests = async (status = null) => {
  try {
    let q;

    if (status) {
      q = query(
        collection(db, "legalRequests"),
        where("status", "==", status),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(collection(db, "legalRequests"), orderBy("createdAt", "desc"));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      reviewedAt: doc.data().reviewedAt?.toDate(),
      fulfilledAt: doc.data().fulfilledAt?.toDate(),
    }));
  } catch (error) {
    console.error("Error fetching all legal requests:", error);
    return [];
  }
};

/**
 * Review a legal request (approve/reject)
 * @param {string} requestId - Legal request ID
 * @param {Object} reviewData - Review data
 * @returns {Promise<void>}
 */
export const reviewLegalRequest = async (requestId, reviewData) => {
  try {
    const {
      reviewedBy,
      reviewedByUserId,
      status,
      approvalNotes,
      rejectionReason,
      disclosedData,
      disclosureMethod,
    } = reviewData;

    // Validate status
    if (
      status !== LegalRequestStatus.APPROVED &&
      status !== LegalRequestStatus.REJECTED
    ) {
      throw new Error("Invalid review status");
    }

    // Get the request to fetch companyId for logging
    const request = await getLegalRequest(requestId);

    const updateData = {
      status,
      reviewedBy,
      reviewedByUserId,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (status === LegalRequestStatus.APPROVED) {
      updateData.approvalNotes = approvalNotes || null;
      updateData.disclosedData = disclosedData || null;
      updateData.disclosureMethod = disclosureMethod || null;
    } else {
      updateData.rejectionReason = rejectionReason || null;
    }

    // Update the request
    const requestRef = doc(db, "legalRequests", requestId);
    await updateDoc(requestRef, updateData);

    // Log the activity
    await logSystemActivity(request.companyId, "legal_request_reviewed", {
      requestId,
      status,
      reviewedBy,
      reviewedByUserId,
      reportId: request.reportId,
    });
  } catch (error) {
    console.error("Error reviewing legal request:", error);
    throw error;
  }
};

/**
 * Mark a legal request as fulfilled
 * @param {string} requestId - Legal request ID
 * @param {Object} fulfillmentData - Fulfillment data
 * @returns {Promise<void>}
 */
export const fulfillLegalRequest = async (requestId, fulfillmentData) => {
  try {
    const { disclosedData, disclosureMethod, fulfilledBy, fulfilledByUserId } =
      fulfillmentData;

    // Get the request to fetch companyId for logging
    const request = await getLegalRequest(requestId);

    // Ensure request is approved before fulfilling
    if (request.status !== LegalRequestStatus.APPROVED) {
      throw new Error("Only approved requests can be fulfilled");
    }

    const updateData = {
      status: LegalRequestStatus.FULFILLED,
      disclosedData: disclosedData || request.disclosedData,
      disclosureMethod: disclosureMethod || request.disclosureMethod,
      fulfilledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Update the request
    const requestRef = doc(db, "legalRequests", requestId);
    await updateDoc(requestRef, updateData);

    // Log the activity
    await logSystemActivity(request.companyId, "legal_request_fulfilled", {
      requestId,
      disclosureMethod: updateData.disclosureMethod,
      fulfilledBy,
      fulfilledByUserId,
      reportId: request.reportId,
    });
  } catch (error) {
    console.error("Error fulfilling legal request:", error);
    throw error;
  }
};

/**
 * Get legal requests by report ID
 * @param {string} reportId - Report ID
 * @returns {Promise<Array>} List of legal requests for the report
 */
export const getLegalRequestsByReport = async (reportId) => {
  try {
    const q = query(
      collection(db, "legalRequests"),
      where("reportId", "==", reportId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      reviewedAt: doc.data().reviewedAt?.toDate(),
      fulfilledAt: doc.data().fulfilledAt?.toDate(),
    }));
  } catch (error) {
    console.error("Error fetching legal requests by report:", error);
    return [];
  }
};

/**
 * Get legal request statistics
 * @param {string} companyId - Company ID (optional, for company-specific stats)
 * @returns {Promise<Object>} Statistics object
 */
export const getLegalRequestStats = async (companyId = null) => {
  try {
    let q;

    if (companyId) {
      q = query(
        collection(db, "legalRequests"),
        where("companyId", "==", companyId)
      );
    } else {
      q = query(collection(db, "legalRequests"));
    }

    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Calculate statistics
    const stats = {
      total: requests.length,
      pending: requests.filter(
        (r) => r.status === LegalRequestStatus.PENDING
      ).length,
      underReview: requests.filter(
        (r) => r.status === LegalRequestStatus.UNDER_REVIEW
      ).length,
      approved: requests.filter(
        (r) => r.status === LegalRequestStatus.APPROVED
      ).length,
      rejected: requests.filter(
        (r) => r.status === LegalRequestStatus.REJECTED
      ).length,
      fulfilled: requests.filter(
        (r) => r.status === LegalRequestStatus.FULFILLED
      ).length,
    };

    return stats;
  } catch (error) {
    console.error("Error fetching legal request stats:", error);
    return {
      total: 0,
      pending: 0,
      underReview: 0,
      approved: 0,
      rejected: 0,
      fulfilled: 0,
    };
  }
};

/**
 * Update legal request status
 * @param {string} requestId - Legal request ID
 * @param {string} status - New status
 * @param {string} updatedBy - User who updated
 * @param {string} updatedByUserId - User ID who updated
 * @returns {Promise<void>}
 */
export const updateLegalRequestStatus = async (
  requestId,
  status,
  updatedBy,
  updatedByUserId
) => {
  try {
    // Get the request to fetch companyId for logging
    const request = await getLegalRequest(requestId);

    // Update the request
    const requestRef = doc(db, "legalRequests", requestId);
    await updateDoc(requestRef, {
      status,
      updatedAt: serverTimestamp(),
    });

    // Log the activity
    await logSystemActivity(request.companyId, "legal_request_status_updated", {
      requestId,
      status,
      updatedBy,
      updatedByUserId,
      reportId: request.reportId,
    });
  } catch (error) {
    console.error("Error updating legal request status:", error);
    throw error;
  }
};
