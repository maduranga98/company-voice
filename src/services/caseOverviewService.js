import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { hrCaseScope } from "../utils/caseVisibility";
import { CaseType, getCaseAdapter } from "../utils/caseTypes";
import { toOverviewCase, compareOverviewCases } from "../utils/caseOverview";

// Per-source cap so one huge collection can't make the page unbounded.
export const OVERVIEW_QUERY_LIMIT = 500;

const fetchDocs = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));

/**
 * Loads every case the signed-in staff member may see across posts, vendorReports and
 * contentReports, keeps the open ones, and returns them normalised and sorted.
 *
 * posts: the HR inbox set (privacyLevel hr_only) plus anything assigned to someone,
 * both through hrCaseScope so an HR user never queries involvesHR cases.
 * A source that fails to load doesn't hide the others; it is reported in `failed`.
 *
 * @returns {Promise<{cases: object[], failed: string[], truncated: boolean}>}
 */
export const loadOverviewCases = async (user) => {
  const { companyId, role } = user;
  const scope = hrCaseScope(role);
  const posts = collection(db, "posts");

  const sources = {
    inbox: fetchDocs(
      query(posts, where("companyId", "==", companyId), where("privacyLevel", "==", "hr_only"), ...scope, limit(OVERVIEW_QUERY_LIMIT))
    ),
    assigned: fetchDocs(
      query(posts, where("companyId", "==", companyId), where("assignedTo.type", "in", ["user", "department"]), ...scope, limit(OVERVIEW_QUERY_LIMIT))
    ),
    vendor: fetchDocs(
      query(collection(db, getCaseAdapter(CaseType.VENDOR).collection), where("companyId", "==", companyId), limit(OVERVIEW_QUERY_LIMIT))
    ),
    moderation: fetchDocs(
      query(collection(db, getCaseAdapter(CaseType.MODERATION).collection), where("companyId", "==", companyId), limit(OVERVIEW_QUERY_LIMIT))
    ),
  };

  const names = Object.keys(sources);
  const settled = await Promise.allSettled(Object.values(sources));
  const result = {};
  const failed = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") result[names[i]] = outcome.value;
    else {
      console.error(`Case overview: ${names[i]} failed to load`, outcome.reason);
      result[names[i]] = [];
      failed.push(names[i] === "inbox" || names[i] === "assigned" ? CaseType.POST : names[i]);
    }
  });

  // Same post can be in both post queries
  const postsById = new Map();
  [...result.inbox, ...result.assigned].forEach((p) => postsById.set(p.id, p));
  const postDocs = [...postsById.values()];

  // Reporter-facing timers need to know whether an investigator has replied.
  const threads = new Map();
  if (postDocs.some((p) => p.source === "public_link")) {
    try {
      const threadDocs = await fetchDocs(
        query(collection(db, "anonymousThreads"), where("companyId", "==", companyId), limit(OVERVIEW_QUERY_LIMIT))
      );
      threadDocs.forEach((th) => threads.set(th.id, th));
    } catch (error) {
      // Without threads, "feedback given" falls back to the terminal-status rule only.
      console.error("Case overview: could not load threads", error);
    }
  }

  const now = Date.now();
  const cases = [
    ...postDocs.map((p) => toOverviewCase(CaseType.POST, p, threads.get(p.id) || null, now)),
    ...result.vendor.map((r) => toOverviewCase(CaseType.VENDOR, r, null, now)),
    ...result.moderation.map((r) => toOverviewCase(CaseType.MODERATION, r, null, now)),
  ]
    .filter((c) => c.isOpen)
    .sort(compareOverviewCases);

  const truncated = [result.inbox, result.assigned, result.vendor, result.moderation].some(
    (docs) => docs.length >= OVERVIEW_QUERY_LIMIT
  );
  return { cases, failed: [...new Set(failed)], truncated };
};
