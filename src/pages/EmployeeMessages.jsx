import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { db } from "../config/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Shield, MessageSquare, ChevronRight } from "lucide-react";

const getTimeAgo = (timestamp) => {
  if (!timestamp) return "";
  let date;
  if (timestamp.toDate) date = timestamp.toDate();
  else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
  else date = new Date(timestamp);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const EmployeeMessages = () => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData?.id) loadThreads();
  }, [userData?.id]);

  const loadThreads = async () => {
    setLoading(true);
    try {
      // Query by authorId (non-anon posts) and by creatorId (anonymous posts with encrypted authorId).
      // Run separately so a missing index on creatorId doesn't break the primary query.
      const postsSnap1 = await getDocs(query(collection(db, "posts"), where("companyId", "==", userData.companyId), where("authorId", "==", userData.id)));
      let postsSnap2Docs = [];
      try {
        const postsSnap2 = await getDocs(query(collection(db, "posts"), where("companyId", "==", userData.companyId), where("creatorId", "==", userData.id)));
        postsSnap2Docs = postsSnap2.docs;
      } catch { /* index not yet available */ }
      const seenIds = new Set();
      const userPosts = [];
      [...postsSnap1.docs, ...postsSnap2Docs].forEach((d) => {
        if (!seenIds.has(d.id)) { seenIds.add(d.id); userPosts.push({ id: d.id, ...d.data() }); }
      });

      const threadResults = [];
      for (const post of userPosts) {
        if (!post.isAnonymous) continue;
        try {
          const threadDoc = await getDoc(doc(db, "anonymousThreads", post.id));
          if (threadDoc.exists()) {
            const threadData = threadDoc.data();
            const messages = threadData.messages || [];
            if (messages.length > 0) {
              const lastReadByReporter = threadData.lastReadBy?.reporter || null;
              let unreadCount = 0;
              if (lastReadByReporter) {
                const lastReadTime = lastReadByReporter.toDate
                  ? lastReadByReporter.toDate()
                  : new Date(lastReadByReporter);
                unreadCount = messages.filter(
                  (m) =>
                    m.sender === "investigator" &&
                    m.timestamp &&
                    (m.timestamp.toDate
                      ? m.timestamp.toDate()
                      : new Date(m.timestamp.seconds * 1000)) > lastReadTime
                ).length;
              } else {
                unreadCount = messages.filter((m) => m.sender === "investigator").length;
              }

              const lastMsg = messages[messages.length - 1];
              threadResults.push({
                postId: post.id,
                postTitle: post.title || "Untitled",
                lastMessage: lastMsg,
                unreadCount,
                threadData,
              });
            }
          }
        } catch {
          // skip this thread on error
        }
      }

      threadResults.sort((a, b) => {
        const aTs = a.lastMessage?.timestamp;
        const bTs = b.lastMessage?.timestamp;
        if (!aTs && !bTs) return 0;
        if (!aTs) return 1;
        if (!bTs) return -1;
        const aDate = aTs.toDate ? aTs.toDate() : new Date(aTs.seconds * 1000);
        const bDate = bTs.toDate ? bTs.toDate() : new Date(bTs.seconds * 1000);
        return bDate - aDate;
      });

      setThreads(threadResults);
    } catch (err) {
      console.error("Error loading threads:", err);
    } finally {
      setLoading(false);
    }
  };

  const getLastMessagePreview = (msg) => {
    if (!msg) return "";
    const text = msg.text || msg.content || msg.message || "";
    return text.length > 50 ? text.slice(0, 50) + "..." : text;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-xl border-2 border-[#1ABC9C] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
          <MessageSquare size={20} className="text-teal-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            {t("navigation.messages", "Messages")}
          </h1>
          <p className="text-xs text-gray-400">Private conversations with HR</p>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 flex gap-3 items-start">
        <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield size={16} className="text-emerald-600" />
        </div>
        <p className="text-xs text-emerald-700 leading-relaxed">
          {t(
            "messages.privacy",
            "Only you and HR can see these conversations. Your name is never revealed."
          )}
        </p>
      </div>

      {/* Thread list */}
      {threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
            <Shield size={28} className="text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            {t("messages.noMessages", "No private messages yet")}
          </h3>
          <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">
            {t(
              "messages.noMessagesDesc",
              "When HR needs more information about your reports, they will send you a private message here."
            )}
          </p>
          <button
            onClick={() => navigate("/feed/problems")}
            className="px-5 py-3 bg-[#1ABC9C] text-white text-sm font-semibold rounded-xl hover:bg-[#17a589] transition-colors"
          >
            {t("messages.goToProblems", "Go to Problems Wall")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => (
            <button
              key={thread.postId}
              onClick={() => navigate(`/messages/${thread.postId}`)}
              className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex gap-3 hover:shadow-md hover:border-gray-200 active:scale-[0.99] transition-all text-left group"
            >
              {/* Icon */}
              <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageSquare size={18} className="text-teal-600" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  Re: {thread.postTitle.length > 40
                    ? thread.postTitle.slice(0, 40) + "..."
                    : thread.postTitle}
                </div>
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {getLastMessagePreview(thread.lastMessage)}
                </div>
                <div className="text-[10px] text-gray-300 mt-2">
                  {getTimeAgo(thread.lastMessage?.timestamp)}
                </div>
              </div>

              {/* Unread badge or chevron */}
              <div className="flex-shrink-0 flex items-center">
                {thread.unreadCount > 0 ? (
                  <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-lg flex items-center justify-center">
                    {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
                  </span>
                ) : (
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeMessages;
