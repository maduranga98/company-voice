# Company Voice Platform - Codebase Analysis Report

**Platform**: Employee feedback & engagement platform built with React + Firebase  
**Frontend**: React 19.1.1 + Vite + Tailwind CSS  
**Backend**: Firebase (Firestore, Storage, Cloud Functions)  
**Authentication**: Custom username/password system  

---

## 1. DATABASE SCHEMA & DATA MODELS

### Firestore Collections Structure

```
posts (CORE)
├── id: string (auto)
├── title: string
├── content/description: string
├── type: enum [creative_content, problem_report, team_discussion, idea_suggestion]
├── status: enum [open, acknowledged, in_progress, under_review, working_on, resolved, closed, rejected, not_a_problem]
├── priority: enum [critical, high, medium, low]
├── category: string (user-selected from config)
├── tags: array<string> (comma-separated, user-defined)
├── authorId: string
├── authorName: string (or "Anonymous" if isAnonymous)
├── authorEmail: string
├── companyId: string (tenant isolation key)
├── isAnonymous: boolean
├── attachments: array<{url, name, type, size}>
├── reactions: object {emoji_type: [userId1, userId2...]}
├── likes: array<string> (legacy, use reactions)
├── comments: number (count for performance)
├── views: number
├── assignedTo: {type: "user"|"department", id, name, assignedAt, assignedBy}
├── dueDate: timestamp (optional)
├── createdAt: timestamp (server)
├── updatedAt: timestamp (server)
├── lastUpdatedBy: string
├── lastUpdatedById: string
├── reportCount: number (moderation)
└── isRemoved: boolean (moderation)

comments
├── id: string
├── postId: string (FK → posts)
├── text: string
├── authorId: string
├── authorName: string
├── authorRole: string (admin flag)
├── isAnonymous: boolean
├── isAdminComment: boolean
├── createdAt: timestamp
└── isRemoved: boolean (moderation)

postActivities (IMMUTABLE AUDIT LOG)
├── id: string
├── postId: string (FK → posts)
├── type: enum [created, status_changed, priority_changed, assigned, unassigned, due_date_set, admin_comment, resolved, reopened]
├── metadata: object {adminId, oldStatus, newStatus, comment, ...}
├── createdAt: timestamp
└── (no updates/deletes allowed - audit trail)

postViews (UNREAD TRACKING)
├── id: {postId}_{authorId}
├── postId: string
├── authorId: string
└── lastViewedAt: timestamp

users
├── id: string
├── companyId: string
├── email: string
├── displayName: string
├── username: string (custom auth)
├── role: enum [super_admin, company_admin, hr, employee]
├── userTagId: string (FK → userTags) - optional role level
├── departmentId: string (FK → departments)
├── status: enum [active, suspended, invited]
└── createdAt: timestamp

departments
├── id: string
├── companyId: string
├── name: string
├── icon: string (emoji)
├── isActive: boolean
└── createdAt: timestamp

userTags (ROLE LEVELS - OPTIONAL)
├── id: string
├── companyId: string
├── name: enum [executive, senior_manager, manager, specialist, staff]
├── priority: number (sort order)
└── createdAt: timestamp

contentReports (MODERATION)
├── id: string
├── contentType: enum [post, comment]
├── contentId: string
├── reason: enum [harassment, inappropriate, spam, false_info, discrimination, violence, other]
├── description: string (optional)
├── reportedBy: string (userId)
├── companyId: string
├── contentAuthorId: string
├── status: enum [pending, under_review, resolved, dismissed]
├── reviewedBy: string (moderatorId)
├── reviewedAt: timestamp
├── moderatorNotes: string
├── actionTaken: enum [dismiss, remove_content, remove_and_warn, escalate, remove_and_suspend]
├── createdAt: timestamp
└── updatedAt: timestamp

notifications
├── id: string
├── userId: string (FK → users)
├── type: enum [comment, reaction, mention, post_update, status_changed, priority_changed, assigned, admin_comment, moderation, content_reported, strike_received, account_restricted, account_suspended]
├── title: string
├── message: string
├── postId: string (optional, FK → posts)
├── read: boolean
├── createdAt: timestamp
└── metadata: object

companies
├── id: string
├── name: string
├── email: string
├── status: enum [active, trial, suspended]
└── createdAt: timestamp
```

