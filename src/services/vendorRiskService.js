import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
import { encryptAuthorId } from "./postManagementService";

const VENDOR_REPORTS_COLLECTION = "vendorReports";

// ── REFERENCE CODE ──────────────────────────────────────────────────────────

export const generateReferenceCode = async (companyId) => {
  const q = query(
    collection(db, VENDOR_REPORTS_COLLECTION),
    where("companyId", "==", companyId)
  );
  const snapshot = await getDocs(q);
  const count = snapshot.size;
  const year = new Date().getFullYear();
  const padded = String(count + 1).padStart(4, "0");
  return `VXW-${year}-${padded}`;
};

// ── FILE UPLOAD ──────────────────────────────────────────────────────────────

export const uploadEvidenceFile = async (file, companyId, reportId, prefix = "") => {
  const timestamp = Date.now();
  const path = `vendorEvidence/${companyId}/${reportId}/${prefix}${timestamp}_${file.name}`;
  const storageRef = ref(storage, path);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
      "state_changed",
      null,
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          url,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
      }
    );
  });
};

const uploadFilesWithProgress = async (files, companyId, reportId, prefix = "", onProgress) => {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const timestamp = Date.now();
    const path = `vendorEvidence/${companyId}/${reportId}/${prefix}${timestamp}_${file.name}`;
    const storageRef = ref(storage, path);

    const url = await new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          const overallProgress = Math.round(((i + fileProgress / 100) / files.length) * 100);
          if (onProgress) onProgress(overallProgress);
        },
        (error) => reject(error),
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        }
      );
    });
    urls.push(url);
  }
  if (onProgress) onProgress(100);
  return urls;
};

// ── SUBMIT VENDOR REPORT ─────────────────────────────────────────────────────

export const submitVendorReport = async (reportData, files, userData, onProgress) => {
  const { vendorName, riskCategory, severity, description } = reportData;

  // Validate files
  const validFiles = (files || []).slice(0, 5).filter((f) => {
    const validType = f.type.startsWith("image/") || f.type === "application/pdf";
    const validSize = f.size <= 10 * 1024 * 1024;
    return validType && validSize;
  });

  // Generate a temp doc ref to get an ID for storage path
  const tempRef = doc(collection(db, VENDOR_REPORTS_COLLECTION));
  const reportId = tempRef.id;

  const referenceCode = await generateReferenceCode(userData.companyId);

  // Upload files
  const attachmentUrls = await uploadFilesWithProgress(
    validFiles,
    userData.companyId,
    reportId,
    "",
    onProgress
  );

  // Write document
  await addDoc(collection(db, VENDOR_REPORTS_COLLECTION), {
    companyId: userData.companyId,
    referenceCode,
    vendorName,
    riskCategory,
    severity,
    status: "open",
    description,
    attachmentUrls,
    authorId: encryptAuthorId(userData.id),
    isAnonymous: true,
    corroborationCount: 0,
    autoEscalated: false,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    reviewedBy: null,
    reviewNotes: null,
    resolvedAt: null,
  });

  return { success: true, referenceCode, reportId };
};

// ── SUBMIT CORROBORATION ─────────────────────────────────────────────────────

export const submitCorroboration = async (reportId, corrData, files, userData) => {
  const { relationship, account, severity } = corrData;

  // Fetch parent report to get companyId
  const parentRef = doc(db, VENDOR_REPORTS_COLLECTION, reportId);
  const parentSnap = await getDoc(parentRef);
  if (!parentSnap.exists()) throw new Error("Report not found");
  const { companyId } = parentSnap.data();

  // Validate files
  const validFiles = (files || []).slice(0, 5).filter((f) => {
    const validType = f.type.startsWith("image/") || f.type === "application/pdf";
    const validSize = f.size <= 10 * 1024 * 1024;
    return validType && validSize;
  });

  // Upload files
  const attachmentUrls = await uploadFilesWithProgress(
    validFiles,
    companyId,
    reportId,
    `corr_`,
    null
  );

  // Add corroboration document
  await addDoc(
    collection(db, VENDOR_REPORTS_COLLECTION, reportId, "corroborations"),
    {
      relationship,
      account,
      severity,
      attachmentUrls,
      authorId: encryptAuthorId(userData.id),
      submittedAt: serverTimestamp(),
    }
  );

  // Increment corroborationCount on parent
  await updateDoc(parentRef, {
    corroborationCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  // Re-fetch to check new count for auto-escalation
  const updatedSnap = await getDoc(parentRef);
  const updatedCount = updatedSnap.data()?.corroborationCount ?? 0;
  if (updatedCount >= 3) {
    await updateDoc(parentRef, {
      autoEscalated: true,
      severity: "high",
      status: "escalated",
      updatedAt: serverTimestamp(),
    });
  }

  return { success: true };
};

// ── VALIDATE REFERENCE CODE ──────────────────────────────────────────────────

export const validateReferenceCode = async (code, companyId) => {
  const q = query(
    collection(db, VENDOR_REPORTS_COLLECTION),
    where("referenceCode", "==", code),
    where("companyId", "==", companyId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return { valid: false };
  return { valid: true, reportId: snapshot.docs[0].id };
};

// ── GET VENDOR REPORTS ───────────────────────────────────────────────────────

export const getVendorReports = async (companyId, status = null) => {
  let q = query(
    collection(db, VENDOR_REPORTS_COLLECTION),
    where("companyId", "==", companyId)
  );
  if (status) {
    q = query(
      collection(db, VENDOR_REPORTS_COLLECTION),
      where("companyId", "==", companyId),
      where("status", "==", status)
    );
  }
  const snapshot = await getDocs(q);
  const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return reports.sort((a, b) => {
    const aTime = a.submittedAt?.toMillis?.() ?? 0;
    const bTime = b.submittedAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
};

// ── GET SINGLE VENDOR REPORT WITH CORROBORATIONS ─────────────────────────────

export const getVendorReport = async (reportId) => {
  const reportRef = doc(db, VENDOR_REPORTS_COLLECTION, reportId);
  const reportSnap = await getDoc(reportRef);
  if (!reportSnap.exists()) throw new Error("Report not found");

  const corrSnap = await getDocs(
    collection(db, VENDOR_REPORTS_COLLECTION, reportId, "corroborations")
  );
  const corroborations = corrSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { id: reportSnap.id, ...reportSnap.data(), corroborations };
};

// ── UPDATE VENDOR REPORT STATUS ──────────────────────────────────────────────

export const updateVendorReportStatus = async (reportId, status, reviewedBy, reviewNotes = "") => {
  const updates = {
    status,
    reviewedBy,
    reviewNotes,
    updatedAt: serverTimestamp(),
  };
  if (status === "resolved") {
    updates.resolvedAt = serverTimestamp();
  }
  await updateDoc(doc(db, VENDOR_REPORTS_COLLECTION, reportId), updates);
  return { success: true };
};

// ── GET VENDOR REPORT STATS ──────────────────────────────────────────────────

export const getVendorReportStats = async (companyId) => {
  const reports = await getVendorReports(companyId);
  return {
    total: reports.length,
    open: reports.filter((r) => r.status === "open").length,
    investigating: reports.filter((r) => r.status === "investigating").length,
    escalated: reports.filter((r) => r.status === "escalated").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
    closed: reports.filter((r) => r.status === "closed").length,
    autoEscalated: reports.filter((r) => r.autoEscalated === true).length,
  };
};
