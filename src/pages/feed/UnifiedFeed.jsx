import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import Post from "../../components/Post";
import CreatePost from "../../components/CreatePost";
import AdminActionPanel from "../../components/AdminActionPanel";
import { PostType, COLORS } from "../../utils/constants";
import { isAdmin } from "../../services/postManagementService";

/**
 * Unified Feed Component
 * Displays posts of a specific type with role-based admin controls
 * Used for Creative Wall, Problems, and Discussions feeds
 */
const UnifiedFeed = ({ feedType, title, description, icon, categories }) => {
  const { userData } = useAuth();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const userIsAdmin = isAdmin(userData?.role);

  useEffect(() => {
    loadPosts();
  }, [userData, feedType]);

  useEffect(() => {
    filterPosts();
  }, [posts, searchTerm, selectedCategory, selectedStatus, selectedPriority]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const postsRef = collection(db, "posts");

      // Build query based on feed type
      let q;
      if (feedType === "discussions") {
        // Discussions are stored separately
        const discussionsRef = collection(db, "discussions");
        q = query(
          discussionsRef,
          where("companyId", "==", userData.companyId),
          orderBy("createdAt", "desc"),
          limit(50)
        );
      } else {
        // Creative and problems use the posts collection with type filter
        const postTypeMap = {
          creative: PostType.CREATIVE_CONTENT,
          problems: PostType.PROBLEM_REPORT,
        };

        q = query(
          postsRef,
          where("companyId", "==", userData.companyId),
          where("type", "==", postTypeMap[feedType]),
          orderBy("createdAt", "desc"),
          limit(50)
        );
      }

      const snapshot = await getDocs(q);
      const postsData = [];

      snapshot.forEach((doc) => {
        postsData.push({ id: doc.id, ...doc.data() });
      });

      setPosts(postsData);
    } catch (error) {
      console.error("Error loading posts:", error);
      alert("Failed to load posts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = [...posts];

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (post) =>
          post.title?.toLowerCase().includes(search) ||
          post.description?.toLowerCase().includes(search) ||
          post.tags?.some((tag) => tag.toLowerCase().includes(search))
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((post) => post.category === selectedCategory);
    }

    // Admin filters
    if (userIsAdmin) {
      // Status filter
      if (selectedStatus !== "all") {
        filtered = filtered.filter((post) => post.status === selectedStatus);
      }

      // Priority filter
      if (selectedPriority !== "all") {
        filtered = filtered.filter((post) => post.priority === selectedPriority);
      }
    }

    setFilteredPosts(filtered);
  };

  const handlePostUpdate = () => {
    // Reload posts after admin action
    loadPosts();
  };

  const getFeedColor = () => {
    switch (feedType) {
      case "creative":
        return {
          gradient: "from-purple-600 to-pink-600",
          bg: "bg-purple-50",
          border: "border-purple-200",
          text: "text-purple-700",
        };
      case "problems":
        return {
          gradient: "from-red-600 to-orange-600",
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-700",
        };
      case "discussions":
        return {
          gradient: "from-blue-600 to-indigo-600",
          bg: "bg-blue-50",
          border: "border-blue-200",
          text: "text-blue-700",
        };
      default:
        return {
          gradient: "from-gray-600 to-gray-700",
          bg: "bg-gray-50",
          border: "border-gray-200",
          text: "text-gray-700",
        };
    }
  };

  const colors = getFeedColor();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading {title.toLowerCase()}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} text-white py-6 px-4 sm:px-6`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                {icon} {title}
              </h1>
              <p className="text-white/90 mt-1 text-sm sm:text-base">{description}</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition text-sm sm:text-base"
            >
              + Create
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          {/* Search */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-2">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Admin Filters */}
            {userIsAdmin && (
              <>
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
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                  <option value="rejected">Rejected</option>
                </select>

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
              </>
            )}
          </div>

          {/* Stats */}
          <div className="mt-3 flex gap-4 text-sm text-gray-600">
            <span>
              Total: <strong>{filteredPosts.length}</strong>
            </span>
            {userIsAdmin && (
              <>
                <span>
                  Open:{" "}
                  <strong>{filteredPosts.filter((p) => p.status === "open").length}</strong>
                </span>
                <span>
                  Critical:{" "}
                  <strong>
                    {filteredPosts.filter((p) => p.priority === "critical").length}
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {filteredPosts.length === 0 ? (
          <div className={`${colors.bg} border ${colors.border} rounded-lg p-8 text-center`}>
            <p className={`${colors.text} text-lg font-medium mb-2`}>No posts found</p>
            <p className="text-gray-600 text-sm mb-4">
              {searchTerm || selectedCategory !== "all"
                ? "Try adjusting your filters"
                : "Be the first to create a post!"}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className={`bg-gradient-to-r ${colors.gradient} text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition`}
            >
              Create Post
            </button>
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

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePost
          type={feedType === "creative" ? "creative" : feedType === "problems" ? "complaint" : "discussion"}
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadPosts}
        />
      )}

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setShowCreateModal(true)}
        className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 bg-gradient-to-r ${colors.gradient} text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 z-50 flex items-center gap-2 group`}
        aria-label="Create new post"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap font-medium">
          Create Post
        </span>
      </button>
    </div>
  );
};

export default UnifiedFeed;