import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import ChangePasswordForm from "./ChangePasswordForm";

const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  const { t } = useTranslation();

  if (!currentUser) return <Navigate to="/login" />;

  // Accounts created or reset by an administrator must choose their own password first.
  if (currentUser.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow">
          <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("staff.password.title")}</h1>
          <ChangePasswordForm required />
        </div>
      </div>
    );
  }

  return children;
};

export default PrivateRoute;
