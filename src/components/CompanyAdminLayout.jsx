import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { subscribeToCompanyThreads } from "../services/anonymousThreadService";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { hrCaseScope } from "../utils/caseVisibility";
import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  Building2,
  Tags,
  BookOpen,
  ClipboardList,
  Scale,
  ShieldAlert,
  CreditCard,
  QrCode,
  UserCircle,
  LogOut,
  Menu,
  X,
  Bell,
  BarChart3,
  FileDown,
  ClipboardCheck,
  Inbox,
  HelpCircle,
  LayoutList,
  Route as RouteIcon,
} from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import Logo from "./brand/Logo";

const CompanyAdminLayout = ({ children }) => {
  const { t } = useTranslation();
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasUnreadThreads, setHasUnreadThreads] = useState(false);
  const [hasUnreadHRPosts, setHasUnreadHRPosts] = useState(false);

  useEffect(() => {
    if (
      !userData?.companyId ||
      (userData.role !== "hr" && userData.role !== "company_admin")
    ) {
      return;
    }
    const unsubscribe = subscribeToCompanyThreads(userData.companyId, (threads) => {
      setHasUnreadThreads(threads.some((t) => t.unreadCount > 0));
    });
    return () => unsubscribe();
  }, [userData?.companyId, userData?.role]);

  // Listen for unread HR-only posts (open status with no admin comments)
  useEffect(() => {
    if (
      !userData?.companyId ||
      (userData.role !== "hr" && userData.role !== "company_admin")
    ) {
      return;
    }
    const q = query(
      collection(db, "posts"),
      where("companyId", "==", userData.companyId),
      where("privacyLevel", "==", "hr_only"),
      where("status", "==", "open"),
      ...hrCaseScope(userData.role)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasUnreadHRPosts(snapshot.size > 0);
    }, () => setHasUnreadHRPosts(false));
    return () => unsubscribe();
  }, [userData?.companyId, userData?.role]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

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

  const handleNavigate = (path) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    navigate(path);
  };

  const isActive = (path) => location.pathname === path;

  const roleLabel =
    userData?.role === "company_admin" ? "Admin" : userData?.role === "hr" ? "HR" : "";

  const initial = userData?.displayName?.charAt(0)?.toUpperCase() || "U";

  const isHR = userData?.role === "hr";

  // Navigation sections for the sidebar
  const navSections = [
    {
      id: "main",
      items: [
        ...(!isHR ? [{ label: t("navigation.dashboard", "Dashboard"), path: "/company/dashboard", icon: LayoutDashboard }] : []),
        ...(!isHR ? [{ label: t("navigation.analytics", "Analytics"), path: "/company/analytics", icon: BarChart3 }] : []),
      ],
    },
    {
      id: "content",
      title: t("navigation.content", "Content"),
      items: [
        { label: t("navigation.caseOverview", "Case Overview"), path: "/hr/case-overview", icon: LayoutList },
        { label: t("navigation.hrInbox", "HR Inbox"), path: "/hr/inbox", icon: Inbox, badge: hasUnreadHRPosts },
        { label: t("navigation.assignedToMe", "Assigned"), path: "/assigned-to-me", icon: ClipboardCheck },
        { label: t("navigation.conversations", "Conversations"), path: "/hr/conversations", icon: MessagesSquare, badge: hasUnreadThreads },
      ],
    },
    // Management section - hidden for HR role
    ...(!isHR ? [{
      id: "management",
      title: t("navigation.management", "Management"),
      items: [
        { label: t("navigation.members", "Members"), path: "/company/members", icon: Users },
        { label: t("navigation.departments", "Departments"), path: "/company/departments", icon: Building2 },
        { label: t("navigation.tags", "Tags"), path: "/company/tag-management", icon: Tags },
      ],
    }] : []),
    {
      id: "compliance",
      title: t("navigation.compliance", "Compliance"),
      items: [
        { label: t("navigation.policies", "Policies"), path: "/company/policies", icon: BookOpen },
        { label: t("navigation.auditLog", "Audit Log"), path: "/company/audit-log", icon: ClipboardList },
        ...(!isHR ? [{ label: t("navigation.auditExport", "Audit Export"), path: "/company/audit-export", icon: FileDown }] : []),
        ...(!isHR ? [{ label: t("navigation.legalRequests", "Legal Requests"), path: "/company/legal-requests", icon: Scale }] : []),
        { label: t("navigation.vendorRisk", "Vendor Risk"), path: "/hr/vendor-risk", icon: ShieldAlert },
      ],
    },
    {
      id: "settings",
      title: t("navigation.settings", "Settings"),
      items: [
        ...(!isHR ? [{ label: t("navigation.billing", "Billing"), path: "/company/billing", icon: CreditCard }] : []),
        ...(!isHR ? [{ label: t("navigation.qrCode", "QR Code"), path: "/company/qr-code", icon: QrCode }] : []),
        ...(!isHR ? [{ label: t("navigation.routingRules", "Routing rules"), path: "/company/routing-rules", icon: RouteIcon }] : []),
        { label: t("navigation.profile", "Profile"), path: "/company/profile", icon: UserCircle },
        { label: t("navigation.help", "Help & Instructions"), path: "/help", icon: HelpCircle },
      ],
    },
  ];

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <button
        key={item.path}
        onClick={() => handleNavigate(item.path)}
        aria-current={active ? "page" : undefined}
        className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors duration-150 ${
          active
            ? "bg-brand-50 text-brand-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-ink"
        }`}
      >
        <Icon
          size={17}
          strokeWidth={active ? 2.25 : 1.9}
          className={active ? "text-brand-600" : "text-gray-400 group-hover:text-gray-600"}
        />
        <span className="flex-1 truncate text-left">{item.label}</span>
        {item.badge && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
        )}
      </button>
    );
  };

  const renderSection = (section) => {
    if (section.id === "main") {
      return (
        <div key={section.id} className="mb-4 space-y-0.5">
          {section.items.map(renderNavItem)}
        </div>
      );
    }

    return (
      <div key={section.id} className="mb-4">
        <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          {section.title}
        </p>
        <div className="space-y-0.5">{section.items.map(renderNavItem)}</div>
      </div>
    );
  };

  // Mobile bottom nav
  const mobileBottomTabs = isHR
    ? [
        { id: "inbox", label: "Inbox", path: "/hr/inbox", icon: Inbox, badge: hasUnreadHRPosts },
        { id: "conversations", label: "Chats", path: "/hr/conversations", icon: MessagesSquare, badge: hasUnreadThreads },
        { id: "help", label: "Help", path: "/help", icon: HelpCircle },
        { id: "more", label: "More", path: null, icon: Menu, action: () => setSidebarOpen(true) },
      ]
    : [
        { id: "dashboard", label: "Dashboard", path: "/company/dashboard", icon: LayoutDashboard },
        { id: "inbox", label: "Inbox", path: "/hr/inbox", icon: Inbox, badge: hasUnreadHRPosts },
        { id: "conversations", label: "Chats", path: "/hr/conversations", icon: MessagesSquare, badge: hasUnreadThreads },
        { id: "help", label: "Help", path: "/help", icon: HelpCircle },
        { id: "more", label: "More", path: null, icon: Menu, action: () => setSidebarOpen(true) },
      ];

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex h-16 flex-shrink-0 items-center px-5">
        <button
          onClick={() => handleNavigate("/company/dashboard")}
          className="rounded-lg"
          aria-label="VoxWel home"
        >
          <Logo size={30} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-3 pt-1">
        {navSections.map(renderSection)}
      </nav>

      {/* Account */}
      <div className="flex-shrink-0 border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{userData?.displayName}</p>
            {roleLabel && (
              <p className="text-xs font-medium text-brand-600">{roleLabel}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            disabled={loading}
            title={t("auth.logout", "Logout")}
            aria-label={t("auth.logout", "Logout")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background-page">
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-64 flex-col border-r border-gray-200/70 bg-background-white lg:flex">
        {sidebarContent}
      </aside>

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="animate-slide-in fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-background-white shadow-xl lg:hidden">
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-ink"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* ── TOP HEADER ── */}
      <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/80 backdrop-blur-md lg:ml-64">
        <div className="flex h-14 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <button
              className="flex items-center lg:hidden"
              onClick={() => handleNavigate("/company/dashboard")}
              aria-label="VoxWel home"
            >
              <Logo size={26} />
            </button>
            <h2 className="hidden text-[15px] font-semibold text-ink lg:block">
              {getPageTitle(location.pathname, t)}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <button
              onClick={() => handleNavigate("/company/notifications")}
              aria-label={t("navigation.notifications", "Notifications")}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-ink"
            >
              <Bell size={18} />
            </button>
            <button
              className="ml-1 hidden items-center gap-2 rounded-full border-l border-gray-200 py-1 pl-3 pr-1 lg:flex"
              onClick={() => handleNavigate("/company/profile")}
            >
              <span className="hidden text-sm font-medium text-gray-700 xl:block">
                {userData?.displayName}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-white">
                {initial}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="min-h-[calc(100vh-56px)] pb-24 lg:ml-64 lg:pb-10">
        <div className="mx-auto w-full max-w-[1280px] px-4 py-5 lg:px-8 lg:py-8">
          {children ?? <Outlet />}
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200/70 bg-white/90 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-16">
          {mobileBottomTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.path && location.pathname === tab.path;

            return (
              <button
                key={tab.id}
                onClick={() => (tab.action ? tab.action() : handleNavigate(tab.path))}
                className="relative flex flex-1 flex-col items-center justify-center gap-1"
              >
                <div
                  className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-brand-100" : ""
                  }`}
                >
                  <Icon size={20} className={active ? "text-brand-700" : "text-gray-400"} />
                  {tab.badge && (
                    <span className="absolute right-2 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium ${
                    active ? "text-brand-700" : "text-gray-400"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

// Helper to get a readable page title from the pathname
function getPageTitle(pathname, t) {
  const titles = {
    "/company/dashboard": t("navigation.dashboard", "Dashboard"),
    "/company/analytics": t("navigation.analytics", "Analytics"),
    "/assigned-to-me": t("navigation.assignedToMe", "Assigned to Me"),
    "/hr/case-overview": t("navigation.caseOverview", "Case Overview"),
    "/hr/inbox": t("navigation.hrInbox", "HR Inbox"),
    "/hr/conversations": t("navigation.conversations", "Conversations"),
    "/company/members": t("navigation.members", "Members"),
    "/company/departments": t("navigation.departments", "Departments"),
    "/company/tag-management": t("navigation.tags", "Tag Management"),
    "/company/policies": t("navigation.policies", "Policy Management"),
    "/company/audit-log": t("navigation.auditLog", "Audit Log"),
    "/company/audit-export": t("navigation.auditExport", "Audit Export"),
    "/company/legal-requests": t("navigation.legalRequests", "Legal Requests"),
    "/hr/vendor-risk": t("navigation.vendorRisk", "Vendor Risk"),
    "/company/billing": t("navigation.billing", "Billing"),
    "/company/qr-code": t("navigation.qrCode", "QR Code"),
    "/company/routing-rules": t("navigation.routingRules", "Routing rules"),
    "/company/profile": t("navigation.profile", "Profile"),
    "/help": t("navigation.help", "Help & Instructions"),
  };
  return titles[pathname] || "VoxWel Admin";
}

export default CompanyAdminLayout;
