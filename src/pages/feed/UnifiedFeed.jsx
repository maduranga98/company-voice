import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import Post from "../../components/Post";
import CreatePost from "../../components/CreatePost";
import AdminActionPanel from "../../components/AdminActionPanel";
import { isAdmin } from "../../services/postManagementService";
import { PostType } from "../../utils/constants";

/**
 * UnifiedFeed Component
 * Base component for all feed types (Creative, Problems, Discussions)
 * Shows posts filtered by type with unified controls
 */
const UnifiedFeed = ({ feedType, title, description, colors }) => {
  const { userData } = useAuth();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const userIsAdmin = isAdmin(userData?.role);

  useEffect(() => {
    console.log("first");
    loadPosts();
  }, [userData, feedType]);

  useEffect(() => {
    filterPosts();
  }, [posts, searchTerm, selectedCategory]);

  const loadPosts = async () => {
    if (!userData?.companyId) return;

    try {
      setLoading(true);
      const postsQuery = query(
        collection(db, "posts"),
        where("companyId", "==", userData.companyId),
        where("type", "==", feedType),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(postsQuery);
      const postsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      }));

      setPosts(postsData);
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = [...posts];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (post) =>
          post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          post.content?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((post) =>
        post.tags?.includes(selectedCategory)
      );
    }

    setFilteredPosts(filtered);
  };

  const handlePostUpdate = () => {
    loadPosts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className={`text-2xl sm:text-3xl font-bold ${colors.text} mb-2`}>
          {title}
        </h1>
        <p className="text-gray-600">{description}</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search posts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Categories</option>
          <option value="feedback">Feedback</option>
          <option value="suggestion">Suggestion</option>
          <option value="question">Question</option>
          <option value="announcement">Announcement</option>
        </select>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <div
            className={`${colors.bg} border ${colors.border} rounded-lg p-8 text-center`}
          >
            <div className="mb-4">
              <svg
                className={`mx-auto h-16 w-16 ${colors.text} opacity-50`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className={`${colors.text} text-lg font-medium mb-2`}>
              No posts found
            </p>
            <p className="text-gray-600 text-sm mb-6">
              {searchTerm || selectedCategory !== "all"
                ? "Try adjusting your filters"
                : "Be the first to create a post!"}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className={`bg-gradient-to-r ${colors.gradient} text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-all transform hover:scale-105 shadow-lg`}
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Post
              </span>
            </button>
          </div>
        ) : (
          <>
            {filteredPosts.map((post) => (
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
            ))}
          </>
        )}
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePost
          type={
            feedType === "creative"
              ? "creative"
              : feedType === "problems"
              ? "complaint"
              : "discussion"
          }
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadPosts}
        />
      )}

      {/* Floating Action Button - FIXED VERSION */}
      <button
        onClick={() => setShowCreateModal(true)}
        className={`
          fixed bottom-20 right-6 
          sm:bottom-24 sm:right-8 
          bg-gradient-to-r ${colors.gradient} 
          text-white 
          w-14 h-14 
          sm:w-auto sm:h-auto 
          sm:px-6 sm:py-3 
          rounded-full 
          shadow-2xl 
          hover:shadow-3xl 
          transition-all 
          duration-300 
          transform 
          hover:scale-110 
          active:scale-95
          z-[100]
          flex 
          items-center 
          justify-center
          gap-2 
          group
          border-2
          border-white
        `}
        aria-label="Create new post"
        style={{ zIndex: 100 }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 sm:h-5 sm:w-5"
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
        <span className="hidden sm:inline-block font-semibold whitespace-nowrap">
          Create Post
        </span>
      </button>
    </div>
  );
};

export default UnifiedFeed;
