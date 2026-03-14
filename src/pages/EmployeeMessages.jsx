import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { db } from "../config/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

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
      // 1. Fetch user's posts
      const postsQuery = query(
        collection(db, "posts"),
        where("companyId", "==", userData.companyId),
        where("authorId", "==", userData.id)
      );
      const postsSnap = await getDocs(postsQuery);
      const userPosts = [];
      postsSnap.forEach((d) => userPosts.push({ id: d.id, ...d.data() }));

      // 2. For each anonymous post, check if thread exists
      const threadResults = [];
      for (const post of userPosts) {
        if (!post.isAnonymous) continue;
        try {
          const threadDoc = await getDoc(doc(db, "anonymousThreads", post.id));
          if (threadDoc.exists()) {
            const threadData = threadDoc.data();
            const messages = threadData.messages || [];
            if (messages.length > 0) {
              // Check for unread messages from investigator
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
                // No read timestamp — count all investigator messages as unread
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

      // Sort by last message timestamp (most recent first)
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
    // Try to use plain text (messages may be encrypted)
    const text = msg.text || msg.content || msg.message || "";
    return text.length > 50 ? text.slice(0, 50) + "…" : text;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-b-2 border-[#1ABC9C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
      {/* Privacy notice */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex gap-2 items-start">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" className="flex-shrink-0 mt-0.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <p className="text-[11px] text-green-700 leading-relaxed">
          {t(
            "messages.privacy",
            "Only you and HR can see these conversations. Your name is never revealed."
          )}
        </p>
      </div>

      {/* Page title */}
      <h1 className="text-xl font-bold text-gray-900 mb-4">
        {t("navigation.messages", "Messages")}
      </h1>

      {/* Thread list */}
      {threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
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
            className="px-5 py-2.5 bg-[#1ABC9C] text-white text-sm font-semibold rounded-xl"
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
              className="w-full bg-white rounded-2xl shadow-sm p-4 flex gap-3 active:scale-[0.99] transition-transform text-left"
            >
              {/* Icon */}
              <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-gray-900 truncate">
                  Re: {thread.postTitle.length > 40
                    ? thread.postTitle.slice(0, 40) + "…"
                    : thread.postTitle}
                </div>
                <div className="text-[10px] text-gray-400 mt-1 truncate">
                  {getLastMessagePreview(thread.lastMessage)}
                </div>
                <div className="text-[9px] text-gray-300 mt-2">
                  {getTimeAgo(thread.lastMessage?.timestamp)}
                </div>
              </div>

              {/* Unread badge */}
              {thread.unreadCount > 0 && (
                <div className="flex-shrink-0 flex items-start pt-0.5">
                  <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeMessages;
