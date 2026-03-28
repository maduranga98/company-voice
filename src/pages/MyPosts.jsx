import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PostEnhanced from "../components/PostEnhanced";
import AnonymousThread from "../components/AnonymousThread";
import {
  getUserPosts,
  markPostAsViewed,
} from "../services/postManagementService";
import { getUserBookmarks } from "../services/bookmarkService";
import {
  PostType,
  PostStatusConfig,
  PostPriorityConfig,
} from "../utils/constants";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { ChevronUp, Shield, FileText, Eye, Bookmark } from "lucide-react";

const getTimeAgo = (date) => {
  if (!date) return "Just now";
  let dateObj = date;
  if (date.seconds) dateObj = new Date(date.seconds * 1000);
  else if (!(date instanceof Date)) dateObj = new Date(date);
  const seconds = Math.floor((new Date() - dateObj) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return dateObj.toLocaleDateString();
};

const getPostTypeColor = (type) => {
  switch (type) {
    case PostType.PROBLEM_REPORT: return "bg-red-50 text-red-600 border-red-100";
    case PostType.CREATIVE_CONTENT: return "bg-purple-50 text-purple-600 border-purple-100";
    case PostType.TEAM_DISCUSSION: return "bg-blue-50 text-blue-600 border-blue-100";
    default: return "bg-gray-50 text-gray-600 border-gray-100";
  }
};

const getPostTypeLabel = (type) => {
  switch (type) {
    case PostType.PROBLEM_REPORT: return "Problem";
    case PostType.CREATIVE_CONTENT: return "Creative";
    case PostType.TEAM_DISCUSSION: return "Discussion";
    default: return "Post";
  }
};

const HRReplyHint = ({ postId, userId, navigate }) => {
  const [hasUnread, setHasUnread] = useState(false);
  const [hasThread, setHasThread] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const threadDoc = await getDoc(doc(db, "anonymousThreads", postId));
        if (!threadDoc.exists()) return;
        const data = threadDoc.data();
        const messages = data.messages || [];
        if (messages.length === 0) return;
        setHasThread(true);
        const lastReadByReporter = data.lastReadBy?.reporter || null;
        const lastReadTime = lastReadByReporter?.toDate
          ? lastReadByReporter.toDate()
          : lastReadByReporter
            ? new Date(lastReadByReporter)
            : null;
        const unread = messages.filter((m) => {
          if (m.sender !== "investigator") return false;
          if (!lastReadTime) return true;
          const msgTime = m.timestamp?.toDate
            ? m.timestamp.toDate()
            : new Date(m.timestamp);
          return msgTime > lastReadTime;
        });
        setHasUnread(unread.length > 0);
      } catch {}
    };
    check();
  }, [postId]);

  if (!hasThread) return null;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigate(`/messages/${postId}`); }}
      className={`mt-3 w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
        hasUnread
          ? 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100'
          : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'
      }`}
    >
      <Shield size={14} />
      {hasUnread ? 'HR replied — tap to view private message' : 'View private conversation with HR'}
      {hasUnread && <span className="ml-auto w-2 h-2 bg-teal-500 rounded-full animate-pulse" />}
    </button>
  );
};

