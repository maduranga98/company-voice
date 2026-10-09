import { where } from "firebase/firestore";
import { UserRole } from "./constants";

// Public-report cases flagged involvesHR are readable by company_admin and
// super_admin only. Firestore rules reject any HR query that could return them,
// so every HR-side posts query must add this filter. It is equality-only, so it
// needs no composite index, but it also means the query cannot orderBy; sort
// client-side with sortByCreatedAtDesc instead.
export const hrCaseScope = (role) =>
  role === UserRole.HR ? [where("involvesHR", "==", false)] : [];

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  return new Date(value).getTime() || 0;
};

export const sortByCreatedAtDesc = (items) =>
  [...items].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
