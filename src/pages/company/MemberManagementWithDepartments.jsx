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
import { getDepartments, removeUserFromDepartment } from "../../services/departmentservice";
import DepartmentAssignment from "../../components/DepartmentAssignment";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Building2,
  AlertCircle,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Ban,
  RefreshCw,
  X,
  ChevronLeft,
  UsersRound,
  UserPlus,
  Calendar,
  Hash,
  Building,
  Mail,
  Shield,
  ShieldCheck,
  Tag,
} from "lucide-react";

const MemberManagementWithDepartments = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [tags, setTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagAssigningMember, setTagAssigningMember] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [assigningUser, setAssigningUser] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [viewingMember, setViewingMember] = useState(null);
  const [showMemberDetailsModal, setShowMemberDetailsModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleChangingMember, setRoleChangingMember] = useState(null);

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
      tagsData.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      setTags(tagsData);

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

        // Find tag info
        const tag = tagsData.find((t) => t.id === memberData.userTagId);
        if (tag) {
          memberData.tagName = tag.name;
          memberData.tagIcon = tag.icon;
          memberData.tagColor = tag.color;
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

  const handleAssignTag = async (tagId, member) => {
    try {
      const memberRef = doc(db, "users", member.id);
      await updateDoc(memberRef, {
        userTagId: tagId || null,
        updatedAt: serverTimestamp(),
      });
      alert(tagId ? "Tag assigned successfully!" : "Tag removed successfully!");
      setShowTagModal(false);
      setTagAssigningMember(null);
      loadData();
    } catch (error) {
      console.error("Error assigning tag:", error);
      alert("Failed to assign tag");
    }
  };

  const handleRemoveTag = async (member) => {
    if (!confirm(`Remove tag "${member.tagName}" from ${member.displayName}?`)) {
      return;
    }
    await handleAssignTag(null, member);
  };

  const handleRemoveDepartment = async (member) => {
    if (!confirm(`Remove ${member.displayName} from "${member.departmentName}" department?`)) {
      return;
    }
    try {
      await removeUserFromDepartment(member.id);
      alert("Department removed successfully!");
      loadData();
    } catch (error) {
      console.error("Error removing department:", error);
      alert("Failed to remove department");
    }
  };

  const handleChangeRole = async (newRole, member) => {
    try {
      const memberRef = doc(db, "users", member.id);
      await updateDoc(memberRef, {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      alert(`Role updated to ${newRole === UserRole.COMPANY_ADMIN ? "Admin" : newRole === UserRole.HR ? "HR" : "Employee"} successfully!`);
      setShowRoleModal(false);
      setRoleChangingMember(null);
      loadData();
    } catch (error) {
      console.error("Error changing role:", error);
      alert("Failed to change role");
    }
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

  const getRoleBadge = (role) => {
    const roleConfig = {
      [UserRole.COMPANY_ADMIN]: {
        label: "Admin",
        className: "bg-blue-50 text-[#2D3E50] border border-blue-200",
      },
      [UserRole.HR]: {
        label: "HR",
        className: "bg-teal-50 text-[#1ABC9C] border border-teal-200",
      },
      [UserRole.EMPLOYEE]: {
        label: "Employee",
        className: "bg-gray-50 text-gray-700 border border-gray-200",
      },
    };
    const config = roleConfig[role] || roleConfig[UserRole.EMPLOYEE];
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
      >
        {config.label}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: {
        label: "Active",
        className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      },
      pending: {
        label: "Pending",
        className: "bg-amber-50 text-amber-700 border border-amber-200",
      },
      suspended: {
        label: "Suspended",
        className: "bg-red-50 text-red-700 border border-red-200",
      },
    };
    const config = statusConfig[status] || statusConfig.active;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
      >
        {config.label}
      </span>
    );
  };

  const getTagColorClasses = (color) => {
    const colorMap = {
      purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
      blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
      indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
      green: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
      yellow: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
      red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
      gray: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
    };
    return colorMap[color] || colorMap.gray;
  };

  const filteredMembers = getFilteredMembers();

  if (loading && members.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#1ABC9C] border-t-transparent"></div>
          <p className="text-sm text-gray-500">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#2D3E50]">
              Member Management
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Manage your team members and department assignments
            </p>
          </div>
          <div className="flex gap-3">
            {selectedUsers.length > 0 && (
              <button
                onClick={handleBulkAssignToDepartment}
                className="px-4 py-2.5 bg-[#2D3E50] text-white rounded-xl hover:bg-[#243242] transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
              >
                <UsersRound className="w-4 h-4" />
                Assign {selectedUsers.length} to Department
              </button>
            )}
            <button
              onClick={() => navigate("/company/tag-management")}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
            >
              <Tag className="w-4 h-4" />
              Manage Tags
            </button>
            <button
              onClick={() => navigate("/company/departments")}
              className="px-4 py-2.5 bg-[#1ABC9C] text-white rounded-xl hover:bg-[#16a085] transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
            >
              <Building2 className="w-4 h-4" />
              Manage Departments
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2D3E50]/5 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#2D3E50]" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
                <p className="text-2xl font-bold text-[#2D3E50]">{members.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {members.filter((m) => m.status === "active").length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending</p>
                <p className="text-2xl font-bold text-amber-600">
                  {members.filter((m) => m.status === "pending").length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Tag className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tagged</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {members.filter((m) => m.userTagId).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1ABC9C]/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#1ABC9C]" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Depts</p>
                <p className="text-2xl font-bold text-[#1ABC9C]">
                  {departments.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Unassigned</p>
                <p className="text-2xl font-bold text-gray-600">
                  {members.filter((m) => !m.departmentId).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Search */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] text-sm transition-colors"
                />
              </div>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] text-sm transition-colors appearance-none bg-white"
              >
                <option value="all">All Roles</option>
                <option value={UserRole.COMPANY_ADMIN}>Admin</option>
                <option value={UserRole.HR}>HR</option>
                <option value={UserRole.EMPLOYEE}>Employee</option>
              </select>
            </div>

            {/* Tag Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Tag
              </label>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] text-sm transition-colors appearance-none bg-white"
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
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] text-sm transition-colors appearance-none bg-white"
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
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] text-sm transition-colors appearance-none bg-white"
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
                  setSelectedTag("all");
                  setSelectedDepartment("all");
                  setSelectedStatus("all");
                  setSelectedUsers([]);
                }}
                className="w-full px-3 py-2.5 text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium border border-gray-200"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-500">
            Showing <span className="font-semibold text-[#2D3E50]">{filteredMembers.length}</span> of{" "}
            <span className="font-semibold text-[#2D3E50]">{members.length}</span> members
            {selectedUsers.length > 0 && (
              <span className="ml-4 text-[#1ABC9C]">
                &bull; <span className="font-semibold">{selectedUsers.length}</span> selected
              </span>
            )}
          </div>
        </div>

        {/* Members Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 sm:px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={
                        filteredMembers.length > 0 &&
                        selectedUsers.length === filteredMembers.length
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-[#1ABC9C] rounded-md focus:ring-[#1ABC9C]/20 border-gray-300"
                    />
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="hidden md:table-cell px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Tag
                  </th>
                  <th className="hidden md:table-cell px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="hidden lg:table-cell px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden xl:table-cell px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(member.id)}
                        onChange={() => handleSelectUser(member.id)}
                        className="w-4 h-4 text-[#1ABC9C] rounded-md focus:ring-[#1ABC9C]/20 border-gray-300"
                      />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#2D3E50] to-[#1ABC9C] flex items-center justify-center text-white font-semibold text-sm">
                            {member.displayName?.charAt(0).toUpperCase() || "U"}
                          </div>
                        </div>
                        <div className="ml-3 min-w-0 flex-1">
                          <div className="text-sm font-semibold text-[#2D3E50] truncate">
                            {member.displayName || "Unknown"}
                          </div>
                          <div className="text-xs text-gray-400 truncate">
                            {member.email}
                          </div>
                          {/* Show tag, department and role on mobile */}
                          <div className="md:hidden mt-1 flex flex-wrap gap-2">
                            {member.tagName && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${getTagColorClasses(member.tagColor).bg} ${getTagColorClasses(member.tagColor).text}`}>
                                {member.tagIcon} {member.tagName}
                              </span>
                            )}
                            {member.departmentName && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <span>{member.departmentIcon}</span>
                                {member.departmentName}
                              </span>
                            )}
                            <span className="lg:hidden">{getRoleBadge(member.role)}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Tag Cell */}
                    <td className="hidden md:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                      {member.tagName ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
                              getTagColorClasses(member.tagColor).bg
                            } ${getTagColorClasses(member.tagColor).text} ${
                              getTagColorClasses(member.tagColor).border
                            }`}
                          >
                            <span className="mr-1">{member.tagIcon}</span>
                            {member.tagName}
                          </span>
                          <button
                            onClick={() => handleRemoveTag(member)}
                            className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove tag"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setTagAssigningMember(member);
                            setShowTagModal(true);
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Assign
                        </button>
                      )}
                    </td>
                    {/* Department Cell */}
                    <td className="hidden md:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                      {member.departmentName ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1ABC9C]/10 text-[#1ABC9C] border border-[#1ABC9C]/20">
                            <span className="mr-1">{member.departmentIcon}</span>
                            {member.departmentName}
                          </span>
                          <button
                            onClick={() => handleRemoveDepartment(member)}
                            className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove from department"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAssignToDepartment(member)}
                          className="text-xs text-[#1ABC9C] hover:text-[#16a085] font-medium flex items-center gap-1"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Assign
                        </button>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(member.role)}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(member.status)}
                    </td>
                    <td className="hidden xl:table-cell px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {member.createdAt?.toDate
                        ? member.createdAt.toDate().toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-1.5">
                      {member.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleApproveMember(member.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => handleRejectMember(member.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4.5 h-4.5" />
                          </button>
                        </>
                      )}

                      {member.status === "active" && (
                        <>
                          <button
                            onClick={() => handleViewMemberDetails(member)}
                            className="p-1.5 text-[#2D3E50] hover:bg-[#2D3E50]/5 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => {
                              setRoleChangingMember(member);
                              setShowRoleModal(true);
                            }}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Change Role"
                          >
                            <ShieldCheck className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => {
                              setTagAssigningMember(member);
                              setShowTagModal(true);
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Assign Tag"
                          >
                            <Tag className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => handleAssignToDepartment(member)}
                            className="p-1.5 text-[#1ABC9C] hover:bg-[#1ABC9C]/10 rounded-lg transition-colors"
                            title="Change Department"
                          >
                            <Building2 className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => handleSuspendMember(member.id)}
                            className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Deactivate (Suspend)"
                          >
                            <Ban className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id, member.displayName)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </>
                      )}

                      {member.status === "suspended" && (
                        <>
                          <button
                            onClick={() => handleViewMemberDetails(member)}
                            className="p-1.5 text-[#2D3E50] hover:bg-[#2D3E50]/5 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => handleReactivateMember(member.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Reactivate"
                          >
                            <RefreshCw className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id, member.displayName)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
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
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-sm font-semibold text-[#2D3E50]">
                No members found
              </h3>
              <p className="mt-1 text-sm text-gray-400">
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

      {/* Tag Assignment Modal */}
      {showTagModal && tagAssigningMember && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-[#2D3E50]">
                    Assign Tag
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {tagAssigningMember.displayName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTagModal(false);
                    setTagAssigningMember(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {tags.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                    <Tag className="w-6 h-6 text-indigo-400" />
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    No tags available. Create tags first.
                  </p>
                  <button
                    onClick={() => navigate("/company/tag-management")}
                    className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    Go to Tag Management
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {/* Remove Tag Option */}
                  {tagAssigningMember.userTagId && (
                    <button
                      onClick={() => handleAssignTag(null, tagAssigningMember)}
                      className="w-full p-3 text-left border-2 border-dashed border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 transition-colors group"
                    >
                      <span className="text-sm font-medium text-gray-500 group-hover:text-red-600">
                        Remove current tag
                      </span>
                    </button>
                  )}

                  {tags.map((tag) => {
                    const colors = getTagColorClasses(tag.color);
                    const isActive = tagAssigningMember.userTagId === tag.id;
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleAssignTag(tag.id, tagAssigningMember)}
                        className={`w-full p-3 text-left border-2 rounded-xl hover:border-[#2D3E50]/30 transition-colors ${
                          isActive
                            ? "border-[#1ABC9C] bg-[#1ABC9C]/5"
                            : "border-gray-100"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
                          >
                            <span className="mr-1.5 text-base">{tag.icon}</span>
                            {tag.name}
                          </span>
                          <div className="flex items-center gap-2">
                            {isActive && (
                              <span className="text-xs text-[#1ABC9C] font-medium">Current</span>
                            )}
                            <span className="text-xs text-gray-400">
                              P{tag.priority}
                            </span>
                          </div>
                        </div>
                        {tag.description && (
                          <p className="text-xs text-gray-400 mt-1.5 pl-1">
                            {tag.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-5">
                <button
                  onClick={() => {
                    setShowTagModal(false);
                    setTagAssigningMember(null);
                  }}
                  className="w-full px-4 py-2.5 text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium border border-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal && roleChangingMember && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-[#2D3E50]">
                    Change Role
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {roleChangingMember.displayName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRoleModal(false);
                    setRoleChangingMember(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { role: UserRole.COMPANY_ADMIN, label: "Admin", desc: "Full company management access", icon: "shield", className: "bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400" },
                  { role: UserRole.HR, label: "HR", desc: "Human resources management access", icon: "users", className: "bg-teal-50 text-teal-700 border-teal-200 hover:border-teal-400" },
                  { role: UserRole.EMPLOYEE, label: "Employee", desc: "Standard employee access", icon: "user", className: "bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400" },
                ].map((option) => {
                  const isActive = roleChangingMember.role === option.role;
                  return (
                    <button
                      key={option.role}
                      onClick={() => handleChangeRole(option.role, roleChangingMember)}
                      className={`w-full p-4 text-left border-2 rounded-xl transition-colors ${
                        isActive
                          ? "border-[#1ABC9C] bg-[#1ABC9C]/5"
                          : `border-gray-100 hover:${option.className}`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-[#2D3E50]">
                            {option.label}
                          </span>
                          <p className="text-xs text-gray-400 mt-0.5">{option.desc}</p>
                        </div>
                        {isActive && (
                          <span className="text-xs text-[#1ABC9C] font-medium">Current</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5">
                <button
                  onClick={() => {
                    setShowRoleModal(false);
                    setRoleChangingMember(null);
                  }}
                  className="w-full px-4 py-2.5 text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium border border-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Department Assignment Modal */}
      {showDepartmentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100">
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2D3E50] to-[#1ABC9C] flex items-center justify-center text-white font-bold text-lg">
                    {viewingMember.displayName?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#2D3E50]">Member Details</h2>
                    <p className="text-sm text-gray-400">{viewingMember.displayName || "Unknown"}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowMemberDetailsModal(false);
                    setViewingMember(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Member Info Grid */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50/80 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Display Name</label>
                    </div>
                    <p className="text-sm font-medium text-[#2D3E50]">{viewingMember.displayName || "N/A"}</p>
                  </div>
                  <div className="bg-gray-50/80 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Email</label>
                    </div>
                    <p className="text-sm font-medium text-[#2D3E50]">{viewingMember.email || "N/A"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50/80 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-3.5 h-3.5 text-gray-400" />
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Role</label>
                    </div>
                    <p className="text-sm font-medium text-[#2D3E50] capitalize">{viewingMember.role || "N/A"}</p>
                  </div>
                  <div className="bg-gray-50/80 rounded-xl p-4">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Status</label>
                    <div>{getStatusBadge(viewingMember.status)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50/80 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Building className="w-3.5 h-3.5 text-gray-400" />
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Department</label>
                    </div>
                    <p className="text-sm font-medium text-[#2D3E50]">
                      {viewingMember.departmentIcon && <span className="mr-1">{viewingMember.departmentIcon}</span>}
                      {viewingMember.departmentName || "Not assigned"}
                    </p>
                  </div>
                  <div className="bg-gray-50/80 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash className="w-3.5 h-3.5 text-gray-400" />
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Employee ID</label>
                    </div>
                    <p className="text-sm font-medium text-[#2D3E50]">{viewingMember.employeeId || "N/A"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50/80 rounded-xl p-4">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">User ID</label>
                    <p className="text-xs text-gray-600 font-mono break-all">{viewingMember.id}</p>
                  </div>
                  <div className="bg-gray-50/80 rounded-xl p-4">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Company ID</label>
                    <p className="text-xs text-gray-600 font-mono break-all">{viewingMember.companyId || "N/A"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50/80 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Joined Date</label>
                    </div>
                    <p className="text-sm font-medium text-[#2D3E50]">
                      {viewingMember.createdAt?.toDate
                        ? viewingMember.createdAt.toDate().toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50/80 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Login</label>
                    </div>
                    <p className="text-sm font-medium text-[#2D3E50]">
                      {viewingMember.lastLogin?.toDate
                        ? viewingMember.lastLogin.toDate().toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50/80 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="w-3.5 h-3.5 text-gray-400" />
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tag</label>
                  </div>
                  {viewingMember.tagName ? (
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        getTagColorClasses(viewingMember.tagColor).bg
                      } ${getTagColorClasses(viewingMember.tagColor).text} ${
                        getTagColorClasses(viewingMember.tagColor).border
                      }`}
                    >
                      <span className="mr-1">{viewingMember.tagIcon}</span>
                      {viewingMember.tagName}
                    </span>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Not assigned</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-5 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => {
                    setShowMemberDetailsModal(false);
                    setViewingMember(null);
                  }}
                  className="px-5 py-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium border border-gray-200"
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
