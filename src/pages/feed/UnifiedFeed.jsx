import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import Post from "../../components/Post";
import CreatePost from "../../components/CreatePost";
import AdminActionPanel from "../../components/AdminActionPanel";
import { isAdmin } from "../../services/postManagementService";
import { useTranslation } from "react-i18next";

const UnifiedFeed = ({ feedType, title, description, colors }) => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const userIsAdmin = isAdmin(userData?.role);

  useEffect(() => {
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

  // Utility function to format timestamps
  const getTimeAgo = (date) => {
    if (!date) return "Just now";

    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;

    // For older posts, show the actual date
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1
            className={`text-2xl font-bold bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}
          >
            {title}
          </h1>
          <p className="text-gray-600 text-sm mt-1">{description}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder={t("common.search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            {/* Add dynamic categories based on posts */}
            {[...new Set(posts.flatMap((post) => post.tags || []))].map(
              (tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Posts List */}
      <div className="max-w-4xl mx-auto px-4 space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <div
              className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${colors.gradient} flex items-center justify-center`}
            >
              <svg
                className="w-8 h-8 text-white"
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
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t("post.noPostsYet")}
            </h3>
            <p className="text-gray-600 mb-4">
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
                {t("post.create")}
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
                <Post post={post} getTimeAgo={getTimeAgo} />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePost
          type={
            feedType === "creative_content"
              ? "creative"
              : feedType === "problem_report"
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
