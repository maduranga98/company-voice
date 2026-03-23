import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { subscribeToCompanyThreads } from "../services/anonymousThreadService";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  LayoutDashboard,
  Lightbulb,
  AlertTriangle,
  MessageSquare,
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
  ChevronDown,
  ChevronRight,
  Bell,
  BarChart3,
  FileDown,
  ClipboardCheck,
  Shield,
  Inbox,
} from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";

const CompanyAdminLayout = ({ children }) => {
  const { t } = useTranslation();
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasUnreadThreads, setHasUnreadThreads] = useState(false);
  const [hasUnreadHRPosts, setHasUnreadHRPosts] = useState(false);

  // Collapsible section state
  const [expandedSections, setExpandedSections] = useState({
    content: true,
    management: true,
    compliance: false,
    settings: false,
  });

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
      orderBy("createdAt", "desc")
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

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isActive = (path) => location.pathname === path;
  const isActiveGroup = (paths) => paths.some((p) => location.pathname.startsWith(p));

  const getRoleBadge = () => {
    if (userData?.role === "company_admin") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1ABC9C]/15 text-[#1ABC9C] uppercase tracking-wide">
          Admin
        </span>
      );
    } else if (userData?.role === "hr") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 uppercase tracking-wide">
          HR
        </span>
      );
    }
    return null;
  };

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
        { label: t("navigation.hrInbox", "HR Inbox"), path: "/hr/inbox", icon: Inbox, badge: hasUnreadHRPosts },
        { label: t("navigation.creative", "Creative"), path: "/feed/creative", icon: Lightbulb },
        { label: t("navigation.problems", "Problems"), path: "/feed/problems", icon: AlertTriangle },
        { label: t("navigation.discussions", "Discussions"), path: "/feed/discussions", icon: MessageSquare },
        { label: t("navigation.myPosts", "My Posts"), path: "/my-posts", icon: ClipboardList },
        ...(userData?.userTagId ? [{ label: t("navigation.assignedToMe", "Assigned"), path: "/assigned-to-me", icon: ClipboardCheck }] : []),
        { label: t("navigation.conversations", "Conversations"), path: "/hr/conversations", icon: MessagesSquare, badge: hasUnreadThreads },
        { label: t("navigation.moderation", "Moderation"), path: "/moderation", icon: Shield },
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
        { label: t("navigation.profile", "Profile"), path: "/company/profile", icon: UserCircle },
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
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group relative ${
          active
            ? "bg-[#1ABC9C]/10 text-[#1ABC9C]"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#1ABC9C] rounded-r-full" />
        )}
        <Icon size={18} className={active ? "text-[#1ABC9C]" : "text-gray-500 group-hover:text-gray-300"} />
        <span className="flex-1 text-left truncate">{item.label}</span>
        {item.badge && (
          <span className="w-2 h-2 bg-[#FF6B6B] rounded-full animate-pulse" />
        )}
      </button>
    );
  };

  const renderSection = (section) => {
    if (section.id === "main") {
      return (
        <div key={section.id} className="space-y-0.5 mb-2">
          {section.items.map(renderNavItem)}
        </div>
      );
    }

    const isExpanded = expandedSections[section.id];
    const hasActiveItem = section.items.some((item) => isActive(item.path));

    return (
      <div key={section.id} className="mb-1">
        <button
          onClick={() => toggleSection(section.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
            hasActiveItem ? "text-[#1ABC9C]" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>{section.title}</span>
        </button>
        {isExpanded && (
          <div className="space-y-0.5 mt-0.5">
            {section.items.map(renderNavItem)}
          </div>
        )}
      </div>
    );
  };

  // Mobile bottom nav - HR sees Walls, Conversations, Moderation, Profile
  const mobileBottomTabs = isHR
    ? [
        { id: "content", label: "Walls", path: "/feed/creative", icon: MessageSquare, matchPaths: ["/feed/"] },
        { id: "conversations", label: "Chats", path: "/hr/conversations", icon: MessagesSquare, badge: hasUnreadThreads },
        { id: "moderation", label: "Moderation", path: "/moderation", icon: Shield },
        { id: "more", label: "More", path: null, icon: Menu, action: () => setSidebarOpen(true) },
      ]
    : [
        { id: "dashboard", label: "Dashboard", path: "/company/dashboard", icon: LayoutDashboard },
        { id: "content", label: "Walls", path: "/feed/creative", icon: MessageSquare, matchPaths: ["/feed/"] },
        { id: "conversations", label: "Chats", path: "/hr/conversations", icon: MessagesSquare, badge: hasUnreadThreads },
        { id: "more", label: "More", path: null, icon: Menu, action: () => setSidebarOpen(true) },
      ];

  const sidebarContent = (
    <>
      {/* Logo & brand */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.06] flex-shrink-0">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => handleNavigate("/company/dashboard")}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-[#1ABC9C] rounded-xl blur-md opacity-30 group-hover:opacity-50 transition-opacity" />
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center relative">
              <img src="/voxwel-logo.png" alt="VoxWel" className="w-7 h-7 object-contain rounded-lg" />
            </div>
          </div>
          <div>
            <span className="text-lg font-bold text-white group-hover:text-[#1ABC9C] transition-colors">VoxWel</span>
            <p className="text-[10px] text-gray-500 font-medium">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* User card */}
      <div className="px-4 py-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1ABC9C] to-[#16a085] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {userData?.displayName?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{userData?.displayName}</p>
            <div className="mt-1">{getRoleBadge()}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin">
        {navSections.map(renderSection)}
      </nav>

      {/* Logout at bottom */}
      <div className="px-4 py-4 border-t border-white/[0.06] flex-shrink-0">
        <button
          onClick={handleLogout}
          disabled={loading}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut size={18} />
          <span>{loading ? t("common.loading", "Logging out...") : t("auth.logout", "Logout")}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-60 bg-[#1e2530] z-40 flex-col shadow-2xl">
        {sidebarContent}
      </aside>

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      {sidebarOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 h-full w-72 bg-[#1e2530] z-50 flex flex-col shadow-2xl animate-slide-in">
            {/* Close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-gray-400 hover:text-white hover:bg-white/20 transition-all z-10"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* ── TOP HEADER ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200/80 lg:ml-60">
        <div className="flex items-center justify-between h-14 px-4 lg:px-6">
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div
              className="lg:hidden flex items-center gap-2 cursor-pointer"
              onClick={() => handleNavigate("/company/dashboard")}
            >
              <img src="/voxwel-logo.png" alt="VoxWel" className="w-7 h-7 object-contain rounded-lg" />
              <span className="text-base font-bold text-[#2D3E50]">VoxWel</span>
            </div>
          </div>

          {/* Desktop: Page context (breadcrumb-like) */}
          <div className="hidden lg:block">
            <h2 className="text-sm font-semibold text-gray-800">
              {getPageTitle(location.pathname, t)}
            </h2>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={() => handleNavigate("/company/notifications")}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors relative"
            >
              <Bell size={18} />
            </button>
            {/* Desktop user avatar */}
            <div
              className="hidden lg:flex items-center gap-2 pl-3 ml-1 border-l border-gray-200 cursor-pointer"
              onClick={() => handleNavigate("/company/profile")}
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1ABC9C] to-[#16a085] flex items-center justify-center text-white font-bold text-xs">
                {userData?.displayName?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden xl:block">{userData?.displayName}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="lg:ml-60 pb-20 lg:pb-6 min-h-[calc(100vh-56px)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
          {children ?? <Outlet />}
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-16">
          {mobileBottomTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.matchPaths
              ? tab.matchPaths.some((p) => location.pathname.startsWith(p))
              : tab.path && location.pathname === tab.path;

            return (
              <button
                key={tab.id}
                onClick={() => tab.action ? tab.action() : handleNavigate(tab.path)}
                className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors"
              >
                {active && (
                  <div className="absolute top-0 left-2 right-2 h-[2.5px] bg-[#1ABC9C] rounded-b-full" />
                )}
                <div className="relative">
                  <Icon size={22} className={active ? "text-[#1ABC9C]" : "text-gray-400"} />
                  {tab.badge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FF6B6B] rounded-full border-2 border-white" />
                  )}
                </div>
                <span className={`text-[10px] font-medium ${active ? "text-[#1ABC9C]" : "text-gray-400"}`}>
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
    "/feed/creative": t("navigation.creative", "Creative Wall"),
    "/feed/problems": t("navigation.problems", "Problems"),
    "/feed/discussions": t("navigation.discussions", "Discussions"),
    "/my-posts": t("navigation.myPosts", "My Posts"),
    "/assigned-to-me": t("navigation.assignedToMe", "Assigned to Me"),
    "/hr/inbox": t("navigation.hrInbox", "HR Inbox"),
    "/hr/conversations": t("navigation.conversations", "Conversations"),
    "/moderation": t("navigation.moderation", "Moderation"),
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
    "/company/profile": t("navigation.profile", "Profile"),
  };
  return titles[pathname] || "VoxWel Admin";
}

export default CompanyAdminLayout;
