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
import { db } from "../config/firebase";
import CryptoJS from "crypto-js";

// Hash password
const hashPassword = (password) => {
  return CryptoJS.SHA256(password).toString();
};

// Login with username and password
export const loginWithUsernamePassword = async (username, password) => {
  try {
    // Hash the password
    const hashedPassword = hashPassword(password);
    console.log(password, hashedPassword);
    // Query users collection
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
