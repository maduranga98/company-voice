import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";

// Public (no-login) policy acknowledgement line. The employee gives their name and
// employee ID on purpose, so nothing here is anonymous, and nothing is persisted.

const randomToken = (bytes = 16) => {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
};

// 32 hex chars: matches the server's idempotency token pattern.
export const createAckToken = () => randomToken(16);

export const fetchPolicyForLink = async (slug) => {
  const response = await httpsCallable(functions, "getPolicyForLink")({ slug });
  return response.data;
};

export const submitPolicyResponse = async (payload) => {
  const response = await httpsCallable(functions, "submitPolicyAcknowledgement")(payload);
  return response.data;
};

// Maps callable errors to report.policy.errors.* translation keys.
export const policyErrorKey = (error) => {
  switch (error?.code) {
    case "functions/invalid-argument":
      return "report.policy.errors.invalid";
    case "functions/failed-precondition":
      return error?.details?.reason === "not_on_roster"
        ? "report.policy.errors.notOnRoster"
        : "report.policy.errors.updated";
    case "functions/resource-exhausted":
      return "report.policy.errors.rateLimited";
    case "functions/not-found":
      return "report.policy.errors.inactive";
    case "functions/unavailable":
    case "functions/deadline-exceeded":
      return "report.policy.errors.network";
    default:
      return "report.policy.errors.generic";
  }
};

// Staff side (company_admin / hr): manage a policy's public link.
export const ensurePolicyLink = async (policyId) => {
  const response = await httpsCallable(functions, "ensurePolicyLink")({ policyId });
  return response.data;
};

export const setPolicyLinkActive = async (slug, active) => {
  const response = await httpsCallable(functions, "setPolicyLinkActive")({ slug, active });
  return response.data;
};

export const savePolicyLinkRoster = async (slug, { rosterText, requireRoster }) => {
  const response = await httpsCallable(functions, "setPolicyLinkRoster")({
    slug,
    ...(rosterText !== undefined ? { rosterText } : {}),
    ...(requireRoster !== undefined ? { requireRoster } : {}),
  });
  return response.data;
};
