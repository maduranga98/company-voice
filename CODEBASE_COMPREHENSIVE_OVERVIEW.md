# Company Voice Platform - Comprehensive Codebase Overview

## Project Overview
**Company Voice** is a comprehensive employee engagement and feedback platform built with:
- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Firebase Cloud Functions
- **Database**: Firestore (NoSQL)
- **Storage**: Firebase Storage
- **Authentication**: Custom username/password with Firestore
- **Billing**: Stripe integration
- **Internationalization**: i18next (multi-language support)

---

## 1. DATABASE MODELS & FIRESTORE SCHEMA

### Collections Structure

#### Users Collection
```
users/{userId}
├── id: string (user ID)
├── username: string (unique)
├── password: string (SHA256 hashed)
├── email: string
├── displayName: string
├── role: enum[super_admin|company_admin|hr|employee]
├── status: enum[active|suspended|invited]
├── companyId: string (reference to company)
├── departmentIds: string[] (array of department references)
├── tags: string[] (user tags like executive, manager, staff)
├── userTag: enum[executive|senior_manager|manager|specialist|staff]
├── profilePicture: string (storage URL)
├── bio: string
├── phone: string
├── location: string
├── joinDate: timestamp
├── lastLogin: timestamp
├── createdAt: timestamp
└── updatedAt: timestamp
```

#### Posts Collection
```
posts/{postId}
├── id: string
├── title: string
├── description: string (main content)
├── content: string (alias for description)
├── type: enum[problem_report|idea_suggestion|creative_content|team_discussion]
├── companyId: string (required)
├── authorId: string (creator, encrypted for anonymous posts)
├── authorName: string
├── authorProfilePicture: string
├── status: enum[open|acknowledged|in_progress|under_review|working_on|resolved|closed|rejected|not_a_problem]
├── priority: enum[critical|high|medium|low]
├── tags: string[] (category tags)
├── isDraft: boolean
├── isScheduled: boolean
├── isAnonymous: boolean (can be published anonymously)
├── privacyLevel: enum[company_public|department_only|hr_only]
├── assignedTo: {
│   ├── type: enum[user|department]
│   ├── id: string
│   └── name: string
│ }
├── likes: number (counter)
├── commentCount: number (counter)
├── viewCount: number (counter)
├── reactions: { [reactionType]: number }
├── dueDate: timestamp (for problem reports)
├── createdAt: timestamp
├── updatedAt: timestamp
└── publishedAt: timestamp (if published from draft)

Subcollection: posts/{postId}/likes/{userId}
├── userId: string (user who liked)
└── createdAt: timestamp

Subcollection: posts/{postId}/reactions/{reactionId}
├── userId: string
├── reactionType: enum[like|love|celebrate|support|insightful|concerned]
└── createdAt: timestamp
```

#### Comments Collection
```
comments/{commentId}
├── id: string
├── postId: string (reference to post)
├── text: string
├── authorId: string (comment author)
├── authorName: string
├── authorProfilePicture: string
├── isAdmin: boolean (flag if admin comment)
├── createdAt: timestamp
├── updatedAt: timestamp
└── deletedAt: timestamp (soft delete)
```

#### Discussions Collection
```
discussions/{discussionId}
├── id: string
├── title: string
├── description: string
├── companyId: string
├── authorId: string
├── authorName: string
├── status: string
├── tags: string[]
├── commentCount: number
├── likes: number
├── createdAt: timestamp
├── updatedAt: timestamp
└── archivedAt: timestamp (optional)
```

#### Notifications Collection
```
notifications/{notificationId}
├── id: string
├── userId: string (recipient)
├── type: enum[comment|reaction|mention|post_update|status_changed|priority_changed|assigned|due_date_reminder|admin_comment|moderation|content_reported|strike_received|account_restricted|account_suspended]
├── title: string
├── message: string
├── relatedPostId: string (if applicable)
├── relatedCommentId: string (if applicable)
├── relatedUserId: string (originating user)
├── read: boolean
├── readAt: timestamp
├── actionUrl: string
├── data: object (flexible payload)
├── createdAt: timestamp
└── expiresAt: timestamp (auto-delete)
```

