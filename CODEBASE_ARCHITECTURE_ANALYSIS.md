# Company Voice Platform - Comprehensive Architecture Overview

## Executive Summary

The **Company Voice Platform** is a **React-based employee feedback and engagement system** built entirely on **Firebase (Firestore)** as a serverless, real-time database. The project is a **frontend-only application** with no traditional backend server, implementing role-based access control, post management workflows, and comprehensive audit logging.

**Current Status**: The platform focuses on employee voice capture (feedback, complaints, ideas, discussions) with admin management capabilities. NO PAYMENT/BILLING SYSTEM is currently implemented.

---

## 1. PROJECT STRUCTURE & TECHNOLOGY STACK

### Core Technologies
- **Frontend Framework**: React 19.1.1
- **Build Tool**: Vite 7.1.7 (Next-gen bundler)
- **Styling**: Tailwind CSS 4.1.15 with custom WCAG AA color system
- **Routing**: React Router DOM 6.28.0
- **State Management**: React Context API (AuthContext)
- **Database/Backend**: Firebase Firestore (serverless, real-time)
- **Authentication**: Custom username/password (stored in Firestore, not Firebase Auth)
- **Encryption**: CryptoJS 4.2.0 (AES encryption for anonymous posts)
- **Internationalization**: i18next + react-i18next (English, Sinhala)
- **Data Validation**: Firestore Security Rules (RBAC enforcement)

### Project Structure
```
/home/user/company-voice/
├── src/
│   ├── components/               # Reusable React components (14 files)
│   │   ├── AdminActionPanel.jsx  # KEY: Admin controls for post management
│   │   ├── Post.jsx              # Individual post display
│   │   ├── CommentsSection.jsx   # Comments UI
│   │   ├── CreatePost.jsx        # Post creation form
│   │   ├── RoleBasedLayout.jsx   # Conditional routing by user role
│   │   ├── EmployeeLayout.jsx    # Employee navigation
│   │   ├── CompanyAdminLayout.jsx # Admin navigation
│   │   └── ... (other components)
│   │
│   ├── pages/                    # Page-level components (29 files)
│   │   ├── admin/
│   │   │   ├── CompanyManagement.jsx  # Super admin: manage companies
│   │   │   └── AuditLog.jsx           # Audit history viewer
│   │   ├── company/              # Company admin pages
│   │   │   ├── CompanyDashboard.jsx
│   │   │   ├── CompanyAnalytics.jsx
│   │   │   ├── MemberManagement.jsx
│   │   │   ├── DepartmentManagement.jsx
│   │   │   ├── TagManagement.jsx
│   │   │   └── ...
│   │   ├── employee/             # Employee pages
│   │   ├── feed/                 # Unified feed pages
│   │   │   ├── CreativeFeed.jsx
│   │   │   ├── ProblemsFeed.jsx
│   │   │   └── DiscussionsFeed.jsx
│   │   └── ...
│   │
│   ├── services/                 # Business logic & Firestore operations
│   │   ├── authService.js        # Authentication (username/password)
│   │   ├── postManagementService.js  # Core post operations & audit logging
│   │   ├── auditService.js       # System-level audit logging
│   │   └── departmentservice.js  # Department CRUD
│   │
│   ├── contexts/                 # React Context
│   │   └── AuthContext.jsx       # Global auth state
│   │
│   ├── config/                   # Configuration
│   │   └── firebase.js           # Firebase initialization
│   │
│   ├── utils/                    # Utilities
│   │   └── constants.js          # Enums, constants, color system
│   │
│   ├── i18n/                     # Internationalization
│   │   ├── config.js
│   │   └── locales/
│   │       ├── en.json
│   │       └── si.json
│   │
│   └── assets/                   # Static assets
│
├── firestore.rules               # Firestore security rules (RBAC)
├── firebase.json                 # Firebase hosting config
├── vite.config.js               # Vite configuration
├── package.json                 # Dependencies
└── .env.example                 # Environment variables template
```

---

## 2. DATABASE ARCHITECTURE (Firestore)

### Collections Overview

