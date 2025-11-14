// ============================================
// USER MANAGEMENT
// ============================================

// User roles
export const UserRole = {
  SUPER_ADMIN: "super_admin",
  COMPANY_ADMIN: "company_admin",
  HR: "hr",
  EMPLOYEE: "employee",
};

// User status
export const UserStatus = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  INVITED: "invited",
};

// User tags/levels for assignment (identify higher-order officers)
export const UserTag = {
  EXECUTIVE: "executive",         // C-level, VPs
  SENIOR_MANAGER: "senior_manager", // Senior managers, directors
  MANAGER: "manager",              // Team leads, managers
  SPECIALIST: "specialist",        // Senior specialists, experts
  STAFF: "staff",                  // Regular employees
};

// User tag configuration
export const UserTagConfig = {
  [UserTag.EXECUTIVE]: {
    label: "Executive",
    color: "purple",
    bgColor: "bg-purple-100",
    textColor: "text-purple-800",
    borderColor: "border-purple-300",
    icon: "👔",
    priority: 5,
  },
  [UserTag.SENIOR_MANAGER]: {
    label: "Senior Manager",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    borderColor: "border-blue-300",
    icon: "🎯",
    priority: 4,
  },
  [UserTag.MANAGER]: {
    label: "Manager",
    color: "indigo",
    bgColor: "bg-indigo-100",
    textColor: "text-indigo-800",
    borderColor: "border-indigo-300",
    icon: "📊",
    priority: 3,
  },
  [UserTag.SPECIALIST]: {
    label: "Specialist",
    color: "green",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-300",
    icon: "🔧",
    priority: 2,
  },
  [UserTag.STAFF]: {
    label: "Staff",
    color: "gray",
    bgColor: "bg-gray-100",
    textColor: "text-gray-800",
    borderColor: "border-gray-300",
    icon: "👤",
    priority: 1,
  },
};

// ============================================
// POST TYPES & CATEGORIES
// ============================================

// Post types
export const PostType = {
  PROBLEM_REPORT: "problem_report",
  IDEA_SUGGESTION: "idea_suggestion",
  CREATIVE_CONTENT: "creative_content",
  TEAM_DISCUSSION: "team_discussion",
};

// Privacy levels
export const PrivacyLevel = {
  COMPANY_PUBLIC: "company_public",
  DEPARTMENT_ONLY: "department_only",
  HR_ONLY: "hr_only",
};

// ============================================
// POST MANAGEMENT SYSTEM
// ============================================

// Post status workflow (7 states)
export const PostStatus = {
  OPEN: "open",                        // Just created
  ACKNOWLEDGED: "acknowledged",         // Admin has seen it
  IN_PROGRESS: "in_progress",          // Being worked on (Process)
  UNDER_REVIEW: "under_review",        // Investigating
  WORKING_ON: "working_on",            // Forwarded to relevant sections, waiting for response
  RESOLVED: "resolved",                // Fixed/completed (Finished)
  CLOSED: "closed",                    // No action needed
  REJECTED: "rejected",                // Not valid/duplicate
  NOT_A_PROBLEM: "not_a_problem",      // Not a real problem or will be resolved in future
};

// Legacy statuses (for backward compatibility during migration)
export const LegacyPostStatus = {
  PUBLISHED: "published",
  DRAFT: "draft",
  ARCHIVED: "archived",
};