#### PostActivities Collection (Activity Timeline)
```
postActivities/{activityId}
├── id: string
├── postId: string (reference)
├── type: enum[created|status_changed|priority_changed|assigned|unassigned|due_date_set|due_date_changed|admin_comment|resolved|reopened]
├── performedBy: {
│   ├── id: string
│   └── name: string
│ }
├── oldValue: string (previous value)
├── newValue: string (new value)
├── description: string
├── companyId: string
├── createdAt: timestamp
└── metadata: object
```

#### PostViews Collection (Unread Tracking)
```
postViews/{viewId}
├── postId: string (reference)
├── authorId: string (post author)
├── userId: string (who viewed)
├── viewedAt: timestamp
└── unreadCommentCount: number
```

#### Content Reports Collection (Moderation)
```
contentReports/{reportId}
├── id: string
├── contentType: enum[post|comment]
├── contentId: string (post or comment ID)
├── reason: enum[harassment|inappropriate|spam|false_info|discrimination|violence|other]
├── description: string
├── reportedBy: string (user ID)
├── reportedByName: string
├── companyId: string
├── status: enum[pending|under_review|resolved|dismissed]
├── reviewedBy: string (moderator ID)
├── moderationAction: enum[dismiss|remove_content|remove_and_warn|escalate|remove_and_suspend]
├── notes: string (internal notes)
├── contentData: object (snapshot of reported content)
├── authorId: string (author of reported content)
├── authorStrikeCount: number
├── createdAt: timestamp
├── reviewedAt: timestamp
└── resolvedAt: timestamp
```

#### Departments Collection
```
departments/{departmentId}
├── id: string
├── name: string
├── companyId: string (required)
├── description: string
├── icon: string (emoji)
├── parentDepartmentId: string (for hierarchies)
├── memberCount: number
├── status: enum[active|inactive]
├── createdAt: timestamp
├── updatedAt: timestamp
└── archivedAt: timestamp (soft delete)
```

#### Billing Collections

**subscriptions/{subscriptionId}**
- companyId, stripeSubscriptionId, status, plan, currentPeriodStart, currentPeriodEnd, autoRenew, createdAt

**invoices/{invoiceId}**
- companyId, stripeInvoiceId, amount, status, dueDate, paidDate, items[], createdAt

**payments/{paymentId}**
- companyId, amount, status, method, stripePaymentId, createdAt

**paymentMethods/{methodId}**
- companyId, stripePaymentMethodId, type, last4, expiryDate, isDefault

**usageRecords/{recordId}**
- companyId, period, postCount, userCount, storageUsed, createdAt

**billingHistory/{historyId}**
- companyId, type, amount, status, createdAt (immutable audit trail)

**pricingTiers/{tierId}**
- name, price, features[], maxUsers, maxStorage, isActive, createdAt

---

## 2. API STRUCTURE & CLOUD FUNCTIONS

### Authentication & Authorization Flow
- **Custom Auth**: Username/password stored in Firestore (CryptoJS SHA256 hashing)
- **Session Storage**: User data cached in localStorage
- **Firestore Security Rules**: Role-based access control (RBAC)

### Cloud Functions (Backend API)

Located: `/functions/`

#### Company Admin Functions
```javascript
// Subscription Management
- createCompanySubscription(companyId, paymentMethodId, startTrial)
- cancelCompanySubscription(subscriptionId, immediate)
- reactivateCompanySubscription(subscriptionId)
- getCompanySubscription(companyId)

// Invoice Management
- getInvoices(companyId)
- getInvoice(invoiceId)

// Payment Methods
- addCompanyPaymentMethod(companyId, token)
- getCompanyPaymentMethods(companyId)
- removeCompanyPaymentMethod(companyId, methodId)
- getCompanyPaymentHistory(companyId)

// Usage Tracking
- getUsageSummary(companyId)
```

