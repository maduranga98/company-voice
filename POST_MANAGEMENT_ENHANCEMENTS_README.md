# Post Management & Team Discussion Enhancements

This document describes all the new features added to enhance post management and team discussions in the Company Voice platform.

## 📋 Table of Contents

- [Overview](#overview)
- [New Features](#new-features)
- [Installation & Setup](#installation--setup)
- [Usage Guide](#usage-guide)
- [Database Schema Changes](#database-schema-changes)
- [API/Service Reference](#apiservice-reference)
- [Integration Guide](#integration-guide)

---

## Overview

This enhancement package adds powerful post management features and improves team collaboration through better discussion tools. All new features are designed to integrate seamlessly with the existing codebase.

### What's New

**Post Management:**
- ✅ Draft Posts (save for later)
- ✅ Edit History Tracking (full audit trail)
- ✅ Post Scheduling (future publishing)
- ✅ Pin Important Posts (admin feature)
- ✅ Archive Old Posts
- ✅ Bulk Actions for Admins
- ✅ Post Templates for Common Issues

**Team Discussions:**
- ✅ @Mentions with autocomplete
- ✅ Rich Text Editor (Markdown support)
- ✅ Enhanced Comments UI
- ✅ Real-time @mention notifications

---

## New Features

### 1. Draft Posts

**Save posts as drafts and publish them later.**

**Key Features:**
- Save incomplete posts as drafts
- Auto-save functionality (optional)
- Edit drafts before publishing
- Delete unused drafts
- View all your drafts in one place

**Files:**
- Service: `src/services/postEnhancementsService.js`
- Page: `src/pages/DraftsPage.jsx`
- Component: `src/components/CreatePostEnhanced.jsx`

**Usage:**
```javascript
import { saveDraft, publishDraft, getUserDrafts } from '../services/postEnhancementsService';

// Save as draft
const draftData = { title, content, category, tags, ... };
const { draftId } = await saveDraft(draftData);

// Publish draft
await publishDraft(draftId, adminUser);

// Get user's drafts
const drafts = await getUserDrafts(userId, companyId);
```

### 2. Edit History Tracking

**Track all changes made to posts with full audit trail.**

**Key Features:**
- Automatic tracking of all edits
- View edit history with diff view
- Shows who edited, when, and what changed
- Immutable history (append-only)
- Edit count display on posts

**Files:**
- Service: `src/services/postEnhancementsService.js`
- Component: `src/components/EditPost.jsx`

**Usage:**
```javascript
import { editPost, getPostEditHistory } from '../services/postEnhancementsService';

// Edit a post
await editPost(postId, updateData, editor);

// Get edit history
const history = await getPostEditHistory(postId);
```

**Database Schema:**
```javascript
// postEditHistory collection
{
  postId: string,
  editorId: string,
  editorName: string,
  changes: {
    title: { old: string, new: string },
    content: { old: string, new: string },
    // ... other fields
  },
  editedAt: timestamp,
  companyId: string
}
```

### 3. Post Scheduling

**Schedule posts to be published automatically at a future date/time.**

**Key Features:**
- Schedule posts for future publishing
- View all scheduled posts
- Cancel scheduled posts
- Publish scheduled posts immediately
- Background job integration ready

**Files:**
- Service: `src/services/postEnhancementsService.js`
- Page: `src/pages/ScheduledPostsPage.jsx`
- Component: `src/components/CreatePostEnhanced.jsx`

**Usage:**
```javascript
import { schedulePost, getScheduledPosts, publishScheduledPost } from '../services/postEnhancementsService';

// Schedule a post
const scheduledDate = new Date('2025-12-31T10:00:00');
await schedulePost(postData, scheduledDate);

// Get scheduled posts
const scheduled = await getScheduledPosts(companyId);

// Publish scheduled post (call from cron/cloud function)
await publishScheduledPost(postId);
```

**Database Fields:**
```javascript
// Post document
{
  isScheduled: boolean,
  scheduledPublishDate: timestamp,
  status: 'scheduled',
  // ... other fields
}
```

### 4. Pin/Archive Posts

**Pin important posts to the top or archive old posts.**

**Key Features:**
- Pin posts (admin only)
- Unpin posts
- Archive posts
- Unarchive posts
- View archived posts separately
- Pinned posts appear first in feeds

**Files:**
- Service: `src/services/postEnhancementsService.js`
- Component: `src/components/PostActions.jsx`

**Usage:**
```javascript
import { pinPost, unpinPost, archivePost, getArchivedPosts } from '../services/postEnhancementsService';

// Pin a post (admin only)
await pinPost(postId, adminUser);

// Unpin
await unpinPost(postId, adminUser);

// Archive
await archivePost(postId, user);

// Get archived posts
const archived = await getArchivedPosts(companyId);
```

**Database Fields:**
```javascript
// Post document
{
  isPinned: boolean,
  pinnedAt: timestamp,
  pinnedBy: string,
  pinnedById: string,
  isArchived: boolean,
  archivedAt: timestamp,
  archivedBy: string,
  archivedById: string,
  // ... other fields
}
```

### 5. Bulk Actions for Admins

**Perform actions on multiple posts at once.**

**Key Features:**
- Select multiple posts
- Bulk status update
- Bulk archive
- Bulk assignment
- Bulk delete drafts
- Progress indicators

**Files:**
- Service: `src/services/postEnhancementsService.js`
- Component: `src/components/BulkActionsPanel.jsx`

**Usage:**
```javascript
import { bulkUpdateStatus, bulkArchivePosts, bulkAssignPosts } from '../services/postEnhancementsService';

// Bulk update status
const postIds = ['post1', 'post2', 'post3'];
await bulkUpdateStatus(postIds, 'resolved', adminUser);

// Bulk archive
await bulkArchivePosts(postIds, adminUser);

// Bulk assign
const assignment = { type: 'department', id: 'dept1', name: 'Engineering' };
await bulkAssignPosts(postIds, assignment, adminUser);
```

### 6. Post Templates

**Create reusable templates for common post types.**

**Key Features:**
- Create custom templates
- Pre-defined default templates
- Template categories
- Track template usage
- Most used templates
- Admin template management

**Files:**
- Service: `src/services/postTemplatesService.js`
- Page: `src/pages/TemplatesPage.jsx`
- Component: `src/components/CreatePostEnhanced.jsx`

**Usage:**
```javascript
import { createTemplate, getTemplates, incrementTemplateUseCount } from '../services/postTemplatesService';

// Create template
const template = {
  name: 'Safety Issue Report',
  type: 'problem_report',
  title: 'Safety Concern: [Location]',
  content: '**What is the issue?**\n[Description]',
  category: 'Safety Issue',
  tags: ['safety', 'urgent']
};
await createTemplate(template, creator);

// Get templates
const templates = await getTemplates(companyId, 'problem_report');

// Use template
await incrementTemplateUseCount(templateId);
```

**Default Templates:**
- Safety Issue Report
- Equipment Problem Report
- Idea or Suggestion
- Team Update
- Project Success Story
- Process Improvement Suggestion

### 7. @Mentions Functionality

**Mention team members in comments and posts.**

**Key Features:**
- Type @ to trigger autocomplete
- Real-time user search
- Mention highlighting
- Automatic notifications
- Click mentions to view profiles (optional)

**Files:**
- Service: `src/services/mentionsService.js`
- Component: `src/components/CommentsEnhanced.jsx`

**Usage:**
```javascript
import {
  parseMentions,
  searchUsersForMention,
  createMentionNotifications
} from '../services/mentionsService';

// Parse mentions from text
const mentions = parseMentions("Hey @john, can you review this?");
// Returns: [{ username: 'john', startIndex: 4, endIndex: 9 }]

// Search users for autocomplete
const users = await searchUsersForMention('joh', companyId, 10);

// Create notifications
await createMentionNotifications(commentText, companyId, {
  postId,
  postTitle,
  authorId,
  authorName,
  commentId
});
```

### 8. Rich Text Editor

**Simple Markdown-based rich text editing.**

**Key Features:**
- Bold, italic, code formatting
- Lists (bulleted & numbered)
- Quotes
- Links
- Code blocks
- Markdown preview (optional)

**Files:**
- Component: `src/components/RichTextEditor.jsx`

**Usage:**
```javascript
import RichTextEditor, { MarkdownPreview } from '../components/RichTextEditor';

// In your component
<RichTextEditor
  value={content}
  onChange={setContent}
  placeholder="Write something..."
  rows={8}
/>

// Preview markdown
<MarkdownPreview content={content} />
```

**Supported Markdown:**
- `**bold**` → **bold**
- `*italic*` → *italic*
- `` `code` `` → `code`
- `[link](url)` → [link](url)
- `> quote` → blockquote
- `- item` → bullet list
- `1. item` → numbered list

---

## Installation & Setup

### 1. Copy New Files

All new service files and components have been created. Ensure they're in your project:

```
src/
├── services/
│   ├── postEnhancementsService.js     ← NEW
│   ├── postTemplatesService.js        ← NEW
│   └── mentionsService.js             ← NEW
├── components/
│   ├── CreatePostEnhanced.jsx         ← NEW
│   ├── EditPost.jsx                   ← NEW
│   ├── CommentsEnhanced.jsx           ← NEW
│   ├── BulkActionsPanel.jsx           ← NEW
│   ├── PostActions.jsx                ← NEW
│   └── RichTextEditor.jsx             ← NEW
└── pages/
    ├── DraftsPage.jsx                 ← NEW
    ├── TemplatesPage.jsx              ← NEW
    └── ScheduledPostsPage.jsx         ← NEW
```

### 2. Install Dependencies

No additional npm packages are required! All features use existing dependencies:
- Firebase/Firestore (already installed)
- React 19 (already installed)
- Lucide React icons (already installed)

### 3. Firestore Indexes

Create these Firestore indexes for optimal performance:

```javascript
// postEditHistory collection
- postId (ascending), editedAt (descending)

// postTemplates collection
- companyId (ascending), type (ascending), name (ascending)
- companyId (ascending), isActive (ascending), useCount (descending)

// posts collection (add to existing indexes)
- companyId (ascending), isDraft (ascending), updatedAt (descending)
- companyId (ascending), isScheduled (ascending), scheduledPublishDate (ascending)
- companyId (ascending), isArchived (ascending), archivedAt (descending)
- companyId (ascending), isPinned (ascending), createdAt (descending)
```

### 4. Firestore Security Rules

Add these rules to your `firestore.rules`:

```javascript
// Draft posts - only author can read/write
match /posts/{postId} {
  allow read: if resource.data.isDraft == false ||
                 resource.data.authorId == request.auth.uid;
}

// Edit history - read by authenticated users
match /postEditHistory/{historyId} {
  allow read: if request.auth != null;
  allow write: if false; // Only created by backend
}

// Templates - read by all, write by admins
match /postTemplates/{templateId} {
  allow read: if request.auth != null;
  allow create, update: if isAdmin();
  allow delete: if isAdmin() ||
                   resource.data.createdById == request.auth.uid;
}

function isAdmin() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['company_admin', 'super_admin', 'hr'];
}
```

### 5. Optional: Cloud Function for Scheduled Posts

Create a Cloud Function to automatically publish scheduled posts:

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.publishScheduledPosts = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await admin.firestore()
      .collection('posts')
      .where('isScheduled', '==', true)
      .where('scheduledPublishDate', '<=', now)
      .get();

    const batch = admin.firestore().batch();

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        isScheduled: false,
        status: 'open',
        publishedAt: now,
        updatedAt: now
      });
    });

    await batch.commit();

    console.log(`Published ${snapshot.size} scheduled posts`);
  });
```

---

## Usage Guide

### For Regular Users

#### Creating a Draft
1. Click "Create Post"
2. Fill in your content
3. Click "Save Draft" instead of "Publish"
4. Access drafts from "My Drafts" page

#### Using Templates
1. Click "Create Post"
2. Click "Templates" button
3. Select a template
4. Customize the content
5. Publish or save as draft

#### Scheduling a Post
1. Click "Create Post"
2. Click "Schedule" button
3. Select date and time
4. Click "Schedule" button
5. View scheduled posts in "Scheduled Posts" page

#### Using @Mentions
1. Type @ in any comment
2. Start typing a username
3. Select from autocomplete
4. User will be notified

#### Editing a Post
1. Click three dots on your post
2. Select "Edit Post"
3. Make changes
4. Click "Save Changes"
5. View edit history by clicking "History"

### For Admins

#### Pinning Posts
1. Click three dots on any post
2. Select "Pin Post"
3. Post appears at top of feed

#### Bulk Actions
1. Go to post list with bulk actions enabled
2. Select multiple posts (checkboxes)
3. Click "Bulk Actions"
4. Choose action (status update, archive, etc.)
5. Confirm

#### Managing Templates
1. Go to "Templates" page
2. Click "New Template"
3. Fill in template details
4. Save
5. Users can now use your template

#### Archiving Posts
1. Click three dots on post
2. Select "Archive Post"
3. View archived posts in "Archived" page

---

## Database Schema Changes

### Posts Collection (Enhanced)

```javascript
{
  // Existing fields...
  title: string,
  content: string,
  category: string,
  tags: array,
  authorId: string,
  companyId: string,
  status: string,
  priority: string,
  createdAt: timestamp,
  updatedAt: timestamp,

  // NEW FIELDS:

  // Draft functionality
  isDraft: boolean,                // Is this a draft?

  // Scheduling
  isScheduled: boolean,            // Is this scheduled?
  scheduledPublishDate: timestamp, // When to publish
  publishedAt: timestamp,          // When was it published
  publishedBy: string,             // Who published it
  publishedById: string,

  // Pin/Archive
  isPinned: boolean,               // Is pinned?
  pinnedAt: timestamp,             // When pinned
  pinnedBy: string,                // Who pinned
  pinnedById: string,
  isArchived: boolean,             // Is archived?
  archivedAt: timestamp,           // When archived
  archivedBy: string,              // Who archived
  archivedById: string,

  // Edit tracking
  editCount: number,               // Number of edits
  lastEditedAt: timestamp,         // Last edit time
  lastEditedBy: string,            // Last editor name
  lastEditedById: string           // Last editor ID
}
```

### New Collections

#### postEditHistory
```javascript
{
  postId: string,
  editorId: string,
  editorName: string,
  changes: {
    fieldName: {
      old: any,
      new: any
    }
  },
  editedAt: timestamp,
  companyId: string
}
```

#### postTemplates
```javascript
{
  name: string,
  description: string,
  type: string,              // creative_content, problem_report, team_discussion
  title: string,             // Default title
  content: string,           // Default content
  category: string,          // Default category
  tags: array,               // Default tags
  companyId: string,
  createdBy: string,
  createdById: string,
  createdAt: timestamp,
  updatedAt: timestamp,
  isActive: boolean,
  useCount: number,          // How many times used
  lastUsedAt: timestamp
}
```

---

## API/Service Reference

### postEnhancementsService.js

#### Draft Functions
- `saveDraft(postData)` - Save post as draft
- `updateDraft(draftId, updateData)` - Update existing draft
- `publishDraft(draftId, adminUser)` - Publish a draft
- `getUserDrafts(userId, companyId)` - Get user's drafts
- `deleteDraft(draftId, userId)` - Delete a draft

#### Edit History Functions
- `saveEditHistory(postId, oldData, newData, editor)` - Save edit to history
- `getPostEditHistory(postId)` - Get post's edit history
- `editPost(postId, updateData, editor)` - Edit a post

#### Scheduling Functions
- `schedulePost(postData, scheduledDate)` - Schedule a post
- `getScheduledPosts(companyId)` - Get scheduled posts
- `publishScheduledPost(postId)` - Publish scheduled post
- `cancelScheduledPost(postId, userId)` - Cancel scheduled post

#### Pin/Archive Functions
- `pinPost(postId, adminUser)` - Pin a post
- `unpinPost(postId, adminUser)` - Unpin a post
- `archivePost(postId, user)` - Archive a post
- `unarchivePost(postId, user)` - Unarchive a post
- `getArchivedPosts(companyId, limitCount)` - Get archived posts

#### Bulk Action Functions
- `bulkUpdateStatus(postIds, newStatus, adminUser)` - Bulk status update
- `bulkArchivePosts(postIds, adminUser)` - Bulk archive
- `bulkAssignPosts(postIds, assignment, adminUser)` - Bulk assign
- `bulkDeleteDrafts(draftIds, userId)` - Bulk delete drafts

### postTemplatesService.js

- `createTemplate(templateData, creator)` - Create new template
- `getTemplates(companyId, type)` - Get all templates
- `getTemplate(templateId)` - Get single template
- `updateTemplate(templateId, updateData, editor)` - Update template
- `deleteTemplate(templateId, user)` - Delete template (soft)
- `incrementTemplateUseCount(templateId)` - Track usage
- `getMostUsedTemplates(companyId, limit)` - Get popular templates
- `initializeDefaultTemplates(companyId, admin)` - Create defaults

### mentionsService.js

- `parseMentions(text)` - Parse @mentions from text
- `extractMentionedUsernames(text)` - Get unique usernames
- `searchUsersForMention(searchTerm, companyId, limitCount)` - Search users
- `getUserByUsername(username, companyId)` - Get user by username
- `createMentionNotifications(text, companyId, context)` - Create notifications
- `highlightMentions(text)` - Highlight mentions for display
- `getUserMentions(userId, limitCount)` - Get user's mentions
- `isValidMentionFormat(username)` - Validate mention format

---

## Integration Guide

### Step 1: Replace CreatePost Component

In your main feed/page components, replace `CreatePost` with `CreatePostEnhanced`:

```javascript
// Before
import CreatePost from '../components/CreatePost';

// After
import CreatePostEnhanced from '../components/CreatePostEnhanced';

// Usage
<CreatePostEnhanced
  type="discussion"
  onClose={() => setShowModal(false)}
  onSuccess={() => loadPosts()}
/>
```

### Step 2: Add New Routes

Add routes for the new pages:

```javascript
// In your router config
import DraftsPage from './pages/DraftsPage';
import TemplatesPage from './pages/TemplatesPage';
import ScheduledPostsPage from './pages/ScheduledPostsPage';

// Add routes
<Route path="/drafts" element={<DraftsPage />} />
<Route path="/templates" element={<TemplatesPage />} />
<Route path="/scheduled" element={<ScheduledPostsPage />} />
```

### Step 3: Add Navigation Links

Add links to your navigation:

```javascript
<nav>
  <Link to="/drafts">My Drafts</Link>
  <Link to="/templates">Templates</Link>
  <Link to="/scheduled">Scheduled Posts</Link>
</nav>
```

### Step 4: Replace Comments Component

Replace existing comments with enhanced version:

```javascript
// Before
import CommentsSection from '../components/CommentsSection';

// After
import CommentsEnhanced from '../components/CommentsEnhanced';

// Usage (same props)
<CommentsEnhanced
  postId={post.id}
  initialCommentCount={post.comments}
  postAuthorId={post.authorId}
  postAuthorName={post.authorName}
  postTitle={post.title}
/>
```

### Step 5: Add Post Actions

Add the PostActions component to your Post component:

```javascript
import PostActions from '../components/PostActions';

// In your Post component
<PostActions
  post={post}
  onEdit={(post) => setEditingPost(post)}
  onActionComplete={() => refreshPosts()}
/>

// Add EditPost modal
{editingPost && (
  <EditPost
    post={editingPost}
    onClose={() => setEditingPost(null)}
    onSuccess={() => refreshPosts()}
  />
)}
```

### Step 6: Add Bulk Actions (Admin Pages)

For admin list views, add bulk actions:

```javascript
import BulkActionsPanel from '../components/BulkActionsPanel';

// In admin post list
<BulkActionsPanel
  posts={posts}
  onActionComplete={() => loadPosts()}
/>
```

### Step 7: Use Rich Text Editor (Optional)

Replace textareas with rich text editor:

```javascript
import RichTextEditor from '../components/RichTextEditor';

// Replace
<textarea value={content} onChange={e => setContent(e.target.value)} />

// With
<RichTextEditor
  value={content}
  onChange={setContent}
  placeholder="Write your post..."
  rows={10}
/>
```

---

## Testing Checklist

- [ ] Create and save draft
- [ ] Publish draft
- [ ] Delete draft
- [ ] Edit post and view history
- [ ] Schedule post for future
- [ ] Cancel scheduled post
- [ ] Publish scheduled post now
- [ ] Pin post (admin)
- [ ] Unpin post (admin)
- [ ] Archive post
- [ ] Unarchive post
- [ ] Select multiple posts (bulk)
- [ ] Bulk update status
- [ ] Bulk archive
- [ ] Create custom template
- [ ] Use template
- [ ] Delete template
- [ ] Type @mention in comment
- [ ] Receive mention notification
- [ ] Use rich text formatting

---

## Troubleshooting

### Drafts not saving
- Check Firestore rules allow `isDraft: true` posts
- Verify user authentication
- Check console for errors

### Scheduled posts not publishing
- Implement Cloud Function (see Installation step 5)
- Or manually call `publishScheduledPost()` from cron

### @Mentions not working
- Ensure users have `username` field
- Check Firestore indexes
- Verify notification creation permissions

### Templates not appearing
- Initialize default templates: `initializeDefaultTemplates(companyId, admin)`
- Check `isActive: true` filter

### Bulk actions failing
- Verify admin permissions
- Check Firestore batch limits (500 writes max)
- For large bulk operations, split into batches

---

## Future Enhancements

Potential improvements for future versions:

1. **Rich Text Editor**: Integrate TipTap or Quill for full WYSIWYG
2. **File Upload**: Drag-and-drop file attachments
3. **Post Analytics**: View counts, engagement metrics
4. **Advanced Search**: Full-text search with filters
5. **Post Reactions**: Beyond basic reactions
6. **Collaborative Editing**: Real-time multi-user editing
7. **Version Control**: Rollback to previous versions
8. **Export**: Export posts to PDF/Word
9. **Auto-save Drafts**: Periodic auto-save
10. **Post Categories**: Advanced categorization

---

## Support

For issues or questions:
1. Check this README
2. Review code comments in service files
3. Check Firestore console for data issues
4. Review browser console for errors

---

## License

This code is part of the Company Voice platform and follows the same license as the main application.

---

**Created:** 2025-11-11
**Version:** 1.0.0
**Author:** Claude (Anthropic)
