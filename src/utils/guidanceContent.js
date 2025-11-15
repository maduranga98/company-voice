/**
 * Guidance Content for Company Voice
 *
 * This file contains all help text, tooltips, and guidance content
 * organized by feature area and role.
 */

// ============================================================================
// ROLE DEFINITIONS
// ============================================================================

export const ROLE_DEFINITIONS = {
  super_admin: {
    name: "Super Admin",
    description: "Platform-level administrator with access to all companies",
    responsibilities: [
      "Manage multiple companies and their settings",
      "Handle super admin billing and subscriptions",
      "Oversee system-wide administration",
      "Create and configure new companies"
    ],
    icon: "👑"
  },
  company_admin: {
    name: "Company Admin",
    description: "Administrator for a specific company with full control",
    responsibilities: [
      "Manage company members and departments",
      "Handle post moderation and status updates",
      "Access analytics and reporting",
      "Manage tags and user classifications",
      "Configure company billing and subscriptions",
      "Create and manage post templates",
      "Generate QR codes for employee invitations"
    ],
    icon: "⚙️"
  },
  hr: {
    name: "HR",
    description: "Human Resources specialist with administrative privileges",
    responsibilities: [
      "Manage HR-specific content and sensitive posts",
      "Perform member management and moderation",
      "Access company analytics and audit logs",
      "Handle employee-related administrative tasks",
      "Manage departments and tags"
    ],
    icon: "👥"
  },
  employee: {
    name: "Employee",
    description: "Regular company employee with content creation privileges",
    responsibilities: [
      "Create posts (Problems, Ideas, Creative content, Discussions)",
      "Comment on and engage with posts",
      "View company feeds and content",
      "Manage own posts (edit/delete)",
      "View posts assigned to them (if tagged)"
    ],
    icon: "👤"
  }
};

// ============================================================================
// POST STATUS WORKFLOW
// ============================================================================

export const POST_STATUS_GUIDANCE = {
  title: "Post Status Workflow",
  description: "Track and manage posts through their lifecycle using these status indicators.",
  statuses: {
    OPEN: {
      label: "Open",
      description: "Just created, awaiting admin review",
      whenToUse: "Default status for all new posts",
      color: "blue",
      icon: "📬"
    },
    ACKNOWLEDGED: {
      label: "Acknowledged",
      description: "Admin has seen and acknowledged the post",
      whenToUse: "When you've reviewed the post and want to signal awareness",
      color: "purple",
      icon: "👁️"
    },
    IN_PROGRESS: {
      label: "In Progress",
      description: "Actively being worked on",
      whenToUse: "When work has started to address the post",
      color: "yellow",
      icon: "🔄"
    },
    UNDER_REVIEW: {
      label: "Under Review",
      description: "Being investigated or evaluated",
      whenToUse: "When the post requires investigation or analysis",
      color: "orange",
      icon: "🔍"
    },
    WORKING_ON: {
      label: "Working On",
      description: "Forwarded to relevant departments, awaiting response",
      whenToUse: "When you've delegated to another team and waiting for updates",
      color: "indigo",
      icon: "📤"
    },
    RESOLVED: {
      label: "Resolved",
      description: "Successfully fixed or completed",
      whenToUse: "When the issue is fully resolved or idea is implemented",
      color: "green",
      icon: "✅"
    },
    CLOSED: {
      label: "Closed",
      description: "No action needed or taken",
      whenToUse: "When the post doesn't require any action",
      color: "gray",
      icon: "🔒"
    },
    REJECTED: {
      label: "Rejected",
      description: "Not valid, duplicate, or out of scope",
      whenToUse: "When the post is invalid, duplicate, or doesn't align with company goals",
      color: "red",
      icon: "❌"
    },
    NOT_A_PROBLEM: {
      label: "Not a Problem",
      description: "Not a real issue or will be resolved in future",
      whenToUse: "When the reported issue isn't actually a problem or will resolve itself",
      color: "slate",
      icon: "ℹ️"
    }
  },
  bestPractices: [
    "Always add a comment when changing status to explain the reason",
    "Update status promptly to keep employees informed",
    "Use ACKNOWLEDGED quickly to show you've seen important posts",
    "Move to RESOLVED only when action is complete",
    "Provide closure by explaining REJECTED or NOT_A_PROBLEM decisions"
  ]
};

