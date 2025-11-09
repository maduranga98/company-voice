# Company Voice Platform - Architecture Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REACT FRONTEND (Vite)                         │
│                                                                       │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────┐ │
│  │   Authentication     │  │   Role-Based Layout  │  │  i18n      │ │
│  │   Context & Hooks    │  │   & Navigation       │  │  Support   │ │
│  │   - useAuth()        │  │   - EmployeeLayout   │  │            │ │
│  └──────────────────────┘  └──────────────────────┘  └────────────┘ │
│           ↓                           ↓                       ↓       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Page Components (React Router)                  │    │
│  │  ┌─────────────┐  ┌────────────┐  ┌─────────────────┐      │    │
│  │  │ Feed Pages  │  │Admin Pages │  │ User Dashboard  │      │    │
│  │  ├─ Creative  │  ├─ Company   │  ├─ MyPosts        │      │    │
│  │  ├─ Problems  │  │  Dashboard │  ├─ AssignedToMe   │      │    │
│  │  ├─ Discussions
│  │  └─ Unified   │  │  Analytics │  └─ Notifications  │      │    │
│  │               │  └────────────┘                     │      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│           ↓                           ↓                       ↓       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Reusable Components                             │    │
│  │  ┌────────┐  ┌──────────────┐  ┌──────────────┐             │    │
│  │  │  Post  │  │ AdminAction  │  │  Comments    │             │    │
│  │  │Component│  │ Panel        │  │ Section      │             │    │
│  │  └────────┘  └──────────────┘  └──────────────┘             │    │
│  │  ┌────────┐  ┌──────────────┐  ┌──────────────┐             │    │
│  │  │  Like  │  │  Reactions   │  │  Department  │             │    │
│  │  │ Button │  │  System      │  │  Modal       │             │    │
│  │  └────────┘  └──────────────┘  └──────────────┘             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                ↓                                      │
├─────────────────────────────────────────────────────────────────────┤
│                   SERVICE LAYER (Business Logic)                     │
│                                                                       │
│  ┌──────────────────────┐  ┌──────────────────────┐                │
│  │  authService.js      │  │ departmentService.js │                │
│  │  ├─ login()          │  │ ├─ createDept()     │                │
│  │  ├─ getUserById()    │  │ ├─ updateDept()     │                │
│  │  └─ hashPassword()   │  │ ├─ deleteDept()     │                │
│  │                      │  │ └─ getDepartments() │                │
│  └──────────────────────┘  └──────────────────────┘                │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │         postManagementService.js (CORE AUDIT)              │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │ Post Operations                                     │   │    │
│  │  │ ├─ updatePostStatus() → logPostActivity()          │   │    │
│  │  │ ├─ updatePostPriority() → logPostActivity()        │   │    │
│  │  │ ├─ assignPost() → logPostActivity()                │   │    │
│  │  │ ├─ setDueDate() → logPostActivity()                │   │    │
│  │  │ ├─ addAdminComment() → logPostActivity()           │   │    │
│  │  │ └─ unassignPost() → logPostActivity()              │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │ Audit Functions (⭐ KEY)                            │   │    │
│  │  │ ├─ logPostActivity(postId, type, metadata)         │   │    │
│  │  │ ├─ getPostActivityTimeline(postId)                 │   │    │
│  │  │ └─ (Creates postActivities documents)              │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │ Helper Functions                                    │   │    │
│  │  │ ├─ createNotification()                             │   │    │
│  │  │ ├─ notifyAuthor()                                   │   │    │
│  │  │ ├─ encryptAuthorId()                                │   │    │
│  │  │ ├─ decryptAuthorId()                                │   │    │
│  │  │ ├─ isAdmin()                                        │   │    │
│  │  │ └─ checkRateLimit()                                 │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│              FIRESTORE (Cloud Database + Real-time Sync)            │
│                                                                       │
│  ┌────────────────┐  ┌─────────────┐  ┌──────────────┐             │
│  │    users       │  │  companies  │  │  posts       │             │
│  ├────────────────┤  ├─────────────┤  ├──────────────┤             │
│  │ id             │  │ id          │  │ id           │             │
│  │ username       │  │ name        │  │ title        │             │
│  │ password       │  │ industry    │  │ description  │             │
│  │ displayName    │  │ subscription│  │ type         │             │
│  │ email          │  │ createdAt   │  │ status       │             │
│  │ role           │  │ updatedAt   │  │ priority     │             │
│  │ companyId ─────┼──→            │  │ companyId    │             │
│  │ departmentId   │  └─────────────┘  │ authorId     │             │
│  │ lastLogin      │                    │ assignedTo   │             │
│  │ createdAt      │                    │ dueDate      │             │
│  │ updatedAt      │                    │ likes        │             │
│  └────────────────┘                    │ comments     │             │
│                                         │ createdAt    │             │
│  ┌──────────────────┐  ┌──────────────┐│ updatedAt    │             │
│  │  comments        │  │departments   ││ lastUpdatedBy│             │
│  ├──────────────────┤  ├──────────────┤└──────────────┘             │
│  │ id               │  │ id           │                              │
│  │ postId ───────┐  │  │ name         │  ┌──────────────────┐       │
│  │ text          │  │  │ companyId    │  │ postActivities   │       │
│  │ authorId      │  │  │ memberCount  │  │ (⭐ AUDIT LOGS)  │       │
│  │ authorName    │  │  │ activeProjects
│  │ authorRole    │  │  │ isActive     │  ├──────────────────┤       │
│  │ isAdminComment│  │  │ createdAt    │  │ id               │       │
│  │ createdAt     │  │  │ updatedAt    │  │ postId ────────┐ │       │
│  │ updatedAt     │  │  └──────────────┘  │ type           │ │       │
│  └──────────────────┘                    │ metadata       │ │       │
│                                           │   adminId      │ │       │
│  ┌──────────────────┐  ┌──────────────┐ │   adminName    │ │       │
│  │ notifications    │  │ postViews    │ │   oldStatus    │ │       │
│  ├──────────────────┤  ├──────────────┤ │   newStatus    │ │       │
│  │ id               │  │ id           │ │   dueDate      │ │       │
│  │ userId           │  │ postId       │ │ createdAt      │ │       │
│  │ type             │  │ authorId     │ │ (IMMUTABLE!)   │ │       │
│  │ title            │  │ lastViewedAt │ └──────────────────┘       │
│  │ message          │  └──────────────┘                              │
│  │ postId           │                                                │
│  │ read             │  ┌──────────────┐                             │
│  │ createdAt        │  │ userTags     │                             │
│  └──────────────────┘  ├──────────────┤                             │
│                        │ id           │                             │
│                        │ companyId    │                             │
│                        │ name         │                             │
│                        │ label        │                             │
│                        │ priority     │                             │
│                        │ color        │                             │
│                        │ createdAt    │                             │
│                        └──────────────┘                             │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│           FIRESTORE SECURITY RULES (Database-Level Access Control)  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Helper Functions:                                           │   │
│  │ • isAuthenticated() - Check auth.uid exists               │   │
│  │ • isSuperAdmin() - Check role == 'super_admin'            │   │
│  │ • isCompanyAdmin(companyId) - Check role & company match  │   │
│  │ • isSameCompany(companyId) - Enforce company isolation    │   │
│  │ • isOwner(authorId) - Check request.auth.uid == authorId  │   │
│  │ • isAdmin() - Check for any admin role                    │   │
│  │                                                             │   │
│  │ Rule Examples:                                             │   │
│  │ • postActivities: READ all in company, CREATE admin only  │   │
│  │ • postActivities: NO UPDATE/DELETE (immutable)            │   │
│  │ • posts: READ all in company, UPDATE by owner/admin       │   │
│  │ • users: READ by self/admin, CREATE/DELETE admin only     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Admin Changes a Post Status (with Audit Trail)

