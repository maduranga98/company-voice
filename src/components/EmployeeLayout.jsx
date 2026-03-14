import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../config/firebase";
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from "firebase/firestore";
import {
  Home,
  Plus,
  Shield,
  UserCircle,
  Bell,
  Lightbulb,
  AlertTriangle,
  MessageSquare,
  X,
  ClipboardList,
  ClipboardCheck,
  ShieldAlert,
  HelpCircle,
  BookOpen,
  ChevronRight,
} from "lucide-react";

const EmployeeLayout = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showLangSheet, setShowLangSheet] = useState(false);
  const [showPostSheet, setShowPostSheet] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Detect active wall from pathname
  const getActiveWall = () => {
    if (location.pathname.includes("/feed/creative")) return "creative";
    if (location.pathname.includes("/feed/problems")) return "problems";
    if (location.pathname.includes("/feed/discussions")) return "discussions";
    return null;
  };
  const activeWall = getActiveWall();

  const isOnFeed = location.pathname.startsWith("/feed");
  const isWallsActive = location.pathname.startsWith("/feed");
  const isMessagesActive = location.pathname.startsWith("/messages");
  const isProfileActive = location.pathname === "/employee/profile";
  const isMyPostsActive = location.pathname === "/my-posts";
  const isAssignedActive = location.pathname === "/assigned-to-me";

  // Language badge code
  const getLangCode = () => {
    const lang = i18n.language || "en";
    if (lang.startsWith("si")) return "SI";
    if (lang.startsWith("es")) return "ES";
    if (lang.startsWith("fr")) return "FR";
    return "EN";
  };

  // Real-time unread notification count
  useEffect(() => {
    if (!userData?.id) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userData.id),
      where("read", "==", false)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => setUnreadNotifCount(snap.size),
      () => {}
    );
    return () => unsubscribe();
  }, [userData?.id]);

  // Unread messages count
  useEffect(() => {
    if (!userData?.id || !userData?.companyId) return;

    const fetchUnreadCount = async () => {
      try {
        const postsQuery = query(
          collection(db, "posts"),
          where("companyId", "==", userData.companyId),
          where("authorId", "==", userData.id),
          where("isAnonymous", "==", true)
        );
        const postsSnap = await getDocs(postsQuery);

        let total = 0;
        for (const postDoc of postsSnap.docs) {
          const threadDoc = await getDoc(doc(db, "anonymousThreads", postDoc.id));
          if (!threadDoc.exists()) continue;
          const data = threadDoc.data();
          const messages = data.messages || [];
          const lastReadByReporter = data.lastReadBy?.reporter || null;
          const lastReadTime = lastReadByReporter?.toDate
            ? lastReadByReporter.toDate()
            : lastReadByReporter
              ? new Date(lastReadByReporter)
              : null;
          const unread = messages.filter((m) => {
            if (m.sender !== "investigator") return false;
            if (!lastReadTime) return true;
            const msgTime = m.timestamp?.toDate
              ? m.timestamp.toDate()
              : new Date(m.timestamp);
            return msgTime > lastReadTime;
          });
          total += unread.length;
        }
        setUnreadCount(total);
      } catch (err) {
        console.error("Error fetching unread count:", err);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [userData?.id, userData?.companyId]);

  const handleNavigate = (path) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    navigate(path);
  };

  const handleWallNav = (wall) => {
    localStorage.setItem("lastWall", wall);
    handleNavigate(`/feed/${wall}`);
  };

  const handleWallsNav = () => {
    const lastWall = localStorage.getItem("lastWall") || "creative";
    handleNavigate(`/feed/${lastWall}`);
  };

  const languages = [
    { code: "en", badge: "EN", flag: "🇬🇧", name: "English", native: "English" },
    { code: "si", badge: "SI", flag: "🇱🇰", name: "Sinhala", native: "සිංහල" },
    { code: "es", badge: "ES", flag: "🇪🇸", name: "Spanish", native: "Español" },
    { code: "fr", badge: "FR", flag: "🇫🇷", name: "French", native: "Français" },
  ];

  const wallTabs = [
    { id: "creative", label: t("navigation.creative"), icon: Lightbulb, color: "#a855f7" },
    { id: "problems", label: t("navigation.problems"), icon: AlertTriangle, color: "#ef4444" },
    { id: "discussions", label: t("navigation.discussions"), icon: MessageSquare, color: "#3b82f6" },
  ];

  const postSheetCards = [
    {
      label: t("post.reportProblem", "Report a problem"),
      sub: t("post.reportProblemSub", "Issue, safety concern"),
      icon: AlertTriangle,
      color: "#ef4444",
      bgColor: "#fef2f2",
      onClick: () => { handleNavigate("/feed/problems"); setShowPostSheet(false); },
    },
    {
      label: t("post.startDiscussion", "Start discussion"),
      sub: t("post.startDiscussionSub", "Team conversation"),
      icon: MessageSquare,
      color: "#3b82f6",
      bgColor: "#eff6ff",
      onClick: () => { handleNavigate("/feed/discussions"); setShowPostSheet(false); },
    },
    {
      label: t("post.creativeWall", "Creative wall"),
      sub: t("post.creativeWallSub", "Ideas, designs"),
      icon: Lightbulb,
      color: "#a855f7",
      bgColor: "#fdf4ff",
      onClick: () => { handleNavigate("/feed/creative"); setShowPostSheet(false); },
    },
  ];

  // Quick links shown in profile or accessible areas
  const quickLinks = [
    ...(userData?.userTagId ? [{ label: t("navigation.assignedToMe", "Assigned to Me"), path: "/assigned-to-me", icon: ClipboardCheck }] : []),
    { label: t("navigation.myPosts", "My Posts"), path: "/my-posts", icon: ClipboardList },
    { label: t("navigation.policies", "Policies"), path: "/policies", icon: BookOpen },
    { label: t("navigation.help", "Help"), path: "/help", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* ── TOP HEADER ── */}
      <header className="sticky top-0 z-50 bg-[#2D3E50]">
        {/* Main row */}
        <div className="flex items-center justify-between px-4 h-14 md:h-16 md:ml-60">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            onClick={() => handleNavigate("/feed/creative")}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-[#1ABC9C] rounded-xl blur-md opacity-0 group-hover:opacity-30 transition-opacity" />
              <img src="/voxwel-logo.png" alt="VoxWel" className="w-8 h-8 object-contain rounded-lg relative" />
            </div>
            <span className="text-lg font-bold text-[#1ABC9C]">VoxWel</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Language badge */}
            <button
              onClick={() => setShowLangSheet(true)}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.08] border border-[#1ABC9C]/30 text-[#1ABC9C] text-[11px] font-bold hover:bg-white/[0.12] transition-colors"
            >
              {getLangCode()}
            </button>
            {/* Notification bell */}
            <button
              onClick={() => handleNavigate("/notifications")}
              className="relative w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.12] transition-colors"
            >
              <Bell size={16} className="text-white/70" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#FF6B6B] rounded-full border-2 border-[#2D3E50]" />
              )}
            </button>
          </div>
        </div>

        {/* Wall tabs — only on /feed routes */}
        {isOnFeed && (
          <div className="flex gap-1.5 px-4 pb-3 pt-1 md:ml-60">
            {wallTabs.map((tab) => {
              const isActive = activeWall === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleWallNav(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-[#1ABC9C] shadow-lg shadow-[#1ABC9C]/20"
                      : "bg-white/[0.08] border border-white/[0.08] hover:bg-white/[0.12]"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-white" : "text-white/40"} />
                  <span
                    className={`text-[12px] font-semibold tracking-wide ${
                      isActive ? "text-white" : "text-white/40"
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Quick links bar — shows on non-feed pages for easy access */}
        {!isOnFeed && !isMessagesActive && !isProfileActive && (
          <div className="flex gap-2 px-4 pb-3 pt-1 md:ml-60 overflow-x-auto scrollbar-thin">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              const active = location.pathname === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => handleNavigate(link.path)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                    active
                      ? "bg-[#1ABC9C] text-white"
                      : "bg-white/[0.08] text-white/50 hover:bg-white/[0.12] hover:text-white/70"
                  }`}
                >
                  <Icon size={12} />
                  {link.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── DESKTOP SIDEBAR ── */}
      <div className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-gray-200/80 z-40 flex-col shadow-sm">
        {/* Sidebar header */}
        <div
          className="h-16 flex items-center gap-2.5 px-5 bg-[#2D3E50] cursor-pointer select-none flex-shrink-0 group"
          onClick={() => handleNavigate("/feed/creative")}
        >
          <img src="/voxwel-logo.png" alt="VoxWel" className="w-8 h-8 object-contain rounded-lg" />
          <span className="text-lg font-bold text-[#1ABC9C] group-hover:text-[#16a085] transition-colors">VoxWel</span>
        </div>

        {/* Language selector */}
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] text-gray-700 bg-white transition-all"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Nav items */}
        <nav className="px-3 py-3 flex-1 overflow-y-auto min-h-0 space-y-0.5">
          {/* Walls section */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2">
            {t("navigation.walls", "Walls")}
          </p>
          {[
            { id: "creative", label: t("navigation.creative"), icon: Lightbulb },
            { id: "problems", label: t("navigation.problems"), icon: AlertTriangle },
            { id: "discussions", label: t("navigation.discussions"), icon: MessageSquare },
          ].map((wall) => {
            const Icon = wall.icon;
            const active = activeWall === wall.id;
            return (
              <button
                key={wall.id}
                onClick={() => handleWallNav(wall.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  active
                    ? "bg-[#1ABC9C]/10 text-[#1ABC9C]"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                }`}
              >
                <Icon size={16} className={active ? "text-[#1ABC9C]" : "text-gray-400"} />
                {wall.label}
              </button>
            );
          })}

          {/* Main nav */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2">
              {t("navigation.menu", "Menu")}
            </p>
          </div>

          {/* Messages */}
          <button
            onClick={() => handleNavigate("/messages")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
              isMessagesActive ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Shield size={16} className={isMessagesActive ? "text-[#1ABC9C]" : "text-gray-400"} />
            <span className="flex-1 text-left">{t("navigation.messages", "Messages")}</span>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 bg-[#FF6B6B] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* My Posts */}
          <button
            onClick={() => handleNavigate("/my-posts")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
              isMyPostsActive ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ClipboardList size={16} className={isMyPostsActive ? "text-[#1ABC9C]" : "text-gray-400"} />
            {t("navigation.myPosts", "My Posts")}
          </button>

          {/* Assigned to Me (if applicable) */}
          {userData?.userTagId && (
            <button
              onClick={() => handleNavigate("/assigned-to-me")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                isAssignedActive ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <ClipboardCheck size={16} className={isAssignedActive ? "text-[#1ABC9C]" : "text-gray-400"} />
              {t("navigation.assignedToMe", "Assigned to Me")}
            </button>
          )}

          {/* Profile */}
          <button
            onClick={() => handleNavigate("/employee/profile")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
              isProfileActive ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <UserCircle size={16} className={isProfileActive ? "text-[#1ABC9C]" : "text-gray-400"} />
            {t("navigation.profile")}
          </button>

          {/* Divider for secondary items */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2">
              {t("navigation.more", "More")}
            </p>
          </div>

          {/* Policies */}
          <button
            onClick={() => handleNavigate("/policies")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
              location.pathname === "/policies" ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <BookOpen size={16} className={location.pathname === "/policies" ? "text-[#1ABC9C]" : "text-gray-400"} />
            {t("navigation.policies", "Policies")}
          </button>

          {/* Help */}
          <button
            onClick={() => handleNavigate("/help")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
              location.pathname.startsWith("/help") ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <HelpCircle size={16} className={location.pathname.startsWith("/help") ? "text-[#1ABC9C]" : "text-gray-400"} />
            {t("navigation.help", "Help")}
          </button>

          {/* Vendor Risk */}
          <button
            onClick={() => handleNavigate("/vendor-risk")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
              location.pathname === "/vendor-risk" ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ShieldAlert size={16} className={location.pathname === "/vendor-risk" ? "text-[#1ABC9C]" : "text-gray-400"} />
            {t("navigation.vendorRisk", "Report Vendor Concern")}
          </button>
        </nav>

        {/* Create Post at bottom */}
        <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={() => setShowPostSheet(true)}
            className="w-full py-3 bg-[#1ABC9C] text-white text-sm font-semibold rounded-xl hover:bg-[#17a589] active:bg-[#148f77] transition-colors shadow-lg shadow-[#1ABC9C]/20 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            {t("post.create", "Create Post")}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="bg-[#f8f9fb] pb-20 md:pb-6 md:ml-60">
        {children ?? <Outlet />}
      </main>

      {/* ── BOTTOM NAVIGATION (mobile only) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-16">
          {/* Walls */}
          <button
            onClick={handleWallsNav}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
          >
            {isWallsActive && (
              <div className="absolute top-0 left-2 right-2 h-[2.5px] bg-[#1ABC9C] rounded-b-full" />
            )}
            <Home size={22} className={isWallsActive ? "text-[#1ABC9C]" : "text-gray-400"} />
            <span className={`text-[10px] font-medium ${isWallsActive ? "text-[#1ABC9C]" : "text-gray-400"}`}>
              {t("navigation.walls", "Walls")}
            </span>
          </button>

          {/* Post (FAB) */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <button
              onClick={() => setShowPostSheet(!showPostSheet)}
              className="flex items-center justify-center rounded-2xl transition-all duration-200 active:scale-95"
              style={{
                width: "48px",
                height: "48px",
                marginTop: "-16px",
                backgroundColor: showPostSheet ? "#374151" : "#1ABC9C",
                boxShadow: showPostSheet ? "none" : "0 4px 20px rgba(26,188,156,0.4)",
              }}
            >
              {showPostSheet ? (
                <X size={20} className="text-white" />
              ) : (
                <Plus size={22} className="text-white" />
              )}
            </button>
            <span className="text-[10px] text-gray-400 mt-0.5 font-medium">
              {t("navigation.post", "Post")}
            </span>
          </div>

          {/* Messages */}
          <button
            onClick={() => handleNavigate("/messages")}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
          >
            {isMessagesActive && (
              <div className="absolute top-0 left-2 right-2 h-[2.5px] bg-[#1ABC9C] rounded-b-full" />
            )}
            <div className="relative">
              <Shield size={22} className={isMessagesActive ? "text-[#1ABC9C]" : "text-gray-400"} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] bg-[#FF6B6B] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-medium ${isMessagesActive ? "text-[#1ABC9C]" : "text-gray-400"}`}>
              {t("navigation.messages", "Messages")}
            </span>
          </button>

          {/* Profile */}
          <button
            onClick={() => handleNavigate("/employee/profile")}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
          >
            {isProfileActive && (
              <div className="absolute top-0 left-2 right-2 h-[2.5px] bg-[#1ABC9C] rounded-b-full" />
            )}
            <UserCircle size={22} className={isProfileActive ? "text-[#1ABC9C]" : "text-gray-400"} />
            <span className={`text-[10px] font-medium ${isProfileActive ? "text-[#1ABC9C]" : "text-gray-400"}`}>
              {t("navigation.profile")}
            </span>
          </button>
        </div>
      </nav>

      {/* ── LANGUAGE SHEET ── */}
      {showLangSheet && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setShowLangSheet(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 animate-slide-in"
            style={{ paddingBottom: "env(safe-area-inset-bottom)", animationName: "slideUp" }}
          >
            <div className="flex justify-center mt-3 mb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[15px] font-semibold text-gray-800">
                {t("language.chooseLanguage", "Choose language")}
              </p>
              <button
                onClick={() => setShowLangSheet(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
              >
                <X size={14} />
              </button>
            </div>
            <div className="py-2">
              {languages.map((lang) => {
                const isCurrentLang = (i18n.language || "en").startsWith(lang.code);
                return (
                  <button
                    key={lang.code}
                    onClick={() => { i18n.changeLanguage(lang.code); setShowLangSheet(false); }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                      {lang.flag}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-[13px] font-semibold text-gray-800">{lang.name}</div>
                      <div className="text-[11px] text-gray-400">{lang.native}</div>
                    </div>
                    {isCurrentLang && (
                      <div className="w-5 h-5 rounded-full bg-[#1ABC9C] flex items-center justify-center flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── POST SHEET ── */}
      {showPostSheet && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setShowPostSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-2xl">
            <div className="flex justify-center mt-3">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="px-5 pt-4 pb-2">
              <h3 className="text-[15px] font-semibold text-gray-800">
                {t("post.whatToShare", "What do you want to share?")}
              </h3>
              <p className="text-[12px] text-gray-400 mt-0.5">
                {t("post.chooseType", "Choose a type to get started")}
              </p>
            </div>

            {/* Post type cards */}
            <div className="px-4 pb-3 space-y-2">
              {postSheetCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <button
                    key={i}
                    onClick={card.onClick}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-200 active:scale-[0.98] transition-all text-left group"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: card.bgColor }}
                    >
                      <Icon size={22} style={{ color: card.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-gray-800">{card.label}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{card.sub}</div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                  </button>
                );
              })}

              {/* Vendor Risk card */}
              <button
                onClick={() => { handleNavigate("/vendor-risk"); setShowPostSheet(false); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-200 active:scale-[0.98] transition-all text-left group"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-50">
                  <ShieldAlert size={22} className="text-orange-500" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-gray-800">
                    {t("post.vendorConcern", "Report Vendor Concern")}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {t("post.vendorConcernSub", "Flag a supplier or third-party issue")}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
              </button>
            </div>

            {/* Anonymous toggle */}
            <div className="mx-4 mb-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#1ABC9C] rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield size={16} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="text-[12px] font-semibold text-gray-800">
                  {t("post.postAnonymously", "Post anonymously")}
                </div>
                <div className="text-[10px] text-[#15803d] font-medium">
                  {t("post.anonymousDefault", "ON by default · name encrypted")}
                </div>
              </div>
              <div
                className="rounded-full flex items-center justify-end px-0.5 flex-shrink-0"
                style={{ width: "40px", height: "22px", backgroundColor: "#1ABC9C" }}
              >
                <div className="w-[18px] h-[18px] bg-white rounded-full shadow-sm" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EmployeeLayout;
