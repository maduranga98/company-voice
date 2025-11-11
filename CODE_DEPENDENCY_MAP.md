# Code Dependency & Integration Map

## Service Layer Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND COMPONENTS                           │
│  CreatePost, Post, CommentsSection, AdminActionPanel,          │
│  ReactionButton, ReportContentModal                            │
└────────────────────────┬────────────────────────────────────────┘
                         │ imports
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER (src/services/)                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ postManagementService.js (794 lines)                     │  │
│  │  - updatePostStatus()                                    │  │
│  │  - updatePostPriority()                                  │  │
│  │  - assignPost() / unassignPost()                        │  │
│  │  - addAdminComment()                                     │  │
│  │  - logPostActivity()                                     │  │
│  │  - encryptAuthorId() / decryptAuthorId()                │  │
│  │  - checkRateLimit()                                      │  │
│  │  - getUserPosts()                                        │  │
│  │  - markPostAsViewed()                                    │  │
│  │  - hasUnreadUpdates()                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ moderationService.js (750+ lines)                        │  │
│  │  - createContentReport()                                 │  │
│  │  - getCompanyReports()                                   │  │
│  │  - resolveReport()                                       │  │
│  │  - issuedStrike()                                        │  │
│  │  - applyRestriction()                                    │  │
│  │  - logModerationActivity()                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ auditService.js                                          │  │
│  │  - logSystemActivity()                                   │  │
│  │  - getCompanyAuditLog()                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ departmentService.js                                     │  │
│  │  - createDepartment()                                    │  │
│  │  - updateDepartment()                                    │  │
│  │  - getDepartments()                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ authService.js                                           │  │
│  │  - loginWithUsernamePassword()                           │  │
│  │  - getUserById()                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ imports
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                  FIRESTORE DATABASE                              │
│                                                                  │
│  Collections:                                                    │
│  - posts (core)                                                 │
│  - comments                                                     │
│  - postActivities (immutable audit trail)                      │
│  - contentReports                                               │
│  - notifications                                                │
│  - users                                                        │
│  - departments                                                  │
│  - userTags                                                     │
│  - postViews                                                    │
│  - companies                                                    │
│  - systemAuditLogs                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                         │ files stored in
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                  FIREBASE STORAGE                                │
│                                                                  │
│  Path: /posts/{companyId}/{timestamp}_{filename}               │
│  - Images (jpg, png, gif, etc.)                                │
│  - Videos (mp4, webm, etc.)                                    │
│  - Documents (pdf, doc, docx, etc.)                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Integration Flow

### Post Creation Flow
```
User Input
   ↓
CreatePost.jsx
   ├─ Form Validation
   ├─ File Upload → Firebase Storage
   └─ addDoc(posts) ← Direct Firestore write
                    ↓
        postManagementService.logPostActivity()
                    ↓
        Create in postActivities collection
                    ↓
        (Optional) Create notification
```

### Post Display & Interaction Flow
```
Load Feed Page
   ↓
UnifiedFeed.jsx / CompanyPosts.jsx
   ├─ query(posts where companyId == X)
   └─ getDocs() → [posts...]
                    ↓
Display Posts
   ├─ Post.jsx (renders each post)
   │  ├─ Show title, content, attachments
   │  ├─ ReactionButton.jsx (separate component)
   │  │  └─ updateDoc(posts, reactions)
   │  └─ CommentsSection.jsx (expandable)
   │     ├─ onSnapshot() listener (real-time)
   │     └─ addDoc(comments) on submit
   │        └─ Auto-notify post author
   └─ AdminActionPanel.jsx (if admin)
      ├─ updatePostStatus() ← postManagementService
      │  ├─ updateDoc(posts)
      │  ├─ logPostActivity() (audit trail)
      │  └─ createNotification() (notify author)
      ├─ updatePostPriority()
      ├─ assignPost()
      └─ addAdminComment()
```

