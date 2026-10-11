import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Building2, CreditCard, Scale, Shield, Trash2 } from "lucide-react";

const SuperAdminNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    {
      id: "companies",
      label: "Companies",
      path: "/admin/companies",
      icon: <Building2 className="w-[18px] h-[18px]" />,
    },
    {
      id: "billing",
      label: "Billing",
      path: "/admin/billing",
      icon: <CreditCard className="w-[18px] h-[18px]" />,
    },
    {
      id: "legal",
      label: "Legal Requests",
      path: "/admin/legal-requests",
      icon: <Scale className="w-[18px] h-[18px]" />,
    },
    {
      id: "key-vault",
      label: "Key Vault",
      path: "/admin/key-vault",
      icon: <Shield className="w-[18px] h-[18px]" />,
    },
    {
      id: "deleted-posts",
      label: "Deleted Posts",
      path: "/admin/deleted-posts",
      icon: <Trash2 className="w-[18px] h-[18px]" />,
    },
  ];

  const isActiveTab = (path) => location.pathname === path;

  return (
    <div className="border-b border-gray-200/70 bg-white">
      <div
        className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-3 no-scrollbar"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => {
          const isActive = isActiveTab(tab.path);
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-ink"
              }`}
            >
              <span className={isActive ? "text-brand-600" : "text-gray-400"}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SuperAdminNav;
