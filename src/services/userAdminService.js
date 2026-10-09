import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";

// Privileged user changes (create, role, status, password, deletion) go through Cloud Functions,
// which verify the caller's role and company on the server. Firestore rules no longer let
// clients write these fields.

const call = async (name, data) => (await httpsCallable(functions, name)(data)).data;

export const createStaffUser = (data) => call("createStaffUser", data);

export const createCompanyWithAdmin = (data) => call("createCompanyWithAdmin", data);

export const setUserStatus = (userId, status, options = {}) =>
  call("setUserStatus", { userId, status, ...options });

export const changeUserRole = (userId, role) => call("changeUserRole", { userId, role });

export const resetStaffPassword = (userId) => call("resetStaffPassword", { userId });

export const deleteRemovedUsers = (userIds) => call("deleteRemovedUsers", { userIds });

export const deleteCompany = (companyId) => call("deleteCompany", { companyId });
