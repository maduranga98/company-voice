import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";
import AnonymousThread from "../components/AnonymousThread";
import { UserRole } from "../utils/constants";

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
    postTitle.length > 45 ? postTitle.slice(0, 45) + "…" : postTitle;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#2D3E50] px-3 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate("/messages")}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-white truncate">
            {loading ? t("common.loading") : truncatedTitle || t("messages.thread", "Conversation")}
          </div>
          <div className="text-[10px] text-white/50 mt-0.5">
            {t("messages.identityProtected", "HR Team · Your identity is protected")}
          </div>
        </div>
      </div>

      {/* Encrypted notice bar */}
      <div className="mx-4 mt-3 mb-1 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
        <span className="text-[10px] text-green-700 font-medium">
          {t("messages.nameNeverVisible", "Your name is never visible to HR")}
        </span>
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
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-b-2 border-[#1ABC9C] animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeMessageThread;
