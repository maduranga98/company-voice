# Post Management & Team Discussion Enhancement Guide

## Current Implementation Overview

### What's Already Built

#### Post System ✅
- **3 Post Types**: creative_content, problem_report, team_discussion
- **9 Status States**: open, acknowledged, in_progress, under_review, working_on, resolved, closed, rejected, not_a_problem
- **4 Priority Levels**: critical, high, medium, low
- **Full CRUD**: Create, read, update, delete posts
- **Admin Controls**: Status/priority changes, assignment, due dates, admin comments
- **Attachments**: File upload (images, videos, PDFs, documents) - max 5 files, 10MB each
- **Reactions**: 8 emoji types with user-level tracking
- **Comments**: Real-time threaded comments with anonymous option
- **Anonymous Posts**: Encrypted author IDs (CryptoJS AES)
- **Rate Limiting**: 10 posts/hour per user
- **Activity Log**: Immutable audit trail of all changes
- **Unread Tracking**: Posts marked as "New Update" if modified after user viewed them

#### Moderation System ✅
- **Content Reporting**: Posts/comments can be reported with 7 reasons
- **Strike System**: 3-strike policy (warning → 7-day restriction → 30-day suspension)
- **Admin Dashboard**: ModerationDashboard.jsx & ReportDetailView.jsx
- **Restriction Types**: Posting, commenting, full suspension

#### Team Features ✅
- **Discussions**: Dedicated team_discussion post type
- **Department Assignment**: Posts assignable to departments
- **User Tagging**: Executive, Senior Manager, Manager, Specialist, Staff levels
- **Notifications**: Basic notification system for comments, status changes, assignments

---

## Key Data Models

### Posts Collection (Core)
```javascript
{
  id: string,
  type: "creative_content" | "problem_report" | "team_discussion" | "idea_suggestion",
  title: string,
  content: string,
  description: string,  // alias for content
  status: string,       // 9 possible values
  priority: string,     // 4 levels (only for problem_report)
  category: string,
  tags: string[],
  authorId: string,
  authorName: string,   // "Anonymous" if isAnonymous=true
  isAnonymous: boolean,
  attachments: [{url, name, type, size}],
  reactions: {emoji_type: [userId1, userId2...]},
  comments: number,     // count only
  views: number,
  assignedTo: {type, id, name, assignedAt, assignedBy},
  dueDate: timestamp,
  companyId: string,    // tenant isolation
  createdAt: timestamp,
  updatedAt: timestamp,
  lastUpdatedBy: string,
  reportCount: number,
  isRemoved: boolean
}
```

### Comments Collection
```javascript
{
  id: string,
  postId: string,       // FK to posts
  text: string,
  authorId: string,
  authorName: string,
  isAnonymous: boolean,
  isAdminComment: boolean,
  createdAt: timestamp,
  isRemoved: boolean
}
```

### PostActivities Collection (Immutable Audit Trail)
```javascript
{
  id: string,
  postId: string,
  type: enum[CREATED, STATUS_CHANGED, PRIORITY_CHANGED, ASSIGNED, ADMIN_COMMENT...],
  metadata: {
    adminId, oldStatus, newStatus, comment, assignedToId, assignedToName...
  },
  createdAt: timestamp
  // NO UPDATES OR DELETES ALLOWED
}
```

---

## API & Service Layer

### All Operations Through Frontend Services
**No HTTP API layer exists yet** - all operations write directly to Firestore.

### Main Service: `/src/services/postManagementService.js` (794 lines)

```javascript
// Status Management
updatePostStatus(postId, newStatus, adminUser, comment)
updatePostPriority(postId, newPriority, adminUser)

// Assignment
assignPost(postId, assignment, adminUser)
unassignPost(postId, adminUser)
setDueDate(postId, dueDate, adminUser)

// Comments & Notes
addAdminComment(postId, commentText, adminUser)

// Activity/Audit
logPostActivity(postId, activityType, metadata)
getPostActivityTimeline(postId, limit = 50)

// Privacy
encryptAuthorId(authorId) → encryptedId
decryptAuthorId(encryptedId) → authorId

// Query & Filters
getUserPosts(userId, companyId, postType)
checkRateLimit(userId, companyId)
getCompanyDepartments(companyId)

// Tracking
markPostAsViewed(postId, authorId)
hasUnreadUpdates(post, authorId) → boolean
```