// Post status display config
export const PostStatusConfig = {
  [PostStatus.OPEN]: {
    label: "Open",
    color: "gray",
    bgColor: "bg-gray-100",
    textColor: "text-gray-800",
    borderColor: "border-gray-300",
    description: "Awaiting review",
  },
  [PostStatus.ACKNOWLEDGED]: {
    label: "Acknowledged",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    borderColor: "border-blue-300",
    description: "Admin has seen this",
  },
  [PostStatus.IN_PROGRESS]: {
    label: "In Progress",
    color: "yellow",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
    borderColor: "border-yellow-300",
    description: "Being worked on",
  },
  [PostStatus.UNDER_REVIEW]: {
    label: "Under Review",
    color: "purple",
    bgColor: "bg-purple-100",
    textColor: "text-purple-800",
    borderColor: "border-purple-300",
    description: "Under investigation",
  },
  [PostStatus.RESOLVED]: {
    label: "Resolved",
    color: "green",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-300",
    description: "Issue fixed",
  },
  [PostStatus.CLOSED]: {
    label: "Closed",
    color: "slate",
    bgColor: "bg-slate-100",
    textColor: "text-slate-800",
    borderColor: "border-slate-300",
    description: "No action needed",
  },
  [PostStatus.WORKING_ON]: {
    label: "Working On",
    color: "indigo",
    bgColor: "bg-indigo-100",
    textColor: "text-indigo-800",
    borderColor: "border-indigo-300",
    description: "Forwarded to relevant sections, awaiting response",
  },
  [PostStatus.REJECTED]: {
    label: "Rejected",
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    borderColor: "border-red-300",
    description: "Invalid or duplicate",
  },
  [PostStatus.NOT_A_PROBLEM]: {
    label: "Not a Problem",
    color: "slate",
    bgColor: "bg-slate-100",
    textColor: "text-slate-800",
    borderColor: "border-slate-300",
    description: "Not a real problem or will be resolved in future",
  },
};

// Post priority system (4 levels)
export const PostPriority = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

// Priority configuration with auto-escalation rules
export const PostPriorityConfig = {
  [PostPriority.CRITICAL]: {
    label: "Critical",
    level: 4,
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    borderColor: "border-red-300",
    badgeBg: "bg-red-600",
    badgeText: "text-white",
    autoEscalateHours: 2,
    notifyAdmin: "immediately",
    icon: "🔴",
  },
  [PostPriority.HIGH]: {
    label: "High",
    level: 3,
    color: "orange",
    bgColor: "bg-orange-100",
    textColor: "text-orange-800",
    borderColor: "border-orange-300",
    badgeBg: "bg-orange-500",
    badgeText: "text-white",
    autoEscalateHours: 24,
    notifyAdmin: "daily",
    icon: "🟠",
  },
  [PostPriority.MEDIUM]: {
    label: "Medium",
    level: 2,
    color: "yellow",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
    borderColor: "border-yellow-300",
    badgeBg: "bg-yellow-500",
    badgeText: "text-white",
    autoEscalateHours: 72,
    notifyAdmin: "weekly",
    icon: "🟡",
  },
  [PostPriority.LOW]: {
    label: "Low",
    level: 1,
    color: "gray",
    bgColor: "bg-gray-100",
    textColor: "text-gray-800",
    borderColor: "border-gray-300",
    badgeBg: "bg-gray-500",
    badgeText: "text-white",
    autoEscalateHours: null,
    notifyAdmin: "never",
    icon: "⚪",
  },
};

// Assignment types
export const AssignmentType = {
  USER: "user",
  DEPARTMENT: "department",
};

// Post activity types (for timeline)
export const PostActivityType = {
  CREATED: "created",
  STATUS_CHANGED: "status_changed",
  PRIORITY_CHANGED: "priority_changed",
  ASSIGNED: "assigned",
  UNASSIGNED: "unassigned",
  DUE_DATE_SET: "due_date_set",
  DUE_DATE_CHANGED: "due_date_changed",
  ADMIN_COMMENT: "admin_comment",
  RESOLVED: "resolved",
  REOPENED: "reopened",
  EDITED: "edited",
  PINNED: "pinned",
  UNPINNED: "unpinned",
  ARCHIVED: "archived",
  UNARCHIVED: "unarchived",
  POST_DELETED: "post_deleted",
};