### Data Relationships

```
companies (1) ──→ (N) users
            ├──→ (N) departments
            └──→ (N) posts

users (1) ──→ (N) posts
      ├──→ (N) comments
      └──→ (1) departments

departments (1) ──→ (N) users
             └──→ (N) posts

posts (1) ──→ (N) comments
     ├──→ (N) reactions/likes
     ├──→ (N) postActivities (audit trail)
     └──→ (N) postViews

contentReports → posts/comments (content moderation)
notifications → users, posts (engagement)
```

---

## 2. POST MANAGEMENT ENDPOINTS & API ROUTES

### Frontend Service: `/src/services/postManagementService.js` (794 lines)

#### Post Status Management
```javascript
// Update post status with validation & audit trail
updatePostStatus(postId, newStatus, adminUser, comment = "")
// Parameters: newStatus from PostStatus enum
// Triggers: notifications, activity logging, post update

// Update post priority
updatePostPriority(postId, newPriority, adminUser)
// Priority levels: critical, high, medium, low
// Triggers: notifications (if elevated), activity logging

// Get activity timeline
getPostActivityTimeline(postId, limitCount = 50)
// Returns: chronological list of all status/priority/assignment changes
```

#### Post Assignment
```javascript
// Assign to user or department
assignPost(postId, assignment, adminUser)
// assignment: {type: "user"|"department", id, name, dueDate}
// Restrictions: Anonymous posts can only be assigned to departments

// Unassign post
unassignPost(postId, adminUser)

// Set due date
setDueDate(postId, dueDate, adminUser)
```

#### Admin Operations
```javascript
// Add admin comment (public, appears in comments)
addAdminComment(postId, commentText, adminUser)
// Triggers: notification to post author, activity log

// Log post activity (immutable audit trail)
logPostActivity(postId, activityType, metadata = {})
// Activity types: CREATED, STATUS_CHANGED, PRIORITY_CHANGED, ASSIGNED, etc.

// Check rate limit
checkRateLimit(userId, companyId)
// Returns: {allowed, remaining, resetTime, currentCount, limit: 10}

// Get user's posts with unread tracking
getUserPosts(userId, companyId, postType = null)
// Returns: array of posts filtered by type, includes unread flag
```

#### Encryption & Privacy
```javascript
// Encrypt author ID for anonymous posts
encryptAuthorId(authorId) → encryptedId
// Uses: CryptoJS AES encryption with VITE_ANONYMOUS_SECRET

// Decrypt (admin only)
decryptAuthorId(encryptedId) → authorId | null
```

#### Tracking
```javascript
// Mark post as viewed by author
markPostAsViewed(postId, authorId)

// Check for unread updates
hasUnreadUpdates(post, authorId) → boolean
// Compares post.updatedAt vs lastViewedAt
```

### Frontend Form Components (No API Layer Yet)

Currently all operations write directly to Firestore - no REST API layer implemented.

#### Create Post Flow
```javascript
// File: CreatePost.jsx
POST_TYPES = {
  creative: { type: "creative_content", categories: [...] }
  complaint: { type: "problem_report", categories: [...] }
  discussion: { type: "team_discussion", categories: [...] }
}

Data validation:
- title (required)
- content/description (required)
- category (required)
- tags (optional, comma-separated)
- isAnonymous (boolean)
- attachments (optional, max 5 files, 10MB each)

File upload:
- Location: /posts/{companyId}/{timestamp}_{filename}
- Allowed: images, videos, PDF, documents
- Returns: {url, name, type, size}

Firestore write:
- Collection: posts
- Auto-generated ID
- Server timestamp for createdAt/updatedAt
```

---

## 3. TEAM DISCUSSION FEATURES & COMPONENTS

### Post Type System
Posts use a `type` field to distinguish content:

