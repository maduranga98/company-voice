import { useState, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { castVote } from "../services/votingService";
import { useAuth } from "../contexts/AuthContext";

/**
 * VotingButton Component
 * Displays upvote/downvote buttons for posts
 * Shows vote count and allows users to vote
 */
const VotingButton = ({ postId, initialUpvotes = [], initialDownvotes = [] }) => {
  const { userData } = useAuth();
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUpvotes(initialUpvotes || []);
    setDownvotes(initialDownvotes || []);
  }, [initialUpvotes, initialDownvotes]);

  // Check if user has voted
  const userVote = upvotes.includes(userData?.id)
    ? "upvote"
    : downvotes.includes(userData?.id)
    ? "downvote"
    : null;

  // Calculate score
  const score = upvotes.length - downvotes.length;

  const handleVote = async (voteType) => {
    if (!userData?.id) {
      setError("Please log in to vote");
      setTimeout(() => setError(""), 3000);
      return;
    }

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const result = await castVote(postId, userData.id, voteType);

      // Update local state based on server response
      const updatedDoc = await import("../config/firebase").then(({ db }) =>
        import("firebase/firestore").then(({ doc, getDoc }) =>
          getDoc(doc(db, "posts", postId))
        )
      );

      if (updatedDoc.exists()) {
        const data = updatedDoc.data();
        setUpvotes(data.upvotes || []);
        setDownvotes(data.downvotes || []);
      }
    } catch (error) {
      console.error("Error voting:", error);
      setError("Failed to cast vote");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Upvote Button */}
      <button
        onClick={() => handleVote("upvote")}
        disabled={loading}
        className={`flex items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all ${
          userVote === "upvote"
            ? "text-green-600 bg-green-50 hover:bg-green-100"
            : "text-slate-600 hover:text-green-600 hover:bg-green-50"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Upvote"
      >
        <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="text-xs sm:text-sm font-medium">{upvotes.length}</span>
      </button>

      {/* Score Display */}
      <div
        className={`px-2 py-1 text-sm font-bold ${
          score > 0
            ? "text-green-600"
            : score < 0
            ? "text-red-600"
            : "text-slate-600"
        }`}
      >
        {score > 0 ? "+" : ""}
        {score}
      </div>

      {/* Downvote Button */}
      <button
        onClick={() => handleVote("downvote")}
        disabled={loading}
        className={`flex items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all ${
          userVote === "downvote"
            ? "text-red-600 bg-red-50 hover:bg-red-100"
            : "text-slate-600 hover:text-red-600 hover:bg-red-50"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Downvote"
      >
        <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="text-xs sm:text-sm font-medium">{downvotes.length}</span>
      </button>

      {/* Error Message */}
      {error && (
        <span className="text-xs text-red-600 ml-2">{error}</span>
      )}
    </div>
  );
};

export default VotingButton;
