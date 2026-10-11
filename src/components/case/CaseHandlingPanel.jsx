import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, UserCheck, Calendar, Send } from "lucide-react";
import { PostPriority, PostPriorityConfig, AssignmentType } from "../../utils/constants";
import { getCaseAdapter } from "../../utils/caseTypes";
import {
  updateCaseStatus,
  updateCasePriority,
  assignCase,
  unassignCase,
  setCaseDueDate,
  addCaseNote,
  getCaseNotes,
  getAssignableUsers,
} from "../../services/caseService";
import { showSuccess, showError } from "../../services/toastService";

const TAG_COLORS = {
  purple: "bg-purple-100 text-purple-800",
  blue: "bg-blue-100 text-blue-800",
  indigo: "bg-indigo-100 text-indigo-800",
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-gray-100 text-gray-800",
};

const toDateInputValue = (value) => {
  if (!value) return "";
  try {
    const date = value.seconds ? new Date(value.seconds * 1000) : value.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
  } catch {
    return "";
  }
};

const LABEL = "text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block";

/**
 * Shared case-handling controls: status, priority, assignment, due date and internal
 * notes. Works against any case type in utils/caseTypes.js; the page keeps its own
 * status vocabulary because status values/labels come from the type's adapter.
 *
 * Props:
 *  - caseType: "post" | "vendor" | "moderation"
 *  - caseData: the case document ({ id, status, priority, assignedTo, dueDate, companyId, ... })
 *  - currentUser: signed-in user doc
 *  - onUpdate: called after any successful change
 *  - children: optional extra content rendered at the bottom of the panel
 */