| Type | Purpose | Status | Priority | Assignment |
|------|---------|--------|----------|------------|
| `creative_content` | Art, design, innovation | Basic | N/A | N/A |
| `problem_report` | Issues, bugs, concerns | Full lifecycle (9 states) | Yes (4 levels) | User/Department |
| `team_discussion` | General discussions, ideas | Basic | N/A | N/A |
| `idea_suggestion` | Ideas for improvement | Basic | N/A | N/A |

### Discussion Features

#### In Post (CommentsSection.jsx)
```javascript
// Thread comments under posts
Comments:
- Real-time listener: onSnapshot(posts where postId == X)
- Anonymous option per comment
- Admin comments flagged separately
- Report functionality per comment
- Character limit: none (practical)
- Formatting: whitespace-pre-wrap (no rich text)

Features:
- Comment count incremented in posts collection
- Notifications sent to post author
- Real-time sync across sessions
```

#### Discussion Feed (feed/DiscussionsFeed.jsx)
```javascript
// Unified feed view
Displays: All team_discussion posts in company
Filters: Search, category, type
Functions: Create new discussion, view threads
```

#### Categories
```javascript
discussions: [
  "General Discussion",
  "Ideas & Suggestions",
  "Team Updates",
  "Announcements",
  "Questions",
  "Feedback",
  "Collaboration",
  "Events",
  "Other"
]
```

### Components for Discussions
- **Post.jsx**: Display individual discussion
- **CommentsSection.jsx**: Thread comments
- **CreatePost.jsx**: Initiate discussion
- **UnifiedFeed.jsx**: List all discussions
- **AdminActionPanel.jsx**: Moderate/manage (admin only)
- **ReactionButton.jsx**: Multi-emoji reactions
- **ReportContentModal.jsx**: Report inappropriate discussion

---

## 4. FRONTEND COMPONENTS

### Post-Related Components

#### CreatePost.jsx (550 lines)
```javascript
Props: {type, onClose, onSuccess}
Types: 'creative', 'complaint', 'discussion'

Form Fields:
- Title (text input)
- Description (textarea, 8 rows, no RTF)
- Category (select dropdown)
- Tags (comma-separated text)
- Anonymous toggle (checkbox)
- Attachments (file upload, drag-drop, preview)

File Handling:
- Validation: type, size (10MB), count (max 5)
- Upload: Firebase Storage
- Preview: images only, file icons for documents
- Remove: individual file deletion with preview cleanup

States:
- loading: during upload/submit
- error: validation, upload, Firestore errors
- selectedFiles: {file, preview, name, type}
- formData: {title, description, category, tags, isAnonymous}
```

#### Post.jsx (429 lines)
```javascript
Props: {post}

Displays:
- Author name/avatar (initial circle)
- Post type badge (color-coded)
- Category label
- Content with truncation (300 chars, "Read More" toggle)
- Tags as hashtags
- Attachments:
  - Single image: full width (h-64/h-96)
  - Single document: link card with icon
  - Multiple: 2-column grid with click-to-view
- Status/Priority badges (problem reports only)
- Assigned to info (blue pill) (problem reports only)

Interactions:
- ReactionButton: multi-emoji picker
- CommentsSection: threaded discussion
- Report button: flag content modal
```

#### CommentsSection.jsx (332 lines)
```javascript
Props: {postId, initialCommentCount, postAuthorId, postAuthorName, postTitle}

Features:
- Expandable comments section
- Real-time comment list (onSnapshot listener)
- Comment form with textarea
- Anonymous comment option
- Comment author display (avatar + name)
- Admin comment badge
- Report button per comment
- Character limit: 500 (practical textarea limit)
- Notifications to post author (if not anonymous)

Real-time:
- Uses Firebase onSnapshot() listener
- Auto-refresh when comments change
- Cleanup unsubscribe on unmount
```

