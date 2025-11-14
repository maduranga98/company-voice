import { useState } from "react";
import { Plus, X, BarChart3, Trash2 } from "lucide-react";
import { validatePollData } from "../services/pollService";

/**
 * PollCreator Component
 * Allows users to create polls when creating a post
 */
const PollCreator = ({ onPollChange, initialPoll = null }) => {
  const [showPollCreator, setShowPollCreator] = useState(!!initialPoll);
  const [question, setQuestion] = useState(initialPoll?.question || "");
  const [options, setOptions] = useState(
    initialPoll?.options?.map((opt) => opt.text) || ["", ""]
  );
  const [multipleChoice, setMultipleChoice] = useState(
    initialPoll?.multipleChoice || false
  );
  const [endDate, setEndDate] = useState(
    initialPoll?.endDate
      ? new Date(initialPoll.endDate).toISOString().slice(0, 16)
      : ""
  );
  const [errors, setErrors] = useState([]);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      updatePoll(question, newOptions, multipleChoice, endDate);
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    updatePoll(question, newOptions, multipleChoice, endDate);
  };

  const updatePoll = (q, opts, mc, ed) => {
    const pollData = {
      question: q,
      options: opts.map((text) => ({ text, votes: [] })),
      multipleChoice: mc,
      endDate: ed ? new Date(ed) : null,
      totalVotes: 0,
      voters: [],
    };

    const validation = validatePollData(pollData);
    setErrors(validation.errors);

    if (validation.isValid) {
      onPollChange(pollData);
    } else {
      onPollChange(null);
    }
  };

  const handleQuestionChange = (value) => {
    setQuestion(value);
    updatePoll(value, options, multipleChoice, endDate);
  };

  const handleMultipleChoiceChange = (value) => {
    setMultipleChoice(value);
    updatePoll(question, options, value, endDate);
  };

  const handleEndDateChange = (value) => {
    setEndDate(value);
    updatePoll(question, options, multipleChoice, value);
  };

  const handleRemovePoll = () => {
    setShowPollCreator(false);
    setQuestion("");
    setOptions(["", ""]);
    setMultipleChoice(false);
    setEndDate("");
    setErrors([]);
    onPollChange(null);
  };

  if (!showPollCreator) {
    return (
      <button
        type="button"
        onClick={() => setShowPollCreator(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
      >
        <BarChart3 className="w-4 h-4" />
        Add Poll
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-blue-700">
          <BarChart3 className="w-5 h-5" />
          <h4 className="font-semibold">Create Poll</h4>
        </div>
        <button
          type="button"
          onClick={handleRemovePoll}
          className="text-slate-400 hover:text-red-600 transition"
          title="Remove poll"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Poll Question */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Poll Question *
        </label>
        <input
          type="text"
          value={question}
          onChange={(e) => handleQuestionChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
            }
          }}
          placeholder="Ask a question..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          maxLength={200}
        />
      </div>

      {/* Poll Options */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Options * (2-10 options)
        </label>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500 w-6">
                {index + 1}.
              </span>
              <input
                type="text"
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                placeholder={`Option ${index + 1}`}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                maxLength={100}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="p-2 text-slate-400 hover:text-red-600 transition"
                  title="Remove option"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < 10 && (
          <button
            type="button"
            onClick={addOption}
            className="mt-2 flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-100 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add Option
          </button>
        )}
      </div>

      {/* Poll Settings */}
      <div className="space-y-3 mb-4">
        {/* Multiple Choice */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={multipleChoice}
            onChange={(e) => handleMultipleChoiceChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">
            Allow multiple choices
          </span>
        </label>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Poll End Date (Optional)
          </label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            Leave empty for no expiration
          </p>
        </div>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <ul className="text-xs text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PollCreator;