### Moderation Flow
```
User Reports Post
   ↓
ReportContentModal.jsx
   ├─ Form validation
   └─ createContentReport()
        └─ moderationService
                    ↓
        Validate & create contentReports document
                    ↓
        logModerationActivity() (audit)
                    ↓
        notifyAdminsOfNewReport()
                    ↓
Admin Reviews Report
   ↓
ModerationDashboard.jsx
   ├─ getCompanyReports()
   └─ Show list of pending reports
                    ↓
Admin Takes Action
   ↓
ReportDetailView.jsx
   ├─ resolveReport()
   │  ├─ Remove content (if needed)
   │  ├─ Issue strike
   │  ├─ Apply restriction
   │  └─ Update notification
   └─ Log moderation activity
```

## Critical File Dependencies

### CreatePost.jsx Dependencies
```javascript
Import from:
- Firebase: collection, addDoc, serverTimestamp, ref, uploadBytes, getDownloadURL
- Config: db, storage
- Service: authService, postManagementService (checkRateLimit)
- Context: useAuth
- Constants: PostType, UserRole
- Icons: (none, uses inline SVG)

Calls:
- uploadFiles() → Firebase Storage.ref()
- addDoc(posts, postData) → Firestore direct write
- (Optional: postManagementService.checkRateLimit())
```

### Post.jsx Dependencies
```javascript
Import from:
- Firebase: none (read-only display)
- Context: useAuth
- Components: ReactionButton, CommentsSection, ReportContentModal
- Constants: PostStatusConfig, PostPriorityConfig, PostType
- Utils: time formatting

Props:
- post: {id, title, content, type, status, priority, category, tags, attachments, reactions, comments, authorId, authorName, createdAt}
```

### CommentsSection.jsx Dependencies
```javascript
Import from:
- Firebase: collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, increment
- Config: db
- Context: useAuth
- Components: ReportContentModal
- Constants: ReportableContentType, NotificationType

Listeners:
- onSnapshot(query(comments where postId == X)) ← Real-time!
```

### AdminActionPanel.jsx Dependencies
```javascript
Import from:
- Service: postManagementService (updatePostStatus, updatePostPriority, assignPost, addAdminComment, getCompanyDepartments)
- Firebase: query, where, getDocs
- Config: db
- Constants: PostStatus, PostStatusConfig, PostPriority, AssignmentType

Functions Called:
- loadAssignmentOptions()
  ├─ getCompanyDepartments()
  ├─ query(userTags)
  └─ query(users)
- handleStatusChange()
  └─ updatePostStatus()
     ├─ updateDoc(posts)
     ├─ logPostActivity()
     └─ createNotification()
```

### moderationService.js Dependencies
```javascript
Import from:
- Firebase: collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, increment
- Config: db
- Constants: ReportStatus, ReportableContentType, ModerationActionType, StrikeConfig, etc.

Core Functions:
createContentReport(reportData)
  ├─ getDoc(posts/comments) → get content
  ├─ query(contentReports) → check duplicate
  ├─ addDoc(contentReports)
  ├─ updateDoc(posts/comments, reportCount++)
  ├─ logModerationActivity()
  └─ notifyAdminsOfNewReport()

resolveReport(reportId, action, adminUser, notes)
  ├─ getDoc(contentReports)
  ├─ updateDoc(posts/comments, isRemoved) ← if remove action
  ├─ applyRestriction() ← if suspension
  ├─ createNotification() ← notify user
  └─ logModerationActivity()
```

## Data Flow by User Action

### Action: User Creates Post
```
User fills form in CreatePost.jsx
     ↓
Validation:
  - title & content not empty
  - category selected
  - companyId & userId available
     ↓
Upload files (if any):
  for each file:
    - Validate type & size
    - uploadBytes() → Firebase Storage
    - getDownloadURL() → https://...
     ↓
Create post document:
  addDoc(posts, {
    type, title, content, category, tags,
    isAnonymous, authorId, authorName, companyId,
    attachments: [{url, name, type, size}],
    status: "open", priority: "medium",
    createdAt: serverTimestamp(),
    likes: [], comments: 0, views: 0
  })
     ↓
(Optional) Log activity:
  logPostActivity(postId, CREATED, {
    authorId, authorName, companyId
  })
```

