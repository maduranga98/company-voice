import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  subscribeToCompanyThreads,
  markThreadRead,
} from "../../services/anonymousThreadService";
import AnonymousThread from "../../components/AnonymousThread";
import { UserRole, ThreadSender } from "../../utils/constants";

const formatTimeAgo = (date) => {
  if (!date) return "";
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const PostTypeAvatar = ({ postType }) => {
  const config = {
    problem_report: {
      bg: "bg-red-100",
      text: "text-red-600",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    creative_content: {
      bg: "bg-purple-100",
      text: "text-purple-600",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
    },
    team_discussion: {
      bg: "bg-blue-100",
      text: "text-blue-600",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    idea_suggestion: {
      bg: "bg-green-100",
      text: "text-green-600",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
  };

  const c = config[postType] || config.problem_report;

  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${c.bg} ${c.text}`}>
      {c.icon}
    </div>
  );
};

const HRConversations = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);

  useEffect(() => {
    if (!userData) return;

    // Role guard
    if (userData.role !== UserRole.HR && userData.role !== UserRole.COMPANY_ADMIN) {
      navigate("/dashboard");
      return;
    }

    if (!userData.companyId) return;

    const unsubscribe = subscribeToCompanyThreads(userData.companyId, (updatedThreads) => {
      setThreads(updatedThreads);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData, navigate]);

  const filteredThreads = threads.filter((t) => {
    if (filterUnread && t.unreadCount === 0) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        t.postTitle.toLowerCase().includes(s) ||
        t.postId.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  const selectedThread = threads.find((t) => t.postId === selectedPostId);

  const handleSelectThread = (thread) => {
    setSelectedPostId(thread.postId);
    markThreadRead(thread.postId, ThreadSender.INVESTIGATOR);
  };

  // ─── THREAD DETAIL VIEW ───────────────────────────────────────────────────
  if (selectedPostId !== null) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-[#2D3E50] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setSelectedPostId(null)}
            className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg flex-shrink-0 hover:bg-white/20 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Anonymous Reporter</p>
            <p className="text-xs text-white/50 truncate">
              Re: {selectedThread?.postTitle || "Loading..."}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-green-700/40 border border-green-500/30 rounded-full px-2 py-1">
            <svg className="w-3 h-3 text-white/60" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs text-white/60">Encrypted</span>
          </div>
        </header>

        {/* Privacy notice */}
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex items-center gap-2">
          <svg className="w-3 h-3 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-green-700">
            The reporter&apos;s identity is protected. You are communicating with &apos;Reporter&apos;.
          </p>
        </div>

        {/* Thread content */}
        <div className="flex-1 overflow-y-auto">
          {selectedPostId && (
            <AnonymousThread
              postId={selectedPostId}
              companyId={userData.companyId}
              currentUserRole={userData.role}
              isAnonymousPost={true}
              defaultOpen={true}
            />
          )}
        </div>
      </div>
    );
  }

  // ─── INBOX LIST VIEW ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#2D3E50] text-white sticky top-0 z-10 px-4 pt-4">
        {/* Row 1: Title + unread badge */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Conversations</h1>
          {totalUnread > 0 && (
            <span className="bg-[#FF6B6B] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {totalUnread} unread
            </span>
          )}
        </div>

        {/* Row 2: Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search conversations..."
          className="w-full mt-2 bg-white/10 border-0 text-white placeholder-white/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
        />

        {/* Row 3: Filter row */}
        <div className="flex items-center gap-2 mt-2 pb-3">
          <button
            onClick={() => setFilterUnread(!filterUnread)}
            className={`text-xs font-medium px-3 py-1 rounded-full transition ${
              filterUnread
                ? "bg-[#1ABC9C] text-white"
                : "bg-white/10 text-white/60"
            }`}
          >
            Unread only
          </button>
          <span className="text-xs text-white/50 ml-auto">
            {filteredThreads.length} conversation{filteredThreads.length !== 1 ? "s" : ""}
          </span>
        </div>
      </header>

      {/* Privacy notice bar */}
      <div className="bg-green-700/30 border-b border-green-600/30 px-4 py-2 flex items-center gap-2">
        <svg className="w-3 h-3 text-white/60 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <p className="text-xs text-white/60">
          Reporter identities are never visible. All messages are encrypted.
        </p>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-[#1ABC9C]" />
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-600 font-medium">No conversations yet</p>
            <p className="text-sm text-gray-400 text-center max-w-xs mt-1">
              When employees send anonymous reports and HR starts a private thread, conversations will appear here.
            </p>
          </div>
        ) : (
          filteredThreads.map((thread) => (
            <button
              key={thread.postId}
              onClick={() => handleSelectThread(thread)}
              className="w-full bg-white border-b border-gray-100 px-4 py-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition text-left"
            >
              <div className="flex gap-3">
                <PostTypeAvatar postType={thread.postType} />

                <div className="flex-1 min-w-0">
                  {/* Row 1: title + time */}
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-gray-900 truncate flex-1 mr-2">
                      {thread.postTitle}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatTimeAgo(thread.lastActivity)}
                    </span>
                  </div>

                  {/* Row 2: preview + unread badge */}
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-gray-500 truncate flex-1">
                      {thread.lastMessageSender === "reporter"
                        ? `Reporter: ${thread.lastMessagePreview}`
                        : `You: ${thread.lastMessagePreview}`}
                    </p>
                    {thread.unreadCount > 0 && (
                      <span className="bg-[#FF6B6B] text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-5 text-center ml-2 flex-shrink-0">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Row 3: message count */}
                  <p className="text-xs text-gray-300 mt-1">
                    {thread.messageCount} message{thread.messageCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default HRConversations;
