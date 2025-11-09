# Audit History Implementation Guide

This document provides a practical guide for implementing enhanced audit history features that align with the existing Company Voice Platform architecture.

## Quick Start

### 1. Understand the Existing Audit System

The platform **already has a basic audit trail** in place:

- **Collection**: `postActivities` (immutable, append-only)
- **Service**: `logPostActivity()` in `postManagementService.js`
- **Scope**: Tracks admin actions on posts (status, priority, assignment changes)
- **Location**: `/home/user/company-voice/src/services/postManagementService.js` (lines 460-506)

### 2. What's Already Tracked

```
✅ Status changes         - logPostActivity(postId, STATUS_CHANGED, metadata)
✅ Priority changes       - logPostActivity(postId, PRIORITY_CHANGED, metadata)
✅ Post assignments       - logPostActivity(postId, ASSIGNED, metadata)
✅ Assignment removal     - logPostActivity(postId, UNASSIGNED, metadata)
✅ Due date updates       - logPostActivity(postId, DUE_DATE_CHANGED, metadata)
✅ Admin comments         - logPostActivity(postId, ADMIN_COMMENT, metadata)
✅ User attribution       - adminId, adminName in metadata
✅ Timestamps             - createdAt: serverTimestamp()
✅ Immutability           - No updates/deletes allowed by Firestore rules
```

### 3. What Needs to Be Added

Priority order for implementation:

**Phase 1 (Critical)**
- Admin Audit Dashboard to view/search logs
- Timeline display component for existing postActivities

**Phase 2 (High)**
- Extend tracking to comments (create/update/delete)
- Extend tracking to reactions (like/reaction add/remove)
- User action logging (login, logout, role changes)

**Phase 3 (Medium)**
- Audit log filtering and search
- Export functionality (CSV/JSON)
- Retention policies

**Phase 4 (Nice-to-have)**
- Compliance reporting
- IP address tracking (requires backend)
- Session tracking

---

## Implementation Path: Phase 1 - Audit Dashboard

### Step 1: Extend Constants

File: `/home/user/company-voice/src/utils/constants.js`

The `PostActivityType` enum is already defined. Verify these exist:
```javascript
export const PostActivityType = {
  CREATED: "created",
  STATUS_CHANGED: "status_changed",
  PRIORITY_CHANGED: "priority_changed",
  ASSIGNED: "assigned",
  UNASSIGNED: "unassigned",
  DUE_DATE_SET: "due_date_set",
  DUE_DATE_CHANGED: "due_date_changed",
  ADMIN_COMMENT: "admin_comment",
  RESOLVED: "resolved",
  REOPENED: "reopened",
};
```

Add display config for activity types:
```javascript
export const PostActivityTypeConfig = {
  [PostActivityType.STATUS_CHANGED]: {
    label: "Status Changed",
    icon: "📊",
    color: "blue",
  },
  [PostActivityType.PRIORITY_CHANGED]: {
    label: "Priority Changed",
    icon: "⚡",
    color: "orange",
  },
  // ... etc
};
```

### Step 2: Create Audit Service Enhancements

File: `/home/user/company-voice/src/services/postManagementService.js`

The `getPostActivityTimeline()` function already exists. Add these enhancements:

```javascript
/**
 * Get all activities for a company (for audit dashboard)
 * @param {string} companyId - Company ID
 * @param {object} options - Query options {filterType, startDate, endDate, limit}
 * @returns {Promise<Array>}
 */
export const getCompanyActivityLog = async (companyId, options = {}) => {
  try {
    const activitiesRef = collection(db, "postActivities");
    let q = query(
      activitiesRef,
      where("metadata.companyId", "==", companyId), // Add companyId to metadata!
      orderBy("createdAt", "desc"),
      limit(options.limit || 100)
    );

    const snapshot = await getDocs(q);
    const activities = [];

    snapshot.forEach((doc) => {
      activities.push({ id: doc.id, ...doc.data() });
    });

    return activities;
  } catch (error) {
    console.error("Error fetching company activity log:", error);
    return [];
  }
};

/**
 * Search activities by admin user
 */
export const getActivityLogByUser = async (companyId, adminUserId) => {
  try {
    const activitiesRef = collection(db, "postActivities");
    const q = query(
      activitiesRef,
      where("metadata.adminId", "==", adminUserId),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const snapshot = await getDocs(q);
    const activities = [];
    snapshot.forEach((doc) => {
      activities.push({ id: doc.id, ...doc.data() });
    });

    return activities;
  } catch (error) {
    console.error("Error fetching user activity log:", error);
    return [];
  }
};

/**
 * Search activities by type
 */
export const getActivityLogByType = async (companyId, activityType) => {
  try {
    const activitiesRef = collection(db, "postActivities");
    const q = query(
      activitiesRef,
      where("type", "==", activityType),
      where("metadata.companyId", "==", companyId),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const snapshot = await getDocs(q);
    const activities = [];
    snapshot.forEach((doc) => {
      activities.push({ id: doc.id, ...doc.data() });
    });

    return activities;
  } catch (error) {
    console.error("Error fetching activity by type:", error);
    return [];
  }
};
```

