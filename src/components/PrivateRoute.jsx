import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import ChangePasswordForm from "./ChangePasswordForm";

const InactiveAccount = () => {
  const { dismissInactiveAccount } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const backToSignIn = () => {
    dismissInactiveAccount();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-page px-4">
      <div className="w-full max-w-md rounded-xl bg-background-white p-6 text-center shadow">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">{t("auth.accountInactive.title")}</h1>
        <p className="mb-5 text-sm text-gray-600">{t("auth.accountInactive.message")}</p>
        <button
          type="button"
          onClick={backToSignIn}
          className="rounded-lg bg-[#1ABC9C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16A085]"
        >
          {t("auth.accountInactive.backToSignIn")}
        </button>
      </div>
    </div>
  );
};

const PrivateRoute = ({ children }) => {
  const { currentUser, inactiveAccount } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  // Remember where the visitor was headed so a shared deep link (e.g. /cases/...) survives sign-in.
  if (!currentUser) {
    return inactiveAccount ? <InactiveAccount /> : <Navigate to="/login" state={{ from: location }} />;
  }

  // Accounts created or reset by an administrator must choose their own password first.
  if (currentUser.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-page px-4">
        <div className="w-full max-w-md rounded-xl bg-background-white p-6 shadow">
          <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("staff.password.title")}</h1>
          <ChangePasswordForm required />
        </div>
      </div>
    );
  }

  return children;
};

export default PrivateRoute;
