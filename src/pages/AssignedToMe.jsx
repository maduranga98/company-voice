import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import Post from "../components/Post";
import AdminActionPanel from "../components/AdminActionPanel";
import { PostStatus, PostStatusConfig, PostPriority, PostPriorityConfig } from "../utils/constants";
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
    loadAssignedPosts();
  }, [userData]);

  useEffect(() => {
    filterPosts();
  }, [posts, selectedStatus, selectedPriority]);

  const loadAssignedPosts = async () => {
    try {
      setLoading(true);
      const postsRef = collection(db, "posts");

      // Query posts assigned to current user
      const q = query(
        postsRef,
        where("companyId", "==", userData.companyId),
        where("assignedTo.id", "==", userData.uid),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const postsData = [];

      snapshot.forEach((doc) => {
        postsData.push({ id: doc.id, ...doc.data() });
      });

      setPosts(postsData);
    } catch (error) {
      console.error("Error loading assigned posts:", error);
      alert("Failed to load assigned posts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = [...posts];

    // Status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter((post) => post.status === selectedStatus);
    }

    // Priority filter
    if (selectedPriority !== "all") {
      filtered = filtered.filter((post) => post.priority === selectedPriority);
    }

    setFilteredPosts(filtered);
  };

  const handlePostUpdate = () => {
    // Reload posts after admin action
    loadAssignedPosts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assigned posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                📋 Assigned to Me
              </h1>
              <p className="text-white/90 mt-1 text-sm sm:text-base">
                Problems and tasks assigned specifically to you
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          {/* Filters Row */}
          <div className="flex flex-wrap gap-2">
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-indigo-50"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="under_review">Under Review</option>
              <option value="working_on">Working On</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-indigo-50"
            >
              <option value="all">All Priorities</option>
              <option value="critical">🔴 Critical</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">⚪ Low</option>
            </select>
          </div>

          {/* Stats */}
          <div className="mt-3 flex gap-4 text-sm text-gray-600">
            <span>
              Total Assigned: <strong>{filteredPosts.length}</strong>
            </span>
            <span>
              Open:{" "}
              <strong>{filteredPosts.filter((p) => p.status === "open" || p.status === "acknowledged").length}</strong>
            </span>
            <span>
              In Progress:{" "}
              <strong>
                {filteredPosts.filter((p) => p.status === "in_progress" || p.status === "working_on").length}
              </strong>
            </span>
            <span>
              Resolved:{" "}
              <strong>{filteredPosts.filter((p) => p.status === "resolved").length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {filteredPosts.length === 0 ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-8 text-center">
            <div className="bg-indigo-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-indigo-700 text-lg font-medium mb-2">No Assignments Found</p>
            <p className="text-gray-600 text-sm">
              {selectedStatus !== "all" || selectedPriority !== "all"
                ? "Try adjusting your filters"
                : "You don't have any posts assigned to you yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Admin Action Panel (only visible to admins) */}
                {userIsAdmin && (
                  <div className="p-4 pb-0">
                    <AdminActionPanel
                      post={post}
                      currentUser={userData}
                      onUpdate={handlePostUpdate}
                    />
                  </div>
                )}

                {/* Post Content */}
                <Post post={post} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignedToMe;
