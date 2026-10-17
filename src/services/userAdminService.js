import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { db, functions } from "../config/firebase";
import { logAdminAction } from "./auditService";
import { SystemActivityType } from "../utils/constants";

// Privileged user changes (create, role, status, password, deletion) go through Cloud Functions,
// which verify the caller's role and company on the server. Firestore rules no longer let
// clients write these fields.

const call = async (name, data) => (await httpsCallable(functions, name)(data)).data;

// Best-effort snapshot of the target user so the audit entry keeps a readable name after the change.
const targetSnapshot = async (userId) => {
  try {
    const snap = await getDoc(doc(db, "users", userId));
    return snap.exists() ? snap.data() : {};
  } catch {
    return {};
  }
};

const describe = (userId, user) => ({
  userId,
  userName: user.displayName || user.username || userId,
  userRole: user.role,
});

export const createStaffUser = async (data) => {
  const result = await call("createStaffUser", data);
  logAdminAction(SystemActivityType.USER_CREATED, {
    userId: result?.userId || result?.uid || result?.id || null,
    userName: data.displayName || data.username,
    userRole: data.role,
    userEmail: data.email,
  });
  return result;
};

export const createCompanyWithAdmin = (data) => call("createCompanyWithAdmin", data);

export const setUserStatus = async (userId, status, options = {}) => {
  const user = await targetSnapshot(userId);
  const result = await call("setUserStatus", { userId, status, ...options });
  const type = {
    suspended: SystemActivityType.USER_SUSPENDED,
    active: SystemActivityType.USER_ACTIVATED,
    removed: SystemActivityType.USER_DELETED,
  }[status];
  if (type) {
    logAdminAction(type, { ...describe(userId, user), oldStatus: user.status, newStatus: status, reason: options.reason });
  }
  return result;
};

export const changeUserRole = async (userId, role) => {
  const user = await targetSnapshot(userId);
  const result = await call("changeUserRole", { userId, role });
  logAdminAction(SystemActivityType.ROLE_CHANGED, { ...describe(userId, user), oldRole: user.role, newRole: role });
  return result;
};

export const resetStaffPassword = async (userId) => {
  const user = await targetSnapshot(userId);
  const result = await call("resetStaffPassword", { userId });
  logAdminAction(SystemActivityType.PASSWORD_CHANGED, describe(userId, user));
  return result;
};

export const deleteRemovedUsers = async (userIds) => {
  const result = await call("deleteRemovedUsers", { userIds });
  userIds.forEach((userId) =>
    logAdminAction(SystemActivityType.USER_DELETED, { userId, permanent: true })
  );
  return result;
};

export const deleteCompany = (companyId) => call("deleteCompany", { companyId });