const CaseHandlingPanel = ({ caseType, caseData, currentUser, onUpdate, children }) => {
  const { t } = useTranslation();
  const adapter = getCaseAdapter(caseType);
  const caseId = caseData.id;
  const companyId = caseData.companyId || currentUser.companyId;

  const [status, setStatus] = useState(caseData.status || adapter.defaultStatus);
  const [priority, setPriority] = useState(adapter.getPriority(caseData));
  const [isExpanded, setIsExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState(caseData.assignedTo || null);
  const [selectedDueDate, setSelectedDueDate] = useState(() => toDateInputValue(caseData.dueDate));
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [notes, setNotes] = useState([]);

  useEffect(() => { setSelectedAssignee(caseData.assignedTo || null); }, [caseData.assignedTo]);
  useEffect(() => { setStatus(caseData.status || adapter.defaultStatus); }, [caseData.status, adapter.defaultStatus]);
  useEffect(() => { setPriority(adapter.getPriority(caseData)); }, [caseData, adapter]);
  useEffect(() => { setSelectedDueDate(toDateInputValue(caseData.dueDate)); }, [caseData.dueDate]);

  useEffect(() => {
    let cancelled = false;
    getAssignableUsers(currentUser.companyId)
      .then((list) => { if (!cancelled) setUsers(list); })
      .catch((error) => console.error("Error loading assignment options:", error));
    return () => { cancelled = true; };
  }, [currentUser.companyId]);

  const loadNotes = useCallback(async () => {
    try {
      setNotes(await getCaseNotes(caseType, caseId, companyId));
    } catch (error) {
      console.error("Error loading internal notes:", error);
    }
  }, [caseType, caseId, companyId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Runs a mutation with the shared loading/toast/onUpdate handling.
  const run = async (action, successKey) => {
    try {
      setLoading(true);
      await action();
      if (successKey) showSuccess(t(successKey));
      if (onUpdate) onUpdate();
      return true;
    } catch (error) {
      showError(t("casePanel.failed", { message: error.message }));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    const ok = await run(() => updateCaseStatus(caseType, caseId, newStatus, currentUser, comment), "casePanel.statusUpdated");
    if (ok) { setStatus(newStatus); setComment(""); }
  };

  const handlePriorityChange = async (newPriority) => {
    const ok = await run(() => updateCasePriority(caseType, caseId, newPriority, currentUser), "casePanel.priorityUpdated");
    if (ok) setPriority(newPriority);
  };

  const handleAssignment = async (assignee) => {
    const ok = await run(
      () => assignee
        ? assignCase(caseType, caseId, {
            type: assignee.type,
            id: assignee.id,
            name: assignee.name,
            dueDate: selectedDueDate ? new Date(selectedDueDate) : null,
          }, currentUser)
        : unassignCase(caseType, caseId, currentUser),
      assignee ? "casePanel.assigned" : "casePanel.unassigned"
    );
    if (ok) {
      setSelectedAssignee(assignee);
      if (!assignee) setSelectedDueDate("");
      setShowAssignDropdown(false);
    }
  };

  const handleDueDateChange = async (newDate) => {
    const previous = selectedDueDate;
    setSelectedDueDate(newDate);
    const ok = await run(
      () => setCaseDueDate(caseType, caseId, newDate ? new Date(newDate) : null, currentUser),
      newDate ? "casePanel.dueDateSet" : "casePanel.dueDateCleared"
    );
    if (!ok) setSelectedDueDate(previous);
  };

  const handleAddNote = async () => {
    if (!comment.trim()) return;
    const ok = await run(() => addCaseNote(caseType, caseId, comment.trim(), currentUser), "casePanel.noteAdded");
    if (ok) { setComment(""); await loadNotes(); }
  };

  const filteredUsers = users.filter((u) => u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));
  const statusCfg = adapter.statusConfig[status];
  const priorityCfg = PostPriorityConfig[priority];

  const pickAssignee = (assignee) => {
    handleAssignment(assignee);
    setSearchTerm("");
  };

  return (
    <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-xl p-3">
      <div className="flex items-center gap-2 flex-wrap">
        {adapter.statusEditable ? (
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={loading}
            aria-label={t("adminPanel.status")}
            className={`px-2.5 py-1.5 text-xs font-medium border rounded-lg focus:ring-1 focus:ring-indigo-400 focus:outline-none ${statusCfg?.bgColor} ${statusCfg?.textColor}`}
          >
            {adapter.statusValues.map((value) => (
              <option key={value} value={value}>{adapter.statusConfig[value]?.label}</option>
            ))}
          </select>
        ) : (
          <span
            title={t("casePanel.statusReadOnly")}
            className={`px-2.5 py-1.5 text-xs font-medium border rounded-lg ${statusCfg?.bgColor} ${statusCfg?.textColor}`}
          >
            {statusCfg?.label || status}
          </span>
        )}

        <select
          value={priority}
          onChange={(e) => handlePriorityChange(e.target.value)}
          disabled={loading}
          aria-label={t("adminPanel.priority")}
          className={`px-2.5 py-1.5 text-xs font-medium border rounded-lg focus:ring-1 focus:ring-indigo-400 focus:outline-none ${priorityCfg?.bgColor} ${priorityCfg?.textColor}`}
        >
          {Object.values(PostPriority).map((value) => (
            <option key={value} value={value}>{PostPriorityConfig[value]?.icon} {PostPriorityConfig[value]?.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="p-1.5 text-indigo-500 hover:bg-indigo-100 rounded-lg transition"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {selectedAssignee && !isExpanded && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-indigo-600 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100">
          <UserCheck className="w-3 h-3" />
          <span className="font-medium">{selectedAssignee.name}</span>
          <span className="text-indigo-400 capitalize">({selectedAssignee.type})</span>
          {selectedDueDate && (
            <>
              <span className="text-indigo-300">|</span>
              <Calendar className="w-3 h-3" />
              <span>{new Date(selectedDueDate).toLocaleDateString()}</span>
            </>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-indigo-100/60">
          <div className="relative">
            <label className={LABEL}>{t("adminPanel.assignTo")}</label>
            <button
              onClick={() => setShowAssignDropdown(!showAssignDropdown)}
              disabled={loading}
              className="w-full px-3 py-2 text-xs text-left border border-gray-200 rounded-lg bg-white hover:border-indigo-300 flex items-center justify-between transition"
            >
              <span className={selectedAssignee ? "text-gray-900 font-medium" : "text-gray-400"}>
                {selectedAssignee ? `${selectedAssignee.name} (${selectedAssignee.type})` : t("casePanel.selectAssignee")}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {showAssignDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-hidden">
                <div className="p-2 border-b border-gray-100">
                  <input
                    type="text"
                    placeholder={t("casePanel.search")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <button
                    onClick={() => pickAssignee(null)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 text-gray-500 border-b border-gray-100"
                  >
                    {t("casePanel.unassign")}
                  </button>

                  {currentUser.userTagId && (
                    <button
                      onClick={() => pickAssignee({ type: AssignmentType.USER, id: currentUser.id, name: currentUser.displayName })}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-indigo-50 flex items-center gap-2 text-indigo-600 font-medium border-b border-gray-100"
                    >
                      <span>⭐</span>
                      <span>{t("casePanel.assignToMe")}</span>
                    </button>
                  )}

                  {filteredUsers.length > 0 ? (
                    <>
                      <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        {t("casePanel.people")}
                      </div>
                      {filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => pickAssignee({ type: AssignmentType.USER, id: user.id, name: user.displayName })}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span>{user.tagData?.icon || "👤"}</span>
                            <div>
                              <div className="font-medium text-gray-900">{user.displayName}</div>
                              <div className="text-[10px] text-gray-400">{user.tagData?.name || user.role}</div>
                            </div>
                          </div>
                          {user.tagData && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TAG_COLORS[user.tagData.color] || TAG_COLORS.gray}`}>
                              {user.tagData.name}
                            </span>
                          )}
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="px-3 py-4 text-xs text-gray-400 text-center">{t("casePanel.noTaggedMembers")}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedAssignee && (
            <div className="flex items-center justify-between p-2.5 bg-white border border-indigo-100 rounded-lg">
              <div className="flex items-center gap-2 text-xs">
                <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-medium text-gray-900">{selectedAssignee.name}</span>
                <span className="text-gray-400 capitalize">{selectedAssignee.type}</span>
              </div>
              <button
                onClick={() => handleAssignment(null)}
                disabled={loading}
                className="text-[10px] text-red-500 hover:text-red-700 font-medium px-2 py-0.5 border border-red-200 rounded-md hover:bg-red-50 transition"
              >
                {t("casePanel.remove")}
              </button>
            </div>
          )}

          <div>
            <label className={LABEL}>{t("adminPanel.dueDate")}</label>
            <input
              type="date"
              value={selectedDueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div>
            <label className={LABEL}>{t("adminPanel.adminNote")}</label>
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={loading}
                placeholder={t("casePanel.notePlaceholder")}
                className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
              />
              <button
                onClick={handleAddNote}
                disabled={loading || !comment.trim()}
                aria-label={t("adminPanel.addNote")}
                className="px-3 py-2 bg-[#1ABC9C] text-white rounded-lg text-xs font-medium hover:bg-[#17a68a] transition disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            {notes.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {notes.map((note) => (
                  <li key={note.id} className="px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs text-gray-700">
                    <p className="whitespace-pre-wrap">{note.text}</p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {note.authorName || t("casePanel.staff")}
                      {note.createdAt?.seconds ? ` · ${new Date(note.createdAt.seconds * 1000).toLocaleString()}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  );
};

export default CaseHandlingPanel;
