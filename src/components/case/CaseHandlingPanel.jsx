import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, UserCheck, CalendarClock, StickyNote, Send, X } from "lucide-react";
import { PostPriority, PostPriorityConfig, AssignmentType } from "../../utils/constants";
import { getCaseAdapter } from "../../utils/caseTypes";
import { toDateInputValue } from "../../utils/caseDisplay";
import Avatar from "../Avatar";
import PillSelect from "./PillSelect";
import { StatusBadge, PriorityBadge, DueDateChip } from "./CaseBadges";
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

const INPUT =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#2D3E50] placeholder:text-gray-400 transition focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 disabled:opacity-60";

// Labelled card so assignment, due date and notes read as three distinct actions.
const Section = ({ icon, title, action, children }) => (
  <section className="rounded-xl border border-gray-100 bg-white p-3 shadow-xs">
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {icon}
        {title}
      </h4>
      {action}
    </div>
    {children}
  </section>
);

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
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState(caseData.assignedTo || null);
  const [selectedDueDate, setSelectedDueDate] = useState(() => toDateInputValue(caseData.dueDate));
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [notes, setNotes] = useState([]);
  const assignRef = useRef(null);

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

  useEffect(() => {
    if (!showAssignDropdown) return undefined;
    const onPointerDown = (event) => {
      if (!assignRef.current?.contains(event.target)) setShowAssignDropdown(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showAssignDropdown]);

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
  const isClosed = adapter.closedStatuses.includes(status);

  const pickAssignee = (assignee) => {
    handleAssignment(assignee);
    setSearchTerm("");
  };

  const assignMe = () =>
    pickAssignee({ type: AssignmentType.USER, id: currentUser.id, name: currentUser.displayName });

  const statusOptions = adapter.statusValues.map((value) => ({
    value,
    label: adapter.statusConfig[value]?.label,
    node: <StatusBadge status={value} config={adapter.statusConfig} size="md" />,
  }));

  const priorityOptions = Object.values(PostPriority).map((value) => ({
    value,
    label: PostPriorityConfig[value]?.label,
    node: <PriorityBadge priority={value} size="md" />,
  }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {adapter.statusEditable ? (
          <PillSelect
            label={t("adminPanel.status")}
            value={status}
            options={statusOptions}
            onChange={handleStatusChange}
            disabled={loading}
          />
        ) : (
          <div title={t("casePanel.statusReadOnly")}>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {t("adminPanel.status")}
            </span>
            <div className="rounded-xl border border-gray-100 bg-white px-2.5 py-2">
              <StatusBadge status={status} config={adapter.statusConfig} size="md" />
            </div>
          </div>
        )}
        <PillSelect
          label={t("adminPanel.priority")}
          value={priority}
          options={priorityOptions}
          onChange={handlePriorityChange}
          disabled={loading}
        />
      </div>

      <Section icon={<UserCheck aria-hidden="true" className="h-3.5 w-3.5 text-[#1ABC9C]" />} title={t("casePanel.assignment")}>
        <div ref={assignRef} className="relative">
          {selectedAssignee ? (
            <div className="flex items-center gap-2.5">
              <Avatar name={selectedAssignee.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#2D3E50]">{selectedAssignee.name}</p>
                <p className="text-[11px] capitalize text-gray-400">{selectedAssignee.type}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                disabled={loading}
                aria-expanded={showAssignDropdown}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-[#2D3E50] transition hover:bg-gray-100 disabled:opacity-50"
              >
                {t("casePanel.change")}
              </button>
              <button
                type="button"
                onClick={() => handleAssignment(null)}
                disabled={loading}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
              >
                {t("casePanel.remove")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                disabled={loading}
                aria-expanded={showAssignDropdown}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-left text-sm text-gray-400 transition hover:border-[#1ABC9C] hover:text-[#2D3E50] disabled:opacity-60"
              >
                <span className="truncate">{t("casePanel.selectAssignee")}</span>
                <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />
              </button>
              {currentUser.userTagId && (
                <button
                  type="button"
                  onClick={assignMe}
                  disabled={loading}
                  className="shrink-0 rounded-lg bg-[#1ABC9C]/10 px-3 py-2 text-xs font-semibold text-[#16A085] transition hover:bg-[#1ABC9C]/20 disabled:opacity-50"
                >
                  {t("casePanel.assignToMe")}
                </button>
              )}
            </div>
          )}

          {showAssignDropdown && (
            <div className="absolute left-0 z-30 mt-2 max-h-72 w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
              <div className="border-b border-gray-100 p-2">
                <input
                  type="text"
                  autoFocus
                  placeholder={t("casePanel.search")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={INPUT}
                />
              </div>
              <div className="max-h-52 overflow-y-auto">
                {currentUser.userTagId && (
                  <button
                    type="button"
                    onClick={assignMe}
                    className="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm font-medium text-[#16A085] transition hover:bg-[#1ABC9C]/5"
                  >
                    {t("casePanel.assignToMe")}
                  </button>
                )}

                {filteredUsers.length > 0 ? (
                  <>
                    <div className="bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {t("casePanel.people")}
                    </div>
                    {filteredUsers.map((user) => (
                      <button
                        type="button"
                        key={user.id}
                        onClick={() => pickAssignee({ type: AssignmentType.USER, id: user.id, name: user.displayName })}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-gray-50"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={user.displayName} size="md" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-[#2D3E50]">{user.displayName}</span>
                            <span className="block text-[11px] text-gray-400">{user.tagData?.name || user.role}</span>
                          </span>
                        </span>
                        {user.tagData && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TAG_COLORS[user.tagData.color] || TAG_COLORS.gray}`}>
                            {user.tagData.name}
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="px-3 py-4 text-center text-xs text-gray-400">{t("casePanel.noTaggedMembers")}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section
        icon={<CalendarClock aria-hidden="true" className="h-3.5 w-3.5 text-[#1ABC9C]" />}
        title={t("adminPanel.dueDate")}
        action={
          selectedDueDate && (
            <button
              type="button"
              onClick={() => handleDueDateChange("")}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
            >
              <X aria-hidden="true" className="h-3 w-3" />
              {t("casePanel.clear")}
            </button>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label={t("adminPanel.dueDate")}
            value={selectedDueDate}
            onChange={(e) => handleDueDateChange(e.target.value)}
            disabled={loading}
            min={new Date().toISOString().split("T")[0]}
            className={`${INPUT} min-w-0 flex-1`}
          />
          {selectedDueDate ? (
            <DueDateChip dueDate={selectedDueDate} closed={isClosed} size="md" />
          ) : (
            <span className="text-xs text-gray-400">{t("casePanel.noDueDate")}</span>
          )}
        </div>
      </Section>

      <Section icon={<StickyNote aria-hidden="true" className="h-3.5 w-3.5 text-[#1ABC9C]" />} title={t("casePanel.notes")}>
        <div className="flex gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={loading}
            aria-label={t("adminPanel.adminNote")}
            placeholder={t("casePanel.notePlaceholder")}
            className={`${INPUT} flex-1`}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
          />
          <button
            type="button"
            onClick={handleAddNote}
            disabled={loading || !comment.trim()}
            aria-label={t("adminPanel.addNote")}
            className="rounded-lg bg-[#1ABC9C] px-3 text-white transition hover:bg-[#16A085] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        {notes.length > 0 ? (
          <ul className="mt-3 max-h-56 space-y-2.5 overflow-y-auto pr-1">
            {notes.map((note) => (
              <li key={note.id} className="flex gap-2.5">
                <Avatar name={note.authorName || t("casePanel.staff")} size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-gray-50 px-3 py-2">
                  <p className="whitespace-pre-wrap break-words text-sm text-[#2D3E50]">{note.text}</p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {note.authorName || t("casePanel.staff")}
                    {note.createdAt?.seconds ? ` · ${new Date(note.createdAt.seconds * 1000).toLocaleString()}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-center text-xs text-gray-400">{t("casePanel.noNotes")}</p>
        )}
      </Section>

      {children}
    </div>
  );
};

export default CaseHandlingPanel;
