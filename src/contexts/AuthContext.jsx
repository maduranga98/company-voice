import { createContext, useContext, useEffect, useState } from "react";
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
    // Check for existing session in localStorage
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        setUserData(user);
      } catch (error) {
        console.error("Error parsing stored user:", error);
        localStorage.removeItem("currentUser");
      }
    }
    setLoading(false);
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