// Post activity type display configuration
export const PostActivityTypeConfig = {
  [PostActivityType.CREATED]: {
    label: "Post Created",
    icon: "📝",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    description: "A new post was created",
  },
  [PostActivityType.STATUS_CHANGED]: {
    label: "Status Changed",
    icon: "🔄",
    color: "indigo",
    bgColor: "bg-indigo-100",
    textColor: "text-indigo-800",
    description: "Post status was updated",
  },
  [PostActivityType.PRIORITY_CHANGED]: {
    label: "Priority Changed",
    icon: "⚡",
    color: "orange",
    bgColor: "bg-orange-100",
    textColor: "text-orange-800",
    description: "Post priority was updated",
  },
  [PostActivityType.ASSIGNED]: {
    label: "Assigned",
    icon: "👤",
    color: "purple",
    bgColor: "bg-purple-100",
    textColor: "text-purple-800",
    description: "Post was assigned to a user or department",
  },
  [PostActivityType.UNASSIGNED]: {
    label: "Unassigned",
    icon: "🚫",
    color: "gray",
    bgColor: "bg-gray-100",
    textColor: "text-gray-800",
    description: "Assignment was removed",
  },
  [PostActivityType.DUE_DATE_SET]: {
    label: "Due Date Set",
    icon: "📅",
    color: "green",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    description: "Due date was set",
  },
  [PostActivityType.DUE_DATE_CHANGED]: {
    label: "Due Date Changed",
    icon: "📆",
    color: "yellow",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
    description: "Due date was updated",
  },
  [PostActivityType.ADMIN_COMMENT]: {
    label: "Admin Comment",
    icon: "💬",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    description: "Admin added a comment",
  },
  [PostActivityType.RESOLVED]: {
    label: "Resolved",
    icon: "✅",
    color: "green",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    description: "Post was marked as resolved",
  },
  [PostActivityType.REOPENED]: {
    label: "Reopened",
    icon: "🔓",
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    description: "Post was reopened",
  },
  [PostActivityType.EDITED]: {
    label: "Edited",
    icon: "✏️",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    description: "Post was edited",
  },
  [PostActivityType.PINNED]: {
    label: "Pinned",
    icon: "📌",
    color: "purple",
    bgColor: "bg-purple-100",
    textColor: "text-purple-800",
    description: "Post was pinned",
  },
  [PostActivityType.UNPINNED]: {
    label: "Unpinned",
    icon: "📍",
    color: "gray",
    bgColor: "bg-gray-100",
    textColor: "text-gray-800",
    description: "Post was unpinned",
  },
  [PostActivityType.ARCHIVED]: {
    label: "Archived",
    icon: "📦",
    color: "slate",
    bgColor: "bg-slate-100",
    textColor: "text-slate-800",
    description: "Post was archived",
  },
  [PostActivityType.UNARCHIVED]: {
    label: "Unarchived",
    icon: "📤",
    color: "green",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    description: "Post was unarchived",
  },
  [PostActivityType.POST_DELETED]: {
    label: "Post Deleted",
    icon: "🗑️",
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    description: "Post was permanently deleted",
  },
};

// System activity types (for system-level audit logging)
export const SystemActivityType = {
  USER_LOGIN: "user_login",
  USER_LOGOUT: "user_logout",
  USER_CREATED: "user_created",
  USER_UPDATED: "user_updated",
  USER_DELETED: "user_deleted",
  USER_SUSPENDED: "user_suspended",
  USER_ACTIVATED: "user_activated",
  ROLE_CHANGED: "role_changed",
  DEPARTMENT_CREATED: "department_created",
  DEPARTMENT_UPDATED: "department_updated",
  DEPARTMENT_DELETED: "department_deleted",
  PASSWORD_CHANGED: "password_changed",
  PROFILE_UPDATED: "profile_updated",
};

