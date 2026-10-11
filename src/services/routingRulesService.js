import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

// Company routing rules (companies/{companyId}/routingRules). Evaluated server-side when a
// case is created (functions/triggers/caseRoutingTriggers.js); this file only manages them.

export const RoutingActionType = { USER: "user", DEPARTMENT: "department", USER_TAG: "userTag" };

// Values the server compares against (functions/utils/routingRules.js caseFacts)
export const ROUTING_CASE_TYPES = ["post", "vendor", "moderation"];
export const ROUTING_PRIORITIES = ["critical", "high", "medium", "low"];
export const ROUTING_SOURCES = ["public_link", "policy_link", "internal"];
export const ROUTING_CATEGORIES = [
  // public reports + posts
  "harassment", "discrimination", "safety", "fraud_ethics", "management", "workplace_conditions", "pay_benefits",
  // vendor risk
  "labor", "data_privacy", "fraud", "compliance",
  // moderation reasons
  "inappropriate", "spam", "false_info", "violence",
  "other",
];

const rulesRef = (companyId) => collection(db, "companies", companyId, "routingRules");

export const getRoutingRules = async (companyId) => {
  const snap = await getDocs(rulesRef(companyId));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id));
};

const clean = (rule) => ({
  name: rule.name.trim().slice(0, 80),
  enabled: rule.enabled !== false,
  conditions: Object.fromEntries(
    Object.entries(rule.conditions || {}).filter(([, list]) => Array.isArray(list) && list.length > 0)
  ),
  action: { type: rule.action.type, id: rule.action.id, name: rule.action.name || "" },
});

export const createRoutingRule = async (companyId, rule, order, user) => {
  const ref = await addDoc(rulesRef(companyId), {
    ...clean(rule),
    order,
    createdBy: user.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateRoutingRule = async (companyId, ruleId, rule) => {
  await updateDoc(doc(db, "companies", companyId, "routingRules", ruleId), {
    ...clean(rule),
    updatedAt: serverTimestamp(),
  });
};

export const setRoutingRuleEnabled = async (companyId, ruleId, enabled) => {
  await updateDoc(doc(db, "companies", companyId, "routingRules", ruleId), {
    enabled,
    updatedAt: serverTimestamp(),
  });
};

export const deleteRoutingRule = async (companyId, ruleId) => {
  await deleteDoc(doc(db, "companies", companyId, "routingRules", ruleId));
};

/** Persists a new evaluation order. `orderedIds` is the full list, first = runs first. */
export const reorderRoutingRules = async (companyId, orderedIds) => {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, "companies", companyId, "routingRules", id), { order: index + 1, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};

/** Everything the rule editor needs to name targets: staff, tags and departments of the company. */
export const getRoutingTargets = async (companyId) => {
  const [users, tags, departments] = await Promise.all([
    getDocs(query(collection(db, "users"), where("companyId", "==", companyId), where("status", "==", "active"))),
    getDocs(query(collection(db, "userTags"), where("companyId", "==", companyId))),
    getDocs(query(collection(db, "departments"), where("companyId", "==", companyId))),
  ]);
  const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
  return {
    users: users.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => u.role === "hr" || u.role === "company_admin")
      .map((u) => ({ id: u.id, name: u.displayName || u.username || u.id, role: u.role }))
      .sort(byName),
    tags: tags.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })).sort(byName),
    departments: departments.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })).sort(byName),
  };
};