### Action: Admin Changes Post Status
```
Admin opens Post.jsx
     ↓
AdminActionPanel.jsx loads
  ├─ getCompanyDepartments()
  └─ query(users) filtered by department, tags
     ↓
Admin selects new status in dropdown
     ↓
Calls: updatePostStatus(postId, "acknowledged", adminUser, "")
  └─ postManagementService.js
     ├─ Verify admin role (isAdmin() check)
     ├─ Get current post status
     ├─ Update post document:
     │  updateDoc(posts, {
     │    status: "acknowledged",
     │    updatedAt: serverTimestamp(),
     │    lastUpdatedBy: adminUser.displayName
     │  })
     ├─ Log activity:
     │  logPostActivity(postId, STATUS_CHANGED, {
     │    adminId, oldStatus, newStatus
     │  })
     └─ Notify author:
        createNotification(authorId, {
          type: STATUS_CHANGED,
          title: "Post status updated",
          message: "Status changed to: acknowledged",
          postId: postId
        })
     ↓
UI updates to show new status badge
```

### Action: User Comments on Post
```
CommentsSection.jsx expands (or already open)
     ↓
User types comment in textarea
     ↓
handleSubmitComment():
  ├─ Validate comment not empty
  ├─ Create comment document:
  │  addDoc(comments, {
  │    postId, text, authorId, authorName,
  │    isAnonymous, createdAt: serverTimestamp()
  │  })
  ├─ Increment post comment counter:
  │  updateDoc(posts, {
  │    comments: increment(1)
  │  })
  └─ (If not anonymous author)
     createNotification(postAuthorId, {
       type: "comment",
       message: "User commented on your post",
       postId: postId
     })
     ↓
Clearing textarea & reset anonymous checkbox
     ↓
onSnapshot() listener refreshes comment list in real-time
```

### Action: User Reports Post
```
User clicks Report button on Post.jsx
     ↓
ReportContentModal opens
     ↓
User selects reason from radio buttons
     ↓
User optionally adds description
     ↓
User submits form
     ↓
createContentReport({
  contentType: "post",
  contentId: postId,
  reason: reportReason,
  description: userText,
  reportedBy: currentUser.uid,
  companyId: companyId
})
  └─ moderationService.js
     ├─ Fetch post content
     ├─ Check for duplicate reports by same user
     ├─ Create contentReports document:
     │  {
     │    contentType, contentId, reason, description,
     │    reportedBy, companyId, contentAuthorId,
     │    status: "pending", createdAt, updatedAt
     │  }
     ├─ Increment post reportCount:
     │  updateDoc(posts, {
     │    reportCount: increment(1)
     │  })
     ├─ Log moderation activity
     └─ notifyAdminsOfNewReport(companyId, reportId)
        └─ Create notification for all admins in company
     ↓
Show success message to user
```

## Constants & Configuration Map

**All configurations in `/src/utils/constants.js`:**

```
USER MANAGEMENT:
├─ UserRole (super_admin, company_admin, hr, employee)
├─ UserStatus (active, suspended, invited)
└─ UserTag (executive, senior_manager, manager, specialist, staff)

POST TYPES:
├─ PostType (problem_report, creative_content, team_discussion, idea_suggestion)
├─ PostStatus (9 states: open, acknowledged, in_progress, etc.)
├─ PostPriority (critical, high, medium, low)
├─ PostActivityType (created, status_changed, priority_changed, etc.)
└─ AssignmentType (user, department)

MODERATION:
├─ ReportReason (harassment, inappropriate, spam, false_info, etc.)
├─ ReportStatus (pending, under_review, resolved, dismissed)
├─ ModerationActionType (dismiss, remove_content, remove_and_warn, etc.)
├─ StrikeLevel (1, 2, 3 with specific consequences)
└─ RestrictionType (posting, commenting, full_suspension)

NOTIFICATIONS:
└─ NotificationType (comment, reaction, mention, status_changed, etc.)

DISPLAY CONFIGS:
├─ PostStatusConfig (label, color, icon for each status)
├─ PostPriorityConfig (label, level, color, icon for each priority)
├─ PostActivityTypeConfig (icon, description, color)
├─ ReportReasonConfig (icon, description)
├─ ReportStatusConfig (label, color, description)
├─ ModerationActionConfig (label, description, icon, color)
└─ StrikeConfig (label, action, consequence, duration)

MISC:
├─ DefaultDepartments (pre-defined org structure)
├─ COLORS (WCAG AA compliant color palette)
└─ ReactionType (like, love, celebrate, support, insightful, concerned)
```