// System activity type display configuration
export const SystemActivityTypeConfig = {
  [SystemActivityType.USER_LOGIN]: {
    label: "User Login",
    icon: "🔑",
    color: "green",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    description: "User logged in",
  },
  [SystemActivityType.USER_LOGOUT]: {
    label: "User Logout",
    icon: "🚪",
    color: "gray",
    bgColor: "bg-gray-100",
    textColor: "text-gray-800",
    description: "User logged out",
  },
  [SystemActivityType.USER_CREATED]: {
    label: "User Created",
    icon: "➕",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    description: "New user was created",
  },
  [SystemActivityType.USER_UPDATED]: {
    label: "User Updated",
    icon: "✏️",
    color: "indigo",
    bgColor: "bg-indigo-100",
    textColor: "text-indigo-800",
    description: "User information was updated",
  },
  [SystemActivityType.USER_DELETED]: {
    label: "User Deleted",
    icon: "🗑️",
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    description: "User was deleted",
  },
  [SystemActivityType.USER_SUSPENDED]: {
    label: "User Suspended",
    icon: "⛔",
    color: "orange",
    bgColor: "bg-orange-100",
    textColor: "text-orange-800",
    description: "User account was suspended",
  },
  [SystemActivityType.USER_ACTIVATED]: {
    label: "User Activated",
    icon: "✅",
    color: "green",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    description: "User account was activated",
  },
  [SystemActivityType.ROLE_CHANGED]: {
    label: "Role Changed",
    icon: "🔐",
    color: "purple",
    bgColor: "bg-purple-100",
    textColor: "text-purple-800",
    description: "User role was changed",
  },
  [SystemActivityType.DEPARTMENT_CREATED]: {
    label: "Department Created",
    icon: "🏢",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    description: "New department was created",
  },
  [SystemActivityType.DEPARTMENT_UPDATED]: {
    label: "Department Updated",
    icon: "📝",
    color: "indigo",
    bgColor: "bg-indigo-100",
    textColor: "text-indigo-800",
    description: "Department information was updated",
  },
  [SystemActivityType.DEPARTMENT_DELETED]: {
    label: "Department Deleted",
    icon: "🗑️",
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    description: "Department was deleted",
  },
  [SystemActivityType.PASSWORD_CHANGED]: {
    label: "Password Changed",
    icon: "🔒",
    color: "yellow",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
    description: "User password was changed",
  },
  [SystemActivityType.PROFILE_UPDATED]: {
    label: "Profile Updated",
    icon: "👤",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    description: "User profile was updated",
  },
};

// ============================================
// COMPANY & DEPARTMENTS
// ============================================

// Subscription status
export const SubscriptionStatus = {
  ACTIVE: "active",
  TRIAL: "trial",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
};

// Default departments (can be customized per company)
export const DefaultDepartments = [
  { id: "engineering", name: "Engineering", icon: "⚙️" },
  { id: "hr", name: "Human Resources", icon: "👥" },
  { id: "finance", name: "Finance", icon: "💰" },
  { id: "marketing", name: "Marketing", icon: "📢" },
  { id: "sales", name: "Sales", icon: "💼" },
  { id: "operations", name: "Operations", icon: "🔧" },
  { id: "it", name: "IT Support", icon: "💻" },
  { id: "legal", name: "Legal", icon: "⚖️" },
  { id: "admin", name: "Administration", icon: "📋" },
  { id: "facilities", name: "Facilities", icon: "🏢" },
];

// ============================================
// NOTIFICATIONS
// ============================================

// Notification types
export const NotificationType = {
  COMMENT: "comment",
  REACTION: "reaction",
  MENTION: "mention",
  POST_UPDATE: "post_update",
  STATUS_CHANGED: "status_changed",
  PRIORITY_CHANGED: "priority_changed",
  ASSIGNED: "assigned",
  DUE_DATE_REMINDER: "due_date_reminder",
  ADMIN_COMMENT: "admin_comment",
  MODERATION: "moderation",
  CONTENT_REPORTED: "content_reported",
  STRIKE_RECEIVED: "strike_received",
  ACCOUNT_RESTRICTED: "account_restricted",
  ACCOUNT_SUSPENDED: "account_suspended",
};

// Reaction types
export const ReactionType = {
  LIKE: "like",
  LOVE: "love",
  CELEBRATE: "celebrate",
  SUPPORT: "support",
  INSIGHTFUL: "insightful",
  CONCERNED: "concerned",
};

// ============================================
// CONTENT MODERATION SYSTEM
// ============================================

// Report reasons
export const ReportReason = {
  HARASSMENT: "harassment",
  INAPPROPRIATE: "inappropriate",
  SPAM: "spam",
  FALSE_INFO: "false_info",
  DISCRIMINATION: "discrimination",
  VIOLENCE: "violence",
  OTHER: "other",
};