### Step 3: Update logPostActivity to Include Company ID

Modify `logPostActivity()` to include `companyId` in metadata for easier filtering:

```javascript
export const logPostActivity = async (postId, activityType, metadata = {}, companyId = null) => {
  try {
    // Get post to get companyId if not provided
    let company = companyId;
    if (!company) {
      const postRef = doc(db, "posts", postId);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        company = postSnap.data().companyId;
      }
    }

    const activityData = {
      postId,
      type: activityType,
      metadata: {
        ...metadata,
        companyId: company,  // Add company ID for filtering
      },
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "postActivities"), activityData);
    return { success: true };
  } catch (error) {
    console.error("Error logging post activity:", error);
    return { success: false };
  }
};
```

### Step 4: Create Audit Timeline Component

File: `/home/user/company-voice/src/components/ActivityTimeline.jsx`

```javascript
import { useState, useEffect } from "react";
import { getPostActivityTimeline } from "../services/postManagementService";
import { PostActivityTypeConfig } from "../utils/constants";
import { useTranslation } from "react-i18next";

const ActivityTimeline = ({ postId, limit = 50 }) => {
  const { t } = useTranslation();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [postId]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const data = await getPostActivityTimeline(postId, limit);
      setActivities(data);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const getActivityConfig = (activityType) => {
    return PostActivityTypeConfig[activityType] || {
      label: activityType,
      icon: "📝",
      color: "gray",
    };
  };

  if (loading) {
    return <div className="text-center py-4">Loading activity timeline...</div>;
  }

  if (activities.length === 0) {
    return <div className="text-center py-4 text-gray-500">No activities recorded yet</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Activity Timeline</h3>
      <div className="space-y-3">
        {activities.map((activity, index) => {
          const config = getActivityConfig(activity.type);
          const meta = activity.metadata || {};

          return (
            <div key={activity.id} className="flex gap-4 pb-4 border-b border-gray-200">
              <div className="flex-shrink-0 text-2xl">{config.icon}</div>
              <div className="flex-grow">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{config.label}</p>
                  <span className="text-sm text-gray-500">{formatDate(activity.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  by <strong>{meta.adminName || "Admin"}</strong>
                </p>
                {meta.comment && (
                  <p className="text-sm text-gray-700 mt-2 italic">"{meta.comment}"</p>
                )}
                {meta.oldStatus && meta.newStatus && (
                  <p className="text-sm text-gray-700 mt-2">
                    Changed from <span className="font-mono bg-gray-100 px-2 py-1 rounded">{meta.oldStatus}</span>
                    {" → "}
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded">{meta.newStatus}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityTimeline;
```

### Step 5: Create Audit Dashboard Page

File: `/home/user/company-voice/src/pages/admin/AuditLog.jsx`

