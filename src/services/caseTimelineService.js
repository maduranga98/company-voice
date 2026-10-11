import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { CaseType } from "../utils/caseTypes";
import { getPostActivityTimeline } from "./postManagementService";
import { CASE_ACTIVITIES_COLLECTION } from "./caseService";

// One chronological history per case, normalised to
//   { id, source, type, actorName, at (ms), metadata }
// Sources already in the project (nothing new is logged by the detail page itself):
//   posts       -> postActivities    (postManagementService)
//   vendor      -> caseActivities    (caseService)
//   moderation  -> caseActivities + moderationActivities (moderationService)
// Internal notes are included because every note also writes an admin_comment activity.

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return new Date(value).getTime() || 0;
};

const normalizeActivity = (source) => (doc) => ({
  id: `${source}:${doc.id}`,
  source,
  type: doc.type,
  actorName: doc.metadata?.adminName || doc.metadata?.moderatorName || null,
  at: toMillis(doc.createdAt),
  metadata: doc.metadata || {},
});

const fetchByEquality = async (collectionName, filters) => {
  const snapshot = await getDocs(
    query(collection(db, collectionName), ...filters.map(([field, value]) => where(field, "==", value)))
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getCaseTimeline = async (caseType, caseId, companyId) => {
  let entries = [];

  if (caseType === CaseType.POST) {
    const activities = await getPostActivityTimeline(caseId, companyId, 200);
    entries = activities.map(normalizeActivity("postActivities"));
  } else {
    const caseActivities = await fetchByEquality(CASE_ACTIVITIES_COLLECTION, [
      ["companyId", companyId],
      ["caseId", caseId],
    ]);
    entries = caseActivities
      .filter((a) => a.caseType === caseType)
      .map(normalizeActivity(CASE_ACTIVITIES_COLLECTION));

    if (caseType === CaseType.MODERATION) {
      const moderation = await fetchByEquality("moderationActivities", [
        ["companyId", companyId],
        ["reportId", caseId],
      ]);
      entries.push(
        ...moderation.map((a) => ({
          id: `moderationActivities:${a.id}`,
          source: "moderationActivities",
          type: a.activityType,
          actorName: a.metadata?.moderatorName || null,
          at: toMillis(a.createdAt),
          metadata: a.metadata || {},
        }))
      );
    }
  }

  return entries.sort((a, b) => b.at - a.at);
};

