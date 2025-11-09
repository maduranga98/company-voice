# Company Voice Platform - Codebase Architecture Analysis

## Executive Summary

The Company Voice Platform is a **React-based employee feedback and engagement system** built on **Firebase (Firestore)** with role-based access control, post management workflows, and real-time data synchronization.

---

## 1. PROJECT STRUCTURE OVERVIEW

### Technology Stack
- **Frontend**: React 19.1.1 with Vite 7.1.7
- **Styling**: Tailwind CSS 4.1.15 with custom WCAG AA color system
- **Routing**: React Router DOM 6.28.0
- **Backend/Database**: Firebase Firestore + Firebase Auth
- **Encryption**: CryptoJS 4.2.0 (for anonymous post encryption)
- **Internationalization**: i18next + react-i18next
- **Build**: Vite with React plugin

### Directory Structure
```
/home/user/company-voice/
├── src/
│   ├── components/          # Reusable React components
│   ├── pages/               # Page-level components (organized by role/section)
│   │   ├── admin/           # Super admin pages
│   │   ├── company/         # Company admin pages
│   │   ├── employee/        # Employee pages
│   │   └── feed/            # Unified feed components
│   ├── services/            # Business logic & Firestore operations
│   ├── contexts/            # React Context (Auth)
│   ├── config/              # Firebase configuration
│   ├── utils/               # Constants, helpers
│   ├── i18n/                # Internationalization
│   └── assets/              # Images, fonts
├── firestore.rules          # Firestore security rules
└── firebase.json            # Firebase configuration
```

---

## 2. DATABASE MODELS & FIRESTORE SCHEMA

### Collections & Document Structure

