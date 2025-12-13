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

    // Sign in anonymously to Firebase Auth for API authentication
    const firebaseAuthResult = await signInAnonymously(auth);

    // Link the Firebase Auth UID to the custom user in Firestore
    // This allows Cloud Functions to verify auth and lookup the actual user
    try {
      // For super admins, companyId might be null or undefined
      // Ensure we use null instead of undefined for Firestore compatibility
      const authSessionData = {
        userId: activeUserDoc.id,
        username: activeUserData.username,
        companyId: activeUserData.companyId || null,
        role: activeUserData.role,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "authSessions", firebaseAuthResult.user.uid), authSessionData);
    } catch (authSessionError) {
      console.error("Failed to create auth session:", authSessionError);
      console.error("Auth session error details:", {
        code: authSessionError.code,
        message: authSessionError.message,
        stack: authSessionError.stack,
      });
      // Sign out of Firebase Auth to prevent auth state mismatch
      await signOut(auth);
      throw new Error("Failed to create authentication session. Please try again.");
    }

    // Update last login
    await updateDoc(doc(db, "users", activeUserDoc.id), {
      lastLogin: serverTimestamp(),
    });

    // Remove password from returned data
    delete activeUserData.password;

    return activeUserData;
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
