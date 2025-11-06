import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { UserRole } from "../../utils/constants";
import {
  getDepartments,
  assignUserToDepartment,
} from "../../services/departmentservice";

const MemberManagement = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [tags, setTags] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showTagModal, setShowTagModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Check URL params for filter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get("filter");
    if (filterParam === "pending") {
      setSelectedStatus("pending");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [userData]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load members
      const usersRef = collection(db, "users");
      const usersQuery = query(
        usersRef,
        where("companyId", "==", userData.companyId)
      );
      const usersSnapshot = await getDocs(usersQuery);

      const membersData = [];
      usersSnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        membersData.push(data);
      });

      // Sort by role, then by name
      membersData.sort((a, b) => {
        const roleOrder = {
          [UserRole.COMPANY_ADMIN]: 1,
          [UserRole.HR]: 2,
          [UserRole.EMPLOYEE]: 3,
        };
        if (roleOrder[a.role] !== roleOrder[b.role]) {
          return (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
        }
        return (a.displayName || "").localeCompare(b.displayName || "");
      });

      setMembers(membersData);

      // Load tags
      const tagsRef = collection(db, "userTags");
      const tagsQuery = query(
        tagsRef,
        where("companyId", "==", userData.companyId)
      );
      const tagsSnapshot = await getDocs(tagsQuery);

      const tagsData = [];
      tagsSnapshot.forEach((doc) => {
        tagsData.push({ id: doc.id, ...doc.data() });
      });

      // Sort by priority
      tagsData.sort((a, b) => b.priority - a.priority);
      setTags(tagsData);

      // Load departments
      const departmentsData = await getDepartments(userData.companyId);
      setDepartments(departmentsData);
    } catch (error) {
      console.error("Error loading data:", error);
      alert("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTag = async (tagId) => {
    try {
      setLoading(true);
      const memberRef = doc(db, "users", selectedMember.id);
      await updateDoc(memberRef, {
        userTagId: tagId,
      });

      alert("Tag assigned successfully!");
      setShowTagModal(false);
      setSelectedMember(null);
      loadData();
    } catch (error) {
      console.error("Error assigning tag:", error);
      alert("Failed to assign tag");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDepartment = async (departmentId) => {
    try {
      setLoading(true);
      if (departmentId) {
        await assignUserToDepartment(selectedMember.id, departmentId);
      } else {
        // Remove from department
        const memberRef = doc(db, "users", selectedMember.id);
        await updateDoc(memberRef, {
          departmentId: null,
          updatedAt: serverTimestamp(),
        });
      }

      alert("Department assigned successfully!");
      setShowDepartmentModal(false);
      setSelectedMember(null);
      loadData();
    } catch (error) {
      console.error("Error assigning department:", error);
      alert("Failed to assign department");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveMember = async (memberId) => {
    if (!confirm("Are you sure you want to approve this member?")) {
      return;
    }

    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
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
      setLoading(true);
      const memberRef = doc(db, "users", memberId);
      await deleteDoc(memberRef);

      alert("Member rejected and removed successfully!");
      loadData();
    } catch (error) {
      console.error("Error rejecting member:", error);
      alert("Failed to reject member");
    } finally {
      setLoading(false);
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

      // Tag filter
      if (selectedTag !== "all") {
        if (selectedTag === "untagged") {
          if (member.userTagId) return false;
        } else {
          if (member.userTagId !== selectedTag) return false;
        }
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

  const getMemberTag = (member) => {
    if (!member.userTagId) return null;
    return tags.find((tag) => tag.id === member.userTagId);
  };

  const getMemberDepartment = (member) => {
    if (!member.departmentId) return null;
    return departments.find((dept) => dept.id === member.departmentId);
  };

  const getColorClasses = (color) => {
    const colorMap = {
      purple: { bgClass: "bg-purple-100", textClass: "text-purple-800" },
      blue: { bgClass: "bg-blue-100", textClass: "text-blue-800" },
      indigo: { bgClass: "bg-indigo-100", textClass: "text-indigo-800" },
      green: { bgClass: "bg-green-100", textClass: "text-green-800" },
      yellow: { bgClass: "bg-yellow-100", textClass: "text-yellow-800" },
      red: { bgClass: "bg-red-100", textClass: "text-red-800" },
      gray: { bgClass: "bg-gray-100", textClass: "text-gray-800" },
    };
    return colorMap[color] || colorMap.gray;
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      [UserRole.COMPANY_ADMIN]: {
        label: "Admin",
        classes: "bg-blue-100 text-blue-800",
      },
      [UserRole.HR]: { label: "HR", classes: "bg-green-100 text-green-800" },
      [UserRole.EMPLOYEE]: {
        label: "Employee",
        classes: "bg-gray-100 text-gray-800",
      },
    };
    const config = roleConfig[role] || roleConfig[UserRole.EMPLOYEE];
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.classes}`}
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
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
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
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Member Management
            </h1>
            <p className="text-gray-600">
              Manage team members, assign tags and departments
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/company/tag-management")}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
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
                  strokeWidth="2"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              Manage Tags
            </button>
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
                  strokeWidth="2"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              Manage Departments
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Total Members</p>
            <p className="text-2xl font-bold text-gray-900">{members.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Active Members</p>
            <p className="text-2xl font-bold text-green-600">
              {members.filter((m) => m.status === "active").length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-yellow-200">
            <p className="text-sm text-gray-600">Pending Approval</p>
            <p className="text-2xl font-bold text-yellow-600">
              {members.filter((m) => m.status === "pending").length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Tagged Members</p>
            <p className="text-2xl font-bold text-indigo-600">
              {members.filter((m) => m.userTagId).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600">In Departments</p>
            <p className="text-2xl font-bold text-blue-600">
              {members.filter((m) => m.departmentId).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Departments</p>
            <p className="text-2xl font-bold text-purple-600">
              {departments.length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Search by name or email..."
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

          {/* Tag Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tag
            </label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Tags</option>
              <option value="untagged">Untagged</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.icon} {tag.name}
                </option>
              ))}
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
              <option value="pending">Pending Approval</option>
            </select>
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Showing <strong>{filteredMembers.length}</strong> of{" "}
          <strong>{members.length}</strong> members
        </div>
      </div>

      {/* Members List */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <p className="text-gray-600">
            No members found matching your filters
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tag
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMembers.map((member) => {
                const memberTag = getMemberTag(member);
                const memberDepartment = getMemberDepartment(member);
                return (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div
                          className={`w-10 h-10 ${
                            member.status === "pending"
                              ? "bg-yellow-500"
                              : "bg-blue-600"
                          } rounded-full flex items-center justify-center text-white font-medium flex-shrink-0`}
                        >
                          {member.displayName?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {member.displayName || "Unnamed"}
                          </div>
                          <div className="text-xs">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                member.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {member.status === "pending"
                                ? "Pending Approval"
                                : "Active"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {member.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(member.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {memberTag ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${
                            getColorClasses(memberTag.color).bgClass
                          } ${getColorClasses(memberTag.color).textClass}`}
                        >
                          <span className="mr-1">{memberTag.icon}</span>
                          {memberTag.name}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          Not tagged
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {memberDepartment ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          <span className="mr-1">{memberDepartment.icon}</span>
                          {memberDepartment.name}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          No department
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {member.status === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveMember(member.id)}
                            className="text-green-600 hover:text-green-800 font-medium px-3 py-1 border border-green-300 rounded-lg hover:bg-green-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectMember(member.id)}
                            className="text-red-600 hover:text-red-800 font-medium px-3 py-1 border border-red-300 rounded-lg hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowTagModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            {memberTag ? "Tag" : "Assign Tag"}
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowDepartmentModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {memberDepartment ? "Dept" : "Assign Dept"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Tag Modal */}
      {showTagModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Assign Tag to {selectedMember.displayName}
              </h2>

              {tags.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    No tags available. Create tags first.
                  </p>
                  <button
                    onClick={() => navigate("/company/tag-management")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Go to Tag Management
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {/* Remove Tag Option */}
                  <button
                    onClick={() => handleAssignTag(null)}
                    className="w-full p-3 text-left border-2 border-gray-200 rounded-lg hover:border-gray-400 transition"
                  >
                    <span className="text-sm font-medium text-gray-600">
                      Remove Tag
                    </span>
                  </button>

                  {tags.map((tag) => {
                    const colorClasses = getColorClasses(tag.color);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleAssignTag(tag.id)}
                        className={`w-full p-3 text-left border-2 rounded-lg hover:border-gray-800 transition ${
                          selectedMember.userTagId === tag.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className={`inline-flex items-center px-2.5 py-1 rounded ${colorClasses.bgClass} ${colorClasses.textClass}`}
                          >
                            <span className="text-lg mr-2">{tag.icon}</span>
                            <span className="font-semibold">{tag.name}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            Priority: {tag.priority}
                          </span>
                        </div>
                        {tag.description && (
                          <p className="text-xs text-gray-600 mt-1">
                            {tag.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-6">
                <button
                  onClick={() => {
                    setShowTagModal(false);
                    setSelectedMember(null);
                  }}
                  className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Department Modal */}
      {showDepartmentModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Assign Department to {selectedMember.displayName}
              </h2>

              {departments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    No departments available. Create departments first.
                  </p>
                  <button
                    onClick={() => navigate("/company/departments")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Go to Department Management
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {/* Remove Department Option */}
                  <button
                    onClick={() => handleAssignDepartment(null)}
                    className="w-full p-3 text-left border-2 border-gray-200 rounded-lg hover:border-gray-400 transition"
                  >
                    <span className="text-sm font-medium text-gray-600">
                      Remove from Department
                    </span>
                  </button>

                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => handleAssignDepartment(dept.id)}
                      className={`w-full p-3 text-left border-2 rounded-lg hover:border-blue-300 transition ${
                        selectedMember.departmentId === dept.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center px-2.5 py-1 rounded bg-blue-100 text-blue-800">
                          <span className="text-lg mr-2">{dept.icon}</span>
                          <span className="font-semibold">{dept.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {dept.memberCount || 0} members
                        </span>
                      </div>
                      {dept.description && (
                        <p className="text-xs text-gray-600 mt-1">
                          {dept.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-6">
                <button
                  onClick={() => {
                    setShowDepartmentModal(false);
                    setSelectedMember(null);
                  }}
                  className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberManagement;