#### **users**
```javascript
{
  id: string (uid),
  username: string,
  password: string (hashed with SHA256),
  displayName: string,
  email: string,
  role: "super_admin" | "company_admin" | "hr" | "employee",
  companyId: string,
  departmentId: string,
  userTagId: string,  // Reference to UserTag
  status: "active" | "suspended" | "invited",
  lastLogin: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### **companies**
```javascript
{
  id: string,
  name: string,
  industry: string,
  subscriptionStatus: "active" | "trial" | "suspended" | "cancelled",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### **posts** (Primary content collection)
```javascript
{
  id: string,
  title: string,
  description: string,
  type: "problem_report" | "idea_suggestion" | "creative_content" | "team_discussion",
  status: "open" | "acknowledged" | "in_progress" | "under_review" | "working_on" | "resolved" | "closed" | "rejected" | "not_a_problem",
  priority: "critical" | "high" | "medium" | "low",
  companyId: string,
  authorId: string,  // Encrypted if isAnonymous=true
  isAnonymous: boolean,
  assignedTo: {
    type: "user" | "department",
    id: string,
    name: string,
    assignedAt: timestamp,
    assignedBy: string,
    assignedById: string
  },
  dueDate: timestamp,
  likes: number,
  comments: number,
  views: number,
  lastUpdatedBy: string,
  lastUpdatedById: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### **postActivities** (Activity Timeline - for Audit History)
```javascript
{
  id: string,
  postId: string,
  type: "created" | "status_changed" | "priority_changed" | "assigned" | "unassigned" | "due_date_set" | "due_date_changed" | "admin_comment" | "resolved" | "reopened",
  metadata: {
    // Content varies by activity type
    adminId: string,
    adminName: string,
    oldStatus: string,
    newStatus: string,
    comment: string,
    ...
  },
  createdAt: timestamp
}
```

#### **comments**
```javascript
{
  id: string,
  postId: string,
  text: string,
  authorId: string,
  authorName: string,
  authorRole: string,
  isAdminComment: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### **notifications**
```javascript
{
  id: string,
  userId: string,
  type: "comment" | "reaction" | "mention" | "post_update" | "status_changed" | "priority_changed" | "assigned" | "due_date_reminder" | "admin_comment" | "moderation",
  title: string,
  message: string,
  postId: string,
  read: boolean,
  createdAt: timestamp
}
```

#### **postViews** (Unread tracking)
```javascript
{
  id: string,
  postId: string,
  authorId: string,
  lastViewedAt: timestamp
}
```

#### **departments**
```javascript
{
  id: string,
  name: string,
  companyId: string,
  memberCount: number,
  activeProjects: number,
  isActive: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### **userTags** (User role/level assignments)
```javascript
{
  id: string,
  companyId: string,
  name: "executive" | "senior_manager" | "manager" | "specialist" | "staff",
  label: string,
  priority: number,
  color: string,
  createdAt: timestamp
}
```

---

## 3. SERVICES & BUSINESS LOGIC ORGANIZATION

### **authService.js** (Authentication)
- `loginWithUsernamePassword(username, password)` - Authenticate user
- `getUserById(userId)` - Retrieve user profile
- `checkUsernameExists(username)` - Validate username availability
- `hashPassword(password)` - SHA256 password hashing

**Key Pattern**: Username/password-based auth (not Firebase Auth), storing credentials in Firestore

### **departmentService.js** (Department Management)
- `createDepartment(departmentData, companyId)` - Create new department
- `updateDepartment(departmentId, updates)` - Update department
- `deleteDepartment(departmentId, reassignToDeptId)` - Soft delete with member reassignment
- `getDepartments(companyId)` - Fetch all departments
- `getDepartmentStats(departmentId)` - Get department statistics
- `assignUserToDepartment(userId, departmentId)` - Assign user to department

### **postManagementService.js** (Core Post Management) - **MOST IMPORTANT FOR AUDIT HISTORY**

#### Post Status & Priority Management
- `updatePostStatus(postId, newStatus, adminUser, comment)` - Update post status (logs activity)
- `updatePostPriority(postId, newPriority, adminUser)` - Update post priority (logs activity)

#### Assignment Management
- `assignPost(postId, assignment, adminUser)` - Assign to user/department (logs activity)
- `unassignPost(postId, adminUser)` - Unassign post (logs activity)

#### Timeline & Activity Logging (Existing Audit Mechanism)
- `logPostActivity(postId, activityType, metadata)` - **Core audit function**
  - Creates documents in `postActivities` collection
  - Called after every admin action
  - Non-critical (failures don't break main operations)
- `getPostActivityTimeline(postId, limitCount)` - Retrieve activity history

#### Other Functions
- `setDueDate(postId, dueDate, adminUser)` - Set/update due date (logs activity)
- `addAdminComment(postId, commentText, adminUser)` - Add admin comment (logs activity)
- `checkRateLimit(userId, companyId)` - Rate limiting (10 posts/hour)
- `encryptAuthorId(authorId)` - Encrypt author for anonymous posts
- `decryptAuthorId(encryptedId)` - Decrypt author (admin only)
- `markPostAsViewed(postId, authorId)` - Track post views
- `hasUnreadUpdates(post, authorId)` - Check for unread updates
- `isAdmin(role)` - Helper to check admin permissions

#### Helper Functions
- `createNotification(notificationData)` - Create user notification
- `notifyAuthor(postData, notificationType, metadata)` - Notify post author

---

## 4. API ENDPOINT STRUCTURE & OPERATIONS

The platform uses **Firestore's client-side SDK** (no traditional REST endpoints). Operations are direct Firestore calls:

### Read Operations
```
collection(db, 'posts').where('companyId', '==', companyId).getDocs()
collection(db, 'postActivities').where('postId', '==', postId).getDocs()
collection(db, 'users').doc(userId).get()
```

### Write Operations
```
updateDoc(doc(db, 'posts', postId), {...})  // Update post
addDoc(collection(db, 'postActivities'), {...})  // Log activity
addDoc(collection(db, 'comments'), {...})  // Add comment
```

### Key Firestore Operations Used
- `collection()`, `doc()` - Reference collections/documents
- `query()`, `where()`, `orderBy()`, `limit()` - Build queries
- `getDocs()` - Fetch multiple documents
- `getDoc()` - Fetch single document
- `addDoc()` - Create document with auto ID
- `updateDoc()` - Update existing document
- `serverTimestamp()` - Use server time for consistency
- `writeBatch()` - Atomic multi-document updates
- `increment()` - Atomic field increment

---

## 5. FRONTEND COMPONENT STRUCTURE

### Layout Components
- **RoleBasedLayout.jsx** - Routes content based on user role (employee vs admin)
- **EmployeeLayout.jsx** - Navigation and layout for employees
- **CompanyAdminLayout.jsx** - Navigation and layout for company admins

### Core Content Components
- **Post.jsx** - Individual post display with status/priority badges
- **CommentsSection.jsx** - Comments display and creation
- **CreatePost.jsx** - Post creation form with anonymity toggle
- **AdminActionPanel.jsx** - **KEY COMPONENT** - Admin controls on each post
  - Status dropdown
  - Priority dropdown
  - Assignment selector
  - Due date picker
  - Admin comment box
  - Triggers `logPostActivity()` for all changes

### Feature Components
- **LikeButton.jsx** - Post reaction handling
- **ReactionButton.jsx** - Detailed reaction system
- **DepartmentCard.jsx** - Department display
- **DepartmentModal.jsx** - Department creation/edit modal
- **DepartmentAssignment.jsx** - User-department assignment UI
- **LanguageSwitcher.jsx** - i18n language selection

### Page Components

#### Unified Feed Pages (all users can see)
- **CreativeFeed.jsx** - `/feed/creative` - Creative content
- **ProblemsFeed.jsx** - `/feed/problems` - Problem reports
- **DiscussionsFeed.jsx** - `/feed/discussions` - Team discussions
- **UnifiedFeed.jsx** - Base component with shared filtering/search

#### User Dashboards
- **MyPosts.jsx** - `/my-posts` - User's own posts with unread indicators
- **AssignedToMe.jsx** - `/assigned-to-me` - Posts assigned to user
- **Notifications.jsx** - Notification center

#### Admin Pages
- **CompanyDashboard.jsx** - Company admin overview and quick stats
- **CompanyAnalytics.jsx** - Detailed analytics (posts by type/status, trends, department stats)
- **CompanyManagement.jsx** - Super admin: manage companies and admins
- **MemberManagement.jsx** - Manage company users
- **MemberManagementWithDepartments.jsx** - User management with department assignment
- **DepartmentManagement.jsx** - Manage departments
- **DepartmentDetails.jsx** - View department details and members
- **TagManagement.jsx** - Manage user tags/levels (executive, manager, specialist, etc.)

#### Authentication
- **Login.jsx** - Username/password authentication
- **Register.jsx** - User registration
- **Profile.jsx** - User profile management

---

## 6. AUTHENTICATION & USER MANAGEMENT

### Authentication Flow
1. **Username/Password Auth** (not Firebase Auth)
   - Credentials stored in `users` collection
   - Password hashed with CryptoJS.SHA256
   - Stored in localStorage as `currentUser` JSON

2. **Context-Based State Management**
   - `AuthContext.jsx` provides global auth state
   - `useAuth()` hook for accessing auth in components

3. **Role-Based Access Control**
   ```javascript
   UserRole = {
     SUPER_ADMIN: "super_admin",      // Manage companies
     COMPANY_ADMIN: "company_admin",  // Manage company data
     HR: "hr",                         // Manage employees
     EMPLOYEE: "employee"              // Create posts
   }
   ```

4. **Company Isolation**
   - Each user linked to single company via `companyId`
   - All data queries filtered by `companyId`
   - Firestore rules enforce company boundaries

5. **User Tags/Levels** (for task assignment priority)
   ```javascript
   UserTag = {
     EXECUTIVE,        // Priority 5
     SENIOR_MANAGER,   // Priority 4
     MANAGER,          // Priority 3
     SPECIALIST,       // Priority 2
     STAFF             // Priority 1
   }
   ```

### Session Management
- **Persistent Login**: localStorage maintains `currentUser`
- **Auto-Load**: AuthProvider checks localStorage on app start
- **Logout**: Clears localStorage and auth context

---

## 7. EXISTING LOGGING & TRACKING MECHANISMS

### Post Activity Timeline (Existing Audit System)
The platform already has a **basic audit trail** for posts:

#### postActivities Collection
Captures all admin actions on posts:
- **Activity Types**:
  - `created` - Post created
  - `status_changed` - Status updated
  - `priority_changed` - Priority updated
  - `assigned` - Post assigned
  - `unassigned` - Assignment removed
  - `due_date_set` - Due date created
  - `due_date_changed` - Due date updated
  - `admin_comment` - Admin comment added
  - `resolved` - Post resolved
  - `reopened` - Post reopened

#### Metadata Structure
Each activity stores:
```javascript
{
  postId,
  type,
  metadata: {
    adminId,
    adminName,
    oldStatus,
    newStatus,
    comment,
    // ... type-specific data
  },
  createdAt: serverTimestamp()
}
```

#### Current Implementation
- **Immutable**: No updates/deletes allowed (Firestore rules)
- **Non-Critical**: Logging failures don't break operations
- **Per-Post**: Activities organized by postId
- **Limited Scope**: Only tracks post-level changes, not user actions

### Other Tracking Mechanisms
1. **User Activity**
   - `lastLogin` timestamp on users collection
   - Updated after successful login

2. **Post View Tracking**
   - `postViews` collection tracks author's last view
   - Used for "unread updates" indicator in MyPosts

3. **Notification History**
   - `notifications` collection (per-user, not immutable)
   - Can be marked as read/deleted by user

---

## 8. ARCHITECTURE PATTERNS & BEST PRACTICES OBSERVED

### 1. **Company Isolation Pattern**
- Every major collection has `companyId` field
- All queries filter by company
- Firestore rules enforce at database level

### 2. **Role-Based Access Control**
- Helper functions in Firestore rules:
  - `isSuperAdmin()`
  - `isCompanyAdmin(companyId)`
  - `isSameCompany(companyId)`
  - `isOwner(authorId)`
- JavaScript service functions:
  - `isAdmin(role)` - Check user permission
  - Components conditionally render based on role

### 3. **Audit-Friendly Design**
- `lastUpdatedBy` and `lastUpdatedById` on modifiable documents
- `serverTimestamp()` used consistently for time tracking
- Metadata captured alongside changes in separate collections

### 4. **Data Immutability**
- Post activities cannot be updated/deleted (Firestore rules)
- Comments can only be updated by author (limited fields)
- Ensures audit trail integrity

### 5. **Error Handling Pattern**
- Non-critical operations fail gracefully
- Activity logging doesn't throw errors
- User-facing errors caught and displayed

### 6. **Encryption for Privacy**
- Anonymous posts: Author ID encrypted with CryptoJS.AES
- Decryption only available to admins
- Enables feedback anonymity while allowing investigation

### 7. **Service Layer Abstraction**
- Business logic separated from components
- Services handle Firestore operations
- Components call services and manage UI state
- Makes audit logging centralized and consistent

---

## 9. KEY ARCHITECTURAL CONSIDERATIONS FOR AUDIT HISTORY IMPLEMENTATION

### Current Gaps to Address
1. **No User-Level Audit Trail**
   - Only post activities tracked
   - No logging of: user login/logout, permissions changes, data exports, etc.

2. **Limited Admin Action Context**
   - `postActivities` lacks detailed information about WHY actions were taken
   - No IP address, session info, or detailed change diffs

3. **No Audit Retention/Cleanup Policy**
   - No configurable data retention rules
   - Could grow unbounded

4. **No Audit Search/Reporting UI**
   - postActivities retrieved but not displayed in admin interface
   - No way to generate audit reports

### Opportunities to Extend
1. **Comprehensive Activity Logging**
   - Extend to all user actions (not just posts)
   - User creation/deletion/role changes
   - Login attempts
   - Data access patterns

2. **Enhanced Metadata Collection**
   - Capture IP addresses (requires backend)
   - Include change diffs (before/after values)
   - Add request context (user agent, session ID)

3. **Audit Dashboard**
   - Component to view/filter audit logs
   - Search by user, action type, date range
   - Export functionality

4. **Compliance Features**
   - Immutable storage (append-only)
   - Retention policies
   - Digital signatures
   - Export for compliance audits

### Recommended Implementation Path
1. **Phase 1**: Extend existing `postActivities` to support more action types
2. **Phase 2**: Add new `auditLogs` collection for system-level events
3. **Phase 3**: Create admin audit dashboard
4. **Phase 4**: Add retention policies and compliance features

---

## 10. FIRESTORE SECURITY RULES OVERVIEW

All access controlled at database level:

### Collections with Audit Implications
- **postActivities**: Read by all in company, create by admins only, no updates/deletes
- **notifications**: User-specific, read/write by user and admins
- **posts**: Company-wide read, role-based write/update

### Key Security Patterns
```javascript
// Company isolation
isSameCompany(companyId) returns true only if user's companyId matches

// Admin checks
isAdmin() checks for super_admin, company_admin, or hr roles

// Ownership verification
isOwner(authorId) checks request.auth.uid == authorId

// Immutability enforcement
allow update, delete: if false; // Prevents tampering with audit logs
```

---

## 11. DATA FLOW EXAMPLE: How Admin Status Change Is Audited

```
User Interface (AdminActionPanel)
    ↓
Component calls updatePostStatus(postId, newStatus, adminUser, comment)
    ↓
postManagementService.js
    ↓ (updates post document)
updateDoc(doc(db, 'posts', postId), {
  status: newStatus,
  updatedAt: serverTimestamp(),
  lastUpdatedBy: adminUser.displayName,
  lastUpdatedById: adminUser.id
})
    ↓ (logs activity)
logPostActivity(postId, PostActivityType.STATUS_CHANGED, {
  adminId, adminName, oldStatus, newStatus, comment
})
    ↓
addDoc(collection(db, 'postActivities'), activityData)
    ↓
postActivities collection in Firestore
(immutable, available for audit/reporting)
```

---

## Summary of Audit-Related Infrastructure

| Component | Location | Purpose | Current State |
|-----------|----------|---------|----------------|
| **Activity Logging** | postManagementService.js | Log admin actions on posts | ✅ Implemented |
| **Activity Storage** | postActivities collection | Immutable activity log | ✅ Implemented |
| **User Tracking** | users.lastLogin | Track last login | ✅ Implemented |
| **Change Attribution** | posts.lastUpdatedBy/Id | Know who changed what | ✅ Implemented |
| **Timeline Display** | getPostActivityTimeline() | Retrieve activities | ✅ Implemented |
| **Audit Dashboard** | — | View/filter audit logs | ❌ Not implemented |
| **System Audit Logs** | — | User actions beyond posts | ❌ Not implemented |
| **Retention Policy** | — | Manage log lifecycle | ❌ Not implemented |
| **Export/Report** | — | Compliance reporting | ❌ Not implemented |