### Secondary Service: `/src/services/moderationService.js` (750+ lines)

```javascript
createContentReport(reportData)
getCompanyReports(companyId, status)
resolveReport(reportId, action, adminUser, notes)
issuedStrike(userId, companyId, reason)
applyRestriction(userId, type, duration)
```

---

## Frontend Components

### Core Components for Posts

| Component | Lines | Purpose |
|-----------|-------|---------|
| CreatePost.jsx | 550 | Post creation form with file upload |
| Post.jsx | 429 | Post display with all metadata |
| CommentsSection.jsx | 332 | Real-time comment threads |
| AdminActionPanel.jsx | 423 | Admin controls (status, priority, assign) |
| ReactionButton.jsx | 210 | Multi-emoji reaction picker |
| ReportContentModal.jsx | 198 | Content reporting form |

### Key Features
- **Sticky header/footer**: CreatePost has sticky title bar and submit button
- **Expandable content**: Post.jsx truncates at 300 chars with "Read More"
- **Real-time comments**: CommentsSection uses onSnapshot() listener
- **File previews**: Images show thumbnails, documents show icons
- **Status badges**: Color-coded by state
- **Activity timeline**: Expandable history of changes

---

## Current Limitations & Gaps

### Rich Text Editor ❌
**Current**: Plain textarea with no formatting
**Limitation**: Users cannot:
- Bold, italic, underline text
- Create lists or tables
- Add links with custom text
- Use code blocks
- Embed media inline
**Solution**: Install TipTap, Quill, or Slate

### No Real-Time Updates ❌
**Current**: One-time fetch per page load
**Exception**: CommentsSection uses real-time listener
**Limitation**: Posts not updated when admin changes status, other users don't see reactions in real-time
**Solution**: Add onSnapshot listeners to post feeds

### No @Mentions ❌
**Current**: Discussions have no way to tag specific users
**Limitation**: Cannot notify specific people
**Solution**: Add mention/tag system to comments

### No Search/Advanced Filtering ❌
**Current**: Filter by type and category only
**Limitation**: Cannot search by keyword, date range, author, etc.
**Solution**: Add Firestore text search or Algolia integration

### No Email/Push Notifications ❌
**Current**: In-app notifications only
**Limitation**: Users miss notifications if not logged in
**Solution**: Firebase Cloud Messaging + SMTP server

### Limited File Handling ❌
**Current**: Raw upload, no compression or optimization
**Limitation**: Large videos not transcoded, images not optimized for web
**Solution**: Add image compression, video thumbnail generation

### No Pagination/Infinite Scroll ❌
**Current**: Fetches up to 100 posts at once
**Limitation**: Performance issues with large datasets
**Solution**: Add cursor-based pagination or infinite scroll

---

## Database Schema Best Practices Already Implemented ✅

1. **Denormalization**: Comments count stored in posts (not fetched via query)
2. **Immutable Audit Trail**: postActivities collection (no deletes/updates)
3. **Encryption for Privacy**: Anonymous author IDs encrypted with CryptoJS
4. **Activity Logging**: Every admin action tracked with metadata
5. **Compound Indexes**: Queries use companyId + type + orderBy createdAt
6. **Server Timestamps**: All dates use serverTimestamp() for consistency
7. **Array Operations**: Reactions use arrayUnion/arrayRemove for atomic updates

---

## What To Build Next

### Priority 1: Rich Text Editor 🔥
**Why**: Major UX improvement, users want formatting
**Effort**: 2-3 days
**Integration Points**:
- CreatePost.jsx: Replace textarea
- Post.jsx: Render HTML content
- CommentsSection.jsx: Optional enhancement
- Migration: Script to convert plain text → HTML
**Recommended**: TipTap (lightweight, React-friendly)

### Priority 2: Real-Time Post Feed 🔄
**Why**: Show live reactions, comments, status changes
**Effort**: 1-2 days
**Changes**:
- Add onSnapshot() listeners to UnifiedFeed.jsx
- Update post list when status changes
- Real-time reaction counts
- Potential cost increase (Firestore reads)

