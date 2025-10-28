import { useState, useEffect } from "react";
import {
  doc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  getDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";

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

  // Reaction types with emojis
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

  // Get user's current reaction
  const getUserReaction = () => {
    for (const type of reactionTypes) {
      const reactionList = reactions[type.type] || [];
      if (reactionList.includes(userData?.id)) {
        return type.type;
      }
    }
    return null;
  };

  // Get total reaction count
  const getTotalCount = () => {
    return Object.values(reactions).reduce((total, users) => {
      return total + (Array.isArray(users) ? users.length : 0);
    }, 0);
  };

  // Get top 3 reactions to display
  const getTopReactions = () => {
    const sorted = reactionTypes
      .map((rt) => ({
        ...rt,
        count: (reactions[rt.type] || []).length,
      }))
      .filter((rt) => rt.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return sorted;
  };

  const handleReaction = async (reactionType) => {
    if (loading) return;

    setLoading(true);
    const currentReaction = getUserReaction();

    try {
      const postRef = doc(db, "posts", postId);

      // Remove old reaction if exists
      if (currentReaction) {
        await updateDoc(postRef, {
          [`reactions.${currentReaction}`]: arrayRemove(userData.id),
        });

        setReactions((prev) => ({
          ...prev,
          [currentReaction]: (prev[currentReaction] || []).filter(
            (id) => id !== userData.id
          ),
        }));
      }

      // Add new reaction if different from current
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
  const currentReactionEmoji = reactionTypes.find(
    (rt) => rt.type === currentUserReaction
  )?.emoji;
  const topReactions = getTopReactions();
  const totalCount = getTotalCount();

  return (
    <div className="relative">
      {/* Main Reaction Button */}
      <button
        onClick={() => setShowReactionPicker(!showReactionPicker)}
        disabled={loading}
        className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg font-medium transition-all ${
          currentUserReaction
            ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
            : "text-slate-600 hover:text-blue-600 hover:bg-blue-50"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {currentUserReaction ? (
          <span className="text-lg">{currentReactionEmoji}</span>
        ) : (
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
            />
          </svg>
        )}
        {totalCount > 0 && (
          <span className="text-xs sm:text-sm">{totalCount}</span>
        )}
      </button>

      {/* Reaction Picker Popup */}
      {showReactionPicker && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowReactionPicker(false)}
          />

          {/* Picker */}
          <div className="absolute bottom-full mb-2 left-0 z-20 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 flex gap-1">
            {reactionTypes.map((reaction) => (
              <button
                key={reaction.type}
                onClick={() => handleReaction(reaction.type)}
                className={`group relative p-2 rounded-lg hover:bg-slate-100 transition-all transform hover:scale-125 ${
                  currentUserReaction === reaction.type ? "bg-blue-50" : ""
                }`}
                title={reaction.label}
              >
                <span className="text-2xl">{reaction.emoji}</span>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {reaction.label}
                  {reactions[reaction.type]?.length > 0 && (
                    <span className="ml-1">
                      ({reactions[reaction.type].length})
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Reaction Summary - Show top reactions */}
      {topReactions.length > 0 && (
        <div className="absolute -bottom-3 left-0 flex gap-1 items-center bg-white px-2 py-0.5 rounded-full shadow-sm border border-slate-200">
          {topReactions.map((reaction) => (
            <div key={reaction.type} className="flex items-center gap-0.5">
              <span className="text-sm">{reaction.emoji}</span>
              <span className="text-xs text-slate-600">{reaction.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReactionButton;