// ============================================================================
// POST PRIORITY SYSTEM
// ============================================================================

export const PRIORITY_GUIDANCE = {
  title: "Priority Levels",
  description: "Assign priority to posts to indicate urgency and importance.",
  levels: {
    CRITICAL: {
      label: "Critical",
      description: "Requires immediate attention",
      criteria: [
        "System outages or major functionality broken",
        "Safety or security concerns",
        "Legal or compliance issues",
        "Severe business impact"
      ],
      color: "red",
      icon: "🚨"
    },
    HIGH: {
      label: "High",
      description: "Important and time-sensitive",
      criteria: [
        "Significant impact on multiple teams",
        "Blocking key processes or workflows",
        "Customer-facing issues",
        "Time-sensitive opportunities"
      ],
      color: "orange",
      icon: "⚡"
    },
    MEDIUM: {
      label: "Medium",
      description: "Normal priority, should be addressed",
      criteria: [
        "Standard operational issues",
        "Process improvements",
        "Non-blocking problems",
        "Regular feature requests"
      ],
      color: "yellow",
      icon: "📊"
    },
    LOW: {
      label: "Low",
      description: "Nice to have, address when possible",
      criteria: [
        "Minor improvements",
        "Optional enhancements",
        "Low-impact suggestions",
        "Long-term ideas"
      ],
      color: "green",
      icon: "💡"
    }
  },
  bestPractices: [
    "Set priority based on business impact, not just urgency",
    "Review and adjust priorities regularly",
    "Communicate priority changes to stakeholders",
    "Use CRITICAL sparingly to maintain its significance"
  ]
};

// ============================================================================
// USER TAG SYSTEM
// ============================================================================

export const TAG_SYSTEM_GUIDANCE = {
  title: "User Tag System",
  description: "Tags help classify users by role or seniority for assignment and filtering.",
  purpose: "Tags enable the 'Assigned to Me' feature - when users with tags are mentioned in posts, those posts appear in their assigned section.",
  tags: {
    EXECUTIVE: {
      label: "Executive",
      description: "C-level executives and Vice Presidents",
      examples: ["CEO", "CTO", "CFO", "VP of Engineering"],
      priority: 5,
      color: "purple",
      icon: "🎯"
    },
    SENIOR_MANAGER: {
      label: "Senior Manager",
      description: "Senior managers and directors",
      examples: ["Director of HR", "Senior Engineering Manager"],
      priority: 4,
      color: "blue",
      icon: "🎯"
    },
    MANAGER: {
      label: "Manager",
      description: "Team leads and managers",
      examples: ["Team Lead", "Project Manager", "Department Manager"],
      priority: 3,
      color: "indigo",
      icon: "📊"
    },
    SPECIALIST: {
      label: "Specialist",
      description: "Senior specialists and subject matter experts",
      examples: ["Senior Engineer", "UX Specialist", "Security Expert"],
      priority: 2,
      color: "green",
      icon: "🔧"
    },
    STAFF: {
      label: "Staff",
      description: "Regular employees and staff members",
      examples: ["Engineer", "Designer", "Analyst"],
      priority: 1,
      color: "gray",
      icon: "👤"
    }
  },
  howToAssign: [
    "Tags are optional - not all users need a tag",
    "Only assign tags to users who need to track assigned items",
    "One user can have multiple tags if they hold multiple roles",
    "Tags don't affect permissions - they're for organization only"
  ],
  bestPractices: [
    "Use tags consistently across your organization",
    "Review and update tags during role changes",
    "Don't over-tag - only tag users who need assignment tracking",
    "Document your organization's tag assignment criteria"
  ]
};

// ============================================================================
// DEPARTMENT MANAGEMENT
// ============================================================================

export const DEPARTMENT_GUIDANCE = {
  title: "Department Management",
  description: "Organize your company structure with departments.",
  whatAreDepartments: "Departments help you organize members by team, function, or location. They're used for filtering posts, analytics, and access control.",
  howToCreate: [
    "Click 'Create Department' button",
    "Enter a descriptive department name",
    "Optionally add a description",
    "Assign members to the department"
  ],
  bestPractices: [
    "Create departments that match your organizational structure",
    "Keep department names clear and consistent",
    "Assign all members to at least one department",
    "Use departments for targeted content with privacy settings",
    "Review department analytics to track team engagement"
  ],
  useCases: [
    "Filter posts by department in feeds",
    "Create department-specific content with privacy controls",
    "Track department performance in analytics",
    "Organize member management by team"
  ]
};

