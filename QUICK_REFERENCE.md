# Company Voice Platform - Quick Reference Guide

## Critical Files & Locations

### Authentication & Config
| File | Purpose | Key Functions |
|------|---------|----------------|
| `/src/config/firebase.js` | Firebase initialization | - |
| `/src/contexts/AuthContext.jsx` | Global auth state | `useAuth()` |
| `/src/services/authService.js` | Auth operations | `loginWithUsernamePassword()`, `getUserById()` |

### Database & Services
| File | Purpose | Key Functions |
|------|---------|----------------|
| `/src/services/postManagementService.js` | Post CRUD + **Audit** | `updatePostStatus()`, `logPostActivity()`, `getPostActivityTimeline()` |
| `/src/services/departmentservice.js` | Department CRUD | `createDepartment()`, `updateDepartment()` |
| `/firestore.rules` | Security rules | - |

### Components
| File | Purpose | Notes |
|------|---------|-------|
| `/src/components/AdminActionPanel.jsx` | Admin controls on posts | Triggers `logPostActivity()` |
| `/src/components/Post.jsx` | Post display | Shows status/priority badges |
| `/src/components/CommentsSection.jsx` | Comments UI | - |

### Pages (Admin)
| File | Purpose | Route |
|------|---------|-------|
| `/src/pages/admin/CompanyManagement.jsx` | Super admin: manage companies | `/admin/companies` |
| `/src/pages/company/CompanyDashboard.jsx` | Company admin: quick stats | `/company/dashboard` |
| `/src/pages/company/CompanyAnalytics.jsx` | Company admin: detailed analytics | `/company/analytics` |
| `/src/pages/company/DepartmentManagement.jsx` | Manage departments | `/company/departments` |

### Pages (User)
| File | Purpose | Route |
|------|---------|-------|
| `/src/pages/feed/CreativeFeed.jsx` | Creative content | `/feed/creative` |
| `/src/pages/feed/ProblemsFeed.jsx` | Problem reports | `/feed/problems` |
| `/src/pages/feed/DiscussionsFeed.jsx` | Team discussions | `/feed/discussions` |
| `/src/pages/MyPosts.jsx` | User's own posts | `/my-posts` |
| `/src/pages/Notifications.jsx` | User notifications | `/notifications` |

### Constants & Utils
| File | Purpose | Key Constants |
|------|---------|----------------|
| `/src/utils/constants.js` | Enums and configs | `PostStatus`, `PostPriority`, `UserRole`, `PostActivityType` |

### Configuration
| File | Purpose |
|------|---------|
| `/vite.config.js` | Vite build config |
| `/tailwind.config.js` | Tailwind CSS config |
| `/firestore.rules` | Firestore security rules |
| `/.env.example` | Environment variables template |

---

## Firestore Collections (Database Schema)

