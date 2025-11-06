import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

/**
 * RoleBasedLayout Component
 * Provides layout wrapper based on user role WITHOUT using Outlet
 * - Admins (company_admin, hr) see blue theme with Dashboard tab
 * - Employees see purple theme
 * This component renders children directly, not through Outlet
 */
const RoleBasedLayout = ({ children }) => {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Failed to log out", error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user is admin (company_admin or hr)
  const isAdmin = userData?.role === "company_admin" || userData?.role === "hr";

  // Define tabs based on role
  const adminBaseTabs = [
    {
      id: "dashboard",
      name: t("navigation.dashboard"),
      path: "/company/dashboard",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      id: "creative",
      name: t("navigation.creative"),
      path: "/feed/creative",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      ),
    },
    {
      id: "problems",
      name: t("navigation.problems"),
      path: "/feed/problems",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    {
      id: "discussions",
      name: t("navigation.discussions"),
      path: "/feed/discussions",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },
    {
      id: "myposts",
      name: t("navigation.myPosts"),
      path: "/my-posts",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
    },
    {
      id: "profile",
      name: t("navigation.profile"),
      path: "/company/profile",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ];

  const employeeBaseTabs = [
    {
      id: "creative",
      name: t("navigation.creative"),
      path: "/feed/creative",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      ),
    },
    {
      id: "problems",
      name: t("navigation.problems"),
      path: "/feed/problems",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    {
      id: "discussions",
      name: t("navigation.discussions"),
      path: "/feed/discussions",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },
    {
      id: "myposts",
      name: t("navigation.myPosts"),
      path: "/my-posts",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
    },
    {
      id: "profile",
      name: t("navigation.profile"),
      path: "/employee/profile",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ];

  // Add "Assigned" tab if user has a tag
  const baseTabs = isAdmin ? adminBaseTabs : employeeBaseTabs;
  const tabs = userData?.userTagId
    ? [
        ...baseTabs.slice(0, isAdmin ? 4 : 3),
        {
          id: "assigned",
          name: t("navigation.assignedToMe"),
          path: "/assigned-to-me",
          icon: (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          ),
        },
        ...baseTabs.slice(isAdmin ? 4 : 3),
      ]
    : baseTabs;

  const isActiveTab = (path) => {
    if (path.startsWith("/feed/")) {
      return location.pathname === path;
    }
    return location.pathname === path;
  };

  const getRoleBadge = () => {
    if (userData?.role === "company_admin") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          COMPANY ADMIN
        </span>
      );
    } else if (userData?.role === "hr") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          HR
        </span>
      );
    }
    return null;
  };

  // Theme colors based on role
  const themeColors = isAdmin
    ? {
        gradient: "from-blue-600 to-indigo-600",
        text: "text-blue-600",
        bg: "bg-blue-50",
        hover: "hover:text-blue-900 hover:bg-blue-50",
        active: "text-blue-600 bg-blue-50",
      }
    : {
        gradient: "from-purple-600 to-blue-600",
        text: "text-purple-600",
        bg: "bg-purple-50",
        hover: "hover:text-purple-900 hover:bg-purple-50",
        active: "text-purple-600 bg-purple-50",
      };

  return (
    <div className="min-h-screen bg-background-softGray pb-24">
      {/* Top Header */}
      <header className="bg-background-white border-b border-border-light sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo Section with Enhanced Styling */}
            <div
              className="flex items-center space-x-3 group cursor-pointer"
              onClick={() => navigate(isAdmin ? "/company/dashboard" : "/feed/creative")}
            >
              <div className="relative">
                <div
                  className={`absolute inset-0 ${isAdmin ? 'bg-blue-500' : 'bg-purple-500'} rounded-lg blur-md opacity-40 group-hover:opacity-60 transition-opacity duration-300`}
                ></div>
                <div
                  className={`bg-gradient-to-r ${themeColors.gradient} rounded-lg p-2 relative z-10`}
                >
                  <img
                    src="/logo.png"
                    alt="ANCHORA Logo"
                    className="w-6 h-6 object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isAdmin ? 'text-blue-900' : 'text-purple-900'} group-hover:${themeColors.text} transition-colors duration-300`}>
                  ANCHORA
                </h1>
                <p className="text-xs text-text-secondary font-medium">
                  Your Anchor in Every Storm
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Language Switcher */}
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>

              {/* User Info - Desktop */}
              <div className="hidden md:flex items-center space-x-3 px-3 py-2 bg-background-lightMist rounded-lg border border-border-light">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${isAdmin ? 'from-blue-500 to-indigo-500' : 'from-purple-500 to-blue-500'} flex items-center justify-center text-text-onDark font-bold text-sm`}>
                  {userData?.displayName?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-primary">
                    {userData?.displayName}
                  </p>
                  <div className="flex justify-end mt-0.5">{getRoleBadge()}</div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                disabled={loading}
                className={`inline-flex items-center px-4 py-2 text-sm font-semibold
                          ${isAdmin ? 'text-blue-700 border-blue-300 hover:bg-blue-50' : 'text-purple-700 border-purple-300 hover:bg-purple-50'}
                          bg-background-white border-2 rounded-lg hover:shadow-lg
                          focus:outline-none focus:ring-2 focus:ring-offset-2
                          ${isAdmin ? 'focus:ring-blue-500' : 'focus:ring-purple-500'}
                          transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                          active:scale-95`}
              >
                {loading ? (
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                )}
                <span className="hidden sm:inline">
                  {loading ? t("common.loading") : t("auth.logout")}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - RENDER CHILDREN DIRECTLY */}
      <main className="max-w-7xl mx-auto">{children}</main>

      {/* Bottom Navigation - Enhanced with Better Mobile Support */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background-white border-t border-border-light z-50 safe-area-inset-bottom shadow-2xl">
        <div className="max-w-7xl mx-auto">
          <div
            className={`grid ${
              userData?.userTagId
                ? `grid-cols-${tabs.length}`
                : `grid-cols-${tabs.length}`
            } gap-0`}
          >
            {tabs.map((tab) => {
              const isActive = isActiveTab(tab.path);
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`
                    relative flex flex-col items-center justify-center py-2 px-1 min-h-[64px]
                    transition-all duration-300 group
                    ${
                      isActive
                        ? themeColors.active
                        : `text-text-tertiary ${themeColors.hover}`
                    }
                  `}
                >
                  {/* Active Indicator - Top */}
                  {isActive && (
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${themeColors.gradient} rounded-b-full animate-pulse`}
                    />
                  )}

                  {/* Icon Container */}
                  <div
                    className={`
                      relative transition-all duration-300
                      ${isActive ? "scale-110" : "group-hover:scale-105"}
                    `}
                  >
                    {/* Background Glow for Active Tab */}
                    {isActive && (
                      <div className={`absolute inset-0 ${isAdmin ? 'bg-blue-500' : 'bg-purple-500'} rounded-full blur-lg opacity-20 -z-10`}></div>
                    )}

                    {/* Icon */}
                    <div className="w-6 h-6 transition-colors duration-300">
                      {tab.icon}
                    </div>
                  </div>

                  {/* Label */}
                  <span
                    className={`
                      text-[10px] sm:text-xs mt-1.5 font-medium leading-tight text-center
                      transition-all duration-300
                      ${
                        isActive
                          ? `${themeColors.text} font-semibold`
                          : "text-text-tertiary group-hover:text-text-primary"
                      }
                    `}
                  >
                    {tab.name}
                  </span>

                  {/* Active Badge Dot */}
                  {isActive && (
                    <div className={`absolute bottom-1 w-1 h-1 ${isAdmin ? 'bg-blue-500' : 'bg-purple-500'} rounded-full animate-ping`}></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default RoleBasedLayout;
