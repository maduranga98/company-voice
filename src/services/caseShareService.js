import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";

// Sharing a finalized case with outside counsel through a private read-only link.

export const createCaseShare = async (payload) => {
  const response = await httpsCallable(functions, "createCaseShare")(payload);
  return response.data;
};

export const revokeCaseShare = async (shareId) => {
  await httpsCallable(functions, "revokeCaseShare")({ shareId });
};

/** Shares already made for one case, newest first. */
export const getCaseShares = async (companyId, caseType, caseId) => {
  const snapshot = await getDocs(
    query(collection(db, "caseShares"), where("companyId", "==", companyId), where("caseId", "==", caseId))
  );
  const toMs = (v) => (v?.toMillis ? v.toMillis() : 0);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.caseType === caseType)
    .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
};

// Public (no login): the token travels in the URL fragment and is sent only to this call.
export const fetchSharedCase = async (shareId, token) => {
  const response = await httpsCallable(functions, "getSharedCase")({ shareId, token });
  return response.data;
};
