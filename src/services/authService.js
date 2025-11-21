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

    const userDoc = querySnapshot.docs[0];
    const userData = { id: userDoc.id, ...userDoc.data() };

    // Sign in anonymously to Firebase Auth for API authentication
    const firebaseAuthResult = await signInAnonymously(auth);
    console.log("Firebase Auth UID:", firebaseAuthResult.user.uid);

    // Link the Firebase Auth UID to the custom user in Firestore
    // This allows Cloud Functions to verify auth and lookup the actual user
    try {
      await setDoc(doc(db, "authSessions", firebaseAuthResult.user.uid), {
        userId: userDoc.id,
        username: userData.username,
        companyId: userData.companyId,
        role: userData.role,
        createdAt: serverTimestamp(),
      });
      console.log("Auth session created successfully for user:", userData.username);
    } catch (authSessionError) {
      console.error("Failed to create auth session:", authSessionError);
      // Sign out of Firebase Auth to prevent auth state mismatch
      await signOut(auth);
      throw new Error("Failed to create authentication session. Please try again.");
    }

    // Update last login
    await updateDoc(doc(db, "users", userDoc.id), {
      lastLogin: serverTimestamp(),
    });

    // Remove password from returned data
    delete userData.password;

    return userData;
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
