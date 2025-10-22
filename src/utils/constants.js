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

// Post types
export const PostType = {
  PROBLEM_REPORT: "problem_report",
  IDEA_SUGGESTION: "idea_suggestion",
  CREATIVE_CONTENT: "creative_content",
};

// Privacy levels
export const PrivacyLevel = {
  COMPANY_PUBLIC: "company_public",
  DEPARTMENT_ONLY: "department_only",
  HR_ONLY: "hr_only",
};

// Post status
export const PostStatus = {
  PUBLISHED: "published",
  DRAFT: "draft",
  UNDER_REVIEW: "under_review",
  ARCHIVED: "archived",
};

// Subscription status
export const SubscriptionStatus = {
  ACTIVE: "active",
  TRIAL: "trial",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
};

// Report status
export const ReportStatus = {
  PENDING: "pending",
  REVIEWED: "reviewed",
  RESOLVED: "resolved",
};

// Notification types
export const NotificationType = {
  COMMENT: "comment",
  REACTION: "reaction",
  MENTION: "mention",
  POST_UPDATE: "post_update",
  MODERATION: "moderation",
};

// Reaction types
export const ReactionType = {
  LIKE: "like",
  LOVE: "love",
  CELEBRATE: "celebrate",
  SUPPORT: "support",
};
