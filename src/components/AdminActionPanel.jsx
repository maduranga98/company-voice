import { useState, useEffect } from "react";
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
          usersList.push({ id: doc.id, ...doc.data() });
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
                  className="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded-lg hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  {selectedAssignee
                    ? `${selectedAssignee.name} (${selectedAssignee.type})`
                    : "Select assignee..."}
                </button>

                {/* Assignment Dropdown */}
                {showAssignDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {/* Unassign option */}
                    <button
                      onClick={() => handleAssignment(null)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-gray-700"
                    >
                      Unassign
                    </button>

                    {/* Departments */}
                    <div className="border-t border-gray-200">
                      <div className="px-3 py-1 bg-gray-50 text-xs font-semibold text-gray-600">
                        Departments
                      </div>
                      {departments.map((dept) => (
                        <button
                          key={dept.id}
                          onClick={() =>
                            handleAssignment({
                              type: AssignmentType.DEPARTMENT,
                              id: dept.id,
                              name: dept.name,
                            })
                          }
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                        >
                          {dept.icon} {dept.name}
                        </button>
                      ))}
                    </div>

                    {/* Users (only for non-anonymous posts) */}
                    {!post.isAnonymous && (
                      <div className="border-t border-gray-200">
                        <div className="px-3 py-1 bg-gray-50 text-xs font-semibold text-gray-600">
                          Users
                        </div>
                        {users.map((user) => (
                          <button
                            key={user.id}
                            onClick={() =>
                              handleAssignment({
                                type: AssignmentType.USER,
                                id: user.id,
                                name: user.displayName,
                              })
                            }
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                          >
                            {user.displayName} ({user.role})
                          </button>
                        ))}
                      </div>
                    )}
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
            <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Currently Assigned To:</div>
                  <div className="text-gray-600">
                    {selectedAssignee.name} ({selectedAssignee.type})
                  </div>
                  {selectedDueDate && (
                    <div className="text-xs text-gray-500 mt-1">
                      Due: {new Date(selectedDueDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleAssignment(null)}
                  disabled={loading}
                  className="text-red-600 hover:text-red-800 text-xs font-medium"
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
