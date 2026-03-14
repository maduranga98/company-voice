import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { PostType } from "../utils/constants";

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

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "super_admin": return "bg-red-100 text-red-800 border-red-200";
      case "company_admin": return "bg-blue-100 text-blue-800 border-blue-200";
      case "hr": return "bg-green-100 text-green-800 border-green-200";
      case "employee": return "bg-purple-100 text-purple-800 border-purple-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
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
    {
      label: t("navigation.myPosts", "My Posts"),
      sub: t("profile.viewAllPosts", "View all your posts"),
      path: "/my-posts",
      iconBg: "bg-purple-100",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: t("profile.policyLibrary", "Policy Library"),
      sub: t("profile.viewPolicies", "Company guidelines"),
      path: "/policies",
      iconBg: "bg-teal-100",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: t("navigation.notifications", "Notifications"),
      sub: t("profile.viewNotifications", "Recent alerts"),
      path: "/notifications",
      iconBg: "bg-amber-100",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
    ...(userData?.userTagId
      ? [{
          label: t("navigation.assignedToMe", "Assigned to Me"),
          sub: t("profile.viewAssigned", "Tasks assigned to you"),
          path: "/assigned-to-me",
          iconBg: "bg-blue-100",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        }]
      : []),
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pb-24">
      {/* ── HEADER SECTION ── */}
      <div className="bg-white rounded-b-2xl shadow-sm mb-4">
        {/* Navy gradient banner */}
        <div
          className="h-24 rounded-none"
          style={{ background: "linear-gradient(to right, #2D3E50, #1e3a4a)" }}
        />

        {/* Avatar */}
        <div className="flex flex-col items-center -mt-9">
          <div
            className="w-[72px] h-[72px] rounded-full border-4 border-white shadow-md flex items-center justify-center text-white text-2xl font-bold"
            style={{ background: "linear-gradient(135deg, #1ABC9C, #16a085)" }}
          >
            {initial}
          </div>
        </div>

        {/* Name */}
        <div className="text-center mt-3 px-4">
          <h2 className="text-lg font-bold text-gray-900">{profileData.displayName}</h2>
          <div className="flex gap-2 justify-center mt-2 mb-4">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(profileData.role)}`}>
              {formatRole(profileData.role)}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
              profileData.status === "active" ? "bg-green-100 text-green-800 border-green-200" : "bg-yellow-100 text-yellow-800 border-yellow-200"
            }`}>
              {profileData.status ? profileData.status.charAt(0).toUpperCase() + profileData.status.slice(1) : ""}
            </span>
          </div>
        </div>

        {/* Edit Profile / Save / Cancel buttons */}
        <div className="px-4 pb-4">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t("profile.editProfile", "Edit Profile")}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-[#1ABC9C] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#17a589] disabled:opacity-50 transition-colors"
              >
                {loading ? t("profile.saving", "Saving...") : t("profile.saveChanges", "Save Changes")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── ACCOUNT INFORMATION ── */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t("profile.accountInformation", "Account Information")}
        </h3>
        <div className="space-y-0">
          {[
            {
              label: t("profile.displayName", "Display Name"),
              value: profileData.displayName,
              editable: true,
              field: "displayName",
            },
            {
              label: t("profile.email", "Email"),
              value: profileData.email,
              editable: true,
              field: "email",
              type: "email",
            },
            {
              label: t("profile.username", "Username"),
              value: profileData.username,
              editable: false,
            },
            {
              label: t("profile.role", "Role"),
              value: formatRole(profileData.role),
              editable: false,
            },
            {
              label: t("profile.companyId", "Company ID"),
              value: profileData.companyId,
              editable: false,
              mono: true,
            },
            {
              label: t("profile.status", "Status"),
              value: profileData.status
                ? profileData.status.charAt(0).toUpperCase() + profileData.status.slice(1)
                : "",
              editable: false,
            },
            {
              label: t("profile.lastLogin", "Last Login"),
              value: formatDate(profileData.lastLogin),
              editable: false,
            },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              className="flex justify-between items-center py-3"
              style={{ borderBottom: i < arr.length - 1 ? "1px solid #f9fafb" : "none" }}
            >
              <span className="text-sm text-gray-500 flex-shrink-0 mr-4">{row.label}</span>
              {isEditing && row.editable ? (
                <input
                  type={row.type || "text"}
                  value={editData[row.field]}
                  onChange={(e) => setEditData({ ...editData, [row.field]: e.target.value })}
                  className="text-sm font-medium text-gray-900 text-right border-b border-[#1ABC9C] outline-none bg-transparent flex-1 min-w-0"
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

      {/* ── ACTIVITY STATS ── */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t("profile.myActivity", "My Activity")}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t("profile.totalPosts", "Total Posts"), value: stats.total },
            { label: t("profile.problemsReported", "Problems Reported"), value: stats.problems },
            { label: t("profile.ideasShared", "Ideas Shared"), value: stats.ideas },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-[#2D3E50]">{stat.value}</div>
              <div className="text-[10px] text-gray-500 mt-1 leading-tight">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── QUICK LINKS ── */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t("profile.quickLinks", "Quick Links")}
        </h3>
        <div className="space-y-0">
          {quickLinks.map((link, i) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="w-full flex items-center gap-3 py-3 hover:bg-gray-50 active:bg-gray-100 rounded-lg transition-colors"
              style={{ borderBottom: i < quickLinks.length - 1 ? "1px solid #f9fafb" : "none" }}
            >
              <div className={`w-8 h-8 ${link.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                {link.icon}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-gray-900">{link.label}</div>
                <div className="text-[11px] text-gray-400">{link.sub}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* ── DANGER ZONE ── */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <button
          onClick={handleLogout}
          className="w-full border border-red-200 text-red-600 rounded-xl py-3 text-sm font-medium hover:bg-red-50 transition-colors"
        >
          {t("auth.logout", "Sign Out")}
        </button>
      </div>
    </div>
  );
};

export default Profile;
