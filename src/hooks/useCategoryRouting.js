import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAssignableStaff,
  subscribeCategories,
  subscribeDefaultAssignee,
  subscribeRoutingRules,
} from "../services/categoryRoutingService";

/**
 * Live categories, per-category routing rules, the company default assignee and the staff who
 * can be assigned, for the "Categories & Routing" settings.
 *
 * `mutate(apply, request)` is the optimistic-update helper: it applies the change to local state
 * immediately, awaits the server call, and on failure restores the previous state and rethrows
 * so the caller can show the error. On success the Firestore snapshot that follows replaces the
 * optimistic value with the stored one.
 */
export const useCategoryRouting = (companyId) => {
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState({});
  const [defaultAssignee, setDefaultAssignee] = useState({ type: null, id: null });
  const [staff, setStaff] = useState([]);
  const [loaded, setLoaded] = useState({ categories: false, rules: false, company: false, staff: false });
  const [error, setError] = useState(null);

  const latest = useRef({ categories, rules, defaultAssignee });
  latest.current = { categories, rules, defaultAssignee };

  const markLoaded = (key) => setLoaded((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

  useEffect(() => {
    if (!companyId) return undefined;
    const fail = (err) => {
      console.error("Categories & Routing: could not load", err?.code);
      setError(err);
    };
    const unsubs = [
      subscribeCategories(companyId, (data) => { setCategories(data); markLoaded("categories"); }, fail),
      subscribeRoutingRules(companyId, (data) => { setRules(data); markLoaded("rules"); }, fail),
      subscribeDefaultAssignee(companyId, (data) => { setDefaultAssignee(data); markLoaded("company"); }, fail),
    ];
    let cancelled = false;
    getAssignableStaff(companyId)
      .then((data) => { if (!cancelled) { setStaff(data); markLoaded("staff"); } })
      .catch(fail);
    return () => {
      cancelled = true;
      unsubs.forEach((unsub) => unsub());
    };
  }, [companyId]);

  const mutate = useCallback(async (apply, request) => {
    const snapshot = latest.current;
    apply({ setCategories, setRules, setDefaultAssignee });
    try {
      return await request();
    } catch (err) {
      setCategories(snapshot.categories);
      setRules(snapshot.rules);
      setDefaultAssignee(snapshot.defaultAssignee);
      throw err;
    }
  }, []);

  return {
    categories,
    rules,
    defaultAssignee,
    staff,
    error,
    loading: !Object.values(loaded).every(Boolean) && !error,
    mutate,
  };
};
