import { useState, useEffect } from "react";
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { SmilePlus } from "lucide-react";

const ReactionButton = ({
  postId,
  initialReactions = {},
  postAuthorId,
  postAuthorName,
  postTitle,
}) => {
  const { userData } = useAuth();
  const [reactions, setReactions] = useState(initialReactions);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const reactionTypes = [
    { type: "like", emoji: "👍", label: "Like" },
    { type: "love", emoji: "❤️", label: "Love" },
    { type: "laugh", emoji: "😂", label: "Laugh" },
    { type: "wow", emoji: "😮", label: "Wow" },
    { type: "sad", emoji: "😢", label: "Sad" },
    { type: "appreciate", emoji: "🙏", label: "Appreciate" },
    { type: "idea", emoji: "💡", label: "Great Idea" },
    { type: "interesting", emoji: "🤔", label: "Interesting" },
  ];

  useEffect(() => {
    setReactions(initialReactions);
  }, [initialReactions]);

  const getUserReaction = () => {
    for (const type of reactionTypes) {
      const reactionList = reactions[type.type] || [];
      if (reactionList.includes(userData?.id)) return type.type;
    }
    return null;
  };

  const getTotalCount = () => {
    return Object.values(reactions).reduce((total, users) => {
      return total + (Array.isArray(users) ? users.length : 0);
    }, 0);
  };

  const getTopReactions = () => {
    return reactionTypes
      .map((rt) => ({ ...rt, count: (reactions[rt.type] || []).length }))
      .filter((rt) => rt.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  };

  const handleReaction = async (reactionType) => {
    if (loading) return;
    setLoading(true);
    const currentReaction = getUserReaction();

    try {
      const postRef = doc(db, "posts", postId);

      if (currentReaction) {
        await updateDoc(postRef, {
          [`reactions.${currentReaction}`]: arrayRemove(userData.id),
        });
        setReactions((prev) => ({
          ...prev,
          [currentReaction]: (prev[currentReaction] || []).filter((id) => id !== userData.id),
        }));
      }

      if (currentReaction !== reactionType) {
        await updateDoc(postRef, {
          [`reactions.${reactionType}`]: arrayUnion(userData.id),
        });
        setReactions((prev) => ({
          ...prev,
          [reactionType]: [...(prev[reactionType] || []), userData.id],
        }));
      }

      setShowReactionPicker(false);
    } catch (error) {
      console.error("Error updating reaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentUserReaction = getUserReaction();
  const currentReactionData = reactionTypes.find((rt) => rt.type === currentUserReaction);
  const topReactions = getTopReactions();
  const totalCount = getTotalCount();

  return (
    <div className="relative flex items-center gap-1">
      {/* Top reactions display inline */}
      {topReactions.length > 0 && (
        <div className="flex items-center gap-0.5 px-1.5 py-1 bg-gray-50 rounded-lg">
          {topReactions.map((reaction) => (
            <button
              key={reaction.type}
              onClick={() => handleReaction(reaction.type)}
              className="text-sm hover:scale-110 transition-transform"
              title={`${reaction.label} (${reaction.count})`}
            >
              {reaction.emoji}
            </button>
          ))}
          <span className="text-xs text-gray-500 font-medium ml-0.5">{totalCount}</span>
        </div>
      )}

      {/* React button */}
      <button
        onClick={() => setShowReactionPicker(!showReactionPicker)}
        disabled={loading}
        className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-sm transition-all ${
          currentUserReaction
            ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
            : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        } disabled:opacity-50`}
      >
        {currentUserReaction ? (
          <span className="text-base">{currentReactionData?.emoji}</span>
        ) : (
          <SmilePlus className="w-4 h-4" />
        )}
      </button>

      {/* Picker popup */}
      {showReactionPicker && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowReactionPicker(false)} />
          <div className="absolute bottom-full mb-2 left-0 z-20 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 flex gap-0.5">
            {reactionTypes.map((reaction) => (
              <button
                key={reaction.type}
                onClick={() => handleReaction(reaction.type)}
                className={`relative p-2 rounded-xl hover:bg-gray-100 transition-all hover:scale-125 ${
                  currentUserReaction === reaction.type ? "bg-blue-50 scale-110" : ""
                }`}
                title={reaction.label}
              >
                <span className="text-xl">{reaction.emoji}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ReactionButton;
