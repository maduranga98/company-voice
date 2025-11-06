import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

const EmployeeLayout = () => {
  const { t } = useTranslation();
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  const baseTabs = [
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

  // Add "Assigned to Me" tab if user has a tag
  const tabs = userData?.userTagId
    ? [
        ...baseTabs.slice(0, 3), // Creative, Problems, Discussions
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
        ...baseTabs.slice(3), // My Posts, Profile
      ]
    : baseTabs;

  const isActiveTab = (path) => {
    // Handle feed routes - mark as active if path starts with the tab path
    if (path.startsWith("/feed/")) {
      return location.pathname === path;
    }
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-background-softGray pb-20">
      {/* Top Header */}
      <header className="bg-primary-navy border-b border-primary-navy sticky top-0 z-40 shadow-lg backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ">
          <div className="flex justify-between items-center h-16">
            {/* Logo Section */}
            <div
              className="flex items-center space-x-3 group cursor-pointer"
              onClick={() => navigate("/feed/creative")}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-(--color-primary-teal) rounded-lg blur-md opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
                <img
                  src="/logo.png"
                  alt="ANCHORA Logo"
                  className="w-10 h-10 object-contain relative z-10 group-hover:scale-110 transition-transform duration-300"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-onDark group-hover:text-(--color-primary-teal) transition-colors duration-300">
                  ANCHORA
                </h1>
                <p className="text-xs text-(--color-primary-teal) font-medium">
                  Your Anchor in Every Storm
                </p>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-4">
              {/* Language Switcher */}
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>

              {/* User Info - Desktop */}
              <div className="hidden md:flex items-center space-x-3 px-4 py-2 bg-primary-navy bg-opacity-50 rounded-lg border border-(--color-primary-teal)er-opacity-30">
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-(--color-primary-teal) to-(--color-accent-coral) flex items-center justify-center text-text-onDark-sm">
                  {userData?.displayName?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-onDark">
                    {userData?.displayName}
                  </p>
                  <p className="text-xs text-(--color-primary-teal) capitalize">
                    {userData?.role?.replace("_", " ")}
                  </p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 text-sm font-semibold text-text-onDark 
                         bg-(--color-primary-teal) border-2 border-(--color-primary-teal) rounded-lg 
                         hover:bg-(--color-primary-teal) hover:bg-opacity-90 hover:shadow-lg
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-(--color-primary-teal)
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                         active:scale-95"
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

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation - Mobile First */}
      <nav className="fixed bottom-0 left-0 right-0 bg-(--color-background-white) border-t border-border-light-inset-bottom shadow-2xl">
        <div className="max-w-7xl mx-auto">
          <div
            className={`grid ${
              userData?.userTagId ? "grid-cols-6" : "grid-cols-5"
            } gap-0`}
          >
            {tabs.map((tab) => {
              const isActive = isActiveTab(tab.path);
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`
                    relative flex flex-col items-center justify-center py-2 px-1 min-h-16 
                    transition-all duration-300 group
                    ${
                      isActive
                        ? "text-(--color-primary-teal) bg-background-lightMist"
                        : "text-text-tertiary hover:text-text-primary--color-background-softGray)]"
                    }
                  `}
                >
                  {/* Active Indicator - Top */}
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-primary-navy to-(--color-primary-teal) rounded-b-full animate-pulse" />
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
                      <div className="absolute inset-0 bg-(--color-primary-teal) rounded-full blur-lg opacity-20 -z-10"></div>
                    )}

                    {/* Icon */}
                    <div
                      className={`
                      w-6 h-6 transition-colors duration-300
                      ${
                        isActive
                          ? "text-(--color-primary-teal)"
                          : "text-text-tertiary group-hover:text-text-primary"
                      }
                    `}
                    >
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
                          ? "text-(--color-primary-teal) font-semibold"
                          : "text-text-tertiary group-hover:text-text-primary"
                      }
                    `}
                  >
                    {tab.name}
                  </span>

                  {/* Active Badge Dot */}
                  {isActive && (
                    <div className="absolute bottom-1 w-1 h-1 bg-(--color-primary-teal) rounded-full animate-ping"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile User Info Overlay - Shown on Language Switcher tap */}
      <div className="md:hidden fixed top-16 right-4 bg-(--color-background-white) rounded-lg shadow-xl border border-border-light p-3 z-30 hidden group-hover:block">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-(--color-primary-teal) to-(--color-accent-coral) flex items-center justify-center text-text-onDark font-bold">
            {userData?.displayName?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {userData?.displayName}
            </p>
            <p className="text-xs text-text-secondary capitalize">
              {userData?.role?.replace("_", " ")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLayout;