#### Super Admin Functions
```javascript
- getAllSubscriptions()
- getSuperAdminInvoices()
- getRevenueReport()
- getBillingDisputes()
- resolveBillingDispute(disputeId)
- getAllBillingHistory()
- updatePricingTier(tierId, data)
```

#### Webhooks
```javascript
- handleStripeWebhook() // Processes Stripe events (payment success, refunds, etc.)
```

#### Scheduled Jobs
```javascript
- monthlyBillingJob() // Runs on 1st of month
- gracePeriodCheckJob() // Checks for expired subscriptions
- paymentRetryJob() // Retries failed payments
- trialExpirationCheckJob() // Notifies about trial expiration
- usageTrackingSyncJob() // Syncs usage metrics
```

### Services (Client-Side API Wrappers)

Located: `/src/services/`

#### **authService.js**
```javascript
- loginWithUsernamePassword(username, password)
- getUserById(userId)
- checkUsernameExists(username)
- hashPassword(password)
```

#### **postManagementService.js**
```javascript
// Post CRUD
- createPost(postData)
- updatePost(postId, updateData)
- deletePost(postId)
- getPost(postId)
- getUserPosts(userId, companyId, postType)
- getCompanyPosts(companyId, filterOptions)

// Anonymous Features
- encryptAuthorId(authorId)
- decryptAuthorId(encryptedId)

// Rate Limiting
- checkRateLimit(userId, companyId)

// Status & Priority Management
- changePostStatus(postId, newStatus, adminData)
- changePostPriority(postId, newPriority)

// Assignment
- assignPost(postId, assignmentData)
- unassignPost(postId)

// Activity Tracking
- getPostActivityTimeline(postId, limit)
- logPostActivity(postId, activityType, metadata)

// Reactions & Likes
- addReaction(postId, reactionType)
- removeReaction(postId, reactionId)
- likePost(postId)
- unlikePost(postId)

// Batch Operations
- bulkUpdatePostStatus(postIds, newStatus)
- bulkUpdatePostPriority(postIds, newPriority)
- bulkAssignPosts(postIds, assignmentData)
```

#### **postEnhancementsService.js**
```javascript
// Drafts & Scheduling
- saveDraft(postData)
- updateDraft(draftId, updateData)
- publishDraft(draftId, adminUser)
- deleteDraft(draftId)
- getDrafts(companyId, authorId)

// Scheduled Posts
- schedulePost(postData, scheduledTime)
- updateScheduledPost(postId, updateData)
- deleteScheduledPost(postId)
- getScheduledPosts(companyId)

// Templates
- saveAsTemplate(postData)
- getTemplates(companyId)
- createFromTemplate(templateId, overrides)
- deleteTemplate(templateId)
```

#### **moderationService.js**
```javascript
// Reporting
- createContentReport(reportData)
- getCompanyReports(companyId, status)
- getAllReports(status)
- getReportById(reportId)

// Moderation Actions
- reviewReport(reportId, action, notes)
- removeContent(contentId, contentType)
- issueStrike(userId, strikeLevel, reason)

// User Restrictions
- applyUserRestriction(userId, restricationType, duration)
- removeUserRestriction(userId)
- suspendUser(userId, duration, reason)
- getUserModerationHistory(userId)

// Analytics
- getModerationStats(companyId)
- getModerationActivityLogs(companyId, limit)
- getStrikesByUser(userId)
```

#### **mentionsService.js**
```javascript
- parseMentions(text)
- extractMentionedUsernames(text)
- searchUsersForMention(searchTerm, companyId, limit)
- createMentionNotification(mentionedUserId, postId, mentionedBy)
```

#### **departmentservice.js**
```javascript
- getDepartments(companyId, includeInactive)
- getDepartmentById(departmentId)
- createDepartment(departmentData)
- updateDepartment(departmentId, updateData)
- deleteDepartment(departmentId)
- addUserToDepartment(userId, departmentId)
- removeUserFromDepartment(userId, departmentId)
- getDepartmentStats(departmentId)
- getDepartmentHierarchy(companyId)
```