```
users/                          # User accounts
  └─ {userId}                  #   ID: Firebase UID
     ├─ username: string       #   Username (unique per company)
     ├─ email: string
     ├─ displayName: string
     ├─ password: string       #   SHA256 hashed
     ├─ role: enum             #   super_admin|company_admin|hr|employee
     ├─ companyId: string      #   Reference to company
     ├─ departmentId: string   #   Reference to department
     ├─ status: enum           #   active|suspended|invited
     ├─ lastLogin: timestamp
     ├─ createdAt: timestamp
     └─ updatedAt: timestamp

companies/                      # Company accounts
  └─ {companyId}
     ├─ name: string
     ├─ industry: string
     ├─ subscriptionStatus: enum
     ├─ createdAt: timestamp
     └─ updatedAt: timestamp

posts/                          # Main content (feedback)
  └─ {postId}                  # ID: auto-generated
     ├─ title: string
     ├─ description: string
     ├─ type: enum             #   problem_report|idea_suggestion|creative_content|team_discussion
     ├─ status: enum           #   open|acknowledged|in_progress|under_review|working_on|resolved|closed|rejected|not_a_problem
     ├─ priority: enum         #   critical|high|medium|low
     ├─ companyId: string      #   Company scope
     ├─ authorId: string       #   Encrypted if anonymous
     ├─ isAnonymous: boolean
     ├─ assignedTo: object     #   {type, id, name, assignedAt, assignedBy, assignedById}
     ├─ dueDate: timestamp
     ├─ likes: number
     ├─ comments: number
     ├─ lastUpdatedBy: string
     ├─ lastUpdatedById: string
     ├─ createdAt: timestamp
     └─ updatedAt: timestamp

postActivities/ ⭐ AUDIT       # Activity timeline (immutable)
  └─ {activityId}              # ID: auto-generated
     ├─ postId: string         #   Reference to post
     ├─ type: enum             #   status_changed|priority_changed|assigned|due_date_changed|admin_comment|...
     ├─ metadata: object       #   Activity-specific data
     │  ├─ adminId: string     #   Who made the change
     │  ├─ adminName: string
     │  ├─ oldStatus: string   #   For status_changed
     │  ├─ newStatus: string
     │  ├─ comment: string     #   For admin_comment
     │  └─ ...
     └─ createdAt: timestamp

comments/                       # User comments on posts
  └─ {commentId}
     ├─ postId: string         #   Reference to post
     ├─ text: string
     ├─ authorId: string
     ├─ authorName: string
     ├─ authorRole: string
     ├─ isAdminComment: boolean
     ├─ createdAt: timestamp
     └─ updatedAt: timestamp

notifications/                  # User notifications
  └─ {notificationId}
     ├─ userId: string         #   Target user
     ├─ type: enum             #   comment|reaction|mention|status_changed|assigned|...
     ├─ title: string
     ├─ message: string
     ├─ postId: string         #   Associated post
     ├─ read: boolean
     └─ createdAt: timestamp

departments/                    # Company departments
  └─ {departmentId}
     ├─ name: string
     ├─ companyId: string
     ├─ memberCount: number
     ├─ activeProjects: number
     ├─ isActive: boolean
     ├─ createdAt: timestamp
     └─ updatedAt: timestamp

postViews/                      # Unread tracking for "My Posts"
  └─ {viewId}
     ├─ postId: string
     ├─ authorId: string
     └─ lastViewedAt: timestamp

userTags/                       # User role/level tags
  └─ {tagId}
     ├─ companyId: string
     ├─ name: enum             #   executive|senior_manager|manager|specialist|staff
     ├─ label: string
     ├─ priority: number
     ├─ color: string
     └─ createdAt: timestamp
```

---

## Core Business Logic Flow

### 1. User Login
```
LoginPage → authService.loginWithUsernamePassword()
  ↓
Query users collection where username & password match
  ↓
Update lastLogin timestamp
  ↓
Store in localStorage + AuthContext
  ↓
Redirect to Dashboard
```

### 2. Create Post
```
CreatePost Form → postManagementService (via component)
  ↓
Check rate limit (10/hour)
  ↓
Encrypt author ID if anonymous
  ↓
Create posts document
  ↓
Notify company (via notifications collection)
```

### 3. Admin Updates Post Status ⭐ AUDIT
```
AdminActionPanel → updatePostStatus(postId, newStatus, adminUser)
  ↓
[1] Update posts document (status, updatedAt, lastUpdatedBy)
[2] logPostActivity() → Create postActivities document
[3] notifyAuthor() → Create notifications document
  ↓
postActivities immutable record created for audit trail
```

### 4. User Views Own Posts
```
MyPosts page → getPostActivityTimeline(postId)
  ↓
Query postActivities collection
  ↓
Display timeline showing all changes
```

---

## Key Audit Functions (Current Implementation)

```javascript
// Log an activity (immutable write)
logPostActivity(postId, type, metadata)
  → Creates document in postActivities collection
  → Non-critical (failures don't break main operations)

// Get activity history for a post
getPostActivityTimeline(postId, limit)
  → Fetches postActivities sorted by date DESC
  → Returns array of activity objects with metadata

// Update post status (triggers audit)
updatePostStatus(postId, newStatus, adminUser, comment)
  → Updates posts document
  → Calls logPostActivity() with STATUS_CHANGED
  → Notifies post author

// Update post priority (triggers audit)
updatePostPriority(postId, newPriority, adminUser)
  → Updates posts document
  → Calls logPostActivity() with PRIORITY_CHANGED

// Assign post (triggers audit)
assignPost(postId, assignment, adminUser)
  → Updates posts.assignedTo
  → Calls logPostActivity() with ASSIGNED
  → Notifies assignee if user assignment

// Set due date (triggers audit)
setDueDate(postId, dueDate, adminUser)
  → Updates posts.dueDate
  → Calls logPostActivity() with DUE_DATE_SET/CHANGED

// Add admin comment (triggers audit)
addAdminComment(postId, commentText, adminUser)
  → Creates comments document
  → Calls logPostActivity() with ADMIN_COMMENT
  → Notifies post author
```

