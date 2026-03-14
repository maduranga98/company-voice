import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";
import CryptoJS from "crypto-js";
import {
  createThread,
  addMessage,
  markThreadRead,
} from "../services/anonymousThreadService";
import { ThreadSender, UserRole } from "../utils/constants";

const ANONYMOUS_SECRET =
  import.meta.env.VITE_ANONYMOUS_SECRET || "default-secret-key-change-in-production";

// Brand colors
const NAVY = "#2D3E50";
const TEAL = "#00BCD4";
const CORAL = "#FF6B6B";

const decryptMessage = (encryptedText) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ANONYMOUS_SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return "[Decryption failed]";
  }
};

const isInvestigatorRole = (role) =>
  [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR].includes(role);

const formatTime = (timestamp) => {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

/**
 * AnonymousThread - two-way private messaging between reporters and investigators.
 *
 * Props:
 *   postId           - Firestore document ID of the post
 *   companyId        - Company ID for thread scoping
 *   currentUserRole  - Role string from UserRole constants, or "reporter"
 *   isAnonymousPost  - Boolean; component renders nothing when false
 */
const AnonymousThread = ({ postId, companyId, currentUserRole, isAnonymousPost, defaultOpen }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen || false);
  const [messages, setMessages] = useState([]);
  const [threadData, setThreadData] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  const isInvestigator = isInvestigatorRole(currentUserRole);
  const senderRole = isInvestigator ? ThreadSender.INVESTIGATOR : ThreadSender.REPORTER;
  const otherSender = isInvestigator ? ThreadSender.REPORTER : ThreadSender.INVESTIGATOR;

  // Live subscription to thread document
  useEffect(() => {
    if (!isAnonymousPost || !postId) return;

    const threadRef = doc(db, "anonymousThreads", postId);
    const unsubscribe = onSnapshot(threadRef, (snap) => {
      if (!snap.exists()) {
        setMessages([]);
        setThreadData(null);
        setUnreadCount(0);
        return;
      }

      const data = snap.data();
      setThreadData(data);

      const decrypted = (data.messages || []).map((msg) => ({
        ...msg,
        content: decryptMessage(msg.encryptedContent),
      }));
      setMessages(decrypted);

      // Count unread messages from the other party
      const lastReadRaw = data.lastReadBy?.[senderRole];
      const lastReadDate = lastReadRaw?.toDate ? lastReadRaw.toDate() : null;

      const unread = decrypted.filter((msg) => {
        if (msg.sender !== otherSender) return false;
        if (!lastReadDate) return true;
        return new Date(msg.timestamp) > lastReadDate;
      });
      setUnreadCount(unread.length);
    });

    return () => unsubscribe();
  }, [postId, isAnonymousPost, senderRole, otherSender]);

  // Scroll to bottom when thread opens or new messages arrive
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  if (!isAnonymousPost) return null;

  const handleToggle = async () => {
    const opening = !isOpen;
    setIsOpen(opening);

    if (opening) {
      // Ensure the thread document exists before subscribing UI
      await createThread(postId, companyId);
      // Mark all existing messages as read
      await markThreadRead(postId, senderRole);
      setUnreadCount(0);
    }
  };

  const handleSend = async () => {
    const text = replyText.trim();
    if (!text || sending) return;

    try {
      setSending(true);
      await addMessage(postId, senderRole, text, companyId);
      setReplyText("");
      // Mark immediately as read for the sender
      await markThreadRead(postId, senderRole);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const senderLabel = isInvestigator ? "Investigator" : "Reporter";
  const toggleLabel = isInvestigator
    ? "Private Investigator Thread"
    : "Private Message Thread";

  return (
    <div className="border-t border-gray-200 mt-2">
      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-gray-50 transition"
        style={{ color: NAVY }}
      >
        {/* Lock icon */}
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>

        <span className="text-sm font-medium flex-1">{toggleLabel}</span>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            className="px-2 py-0.5 text-xs font-bold text-white rounded-full"
            style={{ backgroundColor: CORAL }}
          >
            {unreadCount}
          </span>
        )}

        {/* Chevron */}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Thread Panel */}
      {isOpen && (
        <div className="px-4 pb-4">
          <div
            className="border rounded-lg overflow-hidden"
            style={{ borderColor: "#D1D5DB" }}
          >
            {/* Privacy notice */}
            <div
              className="px-4 py-2 text-xs font-medium flex items-center gap-1"
              style={{ backgroundColor: "#F0F9FF", color: NAVY, borderBottom: "1px solid #E5E7EB" }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              End-to-end encrypted · Identities protected
            </div>

            {/* Messages */}
            <div className="max-h-72 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No messages yet. Ask the reporter for more details privately.
                </p>
              ) : (
                messages.map((msg) => {
                  const isReporterMsg = msg.sender === ThreadSender.REPORTER;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isReporterMsg ? "items-start" : "items-end"}`}
                    >
                      <span className="text-xs text-gray-400 mb-1 px-1">
                        {isReporterMsg ? "Reporter" : "Investigator"} ·{" "}
                        {formatTime(msg.timestamp)}
                      </span>
                      <div
                        className="max-w-xs sm:max-w-sm px-3 py-2 rounded-xl text-sm text-white break-words"
                        style={{
                          backgroundColor: isReporterMsg ? TEAL : NAVY,
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Box */}
            <div
              className="border-t p-3 bg-white flex gap-2 items-end"
              style={{ borderColor: "#E5E7EB" }}
            >
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Reply as ${senderLabel}... (Enter to send)`}
                rows={2}
                disabled={sending}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={sending || !replyText.trim()}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                style={{ backgroundColor: NAVY }}
                onMouseEnter={(e) =>
                  !e.currentTarget.disabled &&
                  (e.currentTarget.style.opacity = "0.85")
                }
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnonymousThread;
