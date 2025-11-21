import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import Post from "../components/Post";
import AdminActionPanel from "../components/AdminActionPanel";
import {
  PostStatus,
  PostStatusConfig,
  PostPriority,
  PostPriorityConfig,
} from "../utils/constants";
import { isAdmin } from "../services/postManagementService";

/**
 * AssignedToMe Component
 * Shows all posts assigned to the current user (for tagged members)
 * Displays problems that have been assigned to them for resolution
 */
const AssignedToMe = () => {
  const { userData } = useAuth();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");

  const userIsAdmin = isAdmin(userData?.role);

  useEffect(() => {
    if (userData?.id && userData?.companyId) {
      loadAssignedPosts();
    }
  }, [userData?.id, userData?.companyId]);

  useEffect(() => {
    filterPosts();
  }, [posts, selectedStatus, selectedPriority]);

  const loadAssignedPosts = async () => {
    // Check if user data is available
    if (!userData?.id || !userData?.companyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const postsRef = collection(db, "posts");

      // Query posts assigned to current user using their ID
      const q = query(
        postsRef,
        where("companyId", "==", userData.companyId),
        where("assignedTo.id", "==", userData.id),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const postsData = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        postsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          dueDate: data.dueDate?.toDate(),
        });
      });

      setPosts(postsData);
    } catch (error) {
      console.error("Error loading assigned posts:", error);

      // More helpful error message
      if (error.code === "failed-precondition") {
        console.error(
          "Index may be missing. Check Firebase Console for index creation link."
        );
      }

      // Don't show alert for initial load
      if (posts.length > 0) {
        alert("Failed to load assigned posts. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = [...posts];

    if (selectedStatus !== "all") {
      filtered = filtered.filter((post) => post.status === selectedStatus);
    }

    if (selectedPriority !== "all") {
      filtered = filtered.filter((post) => post.priority === selectedPriority);
    }

    setFilteredPosts(filtered);
  };

  const handlePostUpdate = () => {
    loadAssignedPosts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show message if user doesn't have a tag
  if (!userData?.userTagId) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <svg
            className="w-12 h-12 text-yellow-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">
            No Tag Assigned
          </h3>
          <p className="text-yellow-700">
            You need to have a user tag assigned to see posts assigned to you.
            Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Assigned to Me
        </h1>
        <p className="text-gray-600">
          Posts and tasks that have been assigned to you
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          {Object.entries(PostStatusConfig).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>

        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Priority</option>
          {Object.entries(PostPriorityConfig).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900 mb-2">
              No assigned posts
            </p>
            <p className="text-gray-600">
              {selectedStatus !== "all" || selectedPriority !== "all"
                ? "Try adjusting your filters"
                : "You don't have any posts assigned to you yet"}
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200"
            >
              {userIsAdmin && (
                <div className="p-4 pb-0">
                  <AdminActionPanel
                    post={post}
                    currentUser={userData}
                    onUpdate={handlePostUpdate}
                  />
                </div>
              )}
              <Post post={post} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AssignedToMe;
