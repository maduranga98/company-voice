import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { findMatchingRule } from "../utils/routingRules";

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

// ── ASSIGNMENT RESOLUTION ────────────────────────────────────────────────────
// Server-side twin: functions/utils/routingRules.js resolveRoutingAssignment.
// Keep the department-resolution and fallback behaviour identical in both —
// there is no shared build between src/ and functions/.

/**
 * A "department" rule action names a department, not a person — nothing downstream
 * (assignee notifications, "Assigned to Me") understands that type, so it must be
 * resolved to a real user before resolveRoutingAssignment returns. Resolves to the
 * department's headUserId when one is set and still active; otherwise null so the
 * caller falls back to resolveFallbackAssignee.
 */
const resolveDepartmentHead = async (companyId, departmentId) => {
  const deptSnap = await getDoc(doc(db, "departments", departmentId));
  if (!deptSnap.exists()) return null;
  const dept = deptSnap.data();
  if (dept.companyId !== companyId || !dept.headUserId) return null;

  const headSnap = await getDoc(doc(db, "users", dept.headUserId));
  if (!headSnap.exists()) return null;
  const head = headSnap.data();
  if (head.status !== undefined && head.status !== "active") return null;

  return {
    id: dept.headUserId,
    name: head.displayName || "",
    departmentId,
    departmentName: dept.name || "",
  };
};

/**
 * Fallback assignee when a rule can't be resolved to a specific person (e.g. a
 * department with no head set): the company's first active company_admin, so the
 * case still lands on someone and they're notified, instead of sitting assigned
 * to a department id that nothing can act on.
 */
const resolveFallbackAssignee = async (companyId) => {
  const snap = await getDocs(
    query(
      collection(db, "users"),
      where("companyId", "==", companyId),
      where("role", "==", "company_admin"),
      limit(5)
    )
  );
  const active = snap.docs.find((d) => {
    const data = d.data();
    return data.status === undefined || data.status === "active";
  });
  if (!active) return null;
  return { id: active.id, name: active.data().displayName || "" };
};

/**
 * Loads a company's enabled routing rules and returns the first match for a
 * freshly-created case, resolved to a concrete user assignment, or null.
 * Never throws: a routing-rule lookup failure must not block case submission,
 * so callers get null and the case is simply left unassigned.
 */
export const resolveRoutingAssignment = async (companyId, caseType, caseData) => {
  try {
    const rules = await getRoutingRules(companyId);
    const rule = findMatchingRule(rules.filter((r) => r.enabled), caseType, caseData);
    if (!rule || !rule.action || !rule.action.id) return null;

    if (rule.action.type === "department") {
      const head = await resolveDepartmentHead(companyId, rule.action.id);
      if (head) {
        return {
          ruleId: rule.id,
          ruleName: rule.name || "",
          assignment: { type: "user", id: head.id, name: head.name },
          routedViaDepartment: { id: head.departmentId, name: head.departmentName },
        };
      }
      const fallback = await resolveFallbackAssignee(companyId);
      if (fallback) {
        return {
          ruleId: rule.id,
          ruleName: rule.name || "",
          assignment: { type: "user", id: fallback.id, name: fallback.name },
          fallbackReason: "department_no_head",
        };
      }
      return null;
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name || "",
      assignment: {
        type: rule.action.type,
        id: rule.action.id,
        name: rule.action.name || "",
      },
    };
  } catch (error) {
    console.error("Error resolving routing assignment:", error);
    return null;
  }
};