#### AdminActionPanel.jsx (423 lines)
```javascript
Props: {post, currentUser, onUpdate}
Visibility: Admins only (company_admin, hr, super_admin)

Controls:
1. Status Dropdown
   Options: open, acknowledged, in_progress, under_review, working_on, resolved, closed, rejected, not_a_problem
   onChange: triggers updatePostStatus()
   
2. Priority Dropdown
   Options: critical, high, medium, low
   onChange: triggers updatePostPriority()
   
3. Assignment Panel
   Dropdown: users (filtered by department, tagged)
   OR: departments
   Restrictions: anonymous posts → departments only
   
4. Due Date Picker
   Input: date picker
   Handler: setDueDate()
   
5. Admin Comment Box
   Textarea: comment text
   Handler: addAdminComment() → notifications
   
6. Activity Timeline (expandable)
   Shows: all status/priority/assignment changes
   Fetched: getPostActivityTimeline()
```

#### ReactionButton.jsx (210 lines)
```javascript
Props: {postId, initialReactions, postAuthorId, postAuthorName, postTitle}

Emoji Reactions:
- 👍 Like
- ❤️ Love
- 😂 Laugh
- 😮 Wow
- 😢 Sad
- 🙏 Appreciate
- 💡 Great Idea
- 🤔 Interesting

UI:
- Main button shows user's current reaction
- Picker popup on click (bottom-aligned)
- Top 3 reactions display below post
- Hover tooltips with counts

Data Storage:
- reactions: {emoji_type: [userId1, userId2...]}
- arrayUnion/arrayRemove for add/remove
- Toggle logic: remove old, add new
```

### Layout Components
- **RoleBasedLayout.jsx**: Route based on role
- **EmployeeLayout.jsx**: Employee dashboard
- **CompanyAdminLayout.jsx**: Admin controls
- **PrivateRoute.jsx**: Auth guard

---

## 5. RICH TEXT EDITOR IMPLEMENTATION

### Current State: NONE ❌

**Posts use plain textarea** with:
- No formatting buttons
- No RTF support
- Whitespace preserved: `whitespace-pre-wrap` in Post.jsx
- Character limit: ~soft limit on textarea (500 chars practical)

### What Would Be Needed

**Popular Options**:
1. **TipTap** (React wrapper for ProseMirror)
   - Lightweight, modular, TypeScript-ready
   - Supports: bold, italic, link, lists, blocks, code
   
2. **Slate** (headless editor)
   - Fine-grained control
   - Custom plugins/serialization
   
3. **Quill** (established, feature-rich)
   - Pre-built UI, easier to integrate
   - Larger bundle size
   
4. **Draft.js** (Facebook maintained)
   - Rich ecosystem, but more complex setup

**Integration Points**:
- CreatePost.jsx: Replace textarea with editor component
- Post.jsx: Render stored HTML/markup
- CommentsSection.jsx: Optional for comments too
- postManagementService.js: Store as `content` field (change from `description`)
- Migration: Map existing text posts to new format

---

## 6. FILE ATTACHMENT HANDLING

### Implementation Details

#### Upload Pipeline (CreatePost.jsx)
```javascript
1. File Selection
   - Input: accept="image/*,video/*,.pdf,.doc,.docx"
   - Multiple files allowed
   - Preview: URL.createObjectURL() for images

2. Validation
   - Type check: MIME type whitelist
   - Size check: ≤10MB each
   - Count check: ≤5 files total
   - Error handling: max files alert

3. Upload (uploadFiles function)
   for each file:
     - ref: `/posts/{companyId}/{timestamp}_{filename}`
     - Upload to Firebase Storage
     - Get download URL
     - Return: {url, name, type, size}

4. Firestore Storage
   - attachments: array<{url, name, type, size}>
   - Stored in `posts` document
```

#### Display Pipeline (Post.jsx)
```javascript
Single Attachment:
  if (image): <img src={url} onClick={open in new tab}>
  else: <file card with download link>

Multiple Attachments:
  Grid: 2 columns
  Each cell:
    if (image): <img with click-to-view>
    else: <file card with icon>
  Height: h-48 (fixed)
  Overflow: click to open

No preview in editor for submitted posts.
```

### Storage Permissions
- Location: `posts/{companyId}/*`
- Access: Via download URL (permanent once created)
- Cleanup: Manual (no auto-delete, no lifecycle rules)
- Billing: Firebase Storage (reads + downloads)

