import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";
import AnonymousThread from "../components/AnonymousThread";
import { UserRole } from "../utils/constants";
import { ArrowLeft, ShieldCheck, Lock, MessageSquare } from "lucide-react";

const EmployeeMessageThread = () => {
  const { postId } = useParams();
  const { userData } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [postTitle, setPostTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (postId) loadPost();
  }, [postId]);

  const loadPost = async () => {
    try {
      const postDoc = await getDoc(doc(db, "posts", postId));
      if (postDoc.exists()) {
        setPostTitle(postDoc.data().title || "Report");
      }
    } catch (err) {
      console.error("Error loading post:", err);
    } finally {
      setLoading(false);
    }
  };

  const truncatedTitle =
    postTitle.length > 45 ? postTitle.slice(0, 45) + "\u2026" : postTitle;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      {/* Header */}
      <div
        className="px-4 py-4 flex items-center gap-3 flex-shrink-0 shadow-sm"
        style={{ backgroundColor: "#2D3E50" }}
      >
        <button
          onClick={() => navigate("/messages")}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all active:scale-95 flex-shrink-0"
        >
          <ArrowLeft className="w-[18px] h-[18px] text-white" />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#1ABC9C" }}
          >
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white truncate">
              {loading ? t("common.loading") : truncatedTitle || t("messages.thread", "Conversation")}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-white/50" />
              <span className="text-[10px] text-white/50">
                {t("messages.identityProtected", "HR Team \u00b7 Your identity is protected")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Encrypted notice bar */}
      <div className="mx-4 mt-3 mb-1">
        <div className="bg-emerald-50 border border-gray-100 rounded-2xl px-4 py-2.5 flex items-center justify-center gap-2 shadow-sm">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#1ABC9C" }}
          >
            <Lock className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">
            {t("messages.nameNeverVisible", "Your name is never visible to HR")}
          </span>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-hidden">
        {!loading && userData?.companyId && (
          <AnonymousThread
            postId={postId}
            companyId={userData.companyId}
            currentUserRole={UserRole.EMPLOYEE}
            isAnonymousPost={true}
          />
        )}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="w-9 h-9 rounded-full border-2 border-gray-200 animate-spin"
              style={{ borderTopColor: "#1ABC9C" }}
            />
            <p className="mt-3 text-xs text-gray-400">{t("common.loading")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeMessageThread;
