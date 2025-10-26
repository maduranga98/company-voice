import { useState, useEffect } from "react";
import {
  PostStatus,
  PostStatusConfig,
  PostPriority,
  PostPriorityConfig,
  AssignmentType,
  UserTag,
  UserTagConfig,
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
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";

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
          // Add default tag if not set
          if (!userData.userTag) {
            userData.userTag = UserTag.STAFF;
          }
          usersList.push(userData);
        });
        // Sort by tag priority (highest first)
        usersList.sort((a, b) => {
          const priorityA = UserTagConfig[a.userTag]?.priority || 0;
          const priorityB = UserTagConfig[b.userTag]?.priority || 0;
          return priorityB - priorityA;
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
      alert("Status updated successfully!");
    } catch (error) {
      console.error("Error updating status:", error);
      alert(`Failed to update status: ${error.message}`);
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
      alert("Priority updated successfully!");
    } catch (error) {
      console.error("Error updating priority:", error);
      alert(`Failed to update priority: ${error.message}`);
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
        alert("Post unassigned successfully!");
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
        alert("Post assigned successfully!");
      }

      setShowAssignDropdown(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error with assignment:", error);
      alert(`Failed to assign: ${error.message}`);
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
        alert("Due date set successfully!");
      }

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error setting due date:", error);
      alert(`Failed to set due date: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) {
      alert("Please enter a comment");
      return;
    }

    try {
      setLoading(true);
      await addAdminComment(post.id, comment, currentUser);
      setComment("");
      alert("Admin comment added successfully!");
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error adding comment:", error);
      alert(`Failed to add comment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Group users by tag for organized display
  const getUsersByTag = () => {
    const filtered = users.filter((user) =>
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grouped = {};
    Object.values(UserTag).forEach((tag) => {
      grouped[tag] = filtered.filter((u) => u.userTag === tag);
    });
    return grouped;
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
          <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
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
          <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
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

      {/* Expanded Section */}
      {isExpanded && (
        <div className="space-y-3 pt-3 border-t border-indigo-200">
          {/* Assignment */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Assign To {post.isAnonymous && "(Departments only for anonymous posts)"}
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
                          {Object.entries(getUsersByTag()).map(([tag, tagUsers]) => {
                            if (tagUsers.length === 0) return null;
                            const tagConfig = UserTagConfig[tag];
                            return (
                              <div key={tag} className="border-t border-gray-200">
                                <div className={`px-3 py-2 ${tagConfig.bgColor} text-xs font-semibold ${tagConfig.textColor} flex items-center`}>
                                  <span className="mr-1">{tagConfig.icon}</span>
                                  <span>{tagConfig.label}s</span>
                                  <span className="ml-auto text-xs opacity-75">({tagUsers.length})</span>
                                </div>
                                {tagUsers.map((user) => (
                                  <button
                                    key={user.id}
                                    onClick={() => {
                                      handleAssignment({
                                        type: AssignmentType.USER,
                                        id: user.id,
                                        name: user.displayName,
                                        userTag: user.userTag,
                                      });
                                      setSearchTerm("");
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                                  >
                                    <div className="flex items-center">
                                      <span className="mr-2">{tagConfig.icon}</span>
                                      <div>
                                        <div className="font-medium">{user.displayName}</div>
                                        <div className="text-xs text-gray-500">{user.role}</div>
                                      </div>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tagConfig.bgColor} ${tagConfig.textColor}`}>
                                      {tagConfig.label}
                                    </span>
                                  </button>
                                ))}
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
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
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Admin Comment (Public - visible to everyone)
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
                    {selectedAssignee.userTag && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${UserTagConfig[selectedAssignee.userTag]?.bgColor} ${UserTagConfig[selectedAssignee.userTag]?.textColor}`}>
                          {UserTagConfig[selectedAssignee.userTag]?.icon} {UserTagConfig[selectedAssignee.userTag]?.label}
                        </span>
                      </>
                    )}
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
