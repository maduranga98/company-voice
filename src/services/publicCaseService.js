import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";

// "Check my case" (no-login status + private replies). Nothing here reads or stores
// reporter identity; the case code + secret key are kept only in component state.

export const fetchCaseStatus = async ({ caseCode, secretKey }) => {
  const response = await httpsCallable(functions, "getCaseStatus")({ caseCode, secretKey });
  const data = response.data;
  return {
    ...data,
    messages: data.messages || [],
  };
};

export const sendCaseReply = async ({ caseCode, secretKey, message }) => {
  const response = await httpsCallable(functions, "submitCaseReply")({ caseCode, secretKey, message });
  return response.data;
};

export const CASE_CHECK_DISABLED_KEY = "report.checkCase.errors.disabled";

// Maps callable errors to report.checkCase.errors.* translation keys.
export const caseErrorKey = (error) => {
  switch (error?.code) {
    case "functions/invalid-argument":
      return "report.checkCase.errors.invalid";
    case "functions/failed-precondition":
      return CASE_CHECK_DISABLED_KEY;
    case "functions/resource-exhausted":
      return "report.checkCase.errors.rateLimited";
    case "functions/unavailable":
    case "functions/deadline-exceeded":
      return "report.checkCase.errors.network";
    default:
      return "report.checkCase.errors.generic";
  }
};