// ============================================================================
// MEMBER MANAGEMENT
// ============================================================================

export const MEMBER_MANAGEMENT_GUIDANCE = {
  title: "Member Management",
  description: "Manage users, assign roles, and control access.",
  memberStatuses: {
    ACTIVE: {
      label: "Active",
      description: "Full access to the platform",
      icon: "✅"
    },
    PENDING: {
      label: "Pending",
      description: "Invitation sent, awaiting registration",
      icon: "⏳"
    },
    SUSPENDED: {
      label: "Suspended",
      description: "Access temporarily revoked",
      icon: "⛔"
    }
  },
  howToManage: [
    "Use filters to find specific members",
    "Click on a member to view details",
    "Change roles from the dropdown menu",
    "Assign tags for organizational classification",
    "Suspend members to temporarily revoke access"
  ],
  roleAssignment: [
    "Assign Company Admin carefully - they have full access",
    "HR role is for human resources personnel",
    "Most users should be Employees",
    "Only Super Admins can create other Super Admins"
  ],
  bulkOperations: [
    "Select multiple members with checkboxes",
    "Use bulk actions for efficiency",
    "Available actions: Change role, Assign tag, Change status",
    "Review selections before applying bulk changes"
  ],
  bestPractices: [
    "Regularly audit member roles and access",
    "Suspend rather than delete when access should be temporary",
    "Document role changes in admin notes",
    "Use departments to organize large teams"
  ]
};

// ============================================================================
// TEMPLATE SYSTEM
// ============================================================================

export const TEMPLATE_GUIDANCE = {
  title: "Post Templates",
  description: "Create reusable templates for common post types.",
  whatAreTemplates: "Templates are pre-formatted post structures that help users create consistent, well-structured content quickly.",
  howToCreate: [
    "Navigate to Templates page",
    "Click 'Create Template'",
    "Choose post type (Problem, Idea, Creative, Discussion)",
    "Add title and content with placeholders",
    "Save template for reuse"
  ],
  howToUse: [
    "When creating a post, look for 'Use Template' option",
    "Select from available templates",
    "Template content auto-fills the form",
    "Customize as needed before posting"
  ],
  templateExamples: [
    {
      name: "Bug Report Template",
      type: "Problem Report",
      content: "Steps to reproduce:\n1. \n2. \n3. \n\nExpected behavior:\n\nActual behavior:\n\nScreenshots/Evidence:"
    },
    {
      name: "Feature Request Template",
      type: "Idea Suggestion",
      content: "Problem:\n\nProposed Solution:\n\nExpected Benefits:\n\nAlternatives Considered:"
    },
    {
      name: "Team Update Template",
      type: "Team Discussion",
      content: "What we accomplished:\n\nWhat's next:\n\nBlockers/Concerns:\n\nShout-outs:"
    }
  ],
  bestPractices: [
    "Create templates for frequently posted content types",
    "Use clear, descriptive template names",
    "Include helpful prompts and examples in templates",
    "Keep templates concise and focused",
    "Review and update templates based on usage"
  ]
};

// ============================================================================
// ANALYTICS DASHBOARD
// ============================================================================

export const ANALYTICS_GUIDANCE = {
  title: "Analytics & Reporting",
  description: "Understand engagement, trends, and performance metrics.",
  keyMetrics: {
    postsByType: {
      label: "Posts by Type",
      description: "Distribution of Problem Reports, Ideas, Creative Content, and Discussions",
      useCase: "Identify what type of content employees create most"
    },
    postsByStatus: {
      label: "Posts by Status",
      description: "Current status distribution (Open, In Progress, Resolved, etc.)",
      useCase: "Track workflow progress and identify bottlenecks"
    },
    postsByPriority: {
      label: "Posts by Priority",
      description: "Distribution across Critical, High, Medium, Low priorities",
      useCase: "Understand urgency distribution and workload"
    },
    engagementMetrics: {
      label: "User Engagement",
      description: "Comments, reactions, and active participation",
      useCase: "Measure platform adoption and user activity"
    },
    responseTime: {
      label: "Response Time",
      description: "Average time to acknowledge and resolve posts",
      useCase: "Track admin responsiveness and efficiency"
    },
    departmentPerformance: {
      label: "Department Performance",
      description: "Activity and metrics by department",
      useCase: "Compare team engagement and identify trends"
    }
  },
  howToUse: [
    "Select time period (7, 30, or 90 days)",
    "Review charts and trends",
    "Click on data points for details",
    "Export data for further analysis",
    "Share insights with leadership"
  ],
  bestPractices: [
    "Review analytics weekly to identify trends",
    "Compare periods to track improvement",
    "Use insights to improve processes",
    "Share positive trends to encourage engagement",
    "Act on concerning patterns quickly"
  ]
};

