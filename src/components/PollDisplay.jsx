import { useState } from "react";
import { CheckCircle2, Clock, BarChart3 } from "lucide-react";
import { votePoll, getUserVotes, getPollStats, hasUserVoted } from "../services/pollService";
import { useAuth } from "../contexts/AuthContext";

/**
 * PollDisplay Component
 * Displays a poll and allows users to vote
 */
const PollDisplay = ({ poll, postId, onVoteUpdate }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localPoll, setLocalPoll] = useState(poll);

  if (!poll || !poll.options) {
    return null;
  }

  const stats = getPollStats(localPoll);
  const userVotes = getUserVotes(localPoll, userData?.id);
  const hasVoted = hasUserVoted(localPoll, userData?.id);

  const handleVote = async (optionIndex) => {
    if (!userData?.id) {
      setError("Please log in to vote");
      setTimeout(() => setError(""), 3000);
      return;
    }

    if (stats.hasEnded) {
      setError("This poll has ended");
      setTimeout(() => setError(""), 3000);
      return;
    }

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const updatedPoll = await votePoll(postId, optionIndex, userData.id);
      setLocalPoll(updatedPoll);
      if (onVoteUpdate) {
        onVoteUpdate(updatedPoll);
      }
    } catch (error) {
      console.error("Error voting on poll:", error);
      setError(error.message || "Failed to cast vote");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const formatEndDate = (endDate) => {
    if (!endDate) return null;
    const date = endDate.toDate ? endDate.toDate() : new Date(endDate);
    const now = new Date();
    const diffMs = date - now;

    if (diffMs < 0) return "Ended";

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `Ends in ${diffMins} minutes`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Ends in ${diffHours} hours`;

    const diffDays = Math.floor(diffHours / 24);
    return `Ends in ${diffDays} days`;
  };

  return (
    <div className="mt-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
      {/* Poll Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 text-blue-700">
          <BarChart3 className="w-5 h-5" />
          <h4 className="font-semibold text-sm">Poll</h4>
        </div>
        {stats.endDate && (
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <Clock className="w-3 h-3" />
            <span>{formatEndDate(stats.endDate)}</span>
          </div>
        )}
      </div>

      {/* Poll Question */}
      <p className="text-slate-900 font-medium mb-3">{poll.question}</p>

      {/* Poll Options */}
      <div className="space-y-2">
        {stats.options.map((option, index) => {
          const isVotedByUser = userVotes.includes(index);
          const showResults = hasVoted || stats.hasEnded;

          return (
            <button
              key={index}
              onClick={() => !stats.hasEnded && handleVote(index)}
              disabled={loading || stats.hasEnded}
              className={`w-full text-left transition-all ${
                stats.hasEnded ? "cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div
                className={`relative p-3 rounded-lg border-2 transition-all ${
                  isVotedByUser
                    ? "border-blue-500 bg-blue-100"
                    : showResults
                    ? "border-slate-200 bg-white"
                    : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                {/* Progress Bar Background */}
                {showResults && (
                  <div
                    className="absolute inset-0 bg-blue-100 rounded-lg transition-all duration-500"
                    style={{
                      width: `${option.percentage}%`,
                      opacity: 0.3,
                    }}
                  />
                )}

                {/* Option Content */}
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    {isVotedByUser && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-slate-900">
                      {option.text}
                    </span>
                  </div>

                  {showResults && (
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {option.percentage}%
                      </span>
                      <span className="text-xs text-slate-500">
                        ({option.votes} {option.votes === 1 ? "vote" : "votes"})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Poll Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
        <span>
          {stats.totalVotes} {stats.totalVotes === 1 ? "vote" : "votes"} total
        </span>
        {poll.multipleChoice && (
          <span className="text-blue-600">Multiple choice allowed</span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Poll Ended Badge */}
      {stats.hasEnded && (
        <div className="mt-2 px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs text-slate-700 text-center font-medium">
          Poll Ended
        </div>
      )}
    </div>
  );
};

export default PollDisplay;
