import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
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
  writeBatch,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { UserRole } from "../../utils/constants";
import {
  getDepartments,
  assignUserToDepartment,
} from "../../services/departmentservice";
import { showSuccess, showError, showWarning } from "../../services/toastService";

const MemberManagement = () => {
  const { t } = useTranslation();
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
  const [showRoleModal, setShowRoleModal] = useState(false);
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
      showError(t('company.failedToLoadData'));
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTag = async (tagId, member = null) => {
    const targetMember = member || selectedMember;
    try {
      setLoading(true);
      const memberRef = doc(db, "users", targetMember.id);
      await updateDoc(memberRef, {
        userTagId: tagId,
      });

      showSuccess(tagId ? t('company.tagAssigned') : t('company.tagRemoved', 'Tag removed successfully'));
      setShowTagModal(false);
      setSelectedMember(null);
      loadData();
    } catch (error) {
      console.error("Error assigning tag:", error);
      showError(t('company.failedToAssignTag'));
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDepartment = async (departmentId, member = null) => {
    const targetMember = member || selectedMember;
    try {
      setLoading(true);
      if (departmentId) {
        await assignUserToDepartment(targetMember.id, departmentId);
      } else {
        // Remove from department
        const memberRef = doc(db, "users", targetMember.id);
        await updateDoc(memberRef, {
          departmentId: null,
          updatedAt: serverTimestamp(),
        });
      }

      showSuccess(departmentId ? t('company.departmentAssigned') : t('company.departmentRemoved', 'Department removed successfully'));
      setShowDepartmentModal(false);
      setSelectedMember(null);
      loadData();
    } catch (error) {
      console.error("Error assigning department:", error);
      showError(t('company.failedToAssignDepartment'));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveMember = async (memberId) => {
    if (!confirm(t('company.confirmApproveMember'))) {
      return;
    }

    try {
      setLoading(true);
      const memberRef = doc(db, "users", memberId);
      await updateDoc(memberRef, {
        status: "active",
        updatedAt: serverTimestamp(),
      });

      showSuccess(t('company.memberApproved'));
      // Reset filter so approved members are visible in "all" view
      setSelectedStatus("all");
      loadData();
    } catch (error) {
      console.error("Error approving member:", error);
      showError(t('company.failedToApproveMember'));
    } finally {
      setLoading(false);
    }
  };

  const handleRejectMember = async (memberId) => {
    if (
      !confirm(t('company.confirmRejectMember'))
    ) {
      return;
    }

    try {
      setLoading(true);
      const memberRef = doc(db, "users", memberId);
      await deleteDoc(memberRef);

      showSuccess(t('company.memberRejected'));
      loadData();
    } catch (error) {
      console.error("Error rejecting member:", error);
      showError(t('company.failedToRejectMember'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (member) => {
    if (!confirm(t('company.confirmRemoveMember', `Remove ${member.displayName} from the company? Their posts will be attributed to "Former Employee".`))) {
      return;
    }

    try {
      setLoading(true);
      const batch = writeBatch(db);

      // Re-attribute posts to "Former Employee"
      const postsQuery = query(
        collection(db, "posts"),
        where("authorId", "==", member.id),
        where("companyId", "==", userData.companyId)
      );
      const postsSnapshot = await getDocs(postsQuery);
      postsSnapshot.forEach((postDoc) => {
        batch.update(postDoc.ref, {
          authorName: "Former Employee",
          isFormerEmployee: true,
          updatedAt: serverTimestamp(),
        });
      });

      // Deactivate the user
      batch.update(doc(db, "users", member.id), {
        status: "removed",
        removedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      showSuccess(t('company.memberRemoved', 'Member removed successfully'));
      loadData();
    } catch (error) {
      console.error("Error removing member:", error);
      showError(t('company.failedToRemoveMember', 'Failed to remove member'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (newRole) => {
    if (!selectedMember) return;
    if (selectedMember.role === newRole) {
      setShowRoleModal(false);
      setSelectedMember(null);
      return;
    }

    try {
      setLoading(true);
      const memberRef = doc(db, "users", selectedMember.id);
      await updateDoc(memberRef, {
        role: newRole,
        updatedAt: serverTimestamp(),
      });

      const roleLabelMap = {
        [UserRole.COMPANY_ADMIN]: t('company.roleAdmin'),
        [UserRole.HR]: t('company.roleHR'),
        [UserRole.EMPLOYEE]: t('company.roleEmployee'),
      };
      const roleLabel = roleLabelMap[newRole] || newRole;
      showSuccess(t('company.roleChanged', `Role changed to ${roleLabel}`));
      setShowRoleModal(false);
      setSelectedMember(null);
      loadData();
    } catch (error) {
      console.error("Error changing role:", error);
      showError(t('company.failedToChangeRole', 'Failed to change role'));
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
          {t('common.back')}
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              {t('company.memberManagementTitle')}
            </h1>
            <p className="text-gray-600 text-sm lg:text-base">
              {t('company.memberManagementDesc')}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => navigate("/company/tag-management")}
              className="px-3 lg:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 text-sm"
            >
              <svg
                className="w-4 h-4 lg:w-5 lg:h-5"
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
              <span className="hidden sm:inline">{t('company.manageTags')}</span>
              <span className="sm:hidden">{t('company.tag')}</span>
            </button>
            <button
              onClick={() => navigate("/company/departments")}
              className="px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm"
            >
              <svg
                className="w-4 h-4 lg:w-5 lg:h-5"
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
              <span className="hidden sm:inline">{t('company.manageDepartments')}</span>
              <span className="sm:hidden">{t('company.dept')}</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600">{t('company.totalMembers')}</p>
            <p className="text-2xl font-bold text-gray-900">{members.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600">{t('company.activeMembers')}</p>
            <p className="text-2xl font-bold text-green-600">
              {members.filter((m) => m.status === "active").length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-yellow-200">
            <p className="text-sm text-gray-600">{t('company.pendingApprovals')}</p>
            <p className="text-2xl font-bold text-yellow-600">
              {members.filter((m) => m.status === "pending").length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600">{t('company.taggedMembers')}</p>
            <p className="text-2xl font-bold text-indigo-600">
              {members.filter((m) => m.userTagId).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600">{t('company.inDepartments')}</p>
            <p className="text-2xl font-bold text-blue-600">
              {members.filter((m) => m.departmentId).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600">{t('company.departmentTitle')}</p>
            <p className="text-2xl font-bold text-purple-600">
              {departments.length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.search')}
            </label>
            <input
              type="text"
              placeholder={t('company.searchByNameOrEmail')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Role Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('company.role')}
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('company.allRoles')}</option>
              <option value={UserRole.COMPANY_ADMIN}>{t('company.roleAdmin')}</option>
              <option value={UserRole.HR}>{t('company.roleHR')}</option>
              <option value={UserRole.EMPLOYEE}>{t('company.roleEmployee')}</option>
            </select>
          </div>

          {/* Tag Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('company.tag')}
            </label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('company.allTags')}</option>
              <option value="untagged">{t('company.untagged')}</option>
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
              {t('company.department')}
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('company.allDepartments')}</option>
              <option value="unassigned">{t('company.unassigned')}</option>
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
              {t('company.status')}
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('company.allStatus')}</option>
              <option value="active">{t('company.statusActive')}</option>
              <option value="pending">{t('company.pendingApprovals')}</option>
            </select>
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          {t('company.showing')} <strong>{filteredMembers.length}</strong> {t('company.of')}{" "}
          <strong>{members.length}</strong> {t('company.membersLower')}
        </div>
      </div>

      {/* Members List */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <p className="text-gray-600">
            {t('company.noMembers')}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('company.memberColumn')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('company.emailColumn')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('company.role')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('company.tag')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('company.department')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('company.actions')}
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
                                ? t('company.pendingApprovals')
                                : t('company.statusActive')}
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
                        <div className="inline-flex items-center gap-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${
                              getColorClasses(memberTag.color).bgClass
                            } ${getColorClasses(memberTag.color).textClass}`}
                          >
                            <span className="mr-1">{memberTag.icon}</span>
                            {memberTag.name}
                          </span>
                          <button
                            onClick={() => {
                              if (confirm(t('company.confirmRemoveTag', `Remove tag "${memberTag.name}" from ${member.displayName}?`))) {
                                handleAssignTag(null, member);
                              }
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                            title={t('company.removeTag')}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          {t('company.notTagged')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {memberDepartment ? (
                        <div className="inline-flex items-center gap-1">
                          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            <span className="mr-1">{memberDepartment.icon}</span>
                            {memberDepartment.name}
                          </span>
                          <button
                            onClick={() => {
                              if (confirm(t('company.confirmRemoveDepartment', `Remove ${member.displayName} from "${memberDepartment.name}" department?`))) {
                                handleAssignDepartment(null, member);
                              }
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                            title={t('company.removeFromDepartment')}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          {t('company.noDepartment')}
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
                            {t('company.approve')}
                          </button>
                          <button
                            onClick={() => handleRejectMember(member.id)}
                            className="text-red-600 hover:text-red-800 font-medium px-3 py-1 border border-red-300 rounded-lg hover:bg-red-50"
                          >
                            {t('company.reject')}
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
                            {memberTag ? t('company.tag') : t('company.assignTag')}
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowDepartmentModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {memberDepartment ? t('company.dept') : t('company.assignDept')}
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowRoleModal(true);
                            }}
                            className="text-purple-600 hover:text-purple-800 font-medium"
                          >
                            {t('company.changeRole', 'Role')}
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => handleRemoveMember(member)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            {t('company.removeMember', 'Remove')}
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
                {t('company.assignTagTo')} {selectedMember.displayName}
              </h2>

              {tags.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    {t('company.noTagsAvailable')}
                  </p>
                  <button
                    onClick={() => navigate("/company/tag-management")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {t('company.goToTagManagement')}
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
                      {t('company.removeTag')}
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
                            {t('company.priority')}: {tag.priority}
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
                  {t('common.cancel')}
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
                {t('company.assignDepartmentTo')} {selectedMember.displayName}
              </h2>

              {departments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    {t('company.noDepartmentsAvailable')}
                  </p>
                  <button
                    onClick={() => navigate("/company/departments")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {t('company.goToDepartmentManagement')}
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
                      {t('company.removeFromDepartment')}
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
                          {dept.memberCount || 0} {t('company.membersLower')}
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
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {showRoleModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {t('company.changeRoleTitle', 'Change Role')}
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                {t('company.changeRoleFor', `Change role for ${selectedMember.displayName}`)}
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => handleChangeRole(UserRole.COMPANY_ADMIN)}
                  className={`w-full p-4 text-left border-2 rounded-lg hover:border-blue-300 transition ${
                    selectedMember.role === UserRole.COMPANY_ADMIN
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {t('company.roleAdmin')}
                        </span>
                        {selectedMember.role === UserRole.COMPANY_ADMIN && (
                          <span className="text-xs text-blue-600 font-medium">{t('company.currentRole', '(Current)')}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {t('company.adminRoleDesc', 'Full access to manage company, members, departments, and settings')}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </button>

                <button
                  onClick={() => handleChangeRole(UserRole.HR)}
                  className={`w-full p-4 text-left border-2 rounded-lg hover:border-green-300 transition ${
                    selectedMember.role === UserRole.HR
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                          {t('company.roleHR')}
                        </span>
                        {selectedMember.role === UserRole.HR && (
                          <span className="text-xs text-blue-600 font-medium">{t('company.currentRole', '(Current)')}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {t('company.hrRoleDesc', 'Access to HR-only posts, manage reports, and handle employee relations')}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </button>

                <button
                  onClick={() => handleChangeRole(UserRole.EMPLOYEE)}
                  className={`w-full p-4 text-left border-2 rounded-lg hover:border-gray-400 transition ${
                    selectedMember.role === UserRole.EMPLOYEE
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {t('company.roleEmployee')}
                        </span>
                        {selectedMember.role === UserRole.EMPLOYEE && (
                          <span className="text-xs text-blue-600 font-medium">{t('company.currentRole', '(Current)')}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {t('company.employeeRoleDesc', 'Standard access to submit posts and participate in discussions')}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </button>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => {
                    setShowRoleModal(false);
                    setSelectedMember(null);
                  }}
                  className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  {t('common.cancel')}
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
