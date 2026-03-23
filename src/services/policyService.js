import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";

const POLICIES_COLLECTION = "policies";
const ACKNOWLEDGEMENTS_COLLECTION = "policyAcknowledgements";

export const createPolicy = async (policyData, userData) => {
  const docRef = await addDoc(collection(db, POLICIES_COLLECTION), {
    ...policyData,
    companyId: userData.companyId,
    status: "draft",
    createdBy: userData.id,
    createdByName: userData.displayName || userData.username,
    fileUrl: policyData.fileUrl || null,
    fileName: policyData.fileName || null,
    publishedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { success: true, id: docRef.id };
};

export const updatePolicy = async (policyId, updates) => {
  await updateDoc(doc(db, POLICIES_COLLECTION, policyId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
  return { success: true };
};

export const publishPolicy = async (policyId) => {
  await updateDoc(doc(db, POLICIES_COLLECTION, policyId), {
    status: "published",
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { success: true };
};

export const deletePolicy = async (policyId) => {
  await deleteDoc(doc(db, POLICIES_COLLECTION, policyId));
  // Also delete associated acknowledgements
  const acksQuery = query(
    collection(db, ACKNOWLEDGEMENTS_COLLECTION),
    where("policyId", "==", policyId)
  );
  const acksSnapshot = await getDocs(acksQuery);
  const deletePromises = acksSnapshot.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);
  return { success: true };
};

export const archivePolicy = async (policyId) => {
  await updateDoc(doc(db, POLICIES_COLLECTION, policyId), {
    status: "archived",
    updatedAt: serverTimestamp(),
  });
  return { success: true };
};

export const getPolicies = async (companyId, status = null) => {
  let q = query(
    collection(db, POLICIES_COLLECTION),
    where("companyId", "==", companyId)
  );
  if (status) {
    q = query(
      collection(db, POLICIES_COLLECTION),
      where("companyId", "==", companyId),
      where("status", "==", status)
    );
  }
  const snapshot = await getDocs(q);
  const policies = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Sort by createdAt descending client-side (avoids composite index requirement)
  return policies.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
};

export const getPublishedPolicies = async (companyId) => {
  return getPolicies(companyId, "published");
};

export const acknowledgePolicy = async (policyId, companyId, userId) => {
  const existingQuery = query(
    collection(db, ACKNOWLEDGEMENTS_COLLECTION),
    where("policyId", "==", policyId),
    where("userId", "==", userId)
  );
  const existingSnapshot = await getDocs(existingQuery);
  if (!existingSnapshot.empty) {
    return { success: true, alreadyAcknowledged: true };
  }
  await addDoc(collection(db, ACKNOWLEDGEMENTS_COLLECTION), {
    policyId,
    companyId,
    userId,
    acknowledgedAt: serverTimestamp(),
  });
  return { success: true, alreadyAcknowledged: false };
};

export const getPolicyAcknowledgements = async (policyId) => {
  const q = query(
    collection(db, ACKNOWLEDGEMENTS_COLLECTION),
    where("policyId", "==", policyId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getUserAcknowledgements = async (userId, companyId) => {
  const q = query(
    collection(db, ACKNOWLEDGEMENTS_COLLECTION),
    where("userId", "==", userId),
    where("companyId", "==", companyId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getPolicyAcknowledgementStats = async (policyId, companyId) => {
  const [acks, usersSnapshot] = await Promise.all([
    getPolicyAcknowledgements(policyId),
    getDocs(
      query(
        collection(db, "users"),
        where("companyId", "==", companyId),
        where("status", "==", "active")
      )
    ),
  ]);
  const acknowledgedCount = acks.length;
  const totalUsers = usersSnapshot.size;
  const percentage = totalUsers > 0 ? Math.round((acknowledgedCount / totalUsers) * 100) : 0;
  return { acknowledgedCount, totalUsers, percentage };
};

export const uploadPolicyFile = async (file, companyId, policyId) => {
  const timestamp = Date.now();
  const path = `policies/${companyId}/${policyId}/${timestamp}_${file.name}`;
  const storageRef = ref(storage, path);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
      "state_changed",
      null,
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ url, fileName: file.name });
      }
    );
  });
};

export const uploadPolicyFileWithProgress = async (file, companyId, policyId, onProgress) => {
  const timestamp = Date.now();
  const path = `policies/${companyId}/${policyId}/${timestamp}_${file.name}`;
  const storageRef = ref(storage, path);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        if (onProgress) onProgress(progress);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ url, fileName: file.name });
      }
    );
  });
};
