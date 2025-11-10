# Company Voice Platform - Quick Reference Guide

## Technology Stack Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER (React)                    │
├─────────────────────────────────────────────────────────────┤
│  React 19.1.1 + Vite 7.1.7 + React Router 6.28.0           │
│  • 14 Reusable Components                                    │
│  • 29 Page Components (admin/company/employee/feed)         │
│  • Tailwind CSS 4.1.15 (WCAG AA color system)             │
│  • i18next (English, Sinhala)                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│               STATE MANAGEMENT & BUSINESS LOGIC              │
├─────────────────────────────────────────────────────────────┤
│  • AuthContext (Global Auth State)                          │
│  • 4 Service Files (auth, post, audit, department)          │
│  • Constants & Enums (55+ configurations)                   │
│  • CryptoJS for encryption/decryption                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  FIRESTORE DATABASE (Backend)                │
├─────────────────────────────────────────────────────────────┤
│  11 Collections:                                            │
│  • users (employees, admins)                                │
│  • companies (organization accounts)                        │
│  • posts (employee feedback/content) - CORE                 │
│  • postActivities (audit trail - IMMUTABLE)                 │
│  • systemAuditLogs (system-level audit)                    │
│  • comments (post comments)                                 │
│  • notifications (user notifications)                       │
│  • departments (company departments)                        │
│  • userTags (employee role levels)                          │
│  • postViews (unread update tracking)                       │
│  ❌ NO PAYMENTS/INVOICES/SUBSCRIPTIONS                     │
├─────────────────────────────────────────────────────────────┤
│  Security: Firestore Rules (RBAC enforcement)               │
│  • Company isolation (all queries filtered by companyId)    │
│  • Role-based access (super_admin, company_admin, hr, emp)  │
│  • Immutable audit logs (no updates/deletes)                │
└─────────────────────────────────────────────────────────────┘
```

## Data Model Relationships

```
┌─────────────────┐
│   companies     │
│  (SaaS tenants) │
└────────┬────────┘
         │ 1:N
         ├──────────────────┬──────────────────┐
         ↓                  ↓                  ↓
    ┌────────┐       ┌──────────────┐   ┌─────────────┐
    │ users  │       │ departments  │   │ userTags    │
    │(N=emp) │◄──────│  (org units) │   │(role levels)│
    └────┬───┘       └──────────────┘   └─────────────┘
         │ 1:N
         │
         ├─────────────────────────────────┐
         ↓                                 ↓
    ┌──────────┐               ┌──────────────────┐
    │  posts   │◄──────────┐   │ postActivities   │
    │ (content)│           │   │   (audit trail)  │
    └────┬─────┘           │   └──────────────────┘
         │ 1:N             │          1:N
         │                 │
         ├──────────┬──────┴──────┬──────────┐
         ↓          ↓             ↓          ↓
    ┌─────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐
    │comments │ │  likes │ │postViews │ │ notify  │
    └─────────┘ └────────┘ └──────────┘ └─────────┘
```

## Role-Based Access Hierarchy

```
SUPER_ADMIN
├── Create/Manage Companies
├── Create Company Admins
├── View all system audit logs
└── Access to system analytics

    COMPANY_ADMIN
    ├── Manage company users & roles
    ├── Create/Update departments
    ├── Assign users to departments
    ├── View company audit logs
    └── Approve/manage user tags
    
        HR
        ├── Manage employees
        ├── View employee profiles
        ├── Update employee departments
        └── View employee activity logs
        
            EMPLOYEE
            ├── Create posts (10/hour limit)
            ├── Comment on posts
            ├── React to posts
            └── View own posts & notifications
```

## Post Workflow States

```
OPEN (created)
    ↓ (admin acknowledges)
ACKNOWLEDGED
    ↓ (assigned to person/dept)
IN_PROGRESS  ←──→  UNDER_REVIEW
    ↓ (forwarded to dept)
WORKING_ON
    ↓ (completed)
RESOLVED
    ↓ (closed)
CLOSED

Alternative paths:
├── REJECTED (invalid/duplicate)
└── NOT_A_PROBLEM (resolved differently)
```

## Key Service Methods Quick Lookup

### Authentication (authService.js)
```javascript
loginWithUsernamePassword(username, password)
getUserById(userId)
checkUsernameExists(username)
hashPassword(password)  // SHA256
```

### Post Management (postManagementService.js) - 794 lines
```javascript
// Status & Priority
updatePostStatus(postId, newStatus, adminUser, comment)
updatePostPriority(postId, newPriority, adminUser)

// Assignment
assignPost(postId, assignment, adminUser)
unassignPost(postId, adminUser)

// Admin Operations
addAdminComment(postId, commentText, adminUser)
setDueDate(postId, dueDate, adminUser)

// Activity Logging (AUDIT TRAIL)
logPostActivity(postId, activityType, metadata)
getPostActivityTimeline(postId, limitCount)

// Encryption & Privacy
encryptAuthorId(authorId)  // For anonymous posts
decryptAuthorId(encryptedId)  // Admin only