#### **users** - Employee/Admin accounts
```javascript
{
  id: string (document ID),
  username: string (unique, lowercase),
  password: string (SHA256 hashed),
  displayName: string,
  email: string,
  companyId: string (FK to companies),
  departmentId: string (FK to departments, optional),
  userTagId: string (FK to userTags, optional),
  role: "super_admin" | "company_admin" | "hr" | "employee",
  status: "active" | "suspended" | "invited",
  lastLogin: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### **companies** - Organization accounts
```javascript
{
  id: string,
  name: string,
  industry: string,
  subscriptionStatus: "active" | "trial" | "suspended" | "cancelled",
  isActive: boolean,
  employeeCount: number,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### **posts** - Employee feedback/content (Core collection)
```javascript
{
  id: string,
  title: string,
  description: string (rich text/markdown),
  type: "problem_report" | "idea_suggestion" | "creative_content" | "team_discussion",
  status: "open" | "acknowledged" | "in_progress" | "under_review" | "working_on" | 
          "resolved" | "closed" | "rejected" | "not_a_problem",
  priority: "critical" | "high" | "medium" | "low",
  companyId: string (FK),
  authorId: string (encrypted if isAnonymous),
  isAnonymous: boolean,
  assignedTo: {
    type: "user" | "department",
    id: string,
    name: string,
    assignedAt: timestamp,
    assignedBy: string (admin name),
    assignedById: string (admin ID)
  } | null,
  dueDate: timestamp | null,
  likes: number (counter),
  comments: number (counter),
  views: number,
  lastUpdatedBy: string,
  lastUpdatedById: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### **comments** - Post comments
```javascript
{
  id: string,
  postId: string (FK),
  text: string,
  authorId: string,
  authorName: string,
  authorRole: string,
  isAdminComment: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### **postActivities** - Audit trail for posts (Immutable)
```javascript
{
  id: string,
  postId: string (FK),
  type: "created" | "status_changed" | "priority_changed" | "assigned" | 
        "unassigned" | "due_date_set" | "due_date_changed" | "admin_comment" | 
        "resolved" | "reopened",
  metadata: {
    // Content varies by activity type
    adminId: string,
    adminName: string,
    oldStatus: string,
    newStatus: string,
    comment: string,
    assignmentType: "user" | "department",
    assignedToId: string,
    assignedToName: string,
    companyId: string,
    // ... type-specific data
  },
  createdAt: timestamp (serverTimestamp for accuracy)
}
```

#### **systemAuditLogs** - System-level audit logs
```javascript
{
  id: string,
  companyId: string,
  type: "user_login" | "user_logout" | "user_created" | "user_deleted" | 
        "user_suspended" | "user_activated" | "role_changed" | "password_changed" | 
        "profile_updated" | "department_created" | "department_deleted",
  metadata: {
    userId: string,
    userName: string,
    action: string,
    oldValue: any,
    newValue: any,
    // ... type-specific data
  },
  createdAt: timestamp
}
```

#### **notifications** - User notifications
```javascript
{
  id: string,
  userId: string (FK),
  type: "comment" | "reaction" | "mention" | "post_update" | "status_changed" | 
        "priority_changed" | "assigned" | "due_date_reminder" | "admin_comment" | "moderation",
  title: string,
  message: string,
  postId: string (FK, optional),
  read: boolean,
  createdAt: timestamp
}
```

#### **departments** - Company departments
```javascript
{
  id: string,
  name: string,
  icon: string (emoji),
  companyId: string (FK),
  memberCount: number,
  activeProjects: number,
  isActive: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### **userTags** - User role/level assignments
```javascript
{
  id: string,
  companyId: string (FK),
  name: "executive" | "senior_manager" | "manager" | "specialist" | "staff",
  label: string,
  priority: number (1-5),
  color: string,
  bgColor: string,
  icon: string,
  createdAt: timestamp
}
```

#### **postViews** - Post view tracking (for "unread updates")
```javascript
{
  id: string,
  postId: string (FK),
  authorId: string (FK),
  lastViewedAt: timestamp
}
```

---

## 3. AUTHENTICATION & AUTHORIZATION

### Authentication System
- **NOT Firebase Auth** - Uses custom username/password system
- **Storage**: Credentials stored in `users` collection
- **Password Hashing**: CryptoJS SHA256 (one-way hash)
- **Session**: localStorage persistence (`currentUser` JSON)

### Authorization Model
```javascript
// Role hierarchy (highest to lowest)
SUPER_ADMIN    -> Manage companies, system-wide operations
  ↓
COMPANY_ADMIN  -> Manage company data, users, departments
  ↓
HR             -> Manage employees, view sensitive data
  ↓
EMPLOYEE       -> Create posts, view feeds
```

### Access Control Patterns
1. **Company Isolation**: All queries filter by `companyId`
2. **Role-Based Visibility**: Pages render conditionally based on role
3. **Firestore Rules**: Server-side enforcement of permissions
4. **User Tags**: Hierarchical assignment levels (executive, manager, staff, etc.)

### AuthContext
- Provides `useAuth()` hook for global auth state
- Manages `currentUser`, `userData`, `login()`, `logout()`
- Persists across page refreshes via localStorage
- Used by PrivateRoute component for route protection

---

## 4. SERVICES & BUSINESS LOGIC

### **authService.js** - Authentication & User Management
```javascript
loginWithUsernamePassword(username, password)  // Authenticate user
getUserById(userId)                             // Get user profile
checkUsernameExists(username)                  // Validate username
hashPassword(password)                          // SHA256 hashing
```

### **postManagementService.js** - Core Post Operations (LARGEST SERVICE)

#### Post Status Management
```javascript
updatePostStatus(postId, newStatus, adminUser, comment)  // Change status
updatePostPriority(postId, newPriority, adminUser)      // Change priority
```

#### Assignment Management
```javascript
assignPost(postId, assignment, adminUser)     // Assign to user/dept
unassignPost(postId, adminUser)                // Remove assignment
setDueDate(postId, dueDate, adminUser)         // Set due date
```

#### Audit & Activity Logging
```javascript
logPostActivity(postId, activityType, metadata)       // Log admin action
getPostActivityTimeline(postId, limitCount)           // Get activity history
```

#### Admin Operations
```javascript
addAdminComment(postId, commentText, adminUser)       // Add admin comment
markPostAsViewed(postId, authorId)                    // Track views
hasUnreadUpdates(post, authorId)                      // Check unread flag
```

#### Utility Functions
```javascript
encryptAuthorId(authorId)                     // Encrypt for anonymous posts
decryptAuthorId(encryptedId)                  // Decrypt (admin only)
checkRateLimit(userId, companyId)             // Rate limit check (10 posts/hour)
getUserPosts(userId, companyId, postType)     // Get user's posts
getCompanyDepartments(companyId)              // Fetch departments
isAdmin(role)                                  // Role check helper
```

### **auditService.js** - System-Level Audit Logging
```javascript
logSystemActivity(companyId, activityType, metadata)    // Log system action
getCompanyAuditLog(companyId, options)                  // Get all audit logs
getPostActivities(companyId, options)                   // Get post activities
getSystemActivities(companyId, options)                 // Get system activities
```

### **departmentService.js** - Department Management
```javascript
createDepartment(departmentData, companyId)   // Create department
updateDepartment(departmentId, updates)       // Update department
deleteDepartment(departmentId, reassignToDeptId)  // Soft delete
getDepartments(companyId)                     // Fetch departments
getDepartmentStats(departmentId)              // Get statistics
assignUserToDepartment(userId, departmentId)  // Assign user
```

---

## 5. API STRUCTURE & DATA PATTERNS

### No Traditional REST API
- **Direct Firestore Queries**: All operations are client-side Firestore SDK calls
- **No Express/Node Backend**: Firebase Firestore handles all persistence
- **Real-Time Syncing**: Firestore listeners for live updates
- **Client-Side Validation**: Firestore rules enforce at database level

### Common Query Patterns
```javascript
// Read single document
getDoc(doc(db, "users", userId))

// Query collection
getDocs(query(collection(db, "posts"), 
  where("companyId", "==", companyId),
  where("status", "==", "open"),
  orderBy("createdAt", "desc"),
  limit(50)
))

// Create document
addDoc(collection(db, "posts"), postData)

// Update document
updateDoc(doc(db, "posts", postId), updates)

// Atomic operations
writeBatch(db)
increment(1)
serverTimestamp()
```

### Rate Limiting
- **Enforced**: In Firestore rules (simplified check)
- **Actual Limit**: 10 posts per hour per user (checked in postManagementService.js)
- **Implementation**: Query posts from last hour, count them

---

## 6. COMPONENT ARCHITECTURE

### Layout Components (Navigation & Structure)
- **RoleBasedLayout.jsx**: Conditional layout based on user role
- **EmployeeLayout.jsx**: Bottom nav for mobile, sidebar for desktop
- **CompanyAdminLayout.jsx**: Admin navigation with management options
- **PrivateRoute.jsx**: Route protection wrapper

### Content Components
- **Post.jsx**: Individual post display with metadata and reactions
- **CommentsSection.jsx**: Comment list and comment creation
- **CreatePost.jsx**: Post creation form with title/description/type/anonymity
- **AdminActionPanel.jsx**: **KEY COMPONENT** - Admin controls:
  - Status dropdown (8 statuses)
  - Priority selector (4 levels)
  - Assignment (user/department with search)
  - Due date picker
  - Admin comment box

### Feature Components
- **LikeButton.jsx**: Simple like/unlike toggle
- **ReactionButton.jsx**: Multi-reaction system (like, love, celebrate, support, insightful, concerned)
- **DepartmentCard.jsx**: Department display card
- **DepartmentModal.jsx**: Department creation/edit modal
- **DepartmentAssignment.jsx**: Assign users to departments
- **LanguageSwitcher.jsx**: i18n language selection

### Page Components (29 pages total)

#### Super Admin Pages
- **CompanyManagement.jsx**: Create companies, manage company admins

#### Admin Pages
- **CompanyDashboard.jsx**: Stats overview (posts by status/priority/type)
- **CompanyAnalytics.jsx**: Detailed charts and trends
- **AuditLog.jsx**: View system and post activities
- **MemberManagement.jsx**: User CRUD and role assignment
- **DepartmentManagement.jsx**: Department CRUD
- **TagManagement.jsx**: User tag management
- **CompanyQRCode.jsx**: Generate registration QR codes

#### Employee Pages
- **CreativeFeed.jsx**: Creative content feed
- **ProblemsFeed.jsx**: Problem reports feed
- **DiscussionsFeed.jsx**: Team discussions feed
- **MyPosts.jsx**: User's own posts with status tracking
- **AssignedToMe.jsx**: Posts assigned to user
- **Notifications.jsx**: Notification center

#### Authentication
- **Login.jsx**: Username/password + QR code scanning
- **Register.jsx**: User registration with QR company selection
- **Profile.jsx**: User profile editing

---

## 7. FIRESTORE SECURITY RULES (Role-Based Access Control)

### Rule Architecture
- **Company Isolation**: Helper function `isSameCompany(companyId)` on all queries
- **Role Checks**: `isSuperAdmin()`, `isCompanyAdmin()`, `isAdmin()`
- **Ownership Checks**: `isOwner(authorId)` for document-level access

### Key Rules Summary
```
users/        -> Users can read own profile, company admins can read company users
companies/    -> Only super admin can create/update
posts/        -> All company users can read, create (with rate limit), admins can update all
comments/     -> Company users can read/create, author can edit own
notifications/ -> Users can only access own notifications
postActivities/ -> All company users can read, immutable (no updates/deletes)
departments/  -> Company users can read, admins can create/update/delete
```

---

## 8. STATE MANAGEMENT & DATA FLOW

### Global State (AuthContext)
```javascript
{
  currentUser: {
    id, username, displayName, email, companyId, role, status, lastLogin
  },
  userData: {...},
  loading: boolean,
  login(username, password): Promise<user>,
  logout(): Promise<void>
}
```

### Local Component State
- Form inputs (useState)
- UI state (expanded panels, modals, loading, etc.)
- Fetch results (posts, users, departments, etc.)

### Real-Time Sync
- No real-time listeners currently implemented
- All data fetched on-demand with `getDocs()`
- Manual refresh required for updates

---

## 9. INTERNATIONALIZATION (i18n)

### Supported Languages
- **English (en)**
- **Sinhala (si)**

### Implementation
- **Library**: i18next + react-i18next
- **Configuration**: `/src/i18n/config.js`
- **Locales**: `/src/i18n/locales/{en,si}.json`
- **Detection**: Browser language preference (auto-detect)
- **Usage**: `const { t } = useTranslation()` in components

---

## 10. STYLING & DESIGN SYSTEM

### CSS Framework
- **Tailwind CSS 4.1.15** with Vite integration
- **Custom WCAG AA Compliant Colors**:
  - Primary (Indigo)
  - Success (Emerald Green)
  - Danger (Red)
  - Warning (Amber)
  - Info (Blue)
  - Neutral (Gray)

### Design Tokens
```javascript
COLORS = {
  primary: { main, hover, active, text, light, border },
  success: { ... },
  danger: { ... },
  warning: { ... },
  info: { ... },
  neutral: { ... },
  text: { primary, secondary, tertiary, disabled, inverse },
  background: { primary, secondary, tertiary, dark },
  border: { light, main, dark, darker }
}
```

### Status/Priority Badges
- Color-coded with icons and labels
- Configuration in `constants.js`

---

## 11. CONSTANTS & ENUMS (constants.js)

### User Management
```javascript
UserRole = { SUPER_ADMIN, COMPANY_ADMIN, HR, EMPLOYEE }
UserStatus = { ACTIVE, SUSPENDED, INVITED }
UserTag = { EXECUTIVE, SENIOR_MANAGER, MANAGER, SPECIALIST, STAFF }
```

### Post Management
```javascript
PostType = { PROBLEM_REPORT, IDEA_SUGGESTION, CREATIVE_CONTENT, TEAM_DISCUSSION }
PostStatus = { OPEN, ACKNOWLEDGED, IN_PROGRESS, UNDER_REVIEW, WORKING_ON, RESOLVED, CLOSED, REJECTED, NOT_A_PROBLEM }
PostPriority = { CRITICAL, HIGH, MEDIUM, LOW }
AssignmentType = { USER, DEPARTMENT }
```

### Activity & Audit
```javascript
PostActivityType = { CREATED, STATUS_CHANGED, PRIORITY_CHANGED, ASSIGNED, UNASSIGNED, DUE_DATE_SET, DUE_DATE_CHANGED, ADMIN_COMMENT, RESOLVED, REOPENED }
SystemActivityType = { USER_LOGIN, USER_LOGOUT, USER_CREATED, USER_UPDATED, USER_DELETED, USER_SUSPENDED, USER_ACTIVATED, ROLE_CHANGED, DEPARTMENT_CREATED, DEPARTMENT_UPDATED, DEPARTMENT_DELETED, PASSWORD_CHANGED, PROFILE_UPDATED }
```

### Notifications
```javascript
NotificationType = { COMMENT, REACTION, MENTION, POST_UPDATE, STATUS_CHANGED, PRIORITY_CHANGED, ASSIGNED, DUE_DATE_REMINDER, ADMIN_COMMENT, MODERATION }
ReactionType = { LIKE, LOVE, CELEBRATE, SUPPORT, INSIGHTFUL, CONCERNED }
```

---

## 12. ENVIRONMENT VARIABLES (.env)

```bash
# Firebase Configuration (required)
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID

# Security (required)
VITE_ANONYMOUS_SECRET=<random 32-char key>  # For encrypting anonymous authors

# Application
VITE_ENV=development|staging|production
VITE_DEBUG=true|false
```

---

## 13. BUILD & DEPLOYMENT

### Development
```bash
npm install
npm run dev  # Starts Vite dev server on http://localhost:5173
```

### Production Build
```bash
npm run build  # Builds to /dist
npm run preview # Preview production build
```

### Hosting
- **Firebase Hosting** (`firebase.json`)
- **Deploy**: `firebase deploy`
- **SPA Rewrite**: All routes redirect to `/index.html`

---

## 14. CURRENT GAPS & MISSING FEATURES

### NO PAYMENT/BILLING SYSTEM
- ❌ No Stripe integration
- ❌ No subscription management
- ❌ No invoice generation
- ❌ No payment history
- `subscriptionStatus` field exists in companies collection but unused
- `subscriptionStatus` set to "trial" on company creation, never updated

### NO BACKGROUND JOBS/SCHEDULED TASKS
- ❌ No Firebase Functions configured
- ❌ No cron jobs or scheduled tasks
- ❌ No automated reminders
- ❌ No rate limit enforcement on backend
- Rate limiting only checked in Firestore rules (simplified)

### NO REAL-TIME UPDATES
- ❌ No Firestore listeners (`onSnapshot`)
- ❌ All data fetched on-demand with `getDocs()`
- ❌ Manual refresh required for updates
- No WebSocket or push notifications

### MISSING FEATURES FOR STRIPE INTEGRATION
- ❌ Billing portal integration
- ❌ Customer management
- ❌ Plan/pricing management
- ❌ Invoice generation and tracking
- ❌ Payment method management
- ❌ Subscription upgrade/downgrade
- ❌ Metering/usage-based billing
- ❌ Webhook handling

---

## 15. DATA FLOW EXAMPLE: Updating Post Status

```
1. User (Admin) clicks status dropdown in AdminActionPanel.jsx
   ↓
2. Calls updatePostStatus() from postManagementService.js
   ↓
3. Checks admin permission (isAdmin helper)
   ↓
4. Updates postRef in Firestore
   └─ Firestore rules verify:
      - User is authenticated
      - User is in same company
      - User has admin role
   ↓
5. Logs activity via logPostActivity() (async, non-blocking)
   └─ Creates postActivities document with:
      - postId, type: "status_changed"
      - metadata: adminId, oldStatus, newStatus, comment
      - createdAt: serverTimestamp()
   ↓
6. Notifies post author via notifyAuthor() (if not anonymous)
   └─ Creates notifications document
   ↓
7. Component updates local state and refreshes UI
```

---

## 16. KEY FILES REFERENCE

### Critical for Understanding
- **`/src/services/postManagementService.js`** - 794 lines, core business logic
- **`/src/services/auditService.js`** - Audit logging system
- **`/firestore.rules`** - Security and access control
- **`/src/utils/constants.js`** - All enums and configurations
- **`/src/App.jsx`** - Route definitions and app structure

### Important Components
- **`/src/components/AdminActionPanel.jsx`** - Admin post management UI
- **`/src/contexts/AuthContext.jsx`** - Global authentication state
- **`/src/config/firebase.js`** - Firebase initialization

### Authentication & User Management
- **`/src/services/authService.js`** - Login, username validation
- **`/src/pages/Login.jsx`** - Login UI with QR code scanning
- **`/src/pages/Register.jsx`** - User registration

---

## 17. ARCHITECTURAL PATTERNS OBSERVED

### 1. **Company Isolation**
- Every major collection has `companyId`
- All queries filter by company
- Prevents data leakage between companies

### 2. **Role-Based Access Control (RBAC)**
- Helper functions in Firestore rules
- Role checks in React components
- Server-side enforcement in database rules

### 3. **Activity Logging Pattern**
- Non-blocking async logging
- Immutable audit records
- Metadata-driven activity storage

### 4. **Encryption for Privacy**
- Anonymous authors encrypted with AES
- Only admins can decrypt (with secret key)
- Respects author privacy rights

### 5. **Lazy Loading & On-Demand Data Fetching**
- No real-time listeners
- Fetch data when needed
- Reduces Firestore costs and complexity

### 6. **Context-Based State Management**
- AuthContext for global auth
- Local state for component-level data
- Avoids Redux complexity

---

## 18. READY FOR STRIPE INTEGRATION?

### Current State
- **Frontend-only** React SPA
- **Firestore** for all data persistence
- **No backend API** currently implemented
- **Basic company management** in place

### What Exists
✅ Company model with `subscriptionStatus` field
✅ Role-based access control foundation
✅ Audit logging system for compliance
✅ User and company management pages

### What's Missing for Billing
❌ Stripe API integration
❌ Payment processing backend
❌ Invoice generation
❌ Subscription state management
❌ Usage metering
❌ Webhook handlers
❌ Payment history tracking

---

## Conclusion

The Company Voice Platform is a well-structured, **frontend-only React application** with comprehensive employee feedback management built on Firebase Firestore. The architecture is clean, follows RBAC patterns, and includes audit logging infrastructure. However, **NO payment/billing system exists yet**, making this an ideal starting point for implementing a Stripe-based subscription system.

The next phase should focus on:
1. Designing billing data models (subscriptions, invoices, plans)
2. Creating a payment processing backend (Node.js/Firebase Functions)
3. Implementing Stripe integration
4. Building subscription management UI
5. Adding usage tracking and metering

