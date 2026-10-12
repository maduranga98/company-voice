import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { hrCaseScope } from "../utils/caseVisibility";
import { getDepartments } from "./departmentservice";

// One read per collection. Each fails independently (an HR user may be denied a
// collection) so a single denied read degrades a metric instead of the whole page.
const load = async (name, companyId, ...extra) => {
  try {
    const snap = await getDocs(query(collection(db, name), where("companyId", "==", companyId), ...extra));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn(`Analytics: could not read ${name}`, error);
    return [];
  }
};

export const fetchAnalyticsData = async (companyId, role) => {
  const [posts, vendorReports, contentReports, postActivities, caseActivities, threads, users, departments] =
    await Promise.all([
      load("posts", companyId, ...hrCaseScope(role)),
      load("vendorReports", companyId),
      load("contentReports", companyId),
      load("postActivities", companyId),
      load("caseActivities", companyId),
      load("anonymousThreads", companyId),
      load("users", companyId),
      getDepartments(companyId, false).catch(() => []),
    ]);
  return { posts, vendorReports, contentReports, postActivities, caseActivities, threads, users, departments };
};