// ============================================================================
// MODERATION DASHBOARD
// ============================================================================

export const MODERATION_GUIDANCE = {
  title: "Content Moderation",
  description: "Review reported content and maintain community standards.",
  reportStatuses: {
    PENDING: {
      label: "Pending",
      description: "New report awaiting review",
      action: "Review the content and take appropriate action",
      icon: "🔔"
    },
    UNDER_REVIEW: {
      label: "Under Review",
      description: "Being investigated",
      action: "Continue investigation and gather context",
      icon: "🔍"
    },
    RESOLVED: {
      label: "Resolved",
      description: "Action taken, issue resolved",
      action: "Ensure resolution is documented",
      icon: "✅"
    },
    DISMISSED: {
      label: "Dismissed",
      description: "No action needed",
      action: "Document reason for dismissal",
      icon: "✖️"
    }
  },
  moderationActions: [
    {
      action: "No Action",
      whenToUse: "Report is invalid or content is acceptable",
      icon: "👍"
    },
    {
      action: "Warning",
      whenToUse: "Minor violation, user should be informed",
      icon: "⚠️"
    },
    {
      action: "Remove Content",
      whenToUse: "Content violates policies and should be hidden",
      icon: "🗑️"
    },
    {
      action: "Suspend User",
      whenToUse: "Serious or repeated violations",
      icon: "🚫"
    }
  ],
  reviewProcess: [
    "Read the report and reported content carefully",
    "Review context (previous posts, comments, user history)",
    "Consult community guidelines and policies",
    "Take appropriate action based on severity",
    "Document your decision and reasoning",
    "Communicate decision to reporter and reported user"
  ],
  bestPractices: [
    "Review reports promptly (within 24 hours)",
    "Be consistent in applying standards",
    "Always document your reasoning",
    "Escalate serious issues to leadership",
    "Provide clear communication to users",
    "Learn from patterns in reports"
  ]
};

// ============================================================================
// POST CREATION
// ============================================================================

export const POST_CREATION_GUIDANCE = {
  title: "Creating Posts",
  description: "Share problems, ideas, creative content, and discussions.",
  postTypes: {
    problem_report: {
      label: "Problem Report",
      description: "Report issues, bugs, or problems that need resolution",
      whenToUse: "When something is broken, not working, or causing issues",
      tips: [
        "Be specific about the problem",
        "Include steps to reproduce",
        "Add screenshots or evidence",
        "Describe impact and urgency"
      ],
      icon: "🐛"
    },
    idea_suggestion: {
      label: "Idea Suggestion",
      description: "Suggest improvements, features, or new ideas",
      whenToUse: "When you have ideas to improve products, processes, or the workplace",
      tips: [
        "Explain the problem you're solving",
        "Describe your proposed solution",
        "Highlight expected benefits",
        "Consider alternatives"
      ],
      icon: "💡"
    },
    creative_content: {
      label: "Creative Content",
      description: "Share creative work, designs, or innovative concepts",
      whenToUse: "When sharing designs, creative projects, or artistic content",
      tips: [
        "Use visuals to showcase your work",
        "Explain your creative process",
        "Request specific feedback",
        "Share inspiration sources"
      ],
      icon: "🎨"
    },
    team_discussion: {
      label: "Team Discussion",
      description: "Start conversations and team discussions",
      whenToUse: "When you want to gather input, brainstorm, or discuss topics",
      tips: [
        "Frame discussion with clear questions",
        "Provide context and background",
        "Encourage diverse perspectives",
        "Summarize conclusions in comments"
      ],
      icon: "💬"
    }
  },
  privacySettings: {
    COMPANY_PUBLIC: {
      label: "Company Public",
      description: "Visible to all company members",
      icon: "🌐"
    },
    DEPARTMENT_ONLY: {
      label: "Department Only",
      description: "Only visible to your department",
      icon: "👥"
    },
    HR_ONLY: {
      label: "HR Only",
      description: "Only visible to HR and admins",
      icon: "🔒"
    }
  },
  bestPractices: [
    "Choose the right post type for your content",
    "Write clear, descriptive titles",
    "Provide sufficient context and details",
    "Use appropriate privacy settings",
    "Add relevant tags or mentions",
    "Proofread before posting"
  ]
};