```
USER INTERACTION
    │
    └──→ Admin clicks "Change Status" in AdminActionPanel
            │
            ├──→ React component state updates: setStatus()
            │
            └──→ Calls: updatePostStatus(postId, newStatus, adminUser, comment)
                            │
                            ├───────────────────────────────────────┐
                            │                                       │
                    POSTMANAGEMENTSERVICE.JS                       │
                            │                                       │
                            ├──→ [1] UPDATE POST DOCUMENT           │
                            │    updateDoc(db, 'posts', postId, {   │
                            │      status: newStatus,               │
                            │      updatedAt: serverTimestamp(),    │
                            │      lastUpdatedBy: adminName,        │
                            │      lastUpdatedById: adminId         │
                            │    })                                 │
                            │                                       │
                            ├──→ [2] LOG ACTIVITY (⭐ AUDIT)        │
                            │    logPostActivity(                   │
                            │      postId,                          │
                            │      STATUS_CHANGED,                  │
                            │      {                                │
                            │        adminId,                       │
                            │        adminName,                     │
                            │        oldStatus,                     │
                            │        newStatus,                     │
                            │        comment                        │
                            │      }                                │
                            │    )                                  │
                            │    │                                  │
                            │    └──→ addDoc(                       │
                            │         db,                           │
                            │         'postActivities',             │
                            │         activityData                  │
                            │       )                               │
                            │                                       │
                            ├──→ [3] NOTIFY AUTHOR                 │
                            │    notifyAuthor(                      │
                            │      postData,                        │
                            │      STATUS_CHANGED,                  │
                            │      {status, adminName, comment}    │
                            │    )                                  │
                            │    │                                  │
                            │    └──→ createNotification(           │
                            │         {userId, type, message, ...} │
                            │       )                               │
                            │                                       │
                            └───────────────────────────────────────┘
                                        │
                                        ↓
                            FIRESTORE WRITES
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
        ↓                               ↓                               ↓
    /posts                        /postActivities              /notifications
    {                              {                            {
      id: "abc123"                   id: "auto"                 id: "auto"
      status: "in_progress"  ←────   postId: "abc123"           userId: userId
      updatedAt: NOW                 type: "status_changed"     type: "status_changed"
      lastUpdatedBy: "Admin Name"    metadata: {                title: "Post status..."
      lastUpdatedById: "admin123"      adminId: "admin123"      message: "Status changed to..."
      ...other fields...               adminName: "Admin Name"  read: false
    }                                oldStatus: "open"         createdAt: NOW
                                    newStatus: "in_progress"  }
                                    comment: "..."
                                  }
                                  createdAt: NOW
                                  (IMMUTABLE - no updates/deletes)
                                }

QUERY & DISPLAY
        │
        └──→ Component calls getPostActivityTimeline(postId)
                │
                ├──→ Query postActivities collection
                │    WHERE postId == "abc123"
                │    ORDER BY createdAt DESC
                │
                ├──→ Returns array of activity objects
                │
                └──→ Component renders timeline showing all changes
                     (Status changed from "open" to "in_progress")
                     (Changed by "Admin Name" at specific timestamp)
```