---

## User Roles & Permissions

```javascript
UserRole {
  SUPER_ADMIN:   "super_admin"      // Manage all companies
  COMPANY_ADMIN: "company_admin"    // Manage single company
  HR:            "hr"               // Manage employees & posts
  EMPLOYEE:      "employee"         // Create posts, comment
}

// Admin Privileges
isAdmin() returns true for: super_admin, company_admin, hr
→ Can update post status/priority/assignment
→ Can create admin comments
→ Can view audit logs
→ Can manage users and departments

// Employee Privileges
→ Can create posts
→ Can comment on posts
→ Can view all posts in company
→ Can view "My Posts" dashboard
→ Cannot update posts
```

---

## Firestore Security Model

### Company Isolation
- Every collection has `companyId`
- `isSameCompany(companyId)` enforced in rules
- Multi-tenant: data strictly separated

### Admin Controls
- `postActivities`: Read by all in company, CREATE by admin only, NO updates/deletes
- `posts`: READ by all in company, UPDATE by author/admin
- `notifications`: READ/WRITE by user only
- `users`: CREATE/DELETE by admin only

### Immutability
- `postActivities` cannot be updated or deleted (audit trail integrity)
- `comments` can only update text field (limited edits)
- Prevents tampering with audit records

---

## Key Architectural Patterns

### 1. Service Layer Abstraction
```
React Component
    ↓
Services (postManagementService.js)
    ↓
Firestore Operations
```
Keeps business logic centralized, makes auditing easier.

### 2. Metadata Capture
```
logPostActivity(postId, type, metadata)
```
Stores WHO, WHAT, WHEN, and context data in metadata object.

### 3. Non-Critical Logging
```
try {
  // Main operation
  await updateDoc(...)
  // Log activity (non-breaking)
  await logPostActivity(...)
} catch (error) {
  // Handle error
}
```
Activity logging failures don't break main operations.

### 4. Timestamp Consistency
```
serverTimestamp() used everywhere
```
Prevents clock skew, ensures accurate ordering.

### 5. Role-Based Access Control (RBAC)
```
Helper functions in Firestore rules:
- isAuthenticated()
- isAdmin()
- isSuperAdmin()
- isCompanyAdmin(companyId)
- isSameCompany(companyId)
- isOwner(authorId)
```
Security enforced at database level, not just frontend.

---

## Development Tips

### Testing Audit Trail
1. Make a post
2. View it in feed
3. As admin, change status
4. Check `postActivities` collection in Firestore Console
5. Each change creates immutable activity document

### Adding New Activity Types
1. Add to `PostActivityType` in `/src/utils/constants.js`
2. Add config to `PostActivityTypeConfig`
3. Call `logPostActivity(postId, newType, metadata)` after operation
4. Activity automatically stored in `postActivities`

### Debugging Firestore
1. Open Firestore Console in Firebase
2. Click on any collection to browse data
3. View Firestore Rules tab to check rules
4. Use Firestore Emulator for local testing

### Performance Optimization
- Use `limit()` in queries to reduce reads
- Index compound queries (Firestore will suggest)
- Avoid N+1 queries (batch operations when possible)
- Use `writeBatch()` for atomic multi-document updates

---

## Environment Variables

Required in `.env`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ANONYMOUS_SECRET=              # For encrypting anonymous authors
```

---

## External Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [React Documentation](https://react.dev)
- [React Router](https://reactrouter.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [i18next](https://www.i18next.com/)

---

## Branch Information

Current branch: `claude/add-audit-history-features-011CUxdjVYG4L5eQhgQjNQVP`

This branch is for implementing enhanced audit history features that build on the existing `postActivities` audit trail.