### Limitations
- No inline media embedding in content
- No drag-and-drop reordering
- No lazy loading or compression
- No CDN optimization
- No video transcoding (raw upload)

---

## 7. MODERATION & CONTENT MANAGEMENT

### Content Reporting System

#### ReportContentModal.jsx
```javascript
Props: {isOpen, onClose, contentType, contentId, companyId}
ContentTypes: "post" | "comment"

Report Reasons:
1. Harassment or bullying
2. Inappropriate content
3. Spam
4. False information
5. Discrimination
6. Violence or threats
7. Other (requires description)

Form:
- Reason selection (radio buttons)
- Description textarea (optional, max 500 chars)
- Success message on submit
- Error handling

Submission:
- Calls: createContentReport()
- Data: {contentType, contentId, reason, description, reportedBy, companyId}
```

#### Moderation Service (moderationService.js - 750+ lines)

```javascript
// Report creation & validation
createContentReport(reportData)
├── Fetch content details (post/comment)
├── Check for duplicate reports
├── Create contentReports document
├── Increment reportCount on content
├── Log moderation activity
└── Notify admins of new report

// Admin review interface
getCompanyReports(companyId, status = null)
├── Fetch all reports (optionally filtered by status)
├── Return with pagination

// Moderation actions
resolveReport(reportId, action, adminUser, notes)
├── Actions: dismiss, remove_content, remove_and_warn, escalate, remove_and_suspend
├── Remove content if needed
├── Issue strikes if needed
├── Update user restrictions if needed
└── Log moderation activity

// User restriction management
getUserRestrictions(userId, companyId)
getActiveRestrictions(userId)
applyRestriction(userId, type, duration) // POSTING, COMMENTING, FULL_SUSPENSION
removeRestriction(userId)

// Strike system (3-strike policy)
issuedStrike(userId, companyId, reason)
├── Strike 1: Warning
├── Strike 2: 7-day posting restriction
├── Strike 3: 30-day account suspension
getStrikeCount(userId, companyId)
resetStrikes(userId, companyId, adminUser)
```

### Moderation Pages
- **ModerationDashboard.jsx**: View/manage reports
- **ReportDetailView.jsx**: Detailed report review

### Strike System
```
Strike 1 (Warning)
  - Content removed
  - Warning notification sent
  - User can post immediately

Strike 2 (7-day Restriction)
  - Content removed
  - Cannot post/comment for 7 days
  - Read-only access maintained
  - Restriction lifted auto-matically

Strike 3 (30-day Suspension)
  - Content removed
  - Account suspended for 30 days
  - Cannot access platform
  - Auto-reactivated after duration
```

### Content Status
- `reportCount`: number of reports
- `isRemoved`: boolean (true = content hidden)
- `reportStatus`: pending, under_review, resolved, dismissed

---

## 8. ARCHITECTURE SUMMARY

### Frontend Architecture
```
React Components (43 total)
    ↓
    ├── Auth Context (global user state)
    ├── Services (postManagementService, moderationService, etc.)
    ├── Utils (constants, helpers)
    └── Config (Firebase SDK)
        ↓
    Firestore Database
        ↓
    Firebase Storage (attachments)
```

### Data Flow
```
User Action (Create Post)
    ↓
Form Validation (CreatePost.jsx)
    ↓
File Upload to Firebase Storage
    ↓
Document Write to Firestore (posts collection)
    ↓
Activity Log (postActivities collection)
    ↓
Notification (if applicable)
```

### Authentication
- **Type**: Custom username/password
- **Not**: Firebase Auth
- **Storage**: users collection in Firestore
- **Encryption**: SHA256 password hashing
- **Session**: Auth context in React state

### Firestore Security
- **Rules**: RBAC-based (firestore.rules file)
- **Isolation**: All queries filtered by companyId
- **Admin-only**: Post status/priority updates require role check in service
- **Immutable logs**: postActivities collection (no deletes/updates)

### Performance Optimizations
- **No real-time listeners** by default (except CommentsSection)
- **Denormalized counts**: comments, likes in posts collection
- **Pagination**: Limit clauses (100 posts, 50 activities)
- **Lazy loading**: Comments expand on demand

