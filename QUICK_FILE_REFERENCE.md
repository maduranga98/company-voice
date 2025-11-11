# Quick File Reference Guide

## Critical Project Files

### Core Configuration
- `/src/config/firebase.js` - Firebase app initialization and service exports
- `/firebase.json` - Firebase project configuration
- `/firestore.rules` - Security rules for all collections
- `/.env.example` - Environment variable template

### Database Models (Firestore Schema)
- **Schema Definition**: `/firestore.rules` (lines 1-450)
- **Data Enums**: `/src/utils/constants.js` (all enums and configurations)

### Authentication
- **Context**: `/src/contexts/AuthContext.jsx` - React context for auth state
- **Service**: `/src/services/authService.js` - Login, user lookup, password hashing
- **Login Page**: `/src/pages/Login.jsx`
- **Register Page**: `/src/pages/Register.jsx`

### Post Management
- **Service**: `/src/services/postManagementService.js` - Post CRUD, status, priority, assignment
- **Component**: `/src/components/Post.jsx` - Post display with styling
- **Create**: `/src/components/CreatePost.jsx` & `/src/components/CreatePostEnhanced.jsx`
- **Edit**: `/src/components/EditPost.jsx`
- **Feed**: `/src/pages/feed/UnifiedFeed.jsx` - Main feed with search/filter
- **My Posts**: `/src/pages/MyPosts.jsx`

### Comments
- **Component**: `/src/components/CommentsSection.jsx` - Display and create
- **Enhanced**: `/src/components/CommentsEnhanced.jsx` - Advanced features
- **Collection**: `comments/{commentId}` in Firestore

### Notifications
- **Page**: `/src/pages/Notifications.jsx` - Notification display and filtering
- **Collection**: `notifications/{notificationId}` in Firestore
- **Service**: Create via postManagementService.js (integrated)

### Content Moderation
- **Service**: `/src/services/moderationService.js` - Reports, strikes, restrictions
- **Dashboard**: `/src/pages/ModerationDashboard.jsx`
- **Report Detail**: `/src/pages/ReportDetailView.jsx`
- **Report Form**: `/src/components/ReportContentModal.jsx`
- **Collection**: `contentReports/{reportId}` in Firestore

### Search
- **Main Search**: `/src/pages/feed/UnifiedFeed.jsx` (lines 60-80)
- **Audit Search**: `/src/services/auditService.js` - searchAuditLogs()
- **Mention Search**: `/src/services/mentionsService.js` - searchUsersForMention()

### Mentions (@mentions)
- **Service**: `/src/services/mentionsService.js`
- **Editor**: `/src/components/RichTextEditor.jsx` - Autocomplete implementation
- **Functions**: parseMentions(), extractMentionedUsernames(), searchUsersForMention()

### Drafts & Scheduling
- **Service**: `/src/services/postEnhancementsService.js`
- **Page**: `/src/pages/DraftsPage.jsx`
- **Scheduled**: `/src/pages/ScheduledPostsPage.jsx`
- **Functions**: saveDraft(), publishDraft(), schedulePost()

### Templates
- **Service**: `/src/services/postTemplatesService.js`
- **Page**: `/src/pages/TemplatesPage.jsx`
- **Functions**: getTemplates(), createTemplate(), cloneTemplate()

### Departments
- **Service**: `/src/services/departmentservice.js`
- **Page**: `/src/pages/company/DepartmentManagement.jsx`
- **Component**: `/src/components/DepartmentCard.jsx`
- **Detail Page**: `/src/pages/company/DepartmentDetails.jsx`

### Audit & Activity Logs
- **Service**: `/src/services/auditService.js`
- **Page**: `/src/pages/admin/AuditLog.jsx`
- **Collections**: 
  - `postActivities/{activityId}` - Post-related activities
  - `systemAuditLogs/{logId}` - System-level audit trail

### Billing
- **Frontend Service**: `/src/services/billingService.js`
- **Dashboard**: `/src/pages/company/CompanyBilling.jsx`
- **Admin Dashboard**: `/src/pages/admin/BillingDashboard.jsx`
- **Backend API**: `/functions/api/companyAdminApi.js` - Company billing functions
- **Super Admin API**: `/functions/api/superAdminApi.js` - Platform billing functions
- **Services**:
  - `/functions/services/subscriptionService.js`
  - `/functions/services/invoiceService.js`
  - `/functions/services/paymentService.js`
  - `/functions/services/usageTrackingService.js`

### Admin Features
- **Super Admin**: `/src/pages/admin/CompanyManagement.jsx`
- **Billing Admin**: `/src/pages/admin/BillingDashboard.jsx`
- **Company Admin**: `/src/pages/company/CompanyDashboard.jsx`
- **Member Management**: `/src/pages/company/MemberManagement.jsx`
- **Analytics**: `/src/pages/company/CompanyAnalytics.jsx`

### Layouts & Routing
- **Main App**: `/src/App.jsx` - All routes defined
- **Employee Layout**: `/src/components/EmployeeLayout.jsx`
- **Admin Layout**: `/src/components/CompanyAdminLayout.jsx`
- **Role-Based**: `/src/components/RoleBasedLayout.jsx`
- **Protected Route**: `/src/components/PrivateRoute.jsx`

