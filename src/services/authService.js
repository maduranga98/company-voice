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
} from "firebase/firestore";
import { db, auth, functions } from "../config/firebase";
import { signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import CryptoJS from "crypto-js";

// Hash password
const hashPassword = (password) => {
  return CryptoJS.SHA256(password).toString();
};

// Login with username and password
export const loginWithUsernamePassword = async (username, password) => {
  try {
    // Call the Cloud Function to generate auth token
    const generateAuthToken = httpsCallable(functions, 'generateAuthToken');
    const result = await generateAuthToken({ username, password });

    if (!result.data.success) {
      throw new Error("Authentication failed");
    }

    const { user, customToken } = result.data.data;

    // Sign in to Firebase Auth with the custom token
    await signInWithCustomToken(auth, customToken);

    return user;
  } catch (error) {
    console.error("Login error:", error);
    if (error.code === 'functions/unauthenticated') {
      throw new Error("Invalid username or password");
    }
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
