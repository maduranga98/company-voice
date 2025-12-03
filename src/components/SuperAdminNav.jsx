import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Building2, CreditCard, Scale, Trash2 } from "lucide-react";

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
      id: "deleted-posts",
      label: "Deleted Posts",
      path: "/admin/deleted-posts",
      icon: <Trash2 className="w-5 h-5" />,
    },
  ];

  const isActiveTab = (path) => location.pathname === path;

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex space-x-1">
        {tabs.map((tab) => {
          const isActive = isActiveTab(tab.path);
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`
                flex items-center space-x-2 px-6 py-3 text-sm font-medium border-b-2 transition-all duration-200
                ${
                  isActive
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                }
              `}
            >
              <span className={isActive ? "text-indigo-600" : "text-gray-400"}>
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