// ============================================================================
// QR CODE GENERATION
// ============================================================================

export const QR_CODE_GUIDANCE = {
  title: "QR Code for Employee Invitations",
  description: "Generate QR codes to simplify employee onboarding.",
  howItWorks: [
    "Admin generates a company-specific QR code",
    "QR code is printed or displayed digitally",
    "New employees scan with their mobile device",
    "They're directed to registration with company pre-filled",
    "After registration, they gain instant access"
  ],
  howToGenerate: [
    "Navigate to QR Code page in admin panel",
    "Click 'Generate QR Code'",
    "Download QR code image or PDF with instructions",
    "Share with new employees or display in office"
  ],
  distributionMethods: [
    "Print and post in common areas",
    "Include in new hire welcome packets",
    "Display during orientation sessions",
    "Share digitally via email or messaging",
    "Add to employee handbook"
  ],
  bestPractices: [
    "Include clear instructions with QR code",
    "Test QR code before wide distribution",
    "Regenerate periodically for security",
    "Track successful registrations",
    "Provide alternative registration methods"
  ]
};

// ============================================================================
// ASSIGNED TO ME FEATURE
// ============================================================================

export const ASSIGNED_TO_ME_GUIDANCE = {
  title: "Assigned to Me",
  description: "Track posts and tasks assigned to you.",
  howItWorks: [
    "Admins can assign posts to tagged users",
    "When mentioned or assigned, posts appear in 'Assigned to Me'",
    "Only users with tags see this section",
    "Acts as your personal task list"
  ],
  whatToExpect: [
    "Posts requiring your attention or action",
    "Items where you're mentioned or tagged",
    "Tasks delegated to you by admins",
    "Priority items for your role level"
  ],
  howToManage: [
    "Review assigned items regularly",
    "Add comments with progress updates",
    "Mark items complete when done",
    "Escalate blockers to admins"
  ],
  bestPractices: [
    "Check assigned items daily",
    "Prioritize by urgency and deadline",
    "Communicate status proactively",
    "Ask for clarification when needed"
  ]
};

// ============================================================================
// GENERAL FEATURE TOOLTIPS
// ============================================================================

export const FEATURE_TOOLTIPS = {
  pinPost: "Pin this post to keep it at the top of the feed",
  archivePost: "Archive this post to remove it from active feeds",
  deletePost: "Permanently delete this post and all its comments",
  editPost: "Edit post content, privacy, or settings",
  changePriority: "Update the priority level (Critical, High, Medium, Low)",
  changeStatus: "Update the workflow status",
  assignPost: "Assign this post to specific users for action",
  addDueDate: "Set a deadline for resolution or completion",
  adminComment: "Add a private admin note (visible to admins only)",
  reportContent: "Report this content for moderation review",
  saveAsDraft: "Save as draft to finish later",
  schedulePost: "Schedule this post to be published later",
  useTemplate: "Use a template to speed up post creation"
};

export default {
  ROLE_DEFINITIONS,
  POST_STATUS_GUIDANCE,
  PRIORITY_GUIDANCE,
  TAG_SYSTEM_GUIDANCE,
  DEPARTMENT_GUIDANCE,
  MEMBER_MANAGEMENT_GUIDANCE,
  TEMPLATE_GUIDANCE,
  ANALYTICS_GUIDANCE,
  MODERATION_GUIDANCE,
  POST_CREATION_GUIDANCE,
  QR_CODE_GUIDANCE,
  ASSIGNED_TO_ME_GUIDANCE,
  FEATURE_TOOLTIPS
};