#### **auditService.js**
```javascript
- getCompanyAuditLog(companyId, options)
- getPostActivities(postId, options)
- getSystemActivities(companyId, options)
- searchAuditLogs(companyId, searchQuery, limit)
- getAuditLogStats(companyId, options)
- getActivityByType(companyId, activityType)
```

#### **billingService.js**
```javascript
- getSubscriptionStatus(companyId)
- getInvoicesList(companyId)
- downloadInvoice(invoiceId)
- getUsageMetrics(companyId, period)
- getPaymentMethods(companyId)
- addPaymentMethod(companyId, token)
- removePaymentMethod(methodId)
- updateBillingContact(companyId, contactData)
```

#### **postTemplatesService.js**
```javascript
- getTemplates(companyId, type)
- getTemplateById(templateId)
- createTemplate(templateData)
- updateTemplate(templateId, updateData)
- deleteTemplate(templateId)
- cloneTemplate(templateId, newName)
```

---

## 3. FRONTEND COMPONENTS STRUCTURE

Located: `/src/components/`

### Core Components

#### **Post.jsx** (72 lines shown)
- Displays individual post with status/priority color-coding
- Supports problem report type with visual indicators
- "Read More" truncation for long content
- Dynamic styling based on priority and status
- Includes reactions, comments, and report button

#### **CreatePost.jsx** & **CreatePostEnhanced.jsx**
- Post creation modal with rich text editor
- Support for multiple post types (problem, idea, creative, discussion)
- Draft saving functionality
- Anonymous posting option
- Media upload support
- Tag assignment

#### **CommentsSection.jsx** & **CommentsEnhanced.jsx**
- Real-time comment display
- Comment creation and editing
- Admin comment highlighting
- Nested reply support
- Comment deletion with confirmation

#### **AdminActionPanel.jsx** (23KB)
- Bulk actions for posts (status, priority, assignment)
- Post filtering and search
- Admin-only features (status management, assignments)
- Multi-select support

#### **BulkActionsPanel.jsx**
- Batch operations UI
- Status update form
- Priority change dialog
- Department assignment

#### **EditPost.jsx**
- Post editing interface
- Rich text editor
- Field validation
- Status/priority adjustment

#### **Post Actions**
- **PostActions.jsx**: Like, comment, share, report buttons
- **ReactionButton.jsx**: Custom reaction emoji selector
- **LikeButton.jsx**: Simple like/unlike toggle

#### **ReportContentModal.jsx**
- Content report submission form
- Reason selection with descriptions
- Detailed explanation input
- Report confirmation

#### **RichTextEditor.jsx**
- WYSIWYG editor for post content
- Mention/@ autocomplete
- Formatting controls
- Link insertion

#### **Department Components**
- **DepartmentCard.jsx**: Department info display
- **DepartmentAssignment.jsx**: Assign posts to departments
- **DepartmentModal.jsx**: Create/edit department dialog

#### **Layouts**
- **EmployeeLayout.jsx**: Standard employee interface
- **CompanyAdminLayout.jsx**: Admin dashboard layout
- **RoleBasedLayout.jsx**: Conditional layout based on user role
- **PrivateRoute.jsx**: Protected route wrapper

#### **User Restriction Banner**
- **UserRestrictionBanner.jsx**: Display active restrictions

### UI Components
- LanguageSwitcher.jsx (i18n support)
- ReportContentModal.jsx (Moderation)
- UserRestrictionBanner.jsx (Account status)

---

## 4. SEARCH & NOTIFICATION FUNCTIONALITY

### Search Implementation

#### **Unified Feed Search** (`UnifiedFeed.jsx`)
```javascript
// Client-side search and filtering
const filterPosts = () => {
  let filtered = [...posts];

  // Search by title and content
  if (searchTerm) {
    filtered = filtered.filter(
      (post) =>
        post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.content?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Filter by tags/categories
  if (selectedCategory !== "all") {
    filtered = filtered.filter((post) =>
      post.tags?.includes(selectedCategory)
    );
  }

  setFilteredPosts(filtered);
};
```