// Utilities
checkRateLimit(userId, companyId)  // 10 posts/hour
getUserPosts(userId, companyId, postType)
getCompanyDepartments(companyId)
markPostAsViewed(postId, authorId)
hasUnreadUpdates(post, authorId)
isAdmin(role)
```

### System Audit (auditService.js)
```javascript
logSystemActivity(companyId, activityType, metadata)
getCompanyAuditLog(companyId, options)
getPostActivities(companyId, options)
getSystemActivities(companyId, options)
```

### Department Management (departmentService.js)
```javascript
createDepartment(departmentData, companyId)
updateDepartment(departmentId, updates)
deleteDepartment(departmentId, reassignToDeptId)
getDepartments(companyId)
getDepartmentStats(departmentId)
assignUserToDepartment(userId, departmentId)
```

## Current Feature Set

### What EXISTS (Built & Working)
✅ User Authentication (username/password)
✅ Company Management (create, list companies)
✅ Employee Feedback (posts with 4 types)
✅ Post Status Management (8 statuses)
✅ Post Priority System (4 levels)
✅ Post Assignment (user/department)
✅ Admin Comments & Notes
✅ Activity Timeline (complete audit trail)
✅ Department Management (CRUD)
✅ User Tagging/Leveling (executive, manager, staff, etc.)
✅ Role-Based Access Control (4 roles)
✅ Notification System
✅ Anonymous Post Support (encrypted author IDs)
✅ Rate Limiting (10 posts/hour)
✅ Multi-language Support (English, Sinhala)
✅ Responsive Design (mobile, tablet, desktop)
✅ WCAG AA Accessible Color System

### What's MISSING (⚠️ NOT IMPLEMENTED)
❌ Payment/Billing System (NO Stripe)
❌ Subscription Management (field exists but unused)
❌ Invoice Generation
❌ Payment History
❌ Background Jobs/Firebase Functions
❌ Scheduled Tasks/Cron Jobs
❌ Real-Time Updates (onSnapshot listeners)
❌ Push Notifications
❌ Email Integration
❌ IP Address Tracking (requires backend)
❌ Advanced Analytics (only basic stats)
❌ API Rate Limiting (server-side)
❌ Usage Metering/Metering-Based Billing

## Component Organization

```
src/components/
├── Layout Components
│   ├── RoleBasedLayout.jsx
│   ├── EmployeeLayout.jsx
│   ├── CompanyAdminLayout.jsx
│   └── PrivateRoute.jsx
├── Content Components
│   ├── Post.jsx
│   ├── CommentsSection.jsx
│   ├── CreatePost.jsx
│   └── AdminActionPanel.jsx ⭐ KEY
├── Feature Components
│   ├── LikeButton.jsx
│   ├── ReactionButton.jsx
│   ├── DepartmentCard.jsx
│   ├── DepartmentModal.jsx
│   ├── DepartmentAssignment.jsx
│   └── LanguageSwitcher.jsx

src/pages/
├── admin/
│   ├── CompanyManagement.jsx
│   └── AuditLog.jsx
├── company/ (8 pages)
│   ├── CompanyDashboard.jsx
│   ├── CompanyAnalytics.jsx
│   ├── MemberManagement.jsx
│   ├── DepartmentManagement.jsx
│   ├── TagManagement.jsx
│   └── ...
├── employee/ (3 pages)
├── feed/ (3 unified feeds)
│   ├── CreativeFeed.jsx
│   ├── ProblemsFeed.jsx
│   └── DiscussionsFeed.jsx
├── Auth Pages
│   ├── Login.jsx (with QR scanning)
│   ├── Register.jsx
│   └── Profile.jsx
└── Utility Pages
    ├── MyPosts.jsx
    ├── AssignedToMe.jsx
    └── Notifications.jsx
```

## Database Write Operations (Firestore Billing Impact)

Each operation = Firestore write:

```
User Action                    → Collections Written
──────────────────────────────────────────────────────
Create Post                    → posts, postActivities
Change Post Status            → posts, postActivities, notifications
Change Priority               → posts, postActivities
Assign Post                   → posts, postActivities, notifications
Add Comment                   → comments, posts (increment)
Like/React                    → posts (counter)
Add Admin Comment             → comments, posts, postActivities, notifications
Mark As Viewed               → postViews
User Login                    → users, systemAuditLogs
```

Optimization: No real-time listeners = fewer continuous reads, more predictable costs.

## Important Configuration Files

```
.env                    → Firebase credentials (NOT in git)
.env.example           → Template (safe to commit)
firebase.json          → Firebase hosting config
firestore.rules        → Security rules (RBAC enforcement)
vite.config.js         → Build configuration
package.json           → Dependencies (React, Firebase, Tailwind, etc.)
```

## Development Workflow

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm lint

# Deploy to Firebase
firebase deploy
```

## Environment Setup Checklist

- [ ] Copy `.env.example` to `.env`
- [ ] Add Firebase project credentials to `.env`
- [ ] Generate and add `VITE_ANONYMOUS_SECRET` (32+ char random key)
- [ ] Set `VITE_ENV` (development|staging|production)
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Create initial super admin user in Firestore manually
- [ ] Test authentication flow
- [ ] Verify role-based access works
- [ ] Check audit logging in postActivities collection

## Upcoming: Stripe Billing System Implementation

Required additions:
1. **Data Models**: subscriptions, invoices, billing_cycles, payment_methods
2. **Services**: stripe.js, billing.js, webhook handlers
3. **Pages**: BillingPage, SubscriptionManagement, InvoiceHistory
4. **Components**: StripePaymentForm, SubscriptionCard
5. **Backend**: Firebase Functions for webhook handling
6. **UI**: Pricing page, billing portal integration
7. **Integration**: Stripe API calls, webhook verification, customer sync

---

## Quick Stats

- **Total Lines of Code**: ~3,000 (frontend)
- **Largest Service**: postManagementService.js (794 lines)
- **React Components**: 14 + 29 pages = 43 total
- **Firestore Collections**: 11 (no payment-related)
- **Supported Roles**: 4 (super_admin, company_admin, hr, employee)
- **Post Statuses**: 9 states
- **User Tags**: 5 levels
- **Rate Limit**: 10 posts/hour per user
- **Real-Time Features**: None currently
- **Authentication**: Custom username/password (NOT Firebase Auth)
- **Encryption**: CryptoJS AES for anonymous posts