const MyPosts = () => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedPost, setExpandedPost] = useState(null);

  useEffect(() => { loadMyPosts(); }, [userData]);
  useEffect(() => {
    if (activeTab === "saved") {
      loadSavedPosts();
    } else {
      filterPosts();
    }
  }, [posts, activeTab]);

  const loadMyPosts = async () => {
    try {
      setLoading(true);
      const myPosts = await getUserPosts(userData.id, userData.companyId);
      setPosts(myPosts);
    } catch (error) {
      console.error("Error loading my posts:", error);
      alert(t("myPosts.failedToLoad"));
    } finally {
      setLoading(false);
    }
  };

  const loadSavedPosts = async () => {
    try {
      setSavedLoading(true);
      const bookmarkedIds = await getUserBookmarks(userData.id, userData.companyId);
      const fetched = await Promise.all(
        bookmarkedIds.map(async (postId) => {
          const snap = await getDoc(doc(db, "posts", postId));
          if (!snap.exists()) return null;
          const data = snap.data();
          return {
            id: snap.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          };
        })
      );
      setSavedPosts(fetched.filter(Boolean));
      setFilteredPosts(fetched.filter(Boolean));
    } catch (error) {
      console.error("Error loading saved posts:", error);
    } finally {
      setSavedLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = [...posts];
    switch (activeTab) {
      case "problems": filtered = filtered.filter((p) => p.type === PostType.PROBLEM_REPORT); break;
      case "creative": filtered = filtered.filter((p) => p.type === PostType.CREATIVE_CONTENT); break;
      case "discussions": filtered = filtered.filter((p) => p.type === PostType.TEAM_DISCUSSION); break;
      case "drafts": filtered = filtered.filter((p) => p.isDraft); break;
      case "unread": filtered = filtered.filter((p) => p.hasUnreadUpdates); break;
      default: break;
    }
    setFilteredPosts(filtered);
  };

  const handleExpandPost = async (post) => {
    setExpandedPost(post.id);
    await markPostAsViewed(post.id, userData.id, userData.companyId);
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, hasUnreadUpdates: false } : p))
    );
  };

  const handleCollapsePost = () => setExpandedPost(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-xl border-2 border-[#1ABC9C] border-t-transparent animate-spin" />
      </div>
    );
  }

  const tabs = [
    { value: "all", label: t("myPosts.allPosts", "All"), count: posts.length },
    { value: "problems", label: t("myPosts.problems", "Problems"), count: posts.filter((p) => p.type === PostType.PROBLEM_REPORT).length },
    { value: "creative", label: t("myPosts.creative", "Creative"), count: posts.filter((p) => p.type === PostType.CREATIVE_CONTENT).length },
    { value: "discussions", label: t("myPosts.discussions", "Discussions"), count: posts.filter((p) => p.type === PostType.TEAM_DISCUSSION).length },
    { value: "drafts", label: t("myPosts.drafts", "Drafts"), count: posts.filter((p) => p.isDraft).length },
    { value: "unread", label: t("myPosts.unreadUpdates", "Unread"), count: posts.filter((p) => p.hasUnreadUpdates).length },
    { value: "saved", label: t("myPosts.saved", "Saved"), count: savedPosts.length },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
          <FileText size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{t("myPosts.title", "My Posts")}</h1>
          <p className="text-xs text-gray-400">{posts.length} total posts</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 no-scrollbar" style={{ scrollbarWidth: "none" }}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === tab.value
                ? "bg-[#2D3E50] text-white shadow-sm"
                : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                activeTab === tab.value ? "bg-white/20" : "bg-gray-100"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Saved loading */}
      {activeTab === "saved" && savedLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 rounded-xl border-2 border-[#1ABC9C] border-t-transparent animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!savedLoading && filteredPosts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
            {activeTab === "saved" ? <Bookmark size={28} className="text-gray-300" /> : <FileText size={28} className="text-gray-300" />}
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {activeTab === "saved" ? t("myPosts.noSaved", "No saved posts") : t("myPosts.noPosts", "No posts")}
          </h3>
          <p className="text-sm text-gray-500 max-w-xs">
            {activeTab === "all"
              ? t("myPosts.noPostsYet", "You haven't created any posts yet")
              : activeTab === "saved"
              ? t("myPosts.noSavedYet", "Bookmark posts to find them here")
              : `No ${activeTab} posts found`}
          </p>
        </div>
      )}

      {/* Post cards */}
      <div className="space-y-3">
        {filteredPosts.map((post) => {
          const isExpanded = expandedPost === post.id;
          const isAnonymous = post.isAnonymous;

          return (
            <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
              {!isExpanded ? (
                <div className="p-4">
                  {/* Top row: badges + time */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${getPostTypeColor(post.type)}`}>
                      {getPostTypeLabel(post.type)}
                    </span>
                    {post.isDraft && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                        Draft
                      </span>
                    )}
                    {isAnonymous && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-100">
                        Anonymous
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">{getTimeAgo(post.createdAt)}</span>
                    {post.hasUnreadUpdates && (
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">{post.title}</h3>

                  {/* Status badges */}
                  {post.type === PostType.PROBLEM_REPORT && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {post.status && PostStatusConfig[post.status] && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${PostStatusConfig[post.status].bgColor} ${PostStatusConfig[post.status].textColor}`}>
                          {PostStatusConfig[post.status].label}
                        </span>
                      )}
                      {post.priority && PostPriorityConfig[post.priority] && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${PostPriorityConfig[post.priority].bgColor} ${PostPriorityConfig[post.priority].textColor}`}>
                          {PostPriorityConfig[post.priority].icon} {PostPriorityConfig[post.priority].label}
                        </span>
                      )}
                    </div>
                  )}

                  {post.isAnonymous && (
                    <HRReplyHint postId={post.id} userId={userData.id} navigate={navigate} />
                  )}

                  {/* Expand button */}
                  <button
                    onClick={() => handleExpandPost(post)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-[#1ABC9C] font-semibold hover:text-[#17a589] transition-colors"
                  >
                    <Eye size={13} />
                    {t("myPosts.viewDetails", "View details")}
                  </button>
                </div>
              ) : (
                <div>
                  {/* Collapse header */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${getPostTypeColor(post.type)}`}>
                        {getPostTypeLabel(post.type)}
                      </span>
                      {post.isDraft && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                          Draft
                        </span>
                      )}
                      {isAnonymous && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-100">
                          Anonymous
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleCollapsePost}
                      className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <ChevronUp size={16} className="text-gray-500" />
                    </button>
                  </div>

                  <PostEnhanced post={post} />

                  {isAnonymous && (
                    <AnonymousThread
                      postId={post.id}
                      companyId={post.companyId || userData.companyId}
                      currentUserRole="reporter"
                      isAnonymousPost={true}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyPosts;
