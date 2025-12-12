import { useState, useEffect } from "react";
import { Pin, Archive } from "lucide-react";
import {
  PostStatus,
  PostStatusConfig,
  PostPriority,
  PostPriorityConfig,
  AssignmentType,
  COLORS,
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
import HelpTooltip from "./help/HelpTooltip";
import { POST_STATUS_GUIDANCE, PRIORITY_GUIDANCE, FEATURE_TOOLTIPS } from "../utils/guidanceContent";

/**
 * Admin Action Panel Component
 * Displays admin controls for post management (status, priority, assignment, etc.)
 * Only visible to admin users (company_admin, hr, super_admin)
 */
const AdminActionPanel = ({ post, currentUser, onUpdate }) => {
  const [status, setStatus] = useState(post.status || PostStatus.OPEN);
  const [priority, setPriority] = useState(post.priority || PostPriority.MEDIUM);
  const [isExpanded, setIsExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [selectedDueDate, setSelectedDueDate] = useState(
    post.dueDate ? new Date(post.dueDate.seconds * 1000).toISOString().split("T")[0] : ""
  );
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Load departments and users on mount
  useEffect(() => {
    loadAssignmentOptions();
  }, [currentUser.companyId]);

  // Initialize assignment if post is already assigned
  useEffect(() => {
    if (post.assignedTo) {
      setSelectedAssignee(post.assignedTo);
    }
  }, [post.assignedTo]);

  const loadAssignmentOptions = async () => {
    try {
      // Load departments
      const depts = await getCompanyDepartments(currentUser.companyId);
      setDepartments(depts);

      // Load tags from database
      const tagsRef = collection(db, "userTags");
      const tagsQuery = query(
        tagsRef,
        where("companyId", "==", currentUser.companyId)
      );
      const tagsSnapshot = await getDocs(tagsQuery);
      const tagsList = [];
      tagsSnapshot.forEach((doc) => {
        tagsList.push({ id: doc.id, ...doc.data() });
      });
      // Sort by priority (highest first)
      tagsList.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      setTags(tagsList);

      // Create a tag map for quick lookup
      const tagMap = {};
      tagsList.forEach((tag) => {
        tagMap[tag.id] = tag;
      });

      // Load users (for non-anonymous posts)
      if (!post.isAnonymous) {
        const usersRef = collection(db, "users");
        const q = query(
          usersRef,
          where("companyId", "==", currentUser.companyId),
          where("status", "==", "active")
        );
        const snapshot = await getDocs(q);
        const usersList = [];
        snapshot.forEach((doc) => {
          const userData = { id: doc.id, ...doc.data() };
          // Attach full tag data if user has a tag
          if (userData.userTagId && tagMap[userData.userTagId]) {
            userData.tagData = tagMap[userData.userTagId];
          }
          usersList.push(userData);
        });
        // Sort by tag priority (highest first), then by name
        usersList.sort((a, b) => {
          const priorityA = a.tagData?.priority || 0;
          const priorityB = b.tagData?.priority || 0;
          if (priorityB !== priorityA) {
            return priorityB - priorityA;
          }
          return (a.displayName || "").localeCompare(b.displayName || "");
        });
        setUsers(usersList);
      }
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
      showSuccess("Status updated successfully!");
    } catch (error) {
      console.error("Error updating status:", error);
      showError(`Failed to update status: ${error.message}`);
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
      showSuccess("Priority updated successfully!");
    } catch (error) {
      console.error("Error updating priority:", error);
      showError(`Failed to update priority: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignment = async (assignee) => {
    try {
      setLoading(true);

      if (!assignee) {
        // Unassign
        await unassignPost(post.id, currentUser);
        setSelectedAssignee(null);
        setSelectedDueDate("");
        showSuccess("Post unassigned successfully!");
      } else {
        // Assign
        const assignment = {
          type: assignee.type,
          id: assignee.id,
          name: assignee.name,
          dueDate: selectedDueDate ? new Date(selectedDueDate) : null,
        };

        await assignPost(post.id, assignment, currentUser);
        setSelectedAssignee(assignee);
        showSuccess("Post assigned successfully!");
      }

      setShowAssignDropdown(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error with assignment:", error);
      showError(`Failed to assign: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDueDateChange = async (newDate) => {
    try {
      setLoading(true);
      setSelectedDueDate(newDate);

      if (newDate) {
        await setDueDate(post.id, new Date(newDate), currentUser);
        showSuccess("Due date set successfully!");
      }

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error setting due date:", error);
      showError(`Failed to set due date: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) {
      showError("Please enter a comment");
      return;
    }

    try {
      setLoading(true);
      await addAdminComment(post.id, comment, currentUser);
      setComment("");
      showSuccess("Admin comment added successfully!");
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error adding comment:", error);
      showError(`Failed to add comment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePinToggle = async () => {
    try {
      setLoading(true);
      if (post.isPinned) {
        await unpinPost(post.id, currentUser.id, currentUser.displayName);
        showSuccess("Post unpinned successfully!");
      } else {
        await pinPost(post.id, currentUser.id, currentUser.displayName, currentUser.companyId);
        showSuccess("Post pinned successfully!");
      }
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error toggling pin:", error);
      showError(`Failed to ${post.isPinned ? 'unpin' : 'pin'} post`);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveToggle = async () => {
    try {
      setLoading(true);
      if (post.isArchived) {
        await unarchivePost(post.id, currentUser.id, currentUser.displayName);
        showSuccess("Post unarchived successfully!");
      } else {
        await archivePost(post.id, currentUser.id, currentUser.displayName, "Archived by admin");
        showSuccess("Post archived successfully!");
      }
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error toggling archive:", error);
      showError(`Failed to ${post.isArchived ? 'unarchive' : 'archive'} post`);
    } finally {
      setLoading(false);
    }
  };

  // Group users by tag for organized display
  const getUsersByTag = () => {
    const filtered = users.filter((user) =>
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group by tag
    const grouped = {};

    // First, create groups for each available tag
    tags.forEach((tag) => {
      grouped[tag.id] = {
        tag: tag,
        users: filtered.filter((u) => u.userTagId === tag.id),
      };
    });

    // Add group for untagged users
    const untaggedUsers = filtered.filter((u) => !u.userTagId);
    if (untaggedUsers.length > 0) {
      grouped["untagged"] = {
        tag: { id: "untagged", name: "Untagged", icon: "👤", color: "gray", priority: 0 },
        users: untaggedUsers,
      };
    }

    return grouped;
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

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-indigo-700 font-semibold text-sm">Admin Controls</span>
          <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
            Only visible to admins
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {/* Quick Actions - Always Visible */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Status Dropdown */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
            Status
            <HelpTooltip
              content={POST_STATUS_GUIDANCE.description}
              title="Post Status"
              size="sm"
            />
          </label>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={loading}
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
              PostStatusConfig[status]?.bgColor
            } ${PostStatusConfig[status]?.textColor}`}
            style={{ borderColor: PostStatusConfig[status]?.borderColor }}
          >
            {Object.values(PostStatus).map((statusValue) => (
              <option key={statusValue} value={statusValue}>
                {PostStatusConfig[statusValue]?.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Dropdown */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
            Priority
            <HelpTooltip
              content={PRIORITY_GUIDANCE.description}
              title="Priority Levels"
              size="sm"
            />
          </label>
          <select
            value={priority}
            onChange={(e) => handlePriorityChange(e.target.value)}
            disabled={loading}
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
              PostPriorityConfig[priority]?.bgColor
            } ${PostPriorityConfig[priority]?.textColor}`}
            style={{ borderColor: PostPriorityConfig[priority]?.borderColor }}
          >
            {Object.values(PostPriority).map((priorityValue) => (
              <option key={priorityValue} value={priorityValue}>
                {PostPriorityConfig[priorityValue]?.icon} {PostPriorityConfig[priorityValue]?.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pin and Archive Actions */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={handlePinToggle}
          disabled={loading}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
            post.isPinned
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Pin className={`w-4 h-4 ${post.isPinned ? 'fill-current' : ''}`} />
          {post.isPinned ? 'Unpin' : 'Pin'} Post
        </button>
        <button
          onClick={handleArchiveToggle}
          disabled={loading}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
            post.isArchived
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Archive className="w-4 h-4" />
          {post.isArchived ? 'Unarchive' : 'Archive'} Post
        </button>
      </div>

      {/* Expanded Section */}
      {isExpanded && (
        <div className="space-y-3 pt-3 border-t border-indigo-200">
          {/* Assignment */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
              Assign To
              {post.isAnonymous && (
                <span className="text-xs font-normal text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                  Departments only (Anonymous post)
                </span>
              )}
              <HelpTooltip
                content={FEATURE_TOOLTIPS.assignPost}
                title="Post Assignment"
                size="sm"
              />
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <button
                  onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                  disabled={loading}
                  className="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded-lg hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white flex items-center justify-between"
                >
                  <span>
                    {selectedAssignee
                      ? `${selectedAssignee.name} (${selectedAssignee.type})`
                      : "Select assignee..."}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Assignment Dropdown */}
                {showAssignDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-hidden">
                    {/* Search Box (for users) */}
                    {!post.isAnonymous && (
                      <div className="p-2 border-b border-gray-200">
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}

                    <div className="max-h-80 overflow-y-auto">
                      {/* Unassign option */}
                      <button
                        onClick={() => {
                          handleAssignment(null);
                          setSearchTerm("");
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-gray-700 border-b border-gray-200"
                      >
                        <span className="font-medium">Unassign</span>
                      </button>

                      {/* Departments */}
                      <div className="border-t border-gray-200">
                        <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-700 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Departments
                        </div>
                        {departments.map((dept) => (
                          <button
                            key={dept.id}
                            onClick={() => {
                              handleAssignment({
                                type: AssignmentType.DEPARTMENT,
                                id: dept.id,
                                name: dept.name,
                              });
                              setSearchTerm("");
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
                          >
                            <span className="mr-2">{dept.icon}</span>
                            <span>{dept.name}</span>
                          </button>
                        ))}
                      </div>

                      {/* Users (only for non-anonymous posts) - Grouped by Tag */}
                      {!post.isAnonymous && (
                        <>
                          {Object.entries(getUsersByTag()).map(([tagId, group]) => {
                            if (group.users.length === 0) return null;
                            const tagData = group.tag;
                            const colorClasses = getColorClasses(tagData.color);
                            return (
                              <div key={tagId} className="border-t border-gray-200">
                                <div className={`px-3 py-2 ${colorClasses.bgClass} text-xs font-semibold ${colorClasses.textClass} flex items-center`}>
                                  <span className="mr-1">{tagData.icon}</span>
                                  <span>{tagData.name}s</span>
                                  <span className="ml-auto text-xs opacity-75">({group.users.length})</span>
                                </div>
                                {group.users.map((user) => {
                                  const userColorClasses = user.tagData ? getColorClasses(user.tagData.color) : getColorClasses("gray");
                                  return (
                                    <button
                                      key={user.id}
                                      onClick={() => {
                                        handleAssignment({
                                          type: AssignmentType.USER,
                                          id: user.id,
                                          name: user.displayName,
                                          userTagId: user.userTagId,
                                        });
                                        setSearchTerm("");
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                                    >
                                      <div className="flex items-center">
                                        <span className="mr-2">{user.tagData?.icon || tagData.icon}</span>
                                        <div>
                                          <div className="font-medium">{user.displayName}</div>
                                          <div className="text-xs text-gray-500">{user.role}</div>
                                        </div>
                                      </div>
                                      {user.tagData && (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${userColorClasses.bgClass} ${userColorClasses.textColor}`}>
                                          {user.tagData.name}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
              Due Date
              <HelpTooltip
                content={FEATURE_TOOLTIPS.addDueDate}
                title="Due Date"
                size="sm"
              />
            </label>
            <input
              type="date"
              value={selectedDueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Admin Comment */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
              Admin Comment (Public - visible to everyone)
              <HelpTooltip
                content={FEATURE_TOOLTIPS.adminComment}
                title="Admin Comment"
                size="sm"
              />
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={loading}
              placeholder="Add a comment explaining your action..."
              rows="3"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <button
              onClick={handleAddComment}
              disabled={loading || !comment.trim()}
              className="mt-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: COLORS.primary.main,
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = COLORS.primary.hover)}
              onMouseLeave={(e) => (e.target.style.backgroundColor = COLORS.primary.main)}
            >
              {loading ? "Adding..." : "Add Comment"}
            </button>
          </div>

          {/* Current Assignment Info */}
          {selectedAssignee && (
            <div className="p-3 bg-white border border-indigo-200 rounded-lg text-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-1 flex items-center">
                    <svg className="w-4 h-4 mr-1 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Currently Assigned To:
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-900 font-semibold">
                      {selectedAssignee.name}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-xs text-gray-600 capitalize">
                      {selectedAssignee.type}
                    </span>
                    {selectedAssignee.userTagId && (() => {
                      const assigneeTag = tags.find(t => t.id === selectedAssignee.userTagId);
                      if (!assigneeTag) return null;
                      const colorClasses = getColorClasses(assigneeTag.color);
                      return (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClasses.bgClass} ${colorClasses.textClass}`}>
                            {assigneeTag.icon} {assigneeTag.name}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  {selectedDueDate && (
                    <div className="flex items-center text-xs text-gray-500 mt-2">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Due: {new Date(selectedDueDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleAssignment(null)}
                  disabled={loading}
                  className="text-red-600 hover:text-red-800 text-xs font-medium px-3 py-1 border border-red-300 rounded-lg hover:bg-red-50 transition"
                >
                  Unassign
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Description */}
      <div className="mt-3 text-xs text-gray-600">
        <span className="font-medium">Status:</span> {PostStatusConfig[status]?.description}
      </div>
    </div>
  );
};

export default AdminActionPanel;