### Priority 3: Advanced Search 🔍
**Why**: Users need to find old posts
**Effort**: 2-3 days
**Options**:
- Client-side: Filter in-memory (works for <10k posts)
- Firestore: Multiple indexes for different filters
- Third-party: Algolia integration (cost extra)

### Priority 4: Notification Enhancement 📧
**Why**: Users miss important updates
**Effort**: 3-5 days
**Components**:
- Firebase Cloud Messaging (push)
- SMTP server (email)
- Notification preferences UI
- Unsubscribe handling

---

## Database Schema Additions for Enhancements

### For Rich Text Support
```javascript
// Update posts collection
{
  // ... existing fields ...
  contentFormat: "plain" | "html",      // track format version
  contentPlain: string,                  // keep for search
  contentHtml: string,                   // render this
  lastEditedAt: timestamp,               // track edits
  editHistory: [{content, editedAt, editedBy}]  // optional, for audit
}
```

### For Advanced Filtering
```javascript
// Add new collection for search optimization
postSearchIndex {
  postId: string,
  companyId: string,
  title: string,
  content: string,        // plain text for search
  tags: string[],
  authorName: string,
  category: string,
  createdAt: timestamp,
  status: string,
  priority: string
  // Easier to query and filter
}
```

### For Mentions
```javascript
// Update comments
{
  // ... existing ...
  mentions: [{userId, displayName}],    // @mentioned users
  mentionNotifications: [{userId, sent: boolean}]
}
```

---

## File Paths Reference

**Core Services**:
- `/src/services/postManagementService.js` - Main post operations (794 lines)
- `/src/services/moderationService.js` - Content reporting & strikes (750+ lines)
- `/src/services/auditService.js` - Activity logging
- `/src/services/departmentService.js` - Department management

**Main Components**:
- `/src/components/CreatePost.jsx` - Post creation form
- `/src/components/Post.jsx` - Post display
- `/src/components/CommentsSection.jsx` - Comments thread
- `/src/components/AdminActionPanel.jsx` - Admin controls
- `/src/components/ReactionButton.jsx` - Emoji reactions
- `/src/components/ReportContentModal.jsx` - Report form

**Pages**:
- `/src/pages/feed/UnifiedFeed.jsx` - Generic feed template
- `/src/pages/feed/DiscussionsFeed.jsx` - Discussions specific
- `/src/pages/MyPosts.jsx` - User's own posts
- `/src/pages/company/CompanyPosts.jsx` - All company posts

**Constants**:
- `/src/utils/constants.js` - All enums and configurations (55+ types)

**Configuration**:
- `/src/config/firebase.js` - Firestore client SDK
- `/functions/config/firebase.js` - Firestore admin SDK

---

## Quick Wins (1-2 hour tasks)

1. **Improve error messages**: Better validation feedback in CreatePost
2. **Add copy-to-clipboard**: Share post links
3. **Improve file preview**: Better thumbnails for attachments
4. **Sort options**: Comments by newest/oldest
5. **Post analytics**: View count, engagement metrics in My Posts

---

## Performance Considerations

### Current Optimizations
- Comments count denormalized in posts
- PostActivities immutable (optimized for query)
- No global real-time listeners (except comments)
- Pagination with limit(100)

### Potential Issues
- Large attachments (10MB limit may be too high for web)
- No compression for images
- Real-time listeners not used widely (good for costs)
- No caching layer

### Firestore Costs Impact
```
POST CREATION:      2 writes (posts + postActivities)
COMMENT:            2 writes (comments + posts increment)
LIKE/REACT:         1 write (posts update)
STATUS CHANGE:      3 writes (posts + postActivities + notification)
ADMIN COMMENT:      3 writes (comments + posts + postActivities)
```

---

## Testing Checklist for New Features

- [ ] Post creation with all attachment types
- [ ] Comments in real-time (open in 2 browsers)
- [ ] Anonymous post author encryption/decryption
- [ ] Admin status/priority changes trigger notifications
- [ ] Rate limit blocks 11th post in hour
- [ ] Unread updates flag works correctly
- [ ] Moderation: Report, strike system, suspension
- [ ] Department assignment for anonymous posts
- [ ] Mobile responsiveness (tested on 320px, 768px, 1024px)
- [ ] Firestore security rules enforced

