import { httpsCallable } from "firebase/functions";
import CryptoJS from "crypto-js";
import { functions } from "../config/firebase";

// "Check my case" (no-login status + private replies). Nothing here reads or stores
// reporter identity; the case code + secret key are kept only in component state.

const ANONYMOUS_SECRET =
  import.meta.env.VITE_ANONYMOUS_SECRET || "default-secret-key-change-in-production";

export const decryptMessage = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== "string") return "";
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ANONYMOUS_SECRET);
    try {
      return bytes.toString(CryptoJS.enc.Utf8) || "";
    } catch {
      return "";
    }
  } catch {
    return "";
  }
};

export const fetchCaseStatus = async ({ caseCode, secretKey }) => {
  const response = await httpsCallable(functions, "getCaseStatus")({ caseCode, secretKey });
  const data = response.data;
  return {
    ...data,
    messages: (data.messages || []).map((m) => ({ ...m, content: decryptMessage(m.encryptedContent) })),
  };
};

export const sendCaseReply = async ({ caseCode, secretKey, message }) => {
  const response = await httpsCallable(functions, "submitCaseReply")({ caseCode, secretKey, message });
  return response.data;
};

// Maps callable errors to report.checkCase.errors.* translation keys.
export const caseErrorKey = (error) => {
  switch (error?.code) {
    case "functions/invalid-argument":
      return "report.checkCase.errors.invalid";
    case "functions/resource-exhausted":
      return "report.checkCase.errors.rateLimited";
    case "functions/unavailable":
    case "functions/deadline-exceeded":
      return "report.checkCase.errors.network";
    default:
      return "report.checkCase.errors.generic";
  }
};
