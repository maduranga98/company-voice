// Shared vocabulary for the "Categories & Routing" settings.
// The limits and the name rules mirror functions/config/categoryRouting.js and
// functions/utils/categoryRouting.js; the server is the authority, these exist so the form can
// show an inline error before a round trip. There is no shared build between src/ and functions/.

export const CATEGORY_NAME_MAX = 60;
export const CATEGORY_DESCRIPTION_MAX = 200;
export const MAX_CATEGORIES = 50;

// Fixed, locked case type. Listed with the categories but never editable.
export const SYSTEM_CATEGORY_ID = "vendor_risk";

export const ASSIGNEE_ROLES = [
  { id: "hr", label: "All HR" },
  { id: "company_admin", label: "All Company Admins" },
];

const ROLE_LABELS = { hr: "HR", company_admin: "Company Admin" };
export const roleLabel = (role) => ROLE_LABELS[role] || role;

const nameKey = (name) => name.replace(/\s+/g, " ").trim().toLocaleLowerCase("en");

/**
 * @param {string} raw the typed name
 * @param {Array<{id: string, name: string}>} categories existing categories (for the duplicate check)
 * @param {string} [ignoreId] the category being renamed
 * @returns {string} an error message, or "" when the name is acceptable
 */
export const validateCategoryName = (raw, categories, ignoreId) => {
  const name = (raw || "").replace(/\s+/g, " ").trim();
  if (!name) return "Enter a category name.";
  if (name.length > CATEGORY_NAME_MAX) return `Use ${CATEGORY_NAME_MAX} characters or fewer.`;
  const key = nameKey(name);
  if (categories.some((c) => c.id !== ignoreId && nameKey(c.name || "") === key)) {
    return "A category with this name already exists.";
  }
  return "";
};

// Assignees are encoded as "user:<id>" / "role:<id>" in <select> values.
export const encodeAssignee = (assignee) => (assignee && assignee.id ? `${assignee.type}:${assignee.id}` : "");
export const decodeAssignee = (value) => {
  if (!value) return null;
  const index = value.indexOf(":");
  return { type: value.slice(0, index), id: value.slice(index + 1) };
};

/**
 * Describes an assignee for display, or reports why it no longer resolves.
 * @returns {{ label: string, valid: boolean }}
 */
export const describeAssignee = (assignee, staff) => {
  if (!assignee || !assignee.id) return { label: "", valid: false };
  if (assignee.type === "role") {
    const members = staff.filter((s) => s.role === assignee.id).length;
    const role = ASSIGNEE_ROLES.find((r) => r.id === assignee.id);
    return { label: role ? role.label : assignee.id, valid: !!role && members > 0 };
  }
  const user = staff.find((s) => s.id === assignee.id);
  return user
    ? { label: `${user.displayName || user.username || "Unnamed"} (${roleLabel(user.role)})`, valid: true }
    : { label: "Unavailable member", valid: false };
};

/** Sorts categories for display: editable ones by `order`, system-defined ones last. */
export const sortCategories = (categories) =>
  [...categories].sort((a, b) => {
    if (!!a.isSystemDefined !== !!b.isSystemDefined) return a.isSystemDefined ? 1 : -1;
    return (a.order ?? 0) - (b.order ?? 0);
  });

// Maps a callable error to a message (and the field it belongs to, when the server named one).
export const describeCallableError = (error) => {
  const details = error?.details || {};
  const reason = details.reason;
  const known = {
    duplicate: ["name", "A category with this name already exists."],
    too_long: [details.field || "name", "That is too long."],
    required: [details.field || "name", "This field is required."],
    system_defined: [null, "Vendor Risk is system-defined and cannot be changed."],
    last_active: [null, "At least one category must stay active."],
    limit: [null, `You can have up to ${MAX_CATEGORIES} categories.`],
    stale: [null, "The list changed in another session. It has been refreshed; try again."],
    assignee_invalid: ["assigneeId", "That person is not an active member of your company."],
    inactive: [null, "Activate the category before routing it."],
  };
  if (reason && known[reason]) return { field: known[reason][0], message: known[reason][1] };
  if (error?.code === "functions/permission-denied") {
    return { field: null, message: "You don't have permission to change this." };
  }
  if (error?.code === "functions/unavailable" || error?.code === "functions/deadline-exceeded") {
    return { field: null, message: "Connection problem. Check your network and try again." };
  }
  return { field: null, message: "Could not save the change. Please try again." };
};

/**
 * Where a category's cases go right now.
 * @returns {{ state: "assigned" | "unassigned" | "unavailable", label: string }}
 *   unassigned: no rule, so the company default applies.
 *   unavailable: a rule exists but its assignee is gone or suspended, so the default applies.
 */
export const routingStatus = (category, rules, staff) => {
  const rule = rules[category.id];
  if (!rule || rule.isActive === false) return { state: "unassigned", label: "" };
  const described = describeAssignee({ type: rule.assigneeType, id: rule.assigneeId }, staff);
  return { state: described.valid ? "assigned" : "unavailable", label: described.label };
};