// Report reason display configuration
export const ReportReasonConfig = {
  [ReportReason.HARASSMENT]: {
    label: "Harassment or bullying",
    description: "Threatening, bullying, or harassing behavior",
    icon: "🚫",
  },
  [ReportReason.INAPPROPRIATE]: {
    label: "Inappropriate content",
    description: "Offensive or inappropriate material",
    icon: "⚠️",
  },
  [ReportReason.SPAM]: {
    label: "Spam",
    description: "Unsolicited or repetitive content",
    icon: "📧",
  },
  [ReportReason.FALSE_INFO]: {
    label: "False information",
    description: "Misleading or false information",
    icon: "❌",
  },
  [ReportReason.DISCRIMINATION]: {
    label: "Discrimination",
    description: "Discriminatory content based on protected characteristics",
    icon: "⛔",
  },
  [ReportReason.VIOLENCE]: {
    label: "Violence or threats",
    description: "Content containing violence or threatening language",
    icon: "🔴",
  },
  [ReportReason.OTHER]: {
    label: "Other",
    description: "Other policy violation",
    icon: "🔍",
  },
};

// Content types that can be reported
export const ReportableContentType = {
  POST: "post",
  COMMENT: "comment",
};

// Report status
export const ReportStatus = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  RESOLVED: "resolved",
  DISMISSED: "dismissed",
};

// Report status display configuration
export const ReportStatusConfig = {
  [ReportStatus.PENDING]: {
    label: "Pending Review",
    color: "yellow",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
    borderColor: "border-yellow-300",
    description: "Awaiting moderator review",
  },
  [ReportStatus.UNDER_REVIEW]: {
    label: "Under Review",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    borderColor: "border-blue-300",
    description: "Being reviewed by a moderator",
  },
  [ReportStatus.RESOLVED]: {
    label: "Resolved",
    color: "green",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-300",
    description: "Action has been taken",
  },
  [ReportStatus.DISMISSED]: {
    label: "Dismissed",
    color: "gray",
    bgColor: "bg-gray-100",
    textColor: "text-gray-800",
    borderColor: "border-gray-300",
    description: "No violation found",
  },
};

// Moderation action types
export const ModerationActionType = {
  DISMISS: "dismiss",
  REMOVE_CONTENT: "remove_content",
  REMOVE_AND_WARN: "remove_and_warn",
  ESCALATE: "escalate",
  REMOVE_AND_SUSPEND: "remove_and_suspend",
};

// Moderation action display configuration
export const ModerationActionConfig = {
  [ModerationActionType.DISMISS]: {
    label: "Dismiss Report",
    description: "No violation found",
    icon: "✓",
    color: "gray",
  },
  [ModerationActionType.REMOVE_CONTENT]: {
    label: "Remove Content",
    description: "Take down content without warning",
    icon: "🗑️",
    color: "orange",
  },
  [ModerationActionType.REMOVE_AND_WARN]: {
    label: "Remove & Warn",
    description: "Remove content and issue strike",
    icon: "⚠️",
    color: "red",
  },
  [ModerationActionType.ESCALATE]: {
    label: "Escalate",
    description: "Forward to super admin",
    icon: "⬆️",
    color: "purple",
  },
  [ModerationActionType.REMOVE_AND_SUSPEND]: {
    label: "Remove & Suspend",
    description: "Immediate suspension (severe violations)",
    icon: "🔒",
    color: "red",
  },
};

// Strike levels (3-strike policy)
export const StrikeLevel = {
  FIRST: 1,
  SECOND: 2,
  THIRD: 3,
};

// Strike configuration
export const StrikeConfig = {
  [StrikeLevel.FIRST]: {
    label: "Strike 1 - Warning",
    action: "Warning notification",
    consequence: "Content removed, warning issued",
    duration: null,
    icon: "⚠️",
    color: "yellow",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
  },
  [StrikeLevel.SECOND]: {
    label: "Strike 2 - Temporary Restriction",
    action: "7-day posting restriction",
    consequence: "Cannot post or comment for 7 days",
    duration: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    icon: "🚫",
    color: "orange",
    bgColor: "bg-orange-100",
    textColor: "text-orange-800",
  },
  [StrikeLevel.THIRD]: {
    label: "Strike 3 - Account Suspension",
    action: "30-day account suspension",
    consequence: "Account suspended for 30 days",
    duration: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    icon: "🔒",
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
  },
};

