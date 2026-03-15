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
      icon: <Building2 className="w-5 h-5" />,
    },
    {
      id: "billing",
      label: "Billing",
      path: "/admin/billing",
      icon: <CreditCard className="w-5 h-5" />,
    },
    {
      id: "legal",
      label: "Legal Requests",
      path: "/admin/legal-requests",
      icon: <Scale className="w-5 h-5" />,
    },
    {
      id: "key-vault",
      label: "Key Vault",
      path: "/admin/key-vault",
      icon: <Shield className="w-5 h-5" />,
    },
    {
      id: "deleted-posts",
      label: "Deleted Posts",
      path: "/admin/deleted-posts",
      icon: <Trash2 className="w-5 h-5" />,
    },
  ];

  const isActiveTab = (path) => location.pathname === path;

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="flex gap-1 overflow-x-auto px-2 no-scrollbar" style={{ scrollbarWidth: "none" }}>
        {tabs.map((tab) => {
          const isActive = isActiveTab(tab.path);
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-[#1ABC9C] text-[#1ABC9C]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className={isActive ? "text-[#1ABC9C]" : "text-gray-400"}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SuperAdminNav;