Features:
- Real-time search as user types
- Filter by post type (problem, idea, creative, discussion)
- Filter by status
- Filter by priority (for problem reports)
- Filter by department
- Filter by tags/categories
- Sort by date, popularity, status

#### **Audit Log Search** (`auditService.js`)
```javascript
- searchAuditLogs(companyId, searchQuery, limit)
  Searches across user actions, post changes, system activities
```

#### **Mentions Search** (`mentionsService.js`)
```javascript
- searchUsersForMention(searchTerm, companyId, limitCount)
  For @mention autocomplete in posts and comments
```

### Notification System

#### **Notification Collection** (Firestore)
- Real-time listener subscriptions
- Push notifications for events
- Notification types: 
  - Comment notifications
  - Reaction notifications
  - @mention notifications
  - Post status change notifications
  - Assignment notifications
  - Admin moderation notifications
  - Account restriction notifications

#### **Notifications Page** (`/src/pages/Notifications.jsx`)
```javascript
Features:
- Real-time notification display (ordered by createdAt desc)
- Filter: all, read, unread
- Mark individual notification as read
- Mark all as read
- Delete notifications
- Dynamic icons based on notification type
- Action URLs to navigate to related content
```

#### **Notification Creation Flow**
- Triggered by: comments, reactions, mentions, status changes, assignments
- Auto-deleted after expiration (configurable)
- User can mark as read
- Unread count tracking

---

## 5. AUTHENTICATION & AUTHORIZATION

### Authentication Setup

#### **AuthContext.jsx** (Context Provider)
```javascript
Features:
- Custom hook: useAuth()
- User state management
- Login/logout handlers
- Session persistence (localStorage)
- Loading state

Methods:
- login(username, password)
- logout()
- getCurrentUser()
```

#### **Auth Service** (`authService.js`)
```javascript
// Firestore-based authentication (no Firebase Auth)
- loginWithUsernamePassword(username, password)
  • Hashes password with CryptoJS.SHA256
  • Queries users collection
  • Validates credentials
  • Updates lastLogin timestamp
  • Returns user object (password removed)

- getUserById(userId)
  • Fetches user profile
  • Removes password before returning

- checkUsernameExists(username)
  • Validates username uniqueness during registration

- hashPassword(password)
  • One-way SHA256 hashing (NOT recommended for production)
  ⚠️ SECURITY NOTE: Should use Firebase Auth or bcrypt instead
```

### Authorization System

#### **Role-Based Access Control (RBAC)**

Roles defined in `/src/utils/constants.js`:
```javascript
UserRole = {
  SUPER_ADMIN: "super_admin",        // Platform-wide admin
  COMPANY_ADMIN: "company_admin",    // Company-level admin
  HR: "hr",                          // HR staff (can moderate)
  EMPLOYEE: "employee"               // Regular users
}
```

#### **Firestore Security Rules** (`firestore.rules`)

Security functions:
```javascript
- isAuthenticated()
  Check if user is logged in

- isOwner(authorId)
  Check if user owns the document

- isSuperAdmin()
  Check if user has super_admin role

- isCompanyAdmin(companyId)
  Check if user is admin for specific company

- isSameCompany(companyId)
  Check if user belongs to same company

- isAdmin()
  Check if user is any type of admin (super, company, or HR)

- checkRateLimit()
  Enforce 10 posts per hour
```

#### **Access Control by Collection**

**Users**:
- Users can read own profile
- Company admins can read users in their company
- Super admins can read all users
- Users can update own profile (limited fields)
- Admins can create/delete users

**Posts**:
- Same company users can read posts
- Users can create posts (with rate limit)
- Post author can update their post (limited fields)
- Admins can update any post (status, priority, assignment)
- Author or admin can delete posts

