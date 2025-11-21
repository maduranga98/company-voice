import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import {
  loginWithUsernamePassword,
  getUserById,
} from "../services/authService";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to Firebase Auth state changes (for anonymous auth)
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // User is authenticated with Firebase (anonymous auth)
          // Check if we have custom user data in localStorage
          const storedUser = localStorage.getItem("currentUser");
          if (storedUser) {
            const user = JSON.parse(storedUser);

            // Ensure authSession exists for this Firebase Auth UID
            // This handles cases where the anonymous auth UID changes
            const authSessionRef = doc(db, "authSessions", firebaseUser.uid);
            const authSessionDoc = await getDoc(authSessionRef);

            // Verify user document in Firestore matches localStorage
            const userDocRef = doc(db, "users", user.id);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
              console.error("User document not found in Firestore:", user.id);
              throw new Error("User document not found");
            }

            const firestoreUserData = userDocSnap.data();
            const firestoreUser = { id: userDocSnap.id, ...firestoreUserData };

            // Check if Firestore data differs from localStorage
            if (firestoreUser.companyId !== user.companyId ||
                firestoreUser.role !== user.role ||
                firestoreUser.username !== user.username) {
              console.warn("User data mismatch - localStorage vs Firestore");
              console.log("LocalStorage:", {
                companyId: user.companyId,
                role: user.role,
                username: user.username
              });
              console.log("Firestore:", {
                companyId: firestoreUser.companyId,
                role: firestoreUser.role,
                username: firestoreUser.username
              });

              // Update localStorage with fresh Firestore data
              localStorage.setItem("currentUser", JSON.stringify(firestoreUser));
              user.companyId = firestoreUser.companyId;
              user.role = firestoreUser.role;
              user.username = firestoreUser.username;
              console.log("Updated localStorage with fresh Firestore data");
            }

            if (!authSessionDoc.exists()) {
              // Create authSession if it doesn't exist
              console.log("Creating missing authSession for restored user");
              await setDoc(authSessionRef, {
                userId: user.id,
                username: user.username,
                companyId: user.companyId,
                role: user.role,
                createdAt: serverTimestamp(),
              });
              console.log("AuthSession created successfully for Firebase UID:", firebaseUser.uid);
            } else {
              // Verify authSession data matches current user
              const sessionData = authSessionDoc.data();
              console.log("AuthSession exists for Firebase UID:", firebaseUser.uid, "User ID:", sessionData.userId);

              if (sessionData.userId !== user.id ||
                  sessionData.companyId !== user.companyId ||
                  sessionData.role !== user.role) {
                console.warn("AuthSession data mismatch detected - updating authSession");
                console.log("Session:", sessionData, "Current User:", {
                  userId: user.id,
                  companyId: user.companyId,
                  role: user.role
                });
                // Update authSession to match current user
                await setDoc(authSessionRef, {
                  userId: user.id,
                  username: user.username,
                  companyId: user.companyId,
                  role: user.role,
                  createdAt: serverTimestamp(),
                }, { merge: true });
                console.log("AuthSession updated successfully");
              }
            }

            // Only set user state AFTER authSession is verified/created
            setCurrentUser(user);
            setUserData(user);
          }
        } else {
          // User is signed out
          setCurrentUser(null);
          setUserData(null);
          localStorage.removeItem("currentUser");
        }
      } catch (error) {
        console.error("Error restoring user session:", error);
        localStorage.removeItem("currentUser");
        await signOut(auth);
        setCurrentUser(null);
        setUserData(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (username, password) => {
    try {
      const user = await loginWithUsernamePassword(username, password);
      setCurrentUser(user);
      setUserData(user);

      // Store in localStorage
      localStorage.setItem("currentUser", JSON.stringify(user));

      return user;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    // Sign out from Firebase Auth (anonymous session)
    await signOut(auth);

    setCurrentUser(null);
    setUserData(null);
    localStorage.removeItem("currentUser");
  };

  const value = {
    currentUser,
    userData,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
