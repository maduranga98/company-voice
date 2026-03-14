import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../config/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const EmployeeLayout = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showLangSheet, setShowLangSheet] = useState(false);
  const [showPostSheet, setShowPostSheet] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [wallsExpanded, setWallsExpanded] = useState(true);

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
  const isHelpActive = location.pathname.startsWith("/help");

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
    {
      id: "creative",
      label: t("navigation.creative"),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
    },
    {
      id: "problems",
      label: t("navigation.problems"),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      id: "discussions",
      label: t("navigation.discussions"),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
    },
  ];

  const postSheetCards = [
    {
      label: "Report a problem",
      sub: "Issue, safety concern",
      iconBg: "#fef2f2",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      onClick: () => { handleNavigate("/feed/problems"); setShowPostSheet(false); },
    },
    {
      label: "Start discussion",
      sub: "Team conversation",
      iconBg: "#eff6ff",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
      onClick: () => { handleNavigate("/feed/discussions"); setShowPostSheet(false); },
    },
    {
      label: "Creative wall",
      sub: "Ideas, designs",
      iconBg: "#fdf4ff",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
      onClick: () => { handleNavigate("/feed/creative"); setShowPostSheet(false); },
    },
    {
      label: "Share an idea",
      sub: "Innovation, suggestions",
      iconBg: "#f0fdf4",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      onClick: () => { handleNavigate("/feed/creative"); setShowPostSheet(false); },
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── TOP HEADER ── */}
      <header className="sticky top-0 z-50 bg-[#2D3E50] md:ml-64">
        {/* Main row */}
        <div className="flex items-center justify-between px-4 h-12">
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => handleNavigate("/feed/creative")}
          >
            {/* App logo */}
            <img src="/voxwel-logo.png" alt="VoxWel" className="w-7 h-7 object-contain rounded-lg" />
            <span className="text-lg font-bold text-[#1ABC9C]">VoxWel</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Language badge */}
            <button
              onClick={() => setShowLangSheet(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#1ABC9C] text-[#1ABC9C] text-[11px] font-bold"
            >
              {getLangCode()}
            </button>
            {/* Notification bell */}
            <button
              onClick={() => handleNavigate("/notifications")}
              className="relative w-7 h-7 flex items-center justify-center rounded-lg bg-white/10"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadNotifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Wall tabs — only on /feed routes */}
        {isOnFeed && (
          <div className="flex gap-1 px-3 py-2 border-t border-white/10" style={{ backgroundColor: "rgba(0,0,0,0.18)" }}>
            {wallTabs.map((tab) => {
              const isActive = activeWall === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleWallNav(tab.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-full transition-all duration-150"
                  style={{
                    paddingTop: "7px",
                    paddingBottom: "7px",
                    backgroundColor: isActive ? "#1ABC9C" : "rgba(255,255,255,0.08)",
                    border: isActive ? "none" : "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <span style={{ color: isActive ? "white" : "rgba(255,255,255,0.55)" }}>
                    {tab.icon}
                  </span>
                  <span
                    className="text-[12px] font-semibold tracking-wide"
                    style={{ color: isActive ? "white" : "rgba(255,255,255,0.55)" }}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── DESKTOP SIDEBAR ── */}
      <div className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-40 flex-col">
        {/* Sidebar header — same height as top header bar */}
        <div
          className="h-12 flex items-center gap-2.5 px-4 bg-[#2D3E50] cursor-pointer select-none flex-shrink-0"
          onClick={() => handleNavigate("/feed/creative")}
        >
          <img src="/voxwel-logo.png" alt="VoxWel" className="w-7 h-7 object-contain rounded-lg" />
          <span className="text-lg font-bold text-[#1ABC9C]">VoxWel</span>
        </div>

        {/* Language selector */}
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none text-gray-700 bg-white"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Nav items */}
        <nav className="px-2 py-2 flex-1 overflow-y-auto min-h-0">
          {/* Walls (expandable) */}
          <div>
            <button
              onClick={() => setWallsExpanded(!wallsExpanded)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                isWallsActive ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="flex-1 text-left">{t("navigation.walls", "Walls")}</span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${wallsExpanded ? "rotate-90" : ""}`}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            {wallsExpanded && (
              <div className="ml-7 mt-1 space-y-0.5">
                {[
                  { id: "creative", label: t("navigation.creative") },
                  { id: "problems", label: t("navigation.problems") },
                  { id: "discussions", label: t("navigation.discussions") },
                ].map((wall) => (
                  <button
                    key={wall.id}
                    onClick={() => handleWallNav(wall.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm ${
                      activeWall === wall.id
                        ? "bg-[#1ABC9C]/10 text-[#1ABC9C] font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {wall.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          <button
            onClick={() => handleNavigate("/messages")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mt-1 ${
              isMessagesActive ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {t("navigation.messages", "Messages")}
          </button>

          {/* Profile */}
          <button
            onClick={() => handleNavigate("/employee/profile")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mt-1 ${
              isProfileActive ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {t("navigation.profile")}
          </button>

          {/* Help */}
          <button
            onClick={() => handleNavigate("/help")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mt-1 ${
              isHelpActive ? "bg-[#1ABC9C]/10 text-[#1ABC9C]" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            {t("navigation.help", "Help")}
          </button>
        </nav>

        {/* Create Post at bottom */}
        <div className="px-3 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={() => setShowPostSheet(true)}
            className="w-full py-3 bg-[#1ABC9C] text-white text-sm font-semibold rounded-xl hover:bg-[#17a589] active:bg-[#148f77] transition-colors"
          >
            {t("post.create", "Create Post")}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="bg-gray-50 pb-20 md:pb-6 md:ml-64">
        {children ?? <Outlet />}
      </main>

      {/* ── BOTTOM NAVIGATION (mobile only) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-[#2D3E50] z-50"
        style={{ height: "60px", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-full">
          {/* Walls */}
          <button
            onClick={handleWallsNav}
            className="flex-1 flex flex-col items-center justify-center relative"
          >
            {isWallsActive && (
              <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#1ABC9C] rounded-b-[3px]" />
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              stroke={isWallsActive ? "#1ABC9C" : "rgba(255,255,255,0.35)"}>
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span
              className="text-[10px] mt-0.5"
              style={{ color: isWallsActive ? "#1ABC9C" : "rgba(255,255,255,0.35)", fontWeight: isWallsActive ? "600" : "400" }}
            >
              {t("navigation.walls", "Walls")}
            </span>
          </button>

          {/* Post (FAB) */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <button
              onClick={() => setShowPostSheet(!showPostSheet)}
              className="flex items-center justify-center rounded-full"
              style={{
                width: "44px",
                height: "44px",
                marginTop: "-14px",
                backgroundColor: showPostSheet ? "#1e293b" : "#1ABC9C",
                boxShadow: "0 4px 14px rgba(26,188,156,0.5)",
              }}
            >
              {showPostSheet ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
            </button>
            <span className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {t("navigation.post", "Post")}
            </span>
          </div>

          {/* Messages */}
          <button
            onClick={() => handleNavigate("/messages")}
            className="flex-1 flex flex-col items-center justify-center relative"
          >
            {isMessagesActive && (
              <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#1ABC9C] rounded-b-[3px]" />
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              stroke={isMessagesActive ? "#1ABC9C" : "rgba(255,255,255,0.35)"}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span
              className="text-[10px] mt-0.5"
              style={{ color: isMessagesActive ? "#1ABC9C" : "rgba(255,255,255,0.35)", fontWeight: isMessagesActive ? "600" : "400" }}
            >
              {t("navigation.messages", "Messages")}
            </span>
          </button>

          {/* Profile */}
          <button
            onClick={() => handleNavigate("/employee/profile")}
            className="flex-1 flex flex-col items-center justify-center relative"
          >
            {isProfileActive && (
              <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#1ABC9C] rounded-b-[3px]" />
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              stroke={isProfileActive ? "#1ABC9C" : "rgba(255,255,255,0.35)"}>
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span
              className="text-[10px] mt-0.5"
              style={{ color: isProfileActive ? "#1ABC9C" : "rgba(255,255,255,0.35)", fontWeight: isProfileActive ? "600" : "400" }}
            >
              {t("navigation.profile")}
            </span>
          </button>

          {/* Help */}
          <button
            onClick={() => handleNavigate("/help")}
            className="flex-1 flex flex-col items-center justify-center relative"
          >
            {isHelpActive && (
              <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#1ABC9C] rounded-b-[3px]" />
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              stroke={isHelpActive ? "#1ABC9C" : "rgba(255,255,255,0.35)"}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span
              className="text-[10px] mt-0.5"
              style={{ color: isHelpActive ? "#1ABC9C" : "rgba(255,255,255,0.35)", fontWeight: isHelpActive ? "600" : "400" }}
            >
              {t("navigation.help", "Help")}
            </span>
          </button>
        </div>
      </nav>

      {/* ── LANGUAGE SHEET ── */}
      {showLangSheet && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowLangSheet(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center mt-2 mb-1">
              <div className="w-9 bg-gray-200 rounded-full" style={{ height: "3px" }} />
            </div>
            <p className="text-[13px] font-semibold px-4 py-3 border-b border-gray-100">
              {t("language.chooseLanguage", "Choose language")}
            </p>
            {languages.map((lang) => {
              const isCurrentLang = (i18n.language || "en").startsWith(lang.code);
              return (
                <div
                  key={lang.code}
                  onClick={() => { i18n.changeLanguage(lang.code); setShowLangSheet(false); }}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100"
                  style={{ borderBottom: "0.5px solid #f1f5f9" }}
                >
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-base flex-shrink-0">
                    {lang.flag}
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] font-semibold text-gray-800">{lang.name}</div>
                    <div className="text-[9px] text-gray-400">{lang.native}</div>
                  </div>
                  {isCurrentLang && (
                    <div className="w-[18px] h-[18px] rounded-full bg-[#1ABC9C] flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── POST SHEET ── */}
      {showPostSheet && (
        <>
          <div className="fixed inset-0 bg-black/55 z-40" onClick={() => setShowPostSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50">
            <div className="flex justify-center mt-2">
              <div className="w-9 bg-gray-200 rounded-full" style={{ height: "3px" }} />
            </div>
            <p className="text-[13px] font-semibold px-4 pt-2 pb-1">
              {t("post.whatToShare", "What do you want to share?")}
            </p>
            <p className="text-[10px] text-gray-400 px-4 pb-3">
              {t("post.chooseType", "Choose a type to get started")}
            </p>

            {/* 2×2 grid */}
            <div className="grid grid-cols-2 gap-2 px-3 pb-2">
              {postSheetCards.map((card, i) => (
                <button
                  key={i}
                  onClick={card.onClick}
                  className="bg-gray-50 rounded-xl p-3 text-left active:scale-[0.98] transition-transform"
                  style={{ border: "0.5px solid #e2e8f0" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                    style={{ backgroundColor: card.iconBg }}
                  >
                    {card.icon}
                  </div>
                  <div className="text-[10px] font-semibold text-gray-800">{card.label}</div>
                  <div className="text-[8px] text-gray-400 mt-0.5">{card.sub}</div>
                </button>
              ))}
            </div>

            {/* Vendor Risk — full-width card */}
            <div className="px-3 pb-3">
              <button
                onClick={() => { handleNavigate("/vendor-risk"); setShowPostSheet(false); }}
                className="w-full bg-gray-50 rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
                style={{ border: "0.5px solid #e2e8f0" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#fff7ed" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-gray-800">Report Vendor Concern</div>
                  <div className="text-[8px] text-gray-400 mt-0.5">Flag a supplier or third-party issue</div>
                </div>
              </button>
            </div>

            {/* Anonymous toggle (informational, always ON) */}
            <div className="mx-3 mb-3 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-6 h-6 bg-[#1ABC9C] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-gray-800">
                  {t("post.postAnonymously", "Post anonymously")}
                </div>
                <div className="text-[8px] text-green-700">
                  {t("post.anonymousDefault", "ON by default · name encrypted")}
                </div>
              </div>
              <div
                className="rounded-full flex items-center justify-end px-0.5 flex-shrink-0"
                style={{ width: "36px", height: "20px", backgroundColor: "#1ABC9C" }}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EmployeeLayout;
