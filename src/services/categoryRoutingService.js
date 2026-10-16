import { collection, doc, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";

// Reads go straight to Firestore (rules: company_admin / hr of the company). Every write goes
// through a Cloud Function, which validates names, checks that an assignee is an active member
// of the same company, and re-checks the caller's role. Firestore rules deny client writes.

const call = async (name, payload) => {
  const response = await httpsCallable(functions, name)(payload);
  return response.data;
};

export const subscribeCategories = (companyId, onData, onError) =>
  onSnapshot(
    collection(db, "companies", companyId, "categories"),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );

/** @returns unsubscribe. Emits a map of categoryId -> rule (rule doc id is the categoryId). */
export const subscribeRoutingRules = (companyId, onData, onError) =>
  onSnapshot(
    collection(db, "companies", companyId, "routingRules"),
    (snap) => onData(Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))),
    onError
  );

/** Emits { type, id } of the company's default routing assignee (both null when unset). */
export const subscribeDefaultAssignee = (companyId, onData, onError) =>
  onSnapshot(
    doc(db, "companies", companyId),
    (snap) => {
      const data = snap.data() || {};
      onData({
        type: data.defaultRoutingAssigneeType || null,
        id: data.defaultRoutingAssigneeId || null,
      });
    },
    onError
  );

/** One-off read of the company's categories (for pickers outside the settings page). */
export const getCategories = async (companyId) => {
  const snap = await getDocs(collection(db, "companies", companyId, "categories"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** Active staff who can be named as an assignee (HR and company admins of this company). */
export const getAssignableStaff = async (companyId) => {
  const snap = await getDocs(
    query(collection(db, "users"), where("companyId", "==", companyId), where("status", "==", "active"))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.role === "hr" || u.role === "company_admin")
    .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
};

export const createCategory = ({ name, description }) => call("createCategory", { name, description });
export const updateCategory = (categoryId, changes) => call("updateCategory", { categoryId, ...changes });
export const reorderCategories = (orderedIds) => call("reorderCategories", { orderedIds });
export const setCategoryRoutingRule = (categoryId, assignee) =>
  call("setCategoryRoutingRule", { categoryId, assigneeType: assignee.type, assigneeId: assignee.id });
export const removeCategoryRoutingRule = (categoryId) => call("removeCategoryRoutingRule", { categoryId });
export const setDefaultRoutingAssignee = (assignee) =>
  call("setDefaultRoutingAssignee", { assigneeType: assignee.type, assigneeId: assignee.id });
