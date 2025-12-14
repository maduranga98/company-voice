import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { UserRole } from "../../utils/constants";
import { getDepartments } from "../../services/departmentservice";
import DepartmentAssignment from "../../components/DepartmentAssignment";

const MemberManagementWithDepartments = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [assigningUser, setAssigningUser] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [viewingMember, setViewingMember] = useState(null);
  const [showMemberDetailsModal, setShowMemberDetailsModal] = useState(false);

  useEffect(() => {
    if (!userData?.companyId) {
      navigate("/dashboard");
      return;
    }

    if (
      userData.role !== UserRole.COMPANY_ADMIN &&
      userData.role !== UserRole.HR
    ) {
      navigate("/dashboard");
      return;
    }

    loadData();
  }, [userData, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load departments
      const depts = await getDepartments(userData.companyId, false);
      setDepartments(depts);

      // Load members
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("companyId", "==", userData.companyId));
      const snapshot = await getDocs(q);

      const membersData = [];
      snapshot.forEach((doc) => {
        const memberData = { id: doc.id, ...doc.data() };

        // Find department info
        const dept = depts.find((d) => d.id === memberData.departmentId);
        if (dept) {
          memberData.departmentName = dept.name;
          memberData.departmentIcon = dept.icon;
        }

        membersData.push(memberData);
      });

      // Sort by role hierarchy then by name
      const roleOrder = {
        [UserRole.COMPANY_ADMIN]: 1,
        [UserRole.HR]: 2,
        [UserRole.EMPLOYEE]: 3,
      };

      membersData.sort((a, b) => {
        if (a.role !== b.role) {
          return (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
        }
        return (a.displayName || "").localeCompare(b.displayName || "");
      });

      setMembers(membersData);
    } catch (error) {
      console.error("Error loading data:", error);
      alert("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveMember = async (memberId) => {
    if (!confirm("Are you sure you want to approve this member?")) {
      return;
    }

    try {
      const memberRef = doc(db, "users", memberId);
      await updateDoc(memberRef, {
        status: "active",
        updatedAt: serverTimestamp(),
      });

      alert("Member approved successfully!");
      loadData();
    } catch (error) {
      console.error("Error approving member:", error);
      alert("Failed to approve member");
    }
  };

  const handleRejectMember = async (memberId) => {
    if (
      !confirm(
        "Are you sure you want to reject this member? This will permanently delete their account."
      )
    ) {
      return;
    }

    try {
      const memberRef = doc(db, "users", memberId);
      await deleteDoc(memberRef);

      alert("Member rejected and removed successfully!");
      loadData();
    } catch (error) {
      console.error("Error rejecting member:", error);
      alert("Failed to reject member");
    }
  };

  const handleSuspendMember = async (memberId) => {
    if (!confirm("Are you sure you want to suspend this member?")) {
      return;
    }

    try {
      const memberRef = doc(db, "users", memberId);
      await updateDoc(memberRef, {
        status: "suspended",
        updatedAt: serverTimestamp(),
      });

      alert("Member suspended successfully!");
      loadData();
    } catch (error) {
      console.error("Error suspending member:", error);
      alert("Failed to suspend member");
    }
  };

  const handleReactivateMember = async (memberId) => {
    try {
      const memberRef = doc(db, "users", memberId);
      await updateDoc(memberRef, {
        status: "active",
        updatedAt: serverTimestamp(),
      });

      alert("Member reactivated successfully!");
      loadData();
    } catch (error) {
      console.error("Error reactivating member:", error);
      alert("Failed to reactivate member");
    }
  };

  const handleDeleteMember = async (memberId, memberName) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete ${memberName}? This action cannot be undone and will remove all their data.`
      )
    ) {
      return;
    }

    // Double confirmation for extra safety
    if (
      !confirm(
        "FINAL WARNING: This will permanently delete this member's account and all associated data. Are you absolutely sure?"
      )
    ) {
      return;
    }

    try {
      const memberRef = doc(db, "users", memberId);
      await deleteDoc(memberRef);

      alert("Member deleted successfully!");
      loadData();
    } catch (error) {
      console.error("Error deleting member:", error);
      alert("Failed to delete member");
    }
  };

  const handleViewMemberDetails = (member) => {
    setViewingMember(member);
    setShowMemberDetailsModal(true);
  };

  const handleAssignToDepartment = (user) => {
    setAssigningUser(user);
    setSelectedUsers([]);
    setBulkMode(false);
    setShowDepartmentModal(true);
  };

  const handleBulkAssignToDepartment = () => {
    if (selectedUsers.length === 0) {
      alert("Please select users to assign to a department");
      return;
    }

    const users = members.filter((m) => selectedUsers.includes(m.id));
    setAssigningUser(users);
    setBulkMode(true);
    setShowDepartmentModal(true);
  };

  const handleDepartmentAssignmentSuccess = () => {
    setShowDepartmentModal(false);
    setSelectedUsers([]);
    setAssigningUser(null);
    setBulkMode(false);
    loadData();
    alert("Department assignment successful!");
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredMembers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredMembers.map((m) => m.id));
    }
  };

  const getFilteredMembers = () => {
    return members.filter((member) => {
      // Search filter
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          member.displayName?.toLowerCase().includes(search) ||
          member.email?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Role filter
      if (selectedRole !== "all" && member.role !== selectedRole) {
        return false;
      }

      // Department filter
      if (selectedDepartment !== "all") {
        if (selectedDepartment === "unassigned") {
          if (member.departmentId) return false;
        } else {
          if (member.departmentId !== selectedDepartment) return false;
        }
      }

      // Status filter
      if (selectedStatus !== "all" && member.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      [UserRole.COMPANY_ADMIN]: {
        label: "Admin",
        className: "bg-blue-100 text-blue-800",
      },
      [UserRole.HR]: {
        label: "HR",
        className: "bg-green-100 text-green-800",
      },
      [UserRole.EMPLOYEE]: {
        label: "Employee",
        className: "bg-gray-100 text-gray-800",
      },
    };
    const config = roleConfig[role] || roleConfig[UserRole.EMPLOYEE];
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}
      >
        {config.label}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: {
        label: "Active",
        className: "bg-green-100 text-green-800",
      },
      pending: {
        label: "Pending",
        className: "bg-yellow-100 text-yellow-800",
      },
      suspended: {
        label: "Suspended",
        className: "bg-red-100 text-red-800",
      },
    };
    const config = statusConfig[status] || statusConfig.active;
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}
      >
        {config.label}
      </span>
    );
  };

  const filteredMembers = getFilteredMembers();

  if (loading && members.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Member Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your team members and department assignments
            </p>
          </div>
          <div className="flex gap-3">
            {selectedUsers.length > 0 && (
              <button
                onClick={handleBulkAssignToDepartment}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Assign {selectedUsers.length} to Department
              </button>
            )}
            <button
              onClick={() => navigate("/company/departments")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              Manage Departments
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">Total Members</p>
            <p className="text-2xl font-bold text-gray-900">{members.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">Active</p>
            <p className="text-2xl font-bold text-green-600">
              {members.filter((m) => m.status === "active").length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {members.filter((m) => m.status === "pending").length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">Departments</p>
            <p className="text-2xl font-bold text-blue-600">
              {departments.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">Unassigned</p>
            <p className="text-2xl font-bold text-gray-600">
              {members.filter((m) => !m.departmentId).length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                placeholder="Name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value={UserRole.COMPANY_ADMIN}>Admin</option>
                <option value={UserRole.HR}>HR</option>
                <option value={UserRole.EMPLOYEE}>Employee</option>
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Departments</option>
                <option value="unassigned">Unassigned</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.icon} {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedRole("all");
                  setSelectedDepartment("all");
                  setSelectedStatus("all");
                  setSelectedUsers([]);
                }}
                className="w-full px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            Showing <strong>{filteredMembers.length}</strong> of{" "}
            <strong>{members.length}</strong> members
            {selectedUsers.length > 0 && (
              <span className="ml-4 text-blue-600">
                • <strong>{selectedUsers.length}</strong> selected
              </span>
            )}
          </div>
        </div>

        {/* Members Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        filteredMembers.length > 0 &&
                        selectedUsers.length === filteredMembers.length
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="hidden md:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="hidden lg:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden xl:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(member.id)}
                        onChange={() => handleSelectUser(member.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                            {member.displayName?.charAt(0).toUpperCase() || "U"}
                          </div>
                        </div>
                        <div className="ml-3 min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {member.displayName || "Unknown"}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {member.email}
                          </div>
                          {/* Show department and role on mobile */}
                          <div className="md:hidden mt-1 flex flex-wrap gap-2">
                            {member.departmentName && (
                              <span className="text-xs text-gray-600 flex items-center gap-1">
                                <span>{member.departmentIcon}</span>
                                {member.departmentName}
                              </span>
                            )}
                            <span className="lg:hidden">{getRoleBadge(member.role)}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                      {member.departmentName ? (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{member.departmentIcon}</span>
                          <span className="text-sm text-gray-900">
                            {member.departmentName}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAssignToDepartment(member)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          + Assign
                        </button>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(member.role)}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(member.status)}
                    </td>
                    <td className="hidden xl:table-cell px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.createdAt?.toDate
                        ? member.createdAt.toDate().toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {member.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleApproveMember(member.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Approve"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleRejectMember(member.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Reject"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </button>
                        </>
                      )}

                      {member.status === "active" && (
                        <>
                          <button
                            onClick={() => handleViewMemberDetails(member)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="View Details"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleAssignToDepartment(member)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Change Department"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleSuspendMember(member.id)}
                            className="text-yellow-600 hover:text-yellow-900"
                            title="Deactivate (Suspend)"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id, member.displayName)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Permanently"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </>
                      )}

                      {member.status === "suspended" && (
                        <>
                          <button
                            onClick={() => handleViewMemberDetails(member)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="View Details"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleReactivateMember(member.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Reactivate"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id, member.displayName)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Permanently"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredMembers.length === 0 && (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No members found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ||
                selectedRole !== "all" ||
                selectedDepartment !== "all" ||
                selectedStatus !== "all"
                  ? "Try adjusting your filters"
                  : "No members in your company yet"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Department Assignment Modal */}
      {showDepartmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <DepartmentAssignment
              users={assigningUser}
              companyId={userData.companyId}
              mode={bulkMode ? "bulk" : "single"}
              onSuccess={handleDepartmentAssignmentSuccess}
              onClose={() => {
                setShowDepartmentModal(false);
                setAssigningUser(null);
                setBulkMode(false);
                setSelectedUsers([]);
              }}
            />
          </div>
        </div>
      )}

      {/* Member Details Modal */}
      {showMemberDetailsModal && viewingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Member Details</h2>
                <button
                  onClick={() => {
                    setShowMemberDetailsModal(false);
                    setViewingMember(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Member Info Grid */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Display Name</label>
                    <p className="mt-1 text-base text-gray-900">{viewingMember.displayName || "N/A"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Email</label>
                    <p className="mt-1 text-base text-gray-900">{viewingMember.email || "N/A"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Role</label>
                    <p className="mt-1 text-base text-gray-900 capitalize">{viewingMember.role || "N/A"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Status</label>
                    <div className="mt-1">{getStatusBadge(viewingMember.status)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Department</label>
                    <p className="mt-1 text-base text-gray-900">
                      {viewingMember.departmentIcon && <span className="mr-1">{viewingMember.departmentIcon}</span>}
                      {viewingMember.departmentName || "Not assigned"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Employee ID</label>
                    <p className="mt-1 text-base text-gray-900">{viewingMember.employeeId || "N/A"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">User ID</label>
                    <p className="mt-1 text-xs text-gray-700 font-mono break-all">{viewingMember.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Company ID</label>
                    <p className="mt-1 text-xs text-gray-700 font-mono break-all">{viewingMember.companyId || "N/A"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Joined Date</label>
                    <p className="mt-1 text-base text-gray-900">
                      {viewingMember.createdAt?.toDate
                        ? viewingMember.createdAt.toDate().toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Last Login</label>
                    <p className="mt-1 text-base text-gray-900">
                      {viewingMember.lastLogin?.toDate
                        ? viewingMember.lastLogin.toDate().toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                </div>

                {viewingMember.userTagId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600">User Tag</label>
                    <p className="mt-1 text-base text-gray-900">{viewingMember.userTagId}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowMemberDetailsModal(false);
                    setViewingMember(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberManagementWithDepartments;