### Backend Cloud Functions
- **Entry Point**: `/functions/index.js`
- **Company API**: `/functions/api/companyAdminApi.js`
- **Super Admin API**: `/functions/api/superAdminApi.js`
- **Stripe Webhook**: `/functions/webhooks/stripeWebhook.js`
- **Scheduled Jobs**: `/functions/scheduled/billingJobs.js`

### Utilities & Constants
- **Constants**: `/src/utils/constants.js` - All enums, color configs
- **Helpers**: `/functions/utils/helpers.js` - Backend utilities

### UI Components Reference

| Component | File | Purpose |
|-----------|------|---------|
| Post | `/src/components/Post.jsx` | Display single post |
| CreatePost | `/src/components/CreatePost.jsx` | Create new post modal |
| CreatePostEnhanced | `/src/components/CreatePostEnhanced.jsx` | Advanced post creation |
| EditPost | `/src/components/EditPost.jsx` | Edit existing post |
| CommentsSection | `/src/components/CommentsSection.jsx` | Display comments |
| CommentsEnhanced | `/src/components/CommentsEnhanced.jsx` | Advanced comments |
| AdminActionPanel | `/src/components/AdminActionPanel.jsx` | Bulk admin actions |
| BulkActionsPanel | `/src/components/BulkActionsPanel.jsx` | Batch operation UI |
| ReactionButton | `/src/components/ReactionButton.jsx` | Reaction emoji selector |
| LikeButton | `/src/components/LikeButton.jsx` | Like/unlike button |
| PostActions | `/src/components/PostActions.jsx` | Post action buttons |
| ReportContentModal | `/src/components/ReportContentModal.jsx` | Report submission |
| RichTextEditor | `/src/components/RichTextEditor.jsx` | Rich text editor |
| DepartmentCard | `/src/components/DepartmentCard.jsx` | Department display |
| DepartmentAssignment | `/src/components/DepartmentAssignment.jsx` | Assign to dept |
| DepartmentModal | `/src/components/DepartmentModal.jsx` | Create/edit dept |
| UserRestrictionBanner | `/src/components/UserRestrictionBanner.jsx` | Restriction display |
| LanguageSwitcher | `/src/components/LanguageSwitcher.jsx` | i18n language toggle |

## Common Development Tasks

### Add a New Post Feature
1. Update `/src/utils/constants.js` (enums)
2. Update `/firestore.rules` (security)
3. Create service function in `/src/services/postManagementService.js`
4. Create/update component in `/src/components/`
5. Add routes in `/src/App.jsx`

### Add a Notification Type
1. Add to `NotificationType` enum in `/src/utils/constants.js`
2. Update notification creation in service
3. Add display logic in `/src/pages/Notifications.jsx`
4. Add icon/styling in notification display

### Add Search Functionality
1. Implement search in service (e.g., `auditService.js`)
2. Add search filter to component/page
3. Test with firestore.rules compliance

### Add New Admin Function
1. Create in `/functions/api/companyAdminApi.js` or `/functions/api/superAdminApi.js`
2. Export in `/functions/index.js`
3. Create frontend service wrapper in `/src/services/`
4. Create page/component in `/src/pages/` or `/src/components/`

## File Sizes & Line Counts

Large Components (>20KB):
- AdminActionPanel.jsx (23KB) - Bulk admin actions
- CreatePostEnhanced.jsx (26KB) - Advanced post creation
- BillingDashboard.jsx (36KB) - Billing management

Critical Services:
- postManagementService.js - Core post operations
- moderationService.js - Content moderation
- auditService.js - Activity logging
- billingService.js - Billing operations

## Dependencies

### Frontend (package.json)
- React 19.1.1
- React Router 6.28
- Tailwind CSS 4.1.15
- Firebase 12.4.0
- i18next (i18n)
- Crypto-JS (encryption)
- Stripe React

### Backend (functions/package.json)
- Firebase Functions 5.0.0
- Firebase Admin 12.0.0
- Stripe 17.5.0

## Important Variables/Secrets

Environment Variables (.env):
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_ANONYMOUS_SECRET (for post encryption)

Stripe Configuration:
- Stripe API keys in `/functions/config/stripe.js`

## Data Schemas Quick Reference

### Post Status Workflow
open → acknowledged → in_progress → under_review → working_on → resolved
                                                  → closed
                                                  → rejected
                                                  → not_a_problem

### Priority Levels
1. critical (red)
2. high (orange)
3. medium (yellow)
4. low (gray)

### User Roles
- super_admin (platform-wide)
- company_admin (company-level)
- hr (can moderate)
- employee (regular user)

### Strike System
- Strike 1: Warning
- Strike 2: 7-day restriction
- Strike 3: 30-day suspension

## Testing Key Scenarios

1. **Search Filtering**: UnifiedFeed.jsx filterPosts() function
2. **Rate Limiting**: postManagementService.js checkRateLimit()
3. **Moderation**: moderationService.js issueStrike()
4. **Billing**: billingService.js and Cloud Functions
5. **Notifications**: Real-time listeners in pages
6. **Access Control**: firestore.rules security functions

