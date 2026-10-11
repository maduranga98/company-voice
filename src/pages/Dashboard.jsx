import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { BrandMark } from "../components/brand/Logo";

const Dashboard = () => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userData) return;

    // Route based on user role
    if (userData.role === "super_admin") {
      navigate("/admin/companies", { replace: true });
    } else if (userData.role === "hr") {
      navigate("/hr/inbox", { replace: true });
    } else if (userData.role === "company_admin") {
      navigate("/company/dashboard", { replace: true });
    }
  }, [userData, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-cream">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-brand-400/30" />
          <BrandMark size={56} className="relative drop-shadow-lg" />
        </div>
        <p className="mt-8 text-base font-semibold text-ink">{t('dashboard.loadingWorkspace')}</p>
        <p className="mt-1 text-sm text-gray-500">{t('dashboard.pleaseWait')}</p>
      </div>
    </div>
  );
};

export default Dashboard;
