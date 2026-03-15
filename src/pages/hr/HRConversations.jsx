import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  subscribeToCompanyThreads,
  markThreadRead,
} from "../../services/anonymousThreadService";
import AnonymousThread from "../../components/AnonymousThread";
import { UserRole, ThreadSender } from "../../utils/constants";
import {
  ArrowLeft,
  Lock,
  Search,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  Edit3,
  ShieldCheck,
} from "lucide-react";

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
    problem_report: { bg: "bg-red-50", icon: <AlertTriangle size={16} className="text-red-500" /> },
    creative_content: { bg: "bg-purple-50", icon: <Edit3 size={16} className="text-purple-500" /> },
    team_discussion: { bg: "bg-blue-50", icon: <MessageSquare size={16} className="text-blue-500" /> },
    idea_suggestion: { bg: "bg-emerald-50", icon: <Lightbulb size={16} className="text-emerald-500" /> },
  };

  const c = config[postType] || config.problem_report;

  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg}`}>
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
      return t.postTitle.toLowerCase().includes(s) || t.postId.toLowerCase().includes(s);
    }
    return true;
  });

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);
  const selectedThread = threads.find((t) => t.postId === selectedPostId);

  const handleSelectThread = (thread) => {
    setSelectedPostId(thread.postId);
    markThreadRead(thread.postId, ThreadSender.INVESTIGATOR);
  };

  // Thread detail view
  if (selectedPostId !== null) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setSelectedPostId(null)}
            className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-xl flex-shrink-0 hover:bg-gray-200 transition"
          >
            <ArrowLeft size={16} className="text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Anonymous Reporter</p>
            <p className="text-xs text-gray-500 truncate">
              Re: {selectedThread?.postTitle || "Loading..."}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5">
            <Lock size={12} className="text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700">Encrypted</span>
          </div>
        </header>

        {/* Privacy notice */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center gap-2">
          <ShieldCheck size={14} className="text-emerald-600 flex-shrink-0" />
          <p className="text-xs text-emerald-700">
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

  // Inbox list view
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
            <MessageSquare size={20} className="text-teal-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">Conversations</h1>
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">
                  {totalUnread}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">{filteredThreads.length} conversation{filteredThreads.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] transition-all"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setFilterUnread(!filterUnread)}
          className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
            filterUnread
              ? "bg-[#1ABC9C] text-white"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          Unread only
        </button>
      </div>

      {/* Privacy bar */}
      <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex items-center gap-2">
        <Lock size={12} className="text-emerald-600 flex-shrink-0" />
        <p className="text-xs text-emerald-700 font-medium">
          Reporter identities are never visible. All messages are encrypted.
        </p>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-xl border-2 border-[#1ABC9C] border-t-transparent animate-spin" />
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-gray-300" />
            </div>
            <p className="text-base font-semibold text-gray-900 mb-1">No conversations yet</p>
            <p className="text-sm text-gray-500 text-center max-w-xs">
              When employees send anonymous reports and HR starts a private thread, conversations will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredThreads.map((thread) => (
              <button
                key={thread.postId}
                onClick={() => handleSelectThread(thread)}
                className="w-full bg-white px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition text-left"
              >
                <div className="flex gap-3">
                  <PostTypeAvatar postType={thread.postType} />

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-semibold text-gray-900 truncate flex-1 mr-2">
                        {thread.postTitle}
                      </p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {formatTimeAgo(thread.lastActivity)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500 truncate flex-1">
                        {thread.lastMessageSender === "reporter"
                          ? `Reporter: ${thread.lastMessagePreview}`
                          : `You: ${thread.lastMessagePreview}`}
                      </p>
                      {thread.unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-lg flex items-center justify-center ml-2 flex-shrink-0">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-gray-300 mt-1.5">
                      {thread.messageCount} message{thread.messageCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HRConversations;
