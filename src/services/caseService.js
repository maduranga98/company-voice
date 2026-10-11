import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  PostActivityType,
  AssignmentType,
  NotificationType,
} from "../utils/constants";
import { CaseType, getCaseAdapter } from "../utils/caseTypes";
import {
  isAdmin,
  updatePostStatus,
  updatePostPriority,
  assignPost,
  unassignPost,
  setDueDate,
  addAdminComment,
} from "./postManagementService";

// Generic case-handling operations. `posts` keeps going through postManagementService
// (its permission checks, postActivities log and author notifications are unchanged);
// every other case type shares one implementation here, logging to `caseActivities`
// and keeping internal notes in `caseNotes`.

export const CASE_ACTIVITIES_COLLECTION = "caseActivities";
export const CASE_NOTES_COLLECTION = "caseNotes";

const requireStaff = (user, action) => {
  if (!isAdmin(user.role)) throw new Error(`Only admins can ${action}`);
};

const loadCase = async (caseType, caseId) => {
  const ref = doc(db, getCaseAdapter(caseType).collection, caseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Case not found");
  return { ref, data: snap.data() };
};

const actorStamp = (user) => ({
  updatedAt: serverTimestamp(),
  lastUpdatedBy: user.displayName,
  lastUpdatedById: user.id,
});

export const logCaseActivity = async (caseType, caseId, activityType, metadata = {}, companyId = null) => {
  try {
    await addDoc(collection(db, CASE_ACTIVITIES_COLLECTION), {
      caseType,
      caseId,
      type: activityType,
      companyId: companyId || metadata.companyId || null,
      metadata,
      createdAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    // Activity logging must never break the action it describes.
    console.error("Error logging case activity:", error);
    return { success: false };
  }
};

const notifyAssignee = async (caseType, caseId, assignment, caseData, adapter) => {
  if (assignment.type !== AssignmentType.USER) return;
  try {
    await addDoc(collection(db, "notifications"), {
      userId: assignment.id,
      type: NotificationType.ASSIGNED,
      title: "New assignment",
      message: `You've been assigned to: ${adapter.getTitle(caseData) || caseId}`,
      caseType,
      caseId,
      companyId: caseData.companyId,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error notifying assignee:", error);
  }
};

// ---------- status ----------

export const updateCaseStatus = async (caseType, caseId, newStatus, user, comment = "") => {
  if (caseType === CaseType.POST) return updatePostStatus(caseId, newStatus, user, comment);

  const adapter = getCaseAdapter(caseType);
  if (!adapter.statusEditable) throw new Error("Status for this case type changes through its own workflow");
  if (!adapter.statusValues.includes(newStatus)) throw new Error("Invalid status");
  requireStaff(user, "update case status");

  const { ref, data } = await loadCase(caseType, caseId);
  const updates = { status: newStatus, ...actorStamp(user) };
  if (caseType === CaseType.VENDOR) {
    updates.reviewedBy = user.displayName;
    if (newStatus === "resolved") updates.resolvedAt = serverTimestamp();
  }
  await updateDoc(ref, updates);
  await logCaseActivity(caseType, caseId, PostActivityType.STATUS_CHANGED, {
    adminId: user.id,
    adminName: user.displayName,
    oldStatus: data.status,
    newStatus,
    comment,
  }, data.companyId);
  return { success: true };
};

// ---------- priority ----------

export const updateCasePriority = async (caseType, caseId, newPriority, user) => {
  if (caseType === CaseType.POST) return updatePostPriority(caseId, newPriority, user);

  const adapter = getCaseAdapter(caseType);
  requireStaff(user, "update case priority");
  const { ref, data } = await loadCase(caseType, caseId);
  await updateDoc(ref, { priority: newPriority, ...actorStamp(user) });
  await logCaseActivity(caseType, caseId, PostActivityType.PRIORITY_CHANGED, {
    adminId: user.id,
    adminName: user.displayName,
    oldPriority: adapter.getPriority(data),
    newPriority,
  }, data.companyId);
  return { success: true };
};

// ---------- assignment ----------

export const assignCase = async (caseType, caseId, assignment, user) => {
  if (caseType === CaseType.POST) return assignPost(caseId, assignment, user);

  const adapter = getCaseAdapter(caseType);
  requireStaff(user, "assign cases");
  const { ref, data } = await loadCase(caseType, caseId);
  await updateDoc(ref, {
    assignedTo: {
      type: assignment.type,
      id: assignment.id,
      name: assignment.name,
      assignedAt: serverTimestamp(),
      assignedBy: user.displayName,
      assignedById: user.id,
    },
    dueDate: assignment.dueDate || null,
    ...actorStamp(user),
  });
  await logCaseActivity(caseType, caseId, PostActivityType.ASSIGNED, {
    adminId: user.id,
    adminName: user.displayName,
    assignmentType: assignment.type,
    assignedToId: assignment.id,
    assignedToName: assignment.name,
    dueDate: assignment.dueDate || null,
  }, data.companyId);
  await notifyAssignee(caseType, caseId, assignment, data, adapter);
  return { success: true };
};

export const unassignCase = async (caseType, caseId, user) => {
  if (caseType === CaseType.POST) return unassignPost(caseId, user);

  requireStaff(user, "unassign cases");
  const { ref, data } = await loadCase(caseType, caseId);
  await updateDoc(ref, { assignedTo: null, dueDate: null, ...actorStamp(user) });
  await logCaseActivity(caseType, caseId, PostActivityType.UNASSIGNED, {
    adminId: user.id,
    adminName: user.displayName,
  }, data.companyId);
  return { success: true };
};

// ---------- due date ----------

export const setCaseDueDate = async (caseType, caseId, dueDate, user) => {
  if (caseType === CaseType.POST) return setDueDate(caseId, dueDate, user);

  requireStaff(user, "set due dates");
  const { ref, data } = await loadCase(caseType, caseId);
  const oldDueDate = data.dueDate || null;
  await updateDoc(ref, { dueDate: dueDate || null, ...actorStamp(user) });
  await logCaseActivity(
    caseType,
    caseId,
    oldDueDate ? PostActivityType.DUE_DATE_CHANGED : PostActivityType.DUE_DATE_SET,
    { adminId: user.id, adminName: user.displayName, oldDueDate, newDueDate: dueDate || null },
    data.companyId
  );
  return { success: true };
};

// ---------- internal notes ----------

export const addCaseNote = async (caseType, caseId, text, user) => {
  if (caseType === CaseType.POST) return addAdminComment(caseId, text, user);

  requireStaff(user, "add notes");
  const { ref, data } = await loadCase(caseType, caseId);
  await addDoc(collection(db, CASE_NOTES_COLLECTION), {
    caseType,
    caseId,
    companyId: data.companyId,
    text,
    authorId: user.id,
    authorName: user.displayName,
    authorRole: user.role,
    createdAt: serverTimestamp(),
  });
  await updateDoc(ref, actorStamp(user));
  await logCaseActivity(caseType, caseId, PostActivityType.ADMIN_COMMENT, {
    adminId: user.id,
    adminName: user.displayName,
    comment: text,
  }, data.companyId);
  return { success: true };
};

const byNewest = (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);

export const getCaseNotes = async (caseType, caseId, companyId) => {
  if (caseType === CaseType.POST) {
    // Staff-only comments (isAdminComment) live in `comments`, as before.
    const snapshot = await getDocs(
      query(collection(db, "comments"), where("companyId", "==", companyId), where("postId", "==", caseId))
    );
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((n) => n.isAdminComment === true)
      .sort(byNewest);
  }
  const snapshot = await getDocs(
    query(
      collection(db, CASE_NOTES_COLLECTION),
      where("companyId", "==", companyId),
      where("caseId", "==", caseId)
    )
  );
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((n) => n.caseType === caseType)
    .sort(byNewest);
};

// ---------- assignee options ----------

// Members who hold a user tag, ordered by tag priority then name. Shared by the
// assignment dropdown (and later by routing-rule editing).
export const getAssignableUsers = async (companyId) => {
  const tagSnap = await getDocs(query(collection(db, "userTags"), where("companyId", "==", companyId)));
  const tagMap = {};
  tagSnap.forEach((d) => { tagMap[d.id] = { id: d.id, ...d.data() }; });

  const userSnap = await getDocs(
    query(collection(db, "users"), where("companyId", "==", companyId), where("status", "==", "active"))
  );
  const users = [];
  userSnap.forEach((d) => {
    const user = { id: d.id, ...d.data() };
    if (!user.userTagId) return; // only tagged members are assignable
    if (tagMap[user.userTagId]) user.tagData = tagMap[user.userTagId];
    users.push(user);
  });
  return users.sort((a, b) => {
    const diff = (b.tagData?.priority || 0) - (a.tagData?.priority || 0);
    return diff || (a.displayName || "").localeCompare(b.displayName || "");
  });
};