**Comments**:
- Same company users can read comments
- Any user can create comments (on posts in their company)
- Comment author can edit their own comment
- Author or admin can delete comments

**Notifications**:
- Users can only read their own notifications
- Users can mark their own notifications as read
- System and admins can create notifications

**Content Reports**:
- Only admins can read reports (for their company)
- Any user can create a report
- Only admins can review/update reports

**Moderation Tools**:
- Only admins can apply restrictions/strikes
- Strike system: 3-strike policy
  - Strike 1: Warning
  - Strike 2: 7-day posting restriction
  - Strike 3: 30-day account suspension

---

## 6. PROJECT STRUCTURE SUMMARY

```
company-voice/
├── functions/                          # Backend Cloud Functions
│   ├── api/
│   │   ├── companyAdminApi.js         # Company subscription & billing API
│   │   └── superAdminApi.js           # Platform-wide admin API
│   ├── services/
│   │   ├── subscriptionService.js
│   │   ├── invoiceService.js
│   │   ├── paymentService.js
│   │   └── usageTrackingService.js
│   ├── scheduled/
│   │   └── billingJobs.js             # Cron jobs for billing
│   ├── webhooks/
│   │   └── stripeWebhook.js           # Stripe event handlers
│   ├── config/
│   │   ├── firebase.js
│   │   └── stripe.js
│   └── index.js                        # Function exports
│
├── src/                                # Frontend React App
│   ├── components/                     # Reusable React components
│   │   ├── Post.jsx
│   │   ├── CreatePost.jsx
│   │   ├── CreatePostEnhanced.jsx
│   │   ├── CommentsSection.jsx
│   │   ├── AdminActionPanel.jsx
│   │   ├── ReactionButton.jsx
│   │   ├── RichTextEditor.jsx
│   │   └── ... (22 total components)
│   │
│   ├── pages/                          # Page components
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Notifications.jsx
│   │   ├── Profile.jsx
│   │   ├── MyPosts.jsx
│   │   ├── Drafts.jsx
│   │   ├── ScheduledPostsPage.jsx
│   │   ├── TemplatesPage.jsx
│   │   ├── ModerationDashboard.jsx
│   │   ├── ReportDetailView.jsx
│   │   ├── feed/
│   │   │   ├── UnifiedFeed.jsx        # Main feed with search/filter
│   │   │   ├── CreativeFeed.jsx
│   │   │   ├── ProblemsFeed.jsx
│   │   │   └── DiscussionsFeed.jsx
│   │   ├── admin/
│   │   │   ├── CompanyManagement.jsx
│   │   │   ├── BillingDashboard.jsx
│   │   │   └── AuditLog.jsx
│   │   └── company/
│   │       ├── CompanyDashboard.jsx
│   │       ├── CompanyAnalytics.jsx
│   │       ├── CompanyBilling.jsx
│   │       ├── MemberManagement.jsx
│   │       ├── DepartmentManagement.jsx
│   │       └── TagManagement.jsx
│   │
│   ├── services/                       # API/Firestore services
│   │   ├── authService.js
│   │   ├── postManagementService.js
│   │   ├── postEnhancementsService.js  # Drafts, scheduling, templates
│   │   ├── moderationService.js
│   │   ├── mentionsService.js
│   │   ├── departmentservice.js
│   │   ├── auditService.js
│   │   ├── billingService.js
│   │   └── postTemplatesService.js
│   │
│   ├── contexts/                       # React Context (state management)
│   │   └── AuthContext.jsx
│   │
│   ├── config/                         # Configuration files
│   │   └── firebase.js                 # Firebase initialization
│   │
│   ├── utils/
│   │   └── constants.js                # Enums, configs, colors
│   │
│   ├── i18n/                           # Internationalization
│   │   └── locales/                    # Translation files
│   │
│   ├── assets/                         # Images, icons
│   ├── App.jsx                         # Root component with routes
│   ├── main.jsx                        # React DOM mount
│   └── index.css                       # Global styles
│
├── public/                             # Static files
├── firestore.rules                     # Firestore security rules
├── firebase.json                       # Firebase configuration
├── package.json                        # Frontend dependencies
└── ... (config files)
```

