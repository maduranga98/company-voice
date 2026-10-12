import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

const COLLECTION = "routingRules";

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

/** All routing rules for a company, sorted by their evaluation order. */
export const getRoutingRules = async (companyId) => {
  const snap = await getDocs(query(collection(db, COLLECTION), where("companyId", "==", companyId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder);
};

export const createRoutingRule = async (rule, user) => {
  const existing = await getRoutingRules(rule.companyId);
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.order ?? 0)) + 1 : 0;
  const ref = await addDoc(collection(db, COLLECTION), {
    ...rule,
    order: nextOrder,
    createdBy: user.id,
    createdByName: user.displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateRoutingRule = async (ruleId, updates, user) => {
  await updateDoc(doc(db, COLLECTION, ruleId), {
    ...updates,
    updatedAt: serverTimestamp(),
    lastUpdatedBy: user.id,
    lastUpdatedByName: user.displayName,
  });
};

export const setRoutingRuleEnabled = (ruleId, enabled, user) =>
  updateRoutingRule(ruleId, { enabled }, user);

export const deleteRoutingRule = async (ruleId) => {
  await deleteDoc(doc(db, COLLECTION, ruleId));
};

/** Swaps a rule's evaluation order with its neighbour in `direction` ("up" | "down"). */
export const moveRoutingRule = async (companyId, ruleId, direction) => {
  const rules = await getRoutingRules(companyId);
  const index = rules.findIndex((r) => r.id === ruleId);
  if (index === -1) return;
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= rules.length) return;

  const a = rules[index];
  const b = rules[targetIndex];
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTION, a.id), { order: b.order ?? targetIndex });
  batch.update(doc(db, COLLECTION, b.id), { order: a.order ?? index });
  await batch.commit();
};
