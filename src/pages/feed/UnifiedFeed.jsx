/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import PostEnhanced from "../../components/PostEnhanced";
import CreatePost from "../../components/CreatePost";
import AdminActionPanel from "../../components/AdminActionPanel";
import { isAdmin, getPostsWithPrivacyFilter } from "../../services/postManagementService";
import { useTranslation } from "react-i18next";
import { getPinnedPosts } from "../../services/postEnhancedFeaturesService";
import { PostSkeleton } from "../../components/SkeletonLoader";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";
import { Search, X, Plus, Pin, ChevronDown, SlidersHorizontal } from "lucide-react";

const UnifiedFeed = ({ feedType, title, description, colors }) => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const [posts, setPosts] = useState([]);
  const [pinnedPosts, setPinnedPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const userIsAdmin = isAdmin(userData?.role);

  useEffect(() => {
    if (!userData?.companyId) return;
    loadPosts();
    const postsRef = collection(db, "posts");
    const postsQuery = query(postsRef, where("companyId", "==", userData.companyId));
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      if (!snapshot.metadata.hasPendingWrites) loadPosts();
    }, (error) => {
      console.error("Error with real-time updates:", error);
    });
    return () => unsubscribe();
  }, [userData, feedType]);

  useEffect(() => { filterPosts(); }, [posts, searchTerm, selectedCategory]);

  useEffect(() => {
    if (searchTerm || selectedCategory !== "all") {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [searchTerm, selectedCategory]);

  const loadPosts = async () => {
    if (!userData?.companyId) return;
    try {
      setLoading(true);
      const postsData = await getPostsWithPrivacyFilter(userData.companyId, feedType, userData);
      const pinned = await getPinnedPosts(userData.companyId, feedType);
      const filteredPinned = pinned.filter(post => {
        if (post.isArchived) return false;
        if (userData.role === "super_admin" || userData.role === "company_admin") return true;
        const privacyLevel = post.privacyLevel || "company_public";
        if (privacyLevel === "company_public") return true;
        if (privacyLevel === "hr_only") return userData.role === "hr" || userData.role === "company_admin" || userData.role === "super_admin";
        if (privacyLevel === "department_only") {
          if (userData.role === "hr") return true;
          if (userData.departmentId && post.departmentId) return userData.departmentId === post.departmentId;
          return false;
        }
        return true;
      });
      setPinnedPosts(filteredPinned);
      setPosts(postsData);
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = [...posts];
    if (searchTerm) {
      filtered = filtered.filter((post) =>
        post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.content?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCategory !== "all") {
      filtered = filtered.filter((post) => post.category === selectedCategory);
    }
    setFilteredPosts(filtered);
  };

  const handlePostUpdate = () => { loadPosts(); };

  const categories = [...new Set(posts.map((post) => post.category).filter(Boolean))].sort();

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <PostSkeleton count={5} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Feed header with search */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-3">
        {/* Title + description */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${colors.gradient} flex items-center justify-center shadow-sm`}>
            <SlidersHorizontal size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>

        {/* Search and filter bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("common.search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={14} className="text-gray-400" />
              </button>
            )}
          </div>

          {categories.length > 0 && (
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] cursor-pointer transition-all"
              >
                <option value="all">{t('feed.allCategories')}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Active filters */}
        {(searchTerm || selectedCategory !== "all") && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs font-medium text-gray-400">{t('feed.activeFilters')}</span>
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1ABC9C]/10 text-[#1ABC9C] text-xs font-medium rounded-lg border border-[#1ABC9C]/20">
                &ldquo;{searchTerm}&rdquo;
                <button onClick={() => setSearchTerm("")} className="hover:text-[#16a085]"><X size={12} /></button>
              </span>
            )}
            {selectedCategory !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg border border-gray-200">
                {selectedCategory}
                <button onClick={() => setSelectedCategory("all")} className="hover:text-gray-800"><X size={12} /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Posts */}
      <div className="max-w-2xl mx-auto px-4 space-y-3">
        {filteredPosts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-r ${colors.gradient} flex items-center justify-center shadow-lg`}>
              <Plus size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t("post.noPostsYet")}</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              {searchTerm || selectedCategory !== "all"
                ? t('feed.noPostsYet')
                : t('feed.createFirst')}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className={`inline-flex items-center gap-2 bg-gradient-to-r ${colors.gradient} text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg active:scale-95 transition-all`}
            >
              <Plus size={18} />
              {t("post.create")}
            </button>
          </div>
        ) : (
          <>
            {/* Results count */}
            <p className="text-xs text-gray-400 font-medium px-1">
              {filteredPosts.length} {filteredPosts.length === 1 ? "post" : "posts"}
            </p>

            {/* Pinned posts */}
            {pinnedPosts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Pin size={12} className="text-purple-500" />
                  <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">{t('feed.pinnedPosts')}</span>
                </div>
                {pinnedPosts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white rounded-2xl shadow-sm border-2 border-purple-100 hover:border-purple-200 hover:shadow-md transition-all"
                  >
                    {userIsAdmin && (
                      <div className="p-3 border-b border-gray-50 bg-gray-50/50 rounded-t-2xl">
                        <AdminActionPanel post={post} currentUser={userData} onUpdate={handlePostUpdate} />
                      </div>
                    )}
                    <PostEnhanced post={post} />
                  </div>
                ))}
              </div>
            )}

            {/* Regular posts */}
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all"
              >
                {userIsAdmin && (
                  <div className="p-3 border-b border-gray-50 bg-gray-50/50 rounded-t-2xl">
                    <AdminActionPanel post={post} currentUser={userData} onUpdate={handlePostUpdate} />
                  </div>
                )}
                <PostEnhanced post={post} />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Create post modal */}
      {showCreateModal && (
        <CreatePost
          type={
            feedType === "creative_content" ? "creative"
            : feedType === "problem_report" ? "complaint"
            : "discussion"
          }
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadPosts}
        />
      )}

      {/* FAB */}
      <button
        onClick={() => setShowCreateModal(true)}
        className={`fixed bottom-24 right-5 lg:bottom-8 lg:right-8 w-14 h-14 lg:w-auto lg:h-auto lg:px-5 lg:py-3 bg-gradient-to-r ${colors.gradient} text-white rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 z-50 border-2 border-white/30`}
        aria-label="Create new post"
      >
        <Plus size={22} className="lg:w-5 lg:h-5" />
        <span className="hidden lg:inline font-semibold text-sm">{t('post.create')}</span>
      </button>
    </div>
  );
};

export default UnifiedFeed;
