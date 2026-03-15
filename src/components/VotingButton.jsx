import { useState, useEffect } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { castVote } from "../services/votingService";
import { useAuth } from "../contexts/AuthContext";

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

  const userVote = upvotes.includes(userData?.id)
    ? "upvote"
    : downvotes.includes(userData?.id)
    ? "downvote"
    : null;

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
      await castVote(postId, userData.id, voteType);
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
      setError("Failed to vote");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center bg-gray-50 rounded-xl overflow-hidden">
      <button
        onClick={() => handleVote("upvote")}
        disabled={loading}
        className={`flex items-center gap-0.5 px-2.5 py-2 transition-all ${
          userVote === "upvote"
            ? "text-emerald-600 bg-emerald-50"
            : "text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50"
        } disabled:opacity-50`}
        title="Upvote"
      >
        <ArrowUp className={`w-4 h-4 ${userVote === "upvote" ? "stroke-[2.5]" : ""}`} />
      </button>

      <span className={`px-1.5 text-xs font-bold min-w-[24px] text-center ${
        score > 0 ? "text-emerald-600" : score < 0 ? "text-red-500" : "text-gray-500"
      }`}>
        {score > 0 ? "+" : ""}{score}
      </span>

      <button
        onClick={() => handleVote("downvote")}
        disabled={loading}
        className={`flex items-center gap-0.5 px-2.5 py-2 transition-all ${
          userVote === "downvote"
            ? "text-red-500 bg-red-50"
            : "text-gray-500 hover:text-red-500 hover:bg-red-50/50"
        } disabled:opacity-50`}
        title="Downvote"
      >
        <ArrowDown className={`w-4 h-4 ${userVote === "downvote" ? "stroke-[2.5]" : ""}`} />
      </button>

      {error && <span className="text-[10px] text-red-500 ml-1.5">{error}</span>}
    </div>
  );
};

export default VotingButton;
