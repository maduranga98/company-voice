import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth, functions } from "../config/firebase";

// Credentials are checked by the `login` Cloud Function, which returns a Firebase custom token
// whose uid is the users/{id} document id and whose claims carry { role, companyId }.
// Nothing here hashes passwords or reads the users collection.
export const loginWithUsernamePassword = async (username, password) => {
  const response = await httpsCallable(functions, "login")({ username, password });
  await signInWithCustomToken(auth, response.data.customToken);
  return response.data.user;
};

export const changeOwnPassword = async (currentPassword, newPassword) => {
  const response = await httpsCallable(functions, "changeOwnPassword")({ currentPassword, newPassword });
  return response.data;
};