---

## Key Audit Trail Features (Current Implementation)

```
WHAT'S BEING TRACKED:
✅ Post status changes      (with old/new values)
✅ Priority changes         (with old/new values)
✅ Post assignments         (to user/department, with assignee info)
✅ Assignment removal       (unassign events)
✅ Due date changes         (set/change/clear)
✅ Admin comments           (public comments on posts)
✅ Admin user info          (who made the change)
✅ Timestamp               (when the change occurred)
✅ Change metadata         (context-specific details)

IMMUTABILITY:
✅ postActivities collection is write-once, never updated or deleted
✅ Prevents tampering with audit trail
✅ Ensures compliance-ready audit logs

WHAT'S NOT YET TRACKED:
❌ User login/logout events
❌ User creation/deletion
❌ Role/permission changes
❌ Data exports
❌ Search queries
❌ Comment creation/deletion
❌ Like/reaction events
❌ Access to sensitive data
❌ IP addresses / device info
❌ Session information
```

---

## Integration Points for Enhanced Audit History

```
To extend audit history coverage, you can:

1. Create new activity types in constants.js
   postActivityType.COMMENT_CREATED
   postActivityType.COMMENT_DELETED
   postActivityType.REACTION_ADDED
   postActivityType.REACTION_REMOVED

2. Add audit logging calls in postManagementService.js
   After comment operations: logPostActivity()
   After like operations: logPostActivity()

3. Create system audit logging for non-post actions
   New service: systemAuditService.js
   New collection: systemAuditLogs
   Track: user login, role changes, data exports

4. Build admin dashboard to view audit logs
   New component: AuditLogViewer.jsx
   New page: /admin/audit-logs
   Features: search, filter, export

5. Add retention policies (future)
   Cloud Functions to archive old logs
   Configurable retention periods
```

