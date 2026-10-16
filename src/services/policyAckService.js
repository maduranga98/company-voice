import { httpsCallable } from "firebase/functions";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db, functions } from "../config/firebase";
import { buildAckReport } from "../utils/policyAckReport";

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

// One link that carries several published policies (acknowledged together in one visit).
export const ensurePolicyBundleLink = async (policyIds, title) => {
  const response = await httpsCallable(functions, "ensurePolicyBundleLink")({ policyIds, title });
  return response.data;
};

const isBundleLink = (link) => Array.isArray(link.policyIds);

const getPolicyLinks = async (companyId) => {
  const snap = await getDocs(query(collection(db, "policyLinks"), where("companyId", "==", companyId)));
  return snap.docs.map((d) => ({ slug: d.id, ...d.data() }));
};

export const getPolicyBundles = async (companyId) =>
  (await getPolicyLinks(companyId))
    .filter(isBundleLink)
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

/**
 * Public-link acknowledgements of one policy: every link that carries it (its own link and any
 * pack) counts, for the policy's current version. The roster is the union of those links' rosters.
 */
export const getPolicyLinkStats = async (policy, companyId) => {
  const [links, responseSnap] = await Promise.all([
    getPolicyLinks(companyId),
    getDocs(
      query(collection(db, "companies", companyId, "policyResponses"), where("policyId", "==", policy.id))
    ),
  ]);
  const mine = links.filter((l) => l.policyId === policy.id || (isBundleLink(l) && l.policyIds.includes(policy.id)));
  const rosterSnaps = await Promise.all(
    mine.map((l) => getDoc(doc(db, "policyLinkRosters", l.slug)).catch(() => null))
  );
  const roster = new Map();
  rosterSnaps.forEach((snap) =>
    (snap?.exists() ? snap.data().employees || [] : []).forEach((e) => roster.set(e.employeeKey, e))
  );

  const { rows, summary } = buildAckReport({
    roster: [...roster.values()],
    responses: responseSnap.docs.map((d) => d.data()),
    version: String(policy.version || "1.0"),
  });
  return {
    summary,
    pending: rows.filter((r) => r.status === "pending"),
    linkCount: mine.length,
    bundleCount: mine.filter(isBundleLink).length,
  };
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