## Query Patterns Used

```javascript
// Fetch posts by company
query(posts, where("companyId", "==", companyId), orderBy("createdAt", "desc"))

// Fetch user's own posts
query(posts, 
  where("authorId", "==", userId),
  where("companyId", "==", companyId),
  orderBy("createdAt", "desc")
)

// Fetch comments for a post (real-time)
query(comments,
  where("postId", "==", postId),
  orderBy("createdAt", "desc")
)
onSnapshot(q, (snapshot) => {...})

// Fetch activity timeline
query(postActivities,
  where("postId", "==", postId),
  orderBy("createdAt", "desc"),
  limit(50)
)

// Fetch company reports
query(contentReports,
  where("companyId", "==", companyId),
  where("status", "==", "pending"),
  orderBy("createdAt", "desc")
)

// Fetch rate limit (posts in last hour)
query(posts,
  where("authorId", "==", userId),
  where("companyId", "==", companyId),
  where("createdAt", ">=", oneHourAgo),
  orderBy("createdAt", "desc")
)
```

## Performance Considerations

### Reads (Query Efficiency)
- Most queries filtered by `companyId` first (tenant isolation)
- `orderBy("createdAt", "desc")` with `limit()` for pagination
- Comment counting denormalized in posts collection (avoid count queries)
- Activity logging uses immutable collection (optimized for append-only)

### Writes (Cost Optimization)
```
Post Creation:       2 writes (posts + postActivities)
Comment:             2 writes (comments + posts.comments++)
Reaction:            1 write (posts.reactions update)
Status Change:       3 writes (posts + postActivities + notification)
Admin Comment:       3 writes (comments + posts + postActivities)
Mark as Viewed:      1 write (postViews)
Report Content:      2 writes (contentReports + posts.reportCount++)
```

### Real-Time Listeners
- **CommentsSection**: onSnapshot() for live comment updates (cost per second)
- **Other feeds**: One-time getDocs() fetch (no continuous cost)
- **Consideration**: Adding real-time listeners to feeds will increase costs

## Technology Stack Summary

```
Frontend:
- React 19.1.1
- Vite 7.1.7
- Tailwind CSS 4.1.15
- Firebase SDK 12.4.0
- CryptoJS 4.2.0
- React Router 6.28.0
- i18next 25.6.0 (i18n)
- Lucide React (icons)

Backend:
- Firestore Database
- Firebase Storage
- Firebase Cloud Functions (v5)
- Firebase Admin SDK 12.0.0
- Stripe SDK 17.5.0 (billing, not integrated yet)

Environment:
- Node.js 20
- npm packages
```

---

## Summary: Key Integration Points for Enhancements

If adding rich text editor:
1. Update CreatePost.jsx (replace textarea with TipTap editor)
2. Update Post.jsx (render HTML instead of plain text)
3. Add contentFormat field to posts schema
4. Create migration script for existing posts

If adding real-time feeds:
1. Replace getDocs() with onSnapshot() in UnifiedFeed.jsx
2. Add cleanup for listeners on unmount
3. Handle potential cost increase from continuous reads
4. Add retry logic for network failures

If adding search:
1. Create postSearchIndex collection (denormalized)
2. Add search function to postManagementService.js
3. Add search UI to feed pages
4. Consider Algolia for large datasets

If adding mentions:
1. Add mentions array to comments schema
2. Parse @username in comment text
3. Create notification for mentioned users
4. Add mention autocomplete to comment form

