import { ASSIGNEE_ROLES, decodeAssignee, encodeAssignee, roleLabel } from "../../utils/categoryRouting";

const SELECT =
  "w-full rounded-xl border bg-background-white px-3 py-2 text-sm text-[#2D3E50] focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Picks who a case goes to: a specific person, or a whole role (e.g. all HR).
 * Shared by the per-category routing table and the default-fallback setting.
 *
 * value:    { type: "user" | "role", id } | null
 * onChange: called with the same shape, or null when the "none" option is chosen
 * staff:    active HR / company_admin users of the company
 */
const AssigneePicker = ({
  id,
  value,
  onChange,
  staff,
  allowNone = false,
  noneLabel = "Unassigned — use default",
  disabled = false,
  invalid = false,
  label,
}) => {
  const encoded = encodeAssignee(value);
  const people = staff.map((s) => ({
    key: `user:${s.id}`,
    label: `${s.displayName || s.username || "Unnamed"} · ${roleLabel(s.role)}`,
  }));
  const roles = ASSIGNEE_ROLES.map((r) => {
    const members = staff.filter((s) => s.role === r.id).length;
    return { key: `role:${r.id}`, label: `${r.label} (${members})`, members };
  });

  // The stored assignee may no longer be selectable (suspended, removed, or a role with nobody
  // in it). Keep it visible rather than silently showing "none".
  const known = [...people, ...roles].some((o) => o.key === encoded);
  const stale = encoded && !known;

  const tone = invalid
    ? "border-amber-300 focus:border-amber-400 focus:ring-amber-200"
    : "border-gray-200 focus:border-[#1ABC9C] focus:ring-[#1ABC9C]/20";

  return (
    <select
      id={id}
      aria-label={label}
      aria-invalid={invalid || undefined}
      className={`${SELECT} ${tone}`}
      value={encoded}
      disabled={disabled}
      onChange={(e) => onChange(decodeAssignee(e.target.value))}
    >
      {allowNone && <option value="">{noneLabel}</option>}
      {!allowNone && !encoded && (
        <option value="" disabled>
          Select an assignee…
        </option>
      )}
      {stale && (
        <option value={encoded} disabled>
          Unavailable — pick another
        </option>
      )}
      <optgroup label="Roles">
        {roles.map((o) => (
          <option key={o.key} value={o.key} disabled={o.members === 0}>
            {o.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="People">
        {people.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
};

export default AssigneePicker;