// User restriction types
export const RestrictionType = {
  POSTING: "posting",
  COMMENTING: "commenting",
  FULL_SUSPENSION: "full_suspension",
};

// Moderation activity types (for audit trail)
export const ModerationActivityType = {
  REPORT_CREATED: "report_created",
  REPORT_ASSIGNED: "report_assigned",
  REPORT_REVIEWED: "report_reviewed",
  CONTENT_REMOVED: "content_removed",
  STRIKE_ISSUED: "strike_issued",
  USER_WARNED: "user_warned",
  USER_RESTRICTED: "user_restricted",
  USER_SUSPENDED: "user_suspended",
  REPORT_DISMISSED: "report_dismissed",
  REPORT_ESCALATED: "report_escalated",
};

// ============================================
// WCAG AA COMPLIANT COLOR SYSTEM
// ============================================

export const COLORS = {
  // Primary actions (Indigo)
  primary: {
    main: "#6366F1",        // Indigo-500
    hover: "#4F46E5",       // Indigo-600
    active: "#4338CA",      // Indigo-700
    text: "#FFFFFF",        // White text for contrast
    light: "#EEF2FF",       // Indigo-50
    border: "#C7D2FE",      // Indigo-200
  },

  // Success actions (Green)
  success: {
    main: "#10B981",        // Emerald-500
    hover: "#059669",       // Emerald-600
    active: "#047857",      // Emerald-700
    text: "#FFFFFF",        // White text
    light: "#D1FAE5",       // Emerald-100
    border: "#6EE7B7",      // Emerald-300
  },

  // Danger/destructive actions (Red)
  danger: {
    main: "#EF4444",        // Red-500
    hover: "#DC2626",       // Red-600
    active: "#B91C1C",      // Red-700
    text: "#FFFFFF",        // White text
    light: "#FEE2E2",       // Red-100
    border: "#FCA5A5",      // Red-300
  },

  // Warning actions (Amber)
  warning: {
    main: "#F59E0B",        // Amber-500
    hover: "#D97706",       // Amber-600
    active: "#B45309",      // Amber-700
    text: "#FFFFFF",        // White text
    light: "#FEF3C7",       // Amber-100
    border: "#FCD34D",      // Amber-300
  },

  // Info actions (Blue)
  info: {
    main: "#3B82F6",        // Blue-500
    hover: "#2563EB",       // Blue-600
    active: "#1D4ED8",      // Blue-700
    text: "#FFFFFF",        // White text
    light: "#DBEAFE",       // Blue-100
    border: "#93C5FD",      // Blue-300
  },

  // Neutral/Secondary (Gray)
  neutral: {
    main: "#6B7280",        // Gray-500
    hover: "#4B5563",       // Gray-600
    active: "#374151",      // Gray-700
    text: "#FFFFFF",        // White text
    light: "#F3F4F6",       // Gray-100
    border: "#D1D5DB",      // Gray-300
  },

  // Text colors
  text: {
    primary: "#111827",     // Gray-900
    secondary: "#4B5563",   // Gray-600
    tertiary: "#6B7280",    // Gray-500
    disabled: "#9CA3AF",    // Gray-400
    inverse: "#FFFFFF",     // White
  },

  // Background colors
  background: {
    primary: "#FFFFFF",     // White
    secondary: "#F9FAFB",   // Gray-50
    tertiary: "#F3F4F6",    // Gray-100
    dark: "#111827",        // Gray-900
  },

  // Border colors
  border: {
    light: "#F3F4F6",       // Gray-100
    main: "#E5E7EB",        // Gray-200
    dark: "#D1D5DB",        // Gray-300
    darker: "#9CA3AF",      // Gray-400
  },
};
