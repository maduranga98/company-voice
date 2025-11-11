# Search & Filtering and Notification System

This document describes the enhanced Search & Filtering and Notification System features added to the Company Voice platform.

## Table of Contents

1. [Search & Filtering](#search--filtering)
2. [Notification System](#notification-system)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Components](#frontend-components)
5. [Usage Examples](#usage-examples)
6. [Security Rules](#security-rules)

---

## Search & Filtering

### Overview

The advanced search system provides comprehensive search capabilities across posts and comments with sophisticated filtering options.

### Features

#### 1. Full-Text Search
- Search across post titles, content, and tags
- Optional search within comments
- Multi-keyword search support
- Case-insensitive matching

#### 2. Advanced Filters
- **Type Filter**: Filter by post type (problem_report, idea_suggestion, creative_content, team_discussion)
- **Status Filter**: Filter by status (open, in_review, in_progress, resolved, closed)
- **Priority Filter**: Filter by priority level (urgent, high, medium, low)
- **Department Filter**: Filter by department
- **Date Range Filter**: Filter posts by creation date range
- **Anonymous Filter**: Filter anonymous vs. named posts

#### 3. Saved Searches (Admin Only)
- Save frequently used search queries
- Track usage count and last used timestamp
- Quick access to saved searches
- Share searches across company admins

#### 4. Search Analytics (Admin Only)
- Track search queries and patterns
- Monitor popular search terms
- Analyze filter usage statistics
- View search trends over time

### Backend API

#### Functions

All search functions are Firebase Cloud Functions accessible via `httpsCallable`.

##### `advancedSearch`

Performs advanced search with filters.

**Parameters:**
```javascript
{
  query: string,              // Search query
  searchInComments: boolean,  // Include comments in search
  filters: {
    department?: string,
    type?: string,
    status?: string,
    priority?: string,
    isAnonymous?: boolean,
    startDate?: string,
    endDate?: string
  },
  page: number,               // Page number (default: 1)
  limit: number,              // Results per page (default: 20)
  sortBy: string,             // Sort field (default: 'createdAt')
  sortOrder: string           // 'asc' or 'desc' (default: 'desc')
}
```

**Returns:**
```javascript
{
  success: boolean,
  results: Post[],
  commentResults: Comment[],
  pagination: {
    total: number,
    page: number,
    limit: number,
    totalPages: number,
    hasMore: boolean
  }
}
```

##### `saveSearch`

Save a search for quick access (admin only).

**Parameters:**
```javascript
{
  name: string,
  query: string,
  filters: object,
  searchInComments: boolean
}
```

##### `getSavedSearches`

Get user's saved searches (admin only).

**Returns:**
```javascript
{
  success: boolean,
  searches: SavedSearch[]
}
```

##### `deleteSavedSearch`

Delete a saved search.

**Parameters:**
```javascript
{
  searchId: string
}
```

##### `useSavedSearch`

Update last used timestamp for a saved search.

**Parameters:**
```javascript
{
  searchId: string
}
```

##### `getSearchAnalytics`

Get search analytics (admin only).

**Parameters:**
```javascript
{
  startDate?: Date,
  endDate?: Date,
  limit?: number  // default: 100
}
```

**Returns:**
```javascript
{
  success: boolean,
  analytics: SearchAnalytic[],
  topQueries: Array<{query: string, count: number}>,
  filterStats: object,
  totalSearches: number
}
```

### Frontend Service

#### `searchService.js`

Located at: `/src/services/searchService.js`

**Available Functions:**
- `advancedSearch(params)` - Perform advanced search
- `saveSearch(name, query, filters, searchInComments)` - Save a search
- `getSavedSearches()` - Get saved searches
- `deleteSavedSearch(searchId)` - Delete a search
- `useSavedSearch(searchId)` - Mark search as used
- `getSearchAnalytics(params)` - Get analytics

### UI Components

#### `AdvancedSearch.jsx`

Located at: `/src/components/AdvancedSearch.jsx`

**Props:**
- `onResultsChange` - Callback when search results change
- `initialFilters` - Initial filter values

**Features:**
- Search bar with real-time search
- Collapsible advanced filters panel
- Saved searches dropdown (admin)
- Save current search dialog (admin)
- Pagination controls
- Clear filters button

**Usage:**
```jsx
import AdvancedSearch from './components/AdvancedSearch';

function MyPage() {
  const handleResultsChange = (posts, comments) => {
    console.log('Search results:', posts, comments);
  };

  return (
    <AdvancedSearch
      onResultsChange={handleResultsChange}
      initialFilters={{ type: 'problem_report' }}
    />
  );
}
```

---

## Notification System

### Overview

A comprehensive notification system with in-app notifications, email digests, and granular user preferences.

### Features

#### 1. In-App Notifications
- Real-time notification updates
- Unread badge counts
- Notification types:
  - Comments on your posts
  - Reactions to your posts
  - Mentions (@username)
  - Status changes
  - Priority changes
  - New posts in department
  - Assignments
  - Department updates
  - System announcements

#### 2. Notification Center
- Slide-out panel interface
- Filter by read/unread
- Mark as read/unread
- Bulk actions
- Delete notifications
- Navigate to related content

#### 3. Notification Preferences
- Granular in-app notification settings
- Email notification toggle
- Immediate email alerts for critical events
- Daily digest option
- Weekly digest option
- Customizable digest schedule
- Timezone support

#### 4. Email Digests
- Daily digest (configurable time)
- Weekly digest (configurable day)
- Beautiful HTML email templates
- Grouped notifications by type
- Company activity statistics (weekly)
- Direct links to notifications

#### 5. Notification History
- Full-page notification view
- Filter by type
- Search through notifications
- Bulk management
- Notification timestamps

### Backend API

#### Functions

##### `getNotificationPreferences`

Get user's notification preferences.

**Returns:**
```javascript
{
  success: boolean,
  preferences: {
    userId: string,
    inApp: {
      comments: boolean,
      reactions: boolean,
      mentions: boolean,
      statusChanges: boolean,
      priorityChanges: boolean,
      newPosts: boolean,
      assignedToYou: boolean,
      departmentUpdates: boolean,
      systemAnnouncements: boolean
    },
    email: {
      enabled: boolean,
      weeklyDigest: boolean,
      dailyDigest: boolean,
      immediate: {
        mentions: boolean,
        assignedToYou: boolean,
        statusChanges: boolean
      }
    },
    digestSchedule: {
      weeklyDay: string,      // 'monday', 'tuesday', etc.
      dailyTime: string,      // '09:00' (24h format)
      timezone: string        // 'UTC', 'America/New_York', etc.
    }
  }
}
```

##### `updateNotificationPreferences`

Update notification preferences.

**Parameters:**
```javascript
{
  preferences: NotificationPreferences
}
```

##### `getNotifications`

Get notifications with pagination.

**Parameters:**
```javascript
{
  limit?: number,        // default: 20
  startAfter?: string,   // Last document ID from previous page
  filter?: string,       // 'all', 'unread', 'read'
  type?: string         // Filter by notification type
}
```

**Returns:**
```javascript
{
  success: boolean,
  notifications: Notification[],
  unreadCount: number,
  hasMore: boolean,
  lastDoc: string
}
```

##### `markNotificationsAsRead`

Mark notifications as read.

**Parameters:**
```javascript
{
  notificationIds?: string[],  // Array of notification IDs
  markAll?: boolean           // Mark all as read
}
```

##### `markNotificationsAsUnread`

Mark notifications as unread.

**Parameters:**
```javascript
{
  notificationIds: string[]
}
```

##### `deleteNotifications`

Delete notifications.

**Parameters:**
```javascript
{
  notificationIds?: string[],
  deleteAll?: boolean
}
```

##### `getUnreadCount`

Get unread notification count.

**Returns:**
```javascript
{
  success: boolean,
  total: number,
  byType: {
    [notificationType]: number
  }
}
```

### Scheduled Jobs

#### `dailyEmailDigestJob`

Runs every hour and sends daily digest emails to users based on their preferred time.

**Schedule:** `0 * * * *` (every hour)

#### `weeklyEmailDigestJob`

Runs daily at 9 AM UTC and sends weekly digest emails to users on their preferred day.

**Schedule:** `0 9 * * *` (daily at 9 AM UTC)

### Frontend Service

#### `notificationService.js`

Located at: `/src/services/notificationService.js`

**Available Functions:**
- `getNotificationPreferences()` - Get preferences
- `updateNotificationPreferences(preferences)` - Update preferences
- `getNotifications(params)` - Get notifications
- `markNotificationsAsRead(ids, markAll)` - Mark as read
- `markNotificationsAsUnread(ids)` - Mark as unread
- `deleteNotifications(ids, deleteAll)` - Delete notifications
- `getUnreadCount()` - Get unread count
- `subscribeToNotifications(userId, callback, options)` - Real-time subscription
- `subscribeToUnreadCount(userId, callback)` - Real-time unread count

### UI Components

#### `NotificationCenter.jsx`

Located at: `/src/components/NotificationCenter.jsx`

**Props:**
- `isOpen` - Whether the notification center is open
- `onClose` - Callback to close the notification center

**Features:**
- Slide-out panel design
- Real-time notification updates
- Unread badge count
- Filter by all/unread/read
- Bulk selection and actions
- Mark as read/unread
- Delete notifications
- Navigate to related content
- Load more pagination

**Usage:**
```jsx
import NotificationCenter from './components/NotificationCenter';

function App() {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <>
      <button onClick={() => setShowNotifications(true)}>
        Notifications
      </button>

      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  );
}
```

#### `NotificationPreferences.jsx`

Located at: `/src/components/NotificationPreferences.jsx`

**Features:**
- In-app notification toggles
- Email notification settings
- Digest schedule configuration
- Timezone selection
- Auto-save with feedback

**Usage:**
```jsx
import NotificationPreferences from './components/NotificationPreferences';

function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <NotificationPreferences />
    </div>
  );
}
```

#### `NotificationHistory.jsx`

Located at: `/src/pages/NotificationHistory.jsx`

**Features:**
- Full-page notification view
- Advanced filtering
- Bulk selection and actions
- Mark all as read
- Delete notifications
- Pagination
- Navigate to related content

**Usage:**
```jsx
import NotificationHistory from './pages/NotificationHistory';

// Add to your router
<Route path="/notifications" element={<NotificationHistory />} />
```

---

## Backend Architecture

### Collections

#### `savedSearches`
```javascript
{
  id: string,
  userId: string,
  companyId: string,
  name: string,
  query: string,
  filters: object,
  searchInComments: boolean,
  createdAt: Timestamp,
  lastUsed: Timestamp,
  useCount: number
}
```

#### `searchAnalytics`
```javascript
{
  id: string,
  userId: string,
  companyId: string,
  query: string,
  filters: object,
  searchInComments: boolean,
  timestamp: Timestamp
}
```

#### `notificationPreferences`
```javascript
{
  userId: string,  // Document ID
  inApp: object,
  email: object,
  digestSchedule: object,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `emailQueue`
```javascript
{
  id: string,
  to: string,
  subject: string,
  html: string,
  createdAt: Timestamp,
  status: 'pending' | 'sent' | 'failed',
  type: 'daily_digest' | 'weekly_digest' | 'immediate'
}
```

---

## Security Rules

### Firestore Rules

All new collections have appropriate security rules:

- **savedSearches**: Users can manage their own searches; admins can view company searches
- **searchAnalytics**: Admin read-only; backend write-only
- **notificationPreferences**: Users can manage their own preferences
- **emailQueue**: Backend-only access

See `/firestore.rules` for complete rules.

---

## Usage Examples

### Example 1: Basic Search

```jsx
import { advancedSearch } from './services/searchService';

async function searchPosts() {
  const results = await advancedSearch({
    query: 'bug report',
    filters: {
      type: 'problem_report',
      status: 'open'
    }
  });

  console.log('Found posts:', results.results);
}
```

### Example 2: Save and Use Search

```jsx
import { saveSearch, useSavedSearch } from './services/searchService';

// Save a search
async function saveMySearch() {
  await saveSearch(
    'Open Bugs',
    'bug',
    { type: 'problem_report', status: 'open' },
    false
  );
}

// Use a saved search
async function useMySearch(searchId) {
  await useSavedSearch(searchId);
  // Then perform the search with the saved parameters
}
```

### Example 3: Subscribe to Notifications

```jsx
import { subscribeToNotifications, subscribeToUnreadCount } from './services/notificationService';

// Subscribe to real-time notifications
const unsubscribe = subscribeToNotifications(
  userId,
  (notifications) => {
    console.log('New notifications:', notifications);
  },
  { limit: 10, unreadOnly: true }
);

// Subscribe to unread count
const unsubscribeCount = subscribeToUnreadCount(
  userId,
  ({ total, byType }) => {
    console.log('Unread count:', total);
  }
);

// Cleanup
return () => {
  unsubscribe();
  unsubscribeCount();
};
```

### Example 4: Update Notification Preferences

```jsx
import { getNotificationPreferences, updateNotificationPreferences } from './services/notificationService';

async function toggleEmailDigest() {
  const prefs = await getNotificationPreferences();

  prefs.email.weeklyDigest = !prefs.email.weeklyDigest;

  await updateNotificationPreferences(prefs);
}
```

---

## Deployment

### Functions Deployment

Deploy the new Cloud Functions:

```bash
cd functions
npm install
firebase deploy --only functions
```

### Security Rules Deployment

Deploy updated Firestore rules:

```bash
firebase deploy --only firestore:rules
```

### Frontend Deployment

Build and deploy the frontend:

```bash
npm install
npm run build
firebase deploy --only hosting
```

---

## Testing

### Test Search Functionality

1. Navigate to the search page
2. Enter a search query
3. Apply various filters
4. Test saving searches (as admin)
5. Test search analytics (as admin)

### Test Notification System

1. Verify in-app notifications appear
2. Test marking as read/unread
3. Test bulk actions
4. Update notification preferences
5. Verify email digest scheduling

---

## Troubleshooting

### Common Issues

#### Search not returning results
- Check that posts exist in Firestore
- Verify user has access to the company
- Check console for errors

#### Notifications not appearing
- Verify notification document exists in Firestore
- Check that user's notification preferences allow the notification type
- Verify real-time listeners are connected

#### Email digests not sending
- Check that Cloud Functions are deployed
- Verify scheduler is running
- Check email queue collection for pending emails
- Ensure user has email notifications enabled

---

## Future Enhancements

### Potential Improvements

1. **Search**
   - Elasticsearch integration for better full-text search
   - Search suggestions/autocomplete
   - Fuzzy matching
   - Search result highlighting

2. **Notifications**
   - Push notifications (mobile)
   - SMS notifications
   - Slack/Teams integration
   - Advanced notification routing

3. **Analytics**
   - Search performance metrics
   - Notification engagement metrics
   - User behavior analytics

---

## Support

For issues or questions:
- Check the codebase documentation
- Review Firestore rules
- Check Cloud Function logs
- Contact the development team

---

## License

Copyright © 2025 Company Voice Platform
