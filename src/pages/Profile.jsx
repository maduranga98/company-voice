import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { PostType } from "../utils/constants";
import {
  Shield,
  ClipboardList,
  BookOpen,
  ShieldAlert,
  Bell,
  ClipboardCheck,
  ChevronRight,
  LogOut,
  Edit3,
  MessageSquare,
} from "lucide-react";

const Profile = () => {
  const { t } = useTranslation();
  const { userData, currentUser, logout, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: "",
    email: "",
    role: "",
    companyId: "",
    status: "",
    lastLogin: null,
    username: "",
  });
  const [editData, setEditData] = useState({ displayName: "", email: "" });
  const [stats, setStats] = useState({ total: 0, problems: 0, ideas: 0 });

  useEffect(() => {
    if (userData) {
      setProfileData({
        displayName: userData.displayName || "",
        email: userData.email || "",
        role: userData.role || "",
        companyId: userData.companyId || "",
        status: userData.status || "",
        lastLogin: userData.lastLogin || null,
        username: userData.username || "",
      });
      setEditData({
        displayName: userData.displayName || "",
        email: userData.email || "",
      });
      loadStats();
    }
  }, [userData]);

  const loadStats = async () => {
    if (!userData?.id || !userData?.companyId) return;
    try {
      const q = query(
        collection(db, "posts"),
        where("authorId", "==", userData.id),
        where("companyId", "==", userData.companyId)
      );
      const snap = await getDocs(q);
      let problems = 0;
      let ideas = 0;
      snap.forEach((doc) => {
        const d = doc.data();
        if (d.type === PostType.PROBLEM_REPORT) problems++;
        else if (d.type === PostType.IDEA_SUGGESTION) ideas++;
      });
      setStats({ total: snap.size, problems, ideas });
    } catch {
      // ignore stats errors
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const userRef = doc(db, "users", userData.id);
      await updateDoc(userRef, {
        displayName: editData.displayName,
        email: editData.email,
      });
      await refreshUserData();
      setProfileData((prev) => ({
        ...prev,
        displayName: editData.displayName,
        email: editData.email,
      }));
      setIsEditing(false);
      alert(t("profile.updateSuccess", "Profile updated successfully!"));
    } catch (error) {
      console.error("Error updating profile:", error);
      alert(t("profile.updateError", "Failed to update profile. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      displayName: profileData.displayName,
      email: profileData.email,
    });
    setIsEditing(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case "super_admin": return "bg-red-50 text-red-700 border-red-200";
      case "company_admin": return "bg-blue-50 text-blue-700 border-blue-200";
      case "hr": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "employee": return "bg-purple-50 text-purple-700 border-purple-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const formatRole = (role) => {
    if (!role) return "";
    return role.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return t("profile.never", "Never");
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return t("profile.invalidDate", "Invalid date");
    }
  };

  const initial = profileData.displayName?.charAt(0)?.toUpperCase() || "U";

  const quickLinks = [
    { label: "Private Messages", sub: "Anonymous conversations with HR", path: "/messages", icon: MessageSquare, iconColor: "text-teal-600", bg: "bg-teal-50" },
    { label: t("navigation.myPosts", "My Posts"), sub: t("profile.viewAllPosts", "View all your posts"), path: "/my-posts", icon: ClipboardList, iconColor: "text-purple-600", bg: "bg-purple-50" },
    { label: t("profile.policyLibrary", "Policy Library"), sub: t("profile.viewPolicies", "Company guidelines"), path: "/policies", icon: BookOpen, iconColor: "text-cyan-600", bg: "bg-cyan-50" },
    { label: "Report Vendor Risk", sub: "Flag a supplier or third-party issue", path: "/vendor-risk", icon: ShieldAlert, iconColor: "text-orange-600", bg: "bg-orange-50" },
    { label: t("navigation.notifications", "Notifications"), sub: t("profile.viewNotifications", "Recent alerts"), path: "/notifications", icon: Bell, iconColor: "text-amber-600", bg: "bg-amber-50" },
    ...(userData?.userTagId
      ? [{
          label: t("navigation.assignedToMe", "Assigned to Me"),
          sub: t("profile.viewAssigned", "Tasks assigned to you"),
          path: "/assigned-to-me",
          icon: ClipboardCheck,
          iconColor: "text-blue-600",
          bg: "bg-blue-50",
        }]
      : []),
  ];

  const infoRows = [
    { label: t("profile.displayName", "Display Name"), value: profileData.displayName, editable: true, field: "displayName" },
    { label: t("profile.email", "Email"), value: profileData.email, editable: true, field: "email", type: "email" },
    { label: t("profile.username", "Username"), value: profileData.username },
    { label: t("profile.role", "Role"), value: formatRole(profileData.role) },
    { label: t("profile.companyId", "Company ID"), value: profileData.companyId, mono: true },
    { label: t("profile.status", "Status"), value: profileData.status ? profileData.status.charAt(0).toUpperCase() + profileData.status.slice(1) : "" },
    { label: t("profile.lastLogin", "Last Login"), value: formatDate(profileData.lastLogin) },
  ];

  const statCards = [
    { label: t("profile.totalPosts", "Total Posts"), value: stats.total, color: "text-[#1ABC9C]" },
    { label: t("profile.problemsReported", "Problems"), value: stats.problems, color: "text-red-500" },
    { label: t("profile.ideasShared", "Ideas"), value: stats.ideas, color: "text-purple-500" },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-2">
      {/* Profile header card */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
        {/* Gradient banner */}
        <div className="h-28 relative" style={{ background: "linear-gradient(135deg, #2D3E50 0%, #1ABC9C 100%)" }}>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTMwVjBoMjR2NEgzNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center -mt-12 relative z-10">
          <div className="w-[88px] h-[88px] rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-white text-3xl font-bold bg-gradient-to-br from-[#1ABC9C] to-[#16a085]">
            {initial}
          </div>
        </div>

        {/* Name + badges */}
        <div className="text-center mt-3 px-5">
          <h2 className="text-xl font-bold text-gray-900">{profileData.displayName}</h2>
          {profileData.username && (
            <p className="text-sm text-gray-400 mt-0.5">@{profileData.username}</p>
          )}
          <div className="flex gap-2 justify-center mt-3 mb-5">
            <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border ${getRoleBadgeStyle(profileData.role)}`}>
              {formatRole(profileData.role)}
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border ${
              profileData.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              {profileData.status ? profileData.status.charAt(0).toUpperCase() + profileData.status.slice(1) : ""}
            </span>
          </div>
        </div>

        {/* Edit button */}
        <div className="px-5 pb-5">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit3 size={15} />
              {t("profile.editProfile", "Edit Profile")}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-[#1ABC9C] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#17a589] disabled:opacity-50 transition-colors"
              >
                {loading ? t("profile.saving", "Saving...") : t("profile.saveChanges", "Save")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Activity stats */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
          {t("profile.myActivity", "My Activity")}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-gray-50 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] font-medium text-gray-500 mt-1.5 leading-tight">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Account information */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
          {t("profile.accountInformation", "Account Information")}
        </h3>
        <div className="divide-y divide-gray-50">
          {infoRows.map((row) => (
            <div key={row.label} className="flex justify-between items-center py-3.5">
              <span className="text-sm text-gray-500 flex-shrink-0 mr-4">{row.label}</span>
              {isEditing && row.editable ? (
                <input
                  type={row.type || "text"}
                  value={editData[row.field]}
                  onChange={(e) => setEditData({ ...editData, [row.field]: e.target.value })}
                  className="text-sm font-medium text-gray-900 text-right border-b-2 border-[#1ABC9C] outline-none bg-transparent flex-1 min-w-0 py-0.5"
                />
              ) : (
                <span className={`text-sm font-medium text-gray-900 text-right flex-1 min-w-0 truncate ${row.mono ? "font-mono text-xs" : ""}`}>
                  {row.value || "—"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
          {t("profile.quickLinks", "Quick Links")}
        </h3>
        <div className="divide-y divide-gray-50">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="w-full flex items-center gap-3 py-3.5 hover:bg-gray-50 active:bg-gray-100 rounded-xl transition-colors group"
              >
                <div className={`w-9 h-9 ${link.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon size={16} className={link.iconColor} />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-gray-900">{link.label}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{link.sub}</div>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Sign out */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 rounded-xl py-3 text-sm font-medium hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          {t("auth.logout", "Sign Out")}
        </button>
      </div>
    </div>
  );
};

export default Profile;