```javascript
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  getCompanyActivityLog,
  getActivityLogByType,
  getActivityLogByUser,
} from "../../services/postManagementService";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { PostActivityType, PostActivityTypeConfig } from "../../utils/constants";

const AuditLog = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    if (!userData?.companyId) {
      navigate("/dashboard");
      return;
    }

    // Fetch admins for filter dropdown
    fetchAdmins();
    fetchActivities();
  }, [userData]);

  const fetchAdmins = async () => {
    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("companyId", "==", userData.companyId),
        where("role", "in", ["company_admin", "hr"])
      );

      const snapshot = await getDocs(q);
      const adminList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAdmins(adminList);
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const data = await getCompanyActivityLog(userData.companyId, {
        limit: 500,
      });
      setActivities(data);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterByType = async (type) => {
    setFilterType(type);
    setLoading(true);
    try {
      if (type === "all") {
        const data = await getCompanyActivityLog(userData.companyId);
        setActivities(data);
      } else {
        const data = await getActivityLogByType(userData.companyId, type);
        setActivities(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterByUser = async (userId) => {
    setFilterUser(userId);
    setLoading(true);
    try {
      if (userId === "all") {
        const data = await getCompanyActivityLog(userData.companyId);
        setActivities(data);
      } else {
        const data = await getActivityLogByUser(userData.companyId, userId);
        setActivities(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const getActivityConfig = (activityType) => {
    return PostActivityTypeConfig[activityType] || {
      label: activityType,
      color: "gray",
    };
  };

  if (loading && activities.length === 0) {
    return <div className="p-6 text-center">Loading audit logs...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Audit Log</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Activity Type
          </label>
          <select
            value={filterType}
            onChange={(e) => handleFilterByType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Activities</option>
            {Object.entries(PostActivityType).map(([key, value]) => (
              <option key={value} value={value}>
                {PostActivityTypeConfig[value]?.label || value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Admin User
          </label>
          <select
            value={filterUser}
            onChange={(e) => handleFilterByUser(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Admins</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {activities.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No activities found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Activity Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Performed By
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Post ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activities.map((activity) => {
                  const config = getActivityConfig(activity.type);
                  const meta = activity.metadata || {};

                  return (
                    <tr key={activity.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(activity.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium text-${config.color}-800 bg-${config.color}-100`}
                        >
                          {config.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {meta.adminName || "Unknown"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                        {activity.postId?.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {meta.oldStatus && meta.newStatus && (
                          <span>
                            {meta.oldStatus} → {meta.newStatus}
                          </span>
                        )}
                        {meta.comment && <span>"{meta.comment.substring(0, 50)}..."</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-600 text-sm">Total Activities</p>
          <p className="text-3xl font-bold text-gray-900">{activities.length}</p>
        </div>
        {Object.entries(PostActivityType).map(([key, type]) => {
          const count = activities.filter((a) => a.type === type).length;
          return count > 0 ? (
            <div key={type} className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-gray-600 text-sm">{PostActivityTypeConfig[type]?.label}</p>
              <p className="text-3xl font-bold text-gray-900">{count}</p>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
};

export default AuditLog;
```

### Step 6: Update Firestore Rules

File: `/home/user/company-voice/firestore.rules`

Ensure postActivities rules allow company-wide querying:

```javascript
match /postActivities/{activityId} {
  // Anyone in the same company can read post activities
  allow read: if isAuthenticated() &&
                 exists(/databases/$(database)/documents/posts/$(resource.data.postId)) &&
                 isSameCompany(get(/databases/$(database)/documents/posts/$(resource.data.postId)).data.companyId);

  // Only admins can create post activities
  allow create: if isAdmin() &&
                   isSameCompany(request.resource.data.metadata.companyId);

  // No updates or deletes allowed (immutable audit trail)
  allow update, delete: if false;
}
```

### Step 7: Add Route

File: `/home/user/company-voice/src/App.jsx`

Add the audit log route:

```javascript
import AuditLog from "./pages/admin/AuditLog";

// In Routes section, add:
<Route
  path="/admin/audit-logs"
  element={
    <PrivateRoute>
      <AuditLog />
    </PrivateRoute>
  }
/>
```

### Step 8: Add Navigation Link

Update your admin navigation to include link to `/admin/audit-logs`.

---

## Phase 2: Extended Activity Tracking

### Add Comment Activity Tracking

Modify the comment creation logic to track comment additions:

```javascript
// After creating comment in postManagementService.js
await addDoc(collection(db, "comments"), commentData);

// Add activity tracking
await logPostActivity(postId, "comment_created", {
  adminId: currentUser.id,
  adminName: currentUser.displayName,
  commentText: commentText.substring(0, 100),
});
```

### Add Reaction Tracking

```javascript
// When creating a like/reaction
await createLike(postId, userId);

// Log activity
await logPostActivity(postId, "reaction_added", {
  userId,
  reactionType: "like",
  timestamp: serverTimestamp(),
});
```

---

## Phase 3: System-Level Audit Logging

Create a new service for non-post activities:

File: `/home/user/company-voice/src/services/auditService.js`

```javascript
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

export const logSystemActivity = async (companyId, eventType, metadata = {}) => {
  try {
    const auditData = {
      companyId,
      eventType, // "user_login", "user_created", "role_changed", etc.
      metadata,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "systemAuditLogs"), auditData);
    return { success: true };
  } catch (error) {
    console.error("Error logging system activity:", error);
    return { success: false };
  }
};

// Track user login
export const logUserLogin = async (userId, companyId) => {
  return logSystemActivity(companyId, "user_login", {
    userId,
    timestamp: serverTimestamp(),
  });
};

// Track user creation
export const logUserCreated = async (companyId, newUserId, createdBy) => {
  return logSystemActivity(companyId, "user_created", {
    newUserId,
    createdById: createdBy.id,
    createdByName: createdBy.displayName,
  });
};

// Track role changes
export const logRoleChange = async (companyId, userId, oldRole, newRole, changedBy) => {
  return logSystemActivity(companyId, "role_changed", {
    userId,
    oldRole,
    newRole,
    changedById: changedBy.id,
    changedByName: changedBy.displayName,
  });
};
```

---

## Testing Checklist

- [ ] Activity logging works after status change
- [ ] Activity logging works after priority change
- [ ] Activity logging works after assignment
- [ ] Activity logging works after due date update
- [ ] Activity logging works after admin comment
- [ ] Activity timeline displays correctly on post detail view
- [ ] Audit dashboard loads and displays activities
- [ ] Filtering by type works
- [ ] Filtering by user works
- [ ] Activity data includes correct metadata
- [ ] Firestore rules prevent tampering with activities
- [ ] Old activities are still accessible

---

## Deployment Considerations

1. **Firestore Indexes**: May need to add indexes for efficient querying of activities
2. **Cost**: Each activity log write costs 1 write operation
3. **Storage**: Monitor storage as activity logs grow
4. **Performance**: Consider pagination for large audit logs

---

## Resources

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [React Context API](https://react.dev/reference/react/useContext)
- [React Router](https://reactrouter.com/)
- [Tailwind CSS](https://tailwindcss.com/)