---

## 7. KEY FEATURES OVERVIEW

### Core Functionality
- Post creation (4 types: problem, idea, creative, discussion)
- Comments and nested discussions
- Reactions (6 types: like, love, celebrate, support, insightful, concerned)
- Anonymous posting (encrypted author ID)
- Draft and scheduled posts

### Post Management
- Status workflow (9 states)
- Priority levels (4 levels)
- Assignment to users or departments
- Activity timeline tracking
- Bulk operations

### Moderation System
- Content reporting
- 3-strike penalty system
- User restrictions (posting/commenting)
- Account suspension
- Moderation activity logging

### Notifications
- Real-time notifications
- Multiple notification types
- Read/unread tracking
- Mention notifications (@username)
- Status change notifications

### Billing
- Stripe integration
- Subscription management
- Invoice generation
- Usage tracking
- Payment methods management

### Admin Features
- Company management (super admin)
- Billing dashboard
- Member management
- Department management
- Audit logging
- Content moderation dashboard

### Security
- Role-based access control (RBAC)
- Row-level security in Firestore
- Rate limiting (10 posts/hour per user)
- Data encryption for anonymous posts
- Audit trail for all administrative actions

---

## 8. TECHNOLOGY STACK

### Frontend
- React 19.1.1
- React Router 6.28
- Tailwind CSS 4.1.15
- Vite 7.1.7
- i18next (internationalization)
- Crypto-JS (encryption)
- Firebase SDK 12.4.0
- Stripe React SDK

### Backend
- Firebase Cloud Functions (Node.js 20)
- Firebase Admin SDK
- Stripe Node SDK

### Database & Storage
- Cloud Firestore (NoSQL)
- Firebase Storage
- Firebase Authentication (custom)

### Build & Development
- Vite (bundler)
- ESLint (linting)
- Tailwind PostCSS

---

## 9. KEY FILES REFERENCE

| Feature | Key Files |
|---------|-----------|
| **Models** | firestore.rules (schema), constants.js (enums) |
| **Auth** | authService.js, AuthContext.jsx |
| **Posts** | postManagementService.js, Post.jsx, CreatePost.jsx |
| **Comments** | CommentsSection.jsx (component side), posts/{id}/comments (Firestore) |
| **Notifications** | Notifications.jsx, notifications collection |
| **Moderation** | moderationService.js, ModerationDashboard.jsx |
| **Billing** | billingService.js, companyAdminApi.js, BillingDashboard.jsx |
| **Search** | UnifiedFeed.jsx (client-side), auditService.js (audit search) |
| **Mentions** | mentionsService.js, RichTextEditor.jsx |
| **Drafts** | postEnhancementsService.js, DraftsPage.jsx |
| **Scheduled Posts** | postEnhancementsService.js, ScheduledPostsPage.jsx |
| **Templates** | postTemplatesService.js, TemplatesPage.jsx |
| **Departments** | departmentservice.js, DepartmentManagement.jsx |
| **Audit** | auditService.js, AuditLog.jsx |
| **Routing** | App.jsx |

---

## 10. IMPORTANT NOTES

### Security Considerations
- Password hashing uses SHA256 (not recommended; should use bcrypt or Firebase Auth)
- Firestore rules enforce multi-level access control
- Anonymous posts encrypt author IDs (reversible only by admins)
- Rate limiting enforced at Firestore rules level

### Performance
- Real-time listeners used for live updates
- Client-side filtering for search (could be optimized with Firestore indexes)
- Batch operations for bulk updates
- Activity logging for audit trail

### Extensibility
- Service-oriented architecture (easy to add new services)
- Component-based UI (reusable components)
- Context API for state management (could scale to Redux if needed)
- Clear separation of concerns (services, components, pages, utils)

