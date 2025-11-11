/* eslint-disable react-hooks/exhaustive-deps */
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
      <div className="flex items-center justify-center min-h-[50vh] bg-[var(--color-background-softGray)]">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[var(--color-border-light)]"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[var(--color-primary-teal)] absolute top-0 left-0"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background-softGray)] pb-24">
      {/* Header with gradient and modern design */}
      <div className="bg-[var(--color-background-white)] border-b border-[var(--color-border-light)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-r ${colors.gradient} flex items-center justify-center shadow-md`}
            >
              <svg
                className="w-6 h-6 text-[var(--color-text-onDark)]"
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
            <div>
              <h1
                className={`text-2xl sm:text-3xl font-bold bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}
              >
                {title}
              </h1>
              <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">
                {description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-[var(--color-background-white)] rounded-xl border border-[var(--color-border-light)] p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-[var(--color-text-tertiary)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder={t("common.search")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-background-lightMist)] border border-[var(--color-border-light)] rounded-lg 
                         text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-teal)] focus:border-transparent
                         transition-all duration-200"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-48 pl-4 pr-10 py-2.5 bg-[var(--color-background-lightMist)] border border-[var(--color-border-light)] rounded-lg
                         text-[var(--color-text-primary)] appearance-none cursor-pointer
                         focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-teal)] focus:border-transparent
                         transition-all duration-200"
              >
                <option value="all">All Categories</option>
                {[...new Set(posts.flatMap((post) => post.tags || []))].map(
                  (tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  )
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-text-tertiary)]">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchTerm || selectedCategory !== "all") && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--color-border-light)]">
              <span className="text-sm text-[var(--color-text-secondary)] font-medium">
                Active filters:
              </span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--color-primary-teal)] bg-opacity-10 text-[var(--color-primary-teal)] text-sm rounded-full border border-[var(--color-primary-teal)] border-opacity-20">
                  Search: "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm("")}
                    className="hover:bg-[var(--color-primary-teal)] hover:bg-opacity-20 rounded-full p-0.5"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </span>
              )}
              {selectedCategory !== "all" && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--color-primary-navy)] bg-opacity-10 text-[var(--color-primary-navy)] text-sm rounded-full border border-[var(--color-primary-navy)] border-opacity-20">
                  Category: {selectedCategory}
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className="hover:bg-[var(--color-primary-navy)] hover:bg-opacity-20 rounded-full p-0.5"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Posts List */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="bg-[var(--color-background-white)] rounded-xl border border-[var(--color-border-light)] p-12 text-center shadow-sm">
            <div className="max-w-md mx-auto">
              <div
                className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-r ${colors.gradient} flex items-center justify-center shadow-lg`}
              >
                <svg
                  className="w-10 h-10 text-[var(--color-text-onDark)]"
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
              <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                {t("post.noPostsYet")}
              </h3>
              <p className="text-[var(--color-text-secondary)] mb-6">
                {searchTerm || selectedCategory !== "all"
                  ? "Try adjusting your filters to see more results"
                  : "Be the first to share your thoughts and create a post!"}
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className={`inline-flex items-center gap-2 bg-gradient-to-r ${colors.gradient} text-[var(--color-text-onDark)] px-6 py-3 rounded-lg font-semibold 
                           hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200`}
              >
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
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Showing{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {filteredPosts.length}
                </span>{" "}
                {filteredPosts.length === 1 ? "post" : "posts"}
              </p>
            </div>

            {/* Posts Grid */}
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="bg-[var(--color-background-white)] rounded-xl shadow-sm border border-[var(--color-border-light)] 
                         hover:shadow-md hover:border-[var(--color-border-medium)] transition-all duration-200"
              >
                {userIsAdmin && (
                  <div className="p-4 pb-0 border-b border-[var(--color-border-light)] bg-[var(--color-background-lightMist)] bg-opacity-50 rounded-t-xl">
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

      {/* Floating Action Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className={`
          fixed bottom-24 right-6
          sm:bottom-28 sm:right-8 
          bg-gradient-to-r ${colors.gradient} 
          text-[var(--color-text-onDark)]
          w-14 h-14 
          sm:w-auto sm:h-auto 
          sm:px-6 sm:py-3.5
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
          border-[var(--color-background-white)]
          backdrop-blur-sm
        `}
        aria-label="Create new post"
        style={{ zIndex: 100 }}
      >
        {/* Animated ring effect */}
        <span className="absolute inset-0 rounded-full bg-[var(--color-background-white)] opacity-20 group-hover:animate-ping"></span>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 sm:h-5 sm:w-5 relative z-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M12 4v16m8-8H4"
          />
        </svg>
        <span className="hidden sm:inline-block font-semibold whitespace-nowrap relative z-10">
          Create Post
        </span>
      </button>
    </div>
  );
};

export default UnifiedFeed;
