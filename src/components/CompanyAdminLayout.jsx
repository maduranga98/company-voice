import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Outlet, useLocation } from "react-router-dom";

const CompanyAdminLayout = () => {
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

  // Build tabs based on user's tag status
  const baseTabs = [
    {
      id: "dashboard",
      name: "Dashboard",
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
      name: "Creative",
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
      name: "Problems",
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
      name: "Discussions",
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
      name: "My Posts",
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
      name: "Profile",
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

  // Add "Assigned to Me" tab if user has a tag
  const tabs = userData?.userTagId
    ? [
        ...baseTabs.slice(0, 4), // Dashboard, Creative, Problems, Discussions
        {
          id: "assigned",
          name: "Assigned",
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
        ...baseTabs.slice(4), // My Posts, Profile
      ]
    : baseTabs;

  const isActiveTab = (path) => {
    // Handle feed routes - mark as active if path starts with the tab path
    if (path.startsWith("/feed/")) {
      return location.pathname === path;
    }
    return location.pathname === path;
  };

  const getRoleBadge = () => {
    if (userData?.role === "company_admin") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-teal text-text-onDark">
          COMPANY ADMIN
        </span>
      );
    } else if (userData?.role === "hr") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-success-light text-status-success-dark">
          HR
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background-softGray pb-20">
      {/* Top Header */}
      <header className="bg-primary-navy border-b border-primary-navy sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img
                src="/logo.png"
                alt="ANCHORA Logo"
                className="w-10 h-10 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-text-onDark">ANCHORA</h1>
                <p className="text-xs text-primary-teal font-medium">
                  Your Anchor in Every Storm
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-text-onDark">
                  {userData?.displayName}
                </p>
                <div className="flex justify-end mt-0.5">{getRoleBadge()}</div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-text-onDark bg-primary-teal border border-primary-teal rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-teal transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
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
                {loading ? "Logging out..." : "Logout"}
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
      <nav className="fixed bottom-0 left-0 right-0 bg-background-white border-t border-border-light z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div
            className={`grid ${
              userData?.userTagId ? "grid-cols-7" : "grid-cols-6"
            } gap-1`}
          >
            {tabs.map((tab) => {
              const isActive = isActiveTab(tab.path);
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`relative flex flex-col items-center justify-center py-3 px-2 transition-all duration-200 ${
                    isActive
                      ? "text-primary-teal bg-background-lightMist"
                      : "text-text-tertiary hover:text-text-primary hover:bg-background-softGray"
                  }`}
                >
                  <div
                    className={`transition-transform duration-200 ${
                      isActive ? "scale-110" : ""
                    }`}
                  >
                    {tab.icon}
                  </div>
                  <span
                    className={`text-xs mt-1 font-medium ${
                      isActive ? "text-primary-teal" : "text-text-tertiary"
                    }`}
                  >
                    {tab.name}
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-primary rounded-t-full" />
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

export default CompanyAdminLayout;
