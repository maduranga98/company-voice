import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../config/firebase";
import { doc, updateDoc } from "firebase/firestore";

const Profile = () => {
  const { userData, currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: "",
    email: "",
    role: "",
    companyId: "",
    status: "",
    lastLogin: null,
  });
  const [editData, setEditData] = useState({
    displayName: "",
    email: "",
  });

  useEffect(() => {
    if (userData) {
      setProfileData({
        displayName: userData.displayName || "",
        email: userData.email || "",
        role: userData.role || "",
        companyId: userData.companyId || "",
        status: userData.status || "",
        lastLogin: userData.lastLogin || null,
      });
      setEditData({
        displayName: userData.displayName || "",
        email: userData.email || "",
      });
    }
  }, [userData]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const userRef = doc(db, "users", userData.id);
      await updateDoc(userRef, {
        displayName: editData.displayName,
        email: editData.email,
      });

      setProfileData({
        ...profileData,
        displayName: editData.displayName,
        email: editData.email,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
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

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "super_admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "company_admin":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "hr":
        return "bg-green-100 text-green-800 border-green-200";
      case "employee":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatRole = (role) => {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Never";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      return "Invalid date";
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Profile
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your personal information and account settings
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Banner */}
          <div className="h-32 bg-linear-to-r from-purple-600 via-blue-600 to-indigo-600"></div>

          {/* Profile Content */}
          <div className="px-6 pb-6">
            {/* Avatar and Name */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-16 mb-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-4xl font-bold">
                    {profileData.displayName
                      ? profileData.displayName.charAt(0).toUpperCase()
                      : "U"}
                  </div>
                </div>
              </div>

              <div className="mt-4 sm:mt-0 sm:ml-6 flex-1 text-center sm:text-left">
                <h2 className="text-2xl font-bold text-gray-900">
                  {profileData.displayName}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getRoleBadgeColor(
                      profileData.role
                    )}`}
                  >
                    {formatRole(profileData.role)}
                  </span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                      profileData.status === "active"
                        ? "bg-green-100 text-green-800 border-green-200"
                        : "bg-yellow-100 text-yellow-800 border-yellow-200"
                    }`}
                  >
                    {profileData.status.charAt(0).toUpperCase() +
                      profileData.status.slice(1)}
                  </span>
                </div>
              </div>

              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit Profile
                </button>
              )}
            </div>

            {/* Profile Information */}
            <div className="border-t border-gray-200 pt-6">
              <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {/* Display Name */}
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Display Name
                  </dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.displayName}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          displayName: e.target.value,
                        })
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                    />
                  ) : (
                    <dd className="mt-1 text-sm text-gray-900">
                      {profileData.displayName}
                    </dd>
                  )}
                </div>

                {/* Email */}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) =>
                        setEditData({ ...editData, email: e.target.value })
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                    />
                  ) : (
                    <dd className="mt-1 text-sm text-gray-900">
                      {profileData.email}
                    </dd>
                  )}
                </div>

                {/* Role */}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Role</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatRole(profileData.role)}
                  </dd>
                </div>

                {/* Company ID */}
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Company ID
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    {profileData.companyId}
                  </dd>
                </div>

                {/* Last Login */}
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">
                    Last Login
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(profileData.lastLogin)}
                  </dd>
                </div>
              </dl>

              {/* Action Buttons */}
              {isEditing && (
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Account Information
          </h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-gray-400 mt-0.5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Account Status
                </p>
                <p className="text-sm text-gray-500">
                  Your account is currently{" "}
                  <span className="font-medium text-green-600">
                    {profileData.status}
                  </span>
                  .
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-gray-400 mt-0.5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">Security</p>
                <p className="text-sm text-gray-500">
                  To change your password, please contact your administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