---

## KEY FILES REFERENCE

### Backend Configuration
```
functions/
├── config/firebase.js         → Admin SDK config, COLLECTIONS const
├── config/stripe.js           → Stripe API setup
├── api/
│   ├── companyAdminApi.js     → Billing endpoints (HTTP callable)
│   └── superAdminApi.js       → System endpoints
├── services/
│   ├── subscriptionService.js
│   ├── paymentService.js
│   └── invoiceService.js
└── index.js                   → Function exports

Firebase deployed as: HTTP callable functions + Firestore triggers
```

### Frontend Service Layer
```
src/
├── services/
│   ├── postManagementService.js     (794 lines) → POST CRUD & admin ops
│   ├── moderationService.js         (750+ lines) → Content reporting
│   ├── auditService.js              (150+ lines) → Activity logging
│   ├── departmentService.js         → Org management
│   └── authService.js               → Custom auth
├── components/
│   ├── Post.jsx                     (429 lines) → Display
│   ├── CreatePost.jsx               (550 lines) → Form
│   ├── CommentsSection.jsx          (332 lines) → Threaded comments
│   ├── AdminActionPanel.jsx         (423 lines) → Admin controls
│   ├── ReactionButton.jsx           (210 lines) → Emoji reactions
│   └── ReportContentModal.jsx       → Report form
└── utils/
    └── constants.js                 → 55+ config enums
```

### Pages
```
pages/
├── feed/
│   ├── CreativeFeed.jsx     → Creative content
│   ├── DiscussionsFeed.jsx  → Team discussions
│   ├── ProblemsFeed.jsx     → Issue reports
│   └── UnifiedFeed.jsx      → Generic template (447 lines)
├── company/
│   ├── CompanyPosts.jsx     → All company posts
│   ├── CompanyDashboard.jsx
│   ├── DepartmentManagement.jsx
│   └── MemberManagement.jsx
├── admin/
│   └── CompanyManagement.jsx
├── MyPosts.jsx              → User's own posts
├── Notifications.jsx
├── Profile.jsx
└── ...
```

---

## ENHANCEMENT OPPORTUNITIES

### High Priority
1. **Rich Text Editor** - Major UX improvement (TipTap recommended)
2. **Notification System** - Currently basic, no push notifications
3. **Search & Filtering** - Add full-text search, advanced filters
4. **Pagination** - Infinite scroll or load more buttons

### Medium Priority
1. **Real-time Collaboration** - onSnapshot listeners for live updates
2. **Mentions & Tagging** - @mention users in comments/posts
3. **Post Reactions** - Currently only emoji, could add custom reactions
4. **Media Optimization** - Image compression, video thumbnails

### Lower Priority
1. **Email Notifications** - SMTP integration
2. **Export/Reports** - CSV/PDF export of posts/activities
3. **Advanced Analytics** - Post performance, engagement metrics
4. **Mobile App** - React Native version

---

## SUMMARY TABLE

| Aspect | Status | Implementation |
|--------|--------|-----------------|
| **Post CRUD** | ✅ Full | Firestore direct + service layer |
| **Comments** | ✅ Full | Real-time listener + notifications |
| **Reactions** | ✅ Full | 8 emoji types, arrayUnion storage |
| **File Attachments** | ✅ Full | Firebase Storage + preview |
| **Rich Text** | ❌ None | Plain textarea only |
| **Team Discussions** | ✅ Full | Post type + feed view |
| **Post Status** | ✅ Full | 9 state lifecycle + transitions |
| **Admin Controls** | ✅ Full | Panel with status/priority/assignment |
| **Moderation** | ✅ Partial | Reporting + strike system, no UI dashboard |
| **Activity Log** | ✅ Full | Immutable postActivities collection |
| **Encryption** | ✅ Partial | CryptoJS for anonymous posts only |
| **Rate Limiting** | ✅ Full | 10 posts/hour enforced |
| **Permissions** | ✅ Full | Role-based in Firestore rules |

