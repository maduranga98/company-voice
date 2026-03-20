import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { signInAnonymously, signOut } from "firebase/auth";
import CryptoJS from "crypto-js";

// Hash password
const hashPassword = (password) => {
  return CryptoJS.SHA256(password).toString();
};

// Login with username and password (custom authentication + Firebase Anonymous Auth)
export const loginWithUsernamePassword = async (username, password) => {
  try {
    const hashedPassword = hashPassword(password);

    // Sign in anonymously FIRST so all subsequent Firestore queries are authenticated.
    // Firestore security rules require request.auth != null for reading users.
    const firebaseAuthResult = await signInAnonymously(auth);

    // Create a temporary auth session so Firestore rules can resolve getSession()
    // during the user queries below. This is needed because rules call getUserRole()
    // which reads from authSessions.
    const tempSessionData = {
      userId: "pending",
      username: username.toLowerCase(),
      companyId: null,
      role: "pending",
      firebaseUid: firebaseAuthResult.user.uid,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "authSessions", firebaseAuthResult.user.uid), tempSessionData);

    try {
      // Query users collection for custom authentication
      const usersRef = collection(db, "users");
      // First, check if user exists regardless of status
      const userCheckQuery = query(
        usersRef,
        where("username", "==", username.toLowerCase()),
        where("password", "==", hashedPassword)
      );

      const userCheckSnapshot = await getDocs(userCheckQuery);

      if (userCheckSnapshot.empty) {
        throw new Error("Invalid username or password");
      }

      const userDoc = userCheckSnapshot.docs[0];
      const userData = { id: userDoc.id, ...userDoc.data() };

      // Check user status
      if (userData.status === "suspended") {
        const suspendedUntil = userData.suspendedUntil?.toDate ? userData.suspendedUntil.toDate() : new Date(userData.suspendedUntil || 0);
        const now = new Date();

        if (suspendedUntil > now) {
          const daysRemaining = Math.ceil((suspendedUntil - now) / (1000 * 60 * 60 * 24));
          throw new Error(`Your account is suspended until ${suspendedUntil.toLocaleDateString()}. ${daysRemaining} day(s) remaining. Reason: ${userData.suspensionReason || 'Policy violation'}`);
        }
      } else if (userData.status === "invited") {
        throw new Error("Your account is pending activation. Please check your email for the invitation link.");
      } else if (userData.status !== "active") {
        throw new Error("Your account has been deactivated. Please contact your company administrator or support.");
      }

      // Re-query to ensure status is active
      const q = query(
        usersRef,
        where("username", "==", username.toLowerCase()),
        where("password", "==", hashedPassword),
        where("status", "==", "active")
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Invalid username or password");
      }

      const activeUserDoc = querySnapshot.docs[0];
      const activeUserData = { id: activeUserDoc.id, ...activeUserDoc.data() };

      // Check if user's company is active (skip for super admins)
      if (activeUserData.companyId) {
        const companyDoc = await getDoc(doc(db, "companies", activeUserData.companyId));

        if (!companyDoc.exists()) {
          throw new Error("Company not found. Please contact support.");
        }

        const companyData = companyDoc.data();

        if (!companyData.isActive) {
          throw new Error("Your company account is deactivated. Please contact support.");
        }
      }

      // Update the auth session with the real user data
      const authSessionData = {
        userId: activeUserDoc.id,
        username: activeUserData.username,
        companyId: activeUserData.companyId ?? null,
        role: activeUserData.role,
        firebaseUid: firebaseAuthResult.user.uid,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "authSessions", firebaseAuthResult.user.uid), authSessionData);

      // Update last login
      await updateDoc(doc(db, "users", activeUserDoc.id), {
        lastLogin: serverTimestamp(),
      });

      // Remove password from returned data
      delete activeUserData.password;

      return activeUserData;
    } catch (loginError) {
      // Login failed — sign out to prevent auth state mismatch
      await signOut(auth);
      throw loginError;
    }
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

// Get user by ID
export const getUserById = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));

    if (!userDoc.exists()) {
      throw new Error("User not found");
    }

    const userData = { id: userDoc.id, ...userDoc.data() };
    delete userData.password;

    return userData;
  } catch (error) {
    console.error("Get user error:", error);
    throw error;
  }
};

// Check if username exists
export const checkUsernameExists = async (username) => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);

    return !querySnapshot.empty;
  } catch (error) {
    console.error("Check username error:", error);
    throw error;
  }
};

export { hashPassword };
