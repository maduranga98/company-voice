import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pin, Archive, ChevronDown, ChevronUp, UserCheck, Calendar, MessageSquare, Send } from "lucide-react";
import AnonymousThread from "./AnonymousThread";
import {
  PostStatus,
  PostStatusConfig,
  PostPriority,
  PostPriorityConfig,
  AssignmentType,
  UserRole,
} from "../utils/constants";
import {
  updatePostStatus,
  updatePostPriority,
  assignPost,
  unassignPost,
  setDueDate,
  addAdminComment,
  getCompanyDepartments,
} from "../services/postManagementService";
import {
  pinPost,
  unpinPost,
  archivePost,
  unarchivePost,
} from "../services/postEnhancedFeaturesService";
import { showSuccess, showError } from "../services/toastService";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";

const AdminActionPanel = ({ post, currentUser, onUpdate }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState(post.status || PostStatus.OPEN);
  const [priority, setPriority] = useState(post.priority || PostPriority.MEDIUM);
  const [isExpanded, setIsExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [selectedDueDate, setSelectedDueDate] = useState(() => {
    if (!post.dueDate) return "";
    try {
      const date = post.dueDate.seconds ? new Date(post.dueDate.seconds * 1000) : new Date(post.dueDate);
      return isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
    } catch { return ""; }
  });
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { loadAssignmentOptions(); }, [currentUser.companyId]);
  useEffect(() => { setSelectedAssignee(post.assignedTo || null); }, [post.assignedTo]);
  useEffect(() => { setStatus(post.status || PostStatus.OPEN); }, [post.status]);
  useEffect(() => { setPriority(post.priority || PostPriority.MEDIUM); }, [post.priority]);

  const loadAssignmentOptions = async () => {
    try {
      const depts = await getCompanyDepartments(currentUser.companyId);
      setDepartments(depts);

      const tagsRef = collection(db, "userTags");
      const tagsQuery = query(tagsRef, where("companyId", "==", currentUser.companyId));
      const tagsSnapshot = await getDocs(tagsQuery);
      const tagsList = [];
      tagsSnapshot.forEach((doc) => { tagsList.push({ id: doc.id, ...doc.data() }); });
      tagsList.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      setTags(tagsList);

      const tagMap = {};
      tagsList.forEach((tag) => { tagMap[tag.id] = tag; });

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("companyId", "==", currentUser.companyId), where("status", "==", "active"));
      const snapshot = await getDocs(q);
      const usersList = [];
      snapshot.forEach((doc) => {
        const userData = { id: doc.id, ...doc.data() };
        if (userData.userTagId && tagMap[userData.userTagId]) userData.tagData = tagMap[userData.userTagId];
        // Only include members who have a tag assigned
        if (userData.userTagId) usersList.push(userData);
      });
      usersList.sort((a, b) => {
        const pA = a.tagData?.priority || 0;
        const pB = b.tagData?.priority || 0;
        if (pB !== pA) return pB - pA;
        return (a.displayName || "").localeCompare(b.displayName || "");
      });
      setUsers(usersList);
    } catch (error) {
      console.error("Error loading assignment options:", error);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setLoading(true);
      await updatePostStatus(post.id, newStatus, currentUser, comment);
      setStatus(newStatus);
      setComment("");
      if (onUpdate) onUpdate();
      showSuccess("Status updated");
    } catch (error) {
      showError(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    try {
      setLoading(true);
      await updatePostPriority(post.id, newPriority, currentUser);
      setPriority(newPriority);
      if (onUpdate) onUpdate();
      showSuccess("Priority updated");
    } catch (error) {
      showError(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignment = async (assignee) => {
    try {
      setLoading(true);
      if (!assignee) {
        await unassignPost(post.id, currentUser);
        setSelectedAssignee(null);
        setSelectedDueDate("");
        showSuccess("Unassigned");
      } else {
        await assignPost(post.id, { type: assignee.type, id: assignee.id, name: assignee.name, dueDate: selectedDueDate ? new Date(selectedDueDate) : null }, currentUser);
        setSelectedAssignee(assignee);
        showSuccess("Assigned");
      }
      setShowAssignDropdown(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      showError(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDueDateChange = async (newDate) => {
    try {
      setLoading(true);
      setSelectedDueDate(newDate);
      if (newDate) await setDueDate(post.id, new Date(newDate), currentUser);
      if (onUpdate) onUpdate();
      showSuccess("Due date set");
    } catch (error) {
      showError(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    try {
      setLoading(true);
      await addAdminComment(post.id, comment, currentUser);
      setComment("");
      showSuccess("Note added");
      if (onUpdate) onUpdate();
    } catch (error) {
      showError(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePinToggle = async () => {
    try {
      setLoading(true);
      if (post.isPinned) {
        await unpinPost(post.id, currentUser.id, currentUser.displayName);
      } else {
        await pinPost(post.id, currentUser.id, currentUser.displayName, currentUser.companyId);
      }
      if (onUpdate) onUpdate();
      showSuccess(post.isPinned ? "Unpinned" : "Pinned");
    } catch (error) {
      showError(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveToggle = async () => {
    try {
      setLoading(true);
      if (post.isArchived) {
        await unarchivePost(post.id, currentUser.id, currentUser.displayName);
      } else {
        await archivePost(post.id, currentUser.id, currentUser.displayName, "Archived by admin");
      }
      if (onUpdate) onUpdate();
      showSuccess(post.isArchived ? "Unarchived" : "Archived");
    } catch (error) {
      showError(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getColorClasses = (color) => {
    const map = {
      purple: "bg-purple-100 text-purple-800",
      blue: "bg-blue-100 text-blue-800",
      indigo: "bg-indigo-100 text-indigo-800",
      green: "bg-green-100 text-green-800",
      yellow: "bg-yellow-100 text-yellow-800",
      red: "bg-red-100 text-red-800",
      gray: "bg-gray-100 text-gray-800",
    };
    return map[color] || map.gray;
  };

  return (
    <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-xl p-3">
      {/* Compact Header Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status */}
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={loading}
          className={`px-2.5 py-1.5 text-xs font-medium border rounded-lg focus:ring-1 focus:ring-indigo-400 focus:outline-none ${PostStatusConfig[status]?.bgColor} ${PostStatusConfig[status]?.textColor}`}
        >
          {Object.values(PostStatus).map((sv) => (
            <option key={sv} value={sv}>{PostStatusConfig[sv]?.label}</option>
          ))}
        </select>

        {/* Priority */}
        <select
          value={priority}
          onChange={(e) => handlePriorityChange(e.target.value)}
          disabled={loading}
          className={`px-2.5 py-1.5 text-xs font-medium border rounded-lg focus:ring-1 focus:ring-indigo-400 focus:outline-none ${PostPriorityConfig[priority]?.bgColor} ${PostPriorityConfig[priority]?.textColor}`}
        >
          {Object.values(PostPriority).map((pv) => (
            <option key={pv} value={pv}>{PostPriorityConfig[pv]?.icon} {PostPriorityConfig[pv]?.label}</option>
          ))}
        </select>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={handlePinToggle}
            disabled={loading}
            className={`p-1.5 rounded-lg transition text-xs ${post.isPinned ? 'bg-amber-100 text-amber-700' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'} disabled:opacity-50`}
            title={post.isPinned ? "Unpin" : "Pin"}
          >
            <Pin className={`w-3.5 h-3.5 ${post.isPinned ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={handleArchiveToggle}
            disabled={loading}
            className={`p-1.5 rounded-lg transition text-xs ${post.isArchived ? 'bg-slate-200 text-slate-700' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'} disabled:opacity-50`}
            title={post.isArchived ? "Unarchive" : "Archive"}
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-indigo-500 hover:bg-indigo-100 rounded-lg transition"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Current Assignment Info (always visible if assigned) */}
      {selectedAssignee && !isExpanded && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-indigo-600 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100">
          <UserCheck className="w-3 h-3" />
          <span className="font-medium">{selectedAssignee.name}</span>
          <span className="text-indigo-400 capitalize">({selectedAssignee.type})</span>
          {selectedDueDate && (
            <>
              <span className="text-indigo-300">|</span>
              <Calendar className="w-3 h-3" />
              <span>{new Date(selectedDueDate).toLocaleDateString()}</span>
            </>
          )}
        </div>
      )}

      {/* Expanded Section */}
      {isExpanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-indigo-100/60">
          {/* Assignment */}
          <div className="relative">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
              {t('adminPanel.assignTo')}
            </label>
            <button
              onClick={() => setShowAssignDropdown(!showAssignDropdown)}
              disabled={loading}
              className="w-full px-3 py-2 text-xs text-left border border-gray-200 rounded-lg bg-white hover:border-indigo-300 flex items-center justify-between transition"
            >
              <span className={selectedAssignee ? "text-gray-900 font-medium" : "text-gray-400"}>
                {selectedAssignee ? `${selectedAssignee.name} (${selectedAssignee.type})` : "Select assignee..."}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {showAssignDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-hidden">
                {!post.isAnonymous && (
                  <div className="p-2 border-b border-gray-100">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                <div className="max-h-52 overflow-y-auto">
                  <button
                    onClick={() => { handleAssignment(null); setSearchTerm(""); }}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 text-gray-500 border-b border-gray-100"
                  >
                    Unassign
                  </button>

                  {/* Assign to me */}
                  {currentUser.userTagId && (
                    <button
                      onClick={() => { handleAssignment({ type: AssignmentType.USER, id: currentUser.id, name: currentUser.displayName, userTagId: currentUser.userTagId }); setSearchTerm(""); }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-indigo-50 flex items-center gap-2 text-indigo-600 font-medium border-b border-gray-100"
                    >
                      <span>⭐</span>
                      <span>Assign to me</span>
                    </button>
                  )}

                  {filteredUsers.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">People</div>
                      {filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => { handleAssignment({ type: AssignmentType.USER, id: user.id, name: user.displayName, userTagId: user.userTagId }); setSearchTerm(""); }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span>{user.tagData?.icon || "👤"}</span>
                            <div>
                              <div className="font-medium text-gray-900">{user.displayName}</div>
                              <div className="text-[10px] text-gray-400">{user.tagData?.name || user.role}</div>
                            </div>
                          </div>
                          {user.tagData && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses(user.tagData.color)}`}>
                              {user.tagData.name}
                            </span>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                  {filteredUsers.length === 0 && (
                    <div className="px-3 py-4 text-xs text-gray-400 text-center">No tagged members found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Assigned info */}
          {selectedAssignee && (
            <div className="flex items-center justify-between p-2.5 bg-white border border-indigo-100 rounded-lg">
              <div className="flex items-center gap-2 text-xs">
                <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-medium text-gray-900">{selectedAssignee.name}</span>
                <span className="text-gray-400 capitalize">{selectedAssignee.type}</span>
              </div>
              <button
                onClick={() => handleAssignment(null)}
                disabled={loading}
                className="text-[10px] text-red-500 hover:text-red-700 font-medium px-2 py-0.5 border border-red-200 rounded-md hover:bg-red-50 transition"
              >
                Remove
              </button>
            </div>
          )}

          {/* Due Date */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">{t('adminPanel.dueDate')}</label>
            <input
              type="date"
              value={selectedDueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Admin Note */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">{t('adminPanel.adminNote')}</label>
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={loading}
                placeholder="Add a note..."
                className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }}
              />
              <button
                onClick={handleAddComment}
                disabled={loading || !comment.trim()}
                className="px-3 py-2 bg-[#1ABC9C] text-white rounded-lg text-xs font-medium hover:bg-[#17a68a] transition disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anonymous Thread */}
      {post.isAnonymous && (
        <AnonymousThread
          postId={post.id}
          companyId={post.companyId || currentUser.companyId}
          currentUserRole={currentUser.role}
          isAnonymousPost={post.isAnonymous}
          defaultOpen={[UserRole.HR, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN].includes(currentUser.role)}
        />
      )}
    </div>
  );
};

export default AdminActionPanel;
