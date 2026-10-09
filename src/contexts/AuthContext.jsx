import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { onIdTokenChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { loginWithUsernamePassword } from "../services/authService";
import { isPublicReportRoute } from "../utils/publicRoute";

const AuthContext = createContext();

// The public report form needs no session, so it must not wait for auth restore.
const publicReportRoute = isPublicReportRoute();

const STAFF_ROLES = ["super_admin", "company_admin", "hr"];
// ID tokens last an hour; forcing a refresh surfaces revoked sessions (suspension, password reset,
// role change) within minutes instead of at the next hourly refresh.
const REVALIDATE_MS = 5 * 60 * 1000;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/**
 * Staff profile for a signed-in Firebase user. Identity comes from the verified token claims
 * (role, companyId) and the users/{uid} document; returns null if either says the session is invalid.
 */
const loadStaffProfile = async (firebaseUser) => {
  const token = await firebaseUser.getIdTokenResult();
  const role = token.claims.role;
  if (!STAFF_ROLES.includes(role)) return null;

  const snap = await getDoc(doc(db, "users", firebaseUser.uid));
  if (!snap.exists()) return null;

  const profile = { id: snap.id, ...snap.data() };
  const companyId = token.claims.companyId || null;
  if (profile.status !== "active" || profile.role !== role || (profile.companyId || null) !== companyId) {
    return null;
  }
  return profile;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const hydrating = useRef(Promise.resolve());

  const applyProfile = useCallback((profile) => {
    setCurrentUser(profile);
    setUserData(profile);
  }, []);

  const hydrate = useCallback(
    (firebaseUser) => {
      hydrating.current = (async () => {
        try {
          const profile = firebaseUser ? await loadStaffProfile(firebaseUser) : null;
          if (firebaseUser && !profile) {
            // Role-less (leftover anonymous) or out-of-date session: force a fresh login.
            await signOut(auth);
          }
          applyProfile(profile);
          return profile;
        } catch (error) {
          console.error("Error restoring user session:", error);
          await signOut(auth).catch(() => {});
          applyProfile(null);
          return null;
        } finally {
          setLoading(false);
        }
      })();
      return hydrating.current;
    },
    [applyProfile]
  );

  useEffect(() => {
    // Sessions from the pre-claims login kept the whole user in localStorage.
    localStorage.removeItem("currentUser");
    // Fires on sign-in, sign-out and every token refresh, so changed claims or a revoked
    // session are noticed without a page reload.
    return onIdTokenChanged(auth, hydrate);
  }, [hydrate]);

  useEffect(() => {
    if (!currentUser) return undefined;
    const timer = setInterval(() => {
      auth.currentUser?.getIdToken(true).catch(() => signOut(auth));
    }, REVALIDATE_MS);
    return () => clearInterval(timer);
  }, [currentUser]);

  const login = async (username, password) => {
    await loginWithUsernamePassword(username, password);
    const profile = await hydrate(auth.currentUser);
    if (!profile) throw new Error("Could not start your session. Please try again.");
    return profile;
  };

  const logout = async () => {
    await signOut(auth);
    applyProfile(null);
  };

  const refreshUserData = async () => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const profile = await loadStaffProfile(auth.currentUser);
    if (!profile) throw new Error("User document not found");
    applyProfile(profile);
    return profile;
  };

  const value = {
    currentUser,
    userData,
    loading,
    login,
    logout,
    refreshUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {(!loading || publicReportRoute) && children}
    </AuthContext.Provider>
  );
};
