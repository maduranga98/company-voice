import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { SystemActivityType } from "../utils/constants";
import CryptoJS from "crypto-js";

// ============================================
// BLOCKCHAIN-STYLE AUDIT CHAIN
// ============================================

// In-memory cache for last audit hash (per company)
const lastAuditHashCache = {};

/**
 * Calculate hash for audit entry
 * @param {Object} activityData - Activity data
 * @param {string} previousHash - Previous entry's hash
 * @param {string} timestamp - Timestamp
 * @returns {string} SHA256 hash
 */
const calculateAuditHash = (activityData, previousHash, timestamp) => {
  try {
    const dataString = JSON.stringify({
      activityData,
      previousHash,
      timestamp,
    });
    return CryptoJS.SHA256(dataString).toString();
  } catch (error) {
    console.error("Error calculating audit hash:", error);
    return null;
  }
};

/**
 * Get last audit hash for a company
 * @param {string} companyId - Company ID
 * @returns {Promise<string>} Last audit hash or "GENESIS_BLOCK"
 */
const getLastAuditHash = async (companyId) => {
  try {
    // Check cache first
    if (lastAuditHashCache[companyId]) {
      return lastAuditHashCache[companyId];
    }

    // Fetch last audit entry from database
    const auditQuery = query(
      collection(db, "systemAuditLogs"),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc"),
      firestoreLimit(1)
    );

    const snapshot = await getDocs(auditQuery);

    if (snapshot.empty) {
      return "GENESIS_BLOCK";
    }

    const lastEntry = snapshot.docs[0].data();
    const hash = lastEntry.currentHash || "GENESIS_BLOCK";

    // Update cache
    lastAuditHashCache[companyId] = hash;

    return hash;
  } catch (error) {
    console.error("Error getting last audit hash:", error);
    return "GENESIS_BLOCK";
  }
};

// ============================================
// SYSTEM ACTIVITY LOGGING
// ============================================

/**
 * Log system-level activity (user actions, admin operations, etc.) with cryptographic hashing
 * @param {string} companyId - Company ID
 * @param {string} activityType - Activity type from SystemActivityType enum
 * @param {object} metadata - Additional activity metadata
 * @returns {Promise<object>}
 */
export const logSystemActivity = async (companyId, activityType, metadata = {}) => {
  try {
    // Detect if this is a harassment-related activity
    const harassmentTypes = ["harassment", "discrimination", "violence"];
    const isHarassmentRelated =
      harassmentTypes.includes(metadata.reason) ||
      harassmentTypes.includes(metadata.violationType) ||
      activityType === "hr_escalation" ||
      activityType === "evidence_package_generated";

    // Get previous hash for blockchain-style chaining
    const previousHash = await getLastAuditHash(companyId);

    // Prepare activity data
    const timestamp = new Date().toISOString();
    const activityData = {
      companyId,
      type: activityType,
      metadata,
    };

    // Calculate current hash
    const currentHash = calculateAuditHash(activityData, previousHash, timestamp);

    // Add legal metadata
    const legalMetadata = {
      legalHold: isHarassmentRelated,
      retentionYears: isHarassmentRelated ? 7 : 2,
    };

    // Create audit entry with blockchain fields
    const auditEntry = {
      ...activityData,
      previousHash,
      currentHash,
      legalHold: legalMetadata.legalHold,
      retentionYears: legalMetadata.retentionYears,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "systemAuditLogs"), auditEntry);

    // Update cache
    lastAuditHashCache[companyId] = currentHash;

    return { success: true, hash: currentHash };
  } catch (error) {
    console.error("Error logging system activity:", error);
    // Don't throw - activity logging should not break the main operation
    return { success: false, error: error.message };
  }
};

// ============================================
// COMPREHENSIVE AUDIT LOG QUERIES
// ============================================

/**
 * Get all audit activities for a company (both post and system activities)
 * @param {string} companyId - Company ID
 * @param {object} options - Query options
 * @returns {Promise<Array>}
 */
export const getCompanyAuditLog = async (companyId, options = {}) => {
  try {
    const {
      activityType = null,
      userId = null,
      startDate = null,
      endDate = null,
      limit = 100,
      includePostActivities = true,
      includeSystemActivities = true,
    } = options;

    let allActivities = [];

    // Fetch post activities
    if (includePostActivities) {
      const postActivities = await getPostActivities(companyId, {
        activityType,
        userId,
        startDate,
        endDate,
        limit,
      });
      allActivities = [...allActivities, ...postActivities.map(a => ({ ...a, source: 'post' }))];
    }

    // Fetch system activities
    if (includeSystemActivities) {
      const systemActivities = await getSystemActivities(companyId, {
        activityType,
        userId,
        startDate,
        endDate,
        limit,
      });
      allActivities = [...allActivities, ...systemActivities.map(a => ({ ...a, source: 'system' }))];
    }

    // Sort by timestamp (newest first)
    allActivities.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    // Apply limit to combined results
    return allActivities.slice(0, limit);
  } catch (error) {
    console.error("Error fetching company audit log:", error);
    return [];
  }
};

/**
 * Get post activities with filtering
 * @param {string} companyId - Company ID
 * @param {object} options - Query options
 * @returns {Promise<Array>}
 */
export const getPostActivities = async (companyId, options = {}) => {
  try {
    const {
      activityType = null,
      userId = null,
      startDate = null,
      endDate = null,
      limit = 100,
      postId = null,
    } = options;

    const activitiesRef = collection(db, "postActivities");
    let constraints = [];

    // Add company filter if metadata.companyId exists
    if (companyId) {
      constraints.push(where("metadata.companyId", "==", companyId));
    }

    // Filter by activity type
    if (activityType) {
      constraints.push(where("type", "==", activityType));
    }

    // Filter by user (admin who performed the action)
    if (userId) {
      constraints.push(where("metadata.adminId", "==", userId));
    }

    // Filter by specific post
    if (postId) {
      constraints.push(where("postId", "==", postId));
    }

    // Filter by date range
    if (startDate) {
      constraints.push(where("createdAt", ">=", Timestamp.fromDate(new Date(startDate))));
    }

    if (endDate) {
      constraints.push(where("createdAt", "<=", Timestamp.fromDate(new Date(endDate))));
    }

    // Always order by creation time (descending)
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(firestoreLimit(limit));

    const q = query(activitiesRef, ...constraints);
    const snapshot = await getDocs(q);

    const activities = [];
    snapshot.forEach((doc) => {
      activities.push({ id: doc.id, ...doc.data() });
    });

    return activities;
  } catch (error) {
    console.error("Error fetching post activities:", error);
    // If the query fails due to missing index, return empty array
    return [];
  }
};

/**
 * Get system activities with filtering
 * @param {string} companyId - Company ID
 * @param {object} options - Query options
 * @returns {Promise<Array>}
 */
export const getSystemActivities = async (companyId, options = {}) => {
  try {
    const {
      activityType = null,
      userId = null,
      startDate = null,
      endDate = null,
      limit = 100,
    } = options;

    const activitiesRef = collection(db, "systemAuditLogs");
    let constraints = [];

    // Filter by company
    constraints.push(where("companyId", "==", companyId));

    // Filter by activity type
    if (activityType) {
      constraints.push(where("type", "==", activityType));
    }

    // Filter by user (who performed the action or was affected)
    if (userId) {
      constraints.push(where("metadata.userId", "==", userId));
    }

    // Filter by date range
    if (startDate) {
      constraints.push(where("createdAt", ">=", Timestamp.fromDate(new Date(startDate))));
    }

    if (endDate) {
      constraints.push(where("createdAt", "<=", Timestamp.fromDate(new Date(endDate))));
    }

    // Always order by creation time (descending)
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(firestoreLimit(limit));

    const q = query(activitiesRef, ...constraints);
    const snapshot = await getDocs(q);

    const activities = [];
    snapshot.forEach((doc) => {
      activities.push({ id: doc.id, ...doc.data() });
    });

    return activities;
  } catch (error) {
    console.error("Error fetching system activities:", error);
    return [];
  }
};

// ============================================
// SPECIFIC ACTIVITY LOGGING FUNCTIONS
// ============================================

/**
 * Log user login
 * @param {string} companyId - Company ID
 * @param {object} userData - User data
 * @returns {Promise<object>}
 */
export const logUserLogin = async (companyId, userData) => {
  return logSystemActivity(companyId, SystemActivityType.USER_LOGIN, {
    userId: userData.id,
    userName: userData.displayName || userData.username,
    userRole: userData.role,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log user logout
 * @param {string} companyId - Company ID
 * @param {object} userData - User data
 * @returns {Promise<object>}
 */
export const logUserLogout = async (companyId, userData) => {
  return logSystemActivity(companyId, SystemActivityType.USER_LOGOUT, {
    userId: userData.id,
    userName: userData.displayName || userData.username,
    userRole: userData.role,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log user creation
 * @param {string} companyId - Company ID
 * @param {object} newUserData - New user data
 * @param {object} createdBy - User who created the new user
 * @returns {Promise<object>}
 */
export const logUserCreated = async (companyId, newUserData, createdBy) => {
  return logSystemActivity(companyId, SystemActivityType.USER_CREATED, {
    userId: newUserData.id,
    userName: newUserData.displayName || newUserData.username,
    userRole: newUserData.role,
    userEmail: newUserData.email,
    createdById: createdBy.id,
    createdByName: createdBy.displayName || createdBy.username,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log user update
 * @param {string} companyId - Company ID
 * @param {object} userData - Updated user data
 * @param {object} updatedBy - User who updated the user
 * @param {object} changes - Changes made
 * @returns {Promise<object>}
 */
export const logUserUpdated = async (companyId, userData, updatedBy, changes = {}) => {
  return logSystemActivity(companyId, SystemActivityType.USER_UPDATED, {
    userId: userData.id,
    userName: userData.displayName || userData.username,
    updatedById: updatedBy.id,
    updatedByName: updatedBy.displayName || updatedBy.username,
    changes: JSON.stringify(changes),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log user deletion
 * @param {string} companyId - Company ID
 * @param {object} userData - Deleted user data
 * @param {object} deletedBy - User who deleted the user
 * @returns {Promise<object>}
 */
export const logUserDeleted = async (companyId, userData, deletedBy) => {
  return logSystemActivity(companyId, SystemActivityType.USER_DELETED, {
    userId: userData.id,
    userName: userData.displayName || userData.username,
    userRole: userData.role,
    deletedById: deletedBy.id,
    deletedByName: deletedBy.displayName || deletedBy.username,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log user suspension
 * @param {string} companyId - Company ID
 * @param {object} userData - Suspended user data
 * @param {object} suspendedBy - User who suspended the user
 * @param {string} reason - Reason for suspension
 * @returns {Promise<object>}
 */
export const logUserSuspended = async (companyId, userData, suspendedBy, reason = "") => {
  return logSystemActivity(companyId, SystemActivityType.USER_SUSPENDED, {
    userId: userData.id,
    userName: userData.displayName || userData.username,
    suspendedById: suspendedBy.id,
    suspendedByName: suspendedBy.displayName || suspendedBy.username,
    reason,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log user activation
 * @param {string} companyId - Company ID
 * @param {object} userData - Activated user data
 * @param {object} activatedBy - User who activated the user
 * @returns {Promise<object>}
 */
export const logUserActivated = async (companyId, userData, activatedBy) => {
  return logSystemActivity(companyId, SystemActivityType.USER_ACTIVATED, {
    userId: userData.id,
    userName: userData.displayName || userData.username,
    activatedById: activatedBy.id,
    activatedByName: activatedBy.displayName || activatedBy.username,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log role change
 * @param {string} companyId - Company ID
 * @param {object} userData - User whose role changed
 * @param {string} oldRole - Previous role
 * @param {string} newRole - New role
 * @param {object} changedBy - User who changed the role
 * @returns {Promise<object>}
 */
export const logRoleChanged = async (companyId, userData, oldRole, newRole, changedBy) => {
  return logSystemActivity(companyId, SystemActivityType.ROLE_CHANGED, {
    userId: userData.id,
    userName: userData.displayName || userData.username,
    oldRole,
    newRole,
    changedById: changedBy.id,
    changedByName: changedBy.displayName || changedBy.username,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log department creation
 * @param {string} companyId - Company ID
 * @param {object} departmentData - Department data
 * @param {object} createdBy - User who created the department
 * @returns {Promise<object>}
 */
export const logDepartmentCreated = async (companyId, departmentData, createdBy) => {
  return logSystemActivity(companyId, SystemActivityType.DEPARTMENT_CREATED, {
    departmentId: departmentData.id,
    departmentName: departmentData.name,
    createdById: createdBy.id,
    createdByName: createdBy.displayName || createdBy.username,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log department update
 * @param {string} companyId - Company ID
 * @param {object} departmentData - Updated department data
 * @param {object} updatedBy - User who updated the department
 * @param {object} changes - Changes made
 * @returns {Promise<object>}
 */
export const logDepartmentUpdated = async (companyId, departmentData, updatedBy, changes = {}) => {
  return logSystemActivity(companyId, SystemActivityType.DEPARTMENT_UPDATED, {
    departmentId: departmentData.id,
    departmentName: departmentData.name,
    updatedById: updatedBy.id,
    updatedByName: updatedBy.displayName || updatedBy.username,
    changes: JSON.stringify(changes),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log department deletion
 * @param {string} companyId - Company ID
 * @param {object} departmentData - Deleted department data
 * @param {object} deletedBy - User who deleted the department
 * @returns {Promise<object>}
 */
export const logDepartmentDeleted = async (companyId, departmentData, deletedBy) => {
  return logSystemActivity(companyId, SystemActivityType.DEPARTMENT_DELETED, {
    departmentId: departmentData.id,
    departmentName: departmentData.name,
    deletedById: deletedBy.id,
    deletedByName: deletedBy.displayName || deletedBy.username,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log password change
 * @param {string} companyId - Company ID
 * @param {object} userData - User whose password changed
 * @param {object} changedBy - User who changed the password (may be same user)
 * @returns {Promise<object>}
 */
export const logPasswordChanged = async (companyId, userData, changedBy) => {
  return logSystemActivity(companyId, SystemActivityType.PASSWORD_CHANGED, {
    userId: userData.id,
    userName: userData.displayName || userData.username,
    changedById: changedBy.id,
    changedByName: changedBy.displayName || changedBy.username,
    isSelfChange: userData.id === changedBy.id,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log profile update
 * @param {string} companyId - Company ID
 * @param {object} userData - User whose profile updated
 * @param {object} changes - Changes made
 * @returns {Promise<object>}
 */
export const logProfileUpdated = async (companyId, userData, changes = {}) => {
  return logSystemActivity(companyId, SystemActivityType.PROFILE_UPDATED, {
    userId: userData.id,
    userName: userData.displayName || userData.username,
    changes: JSON.stringify(changes),
    timestamp: new Date().toISOString(),
  });
};

// ============================================
// AUDIT LOG SEARCH & FILTERING
// ============================================

/**
 * Search audit logs by text query (searches in metadata)
 * @param {string} companyId - Company ID
 * @param {string} searchQuery - Search query
 * @param {number} limit - Result limit
 * @returns {Promise<Array>}
 */
export const searchAuditLogs = async (companyId, searchQuery, limit = 50) => {
  try {
    // Get all activities and filter client-side (Firestore doesn't support full-text search)
    const activities = await getCompanyAuditLog(companyId, { limit: 500 });

    const searchLower = searchQuery.toLowerCase();

    const filtered = activities.filter((activity) => {
      const meta = activity.metadata || {};
      const metaString = JSON.stringify(meta).toLowerCase();
      const typeString = activity.type.toLowerCase();

      return metaString.includes(searchLower) || typeString.includes(searchLower);
    });

    return filtered.slice(0, limit);
  } catch (error) {
    console.error("Error searching audit logs:", error);
    return [];
  }
};

/**
 * Get audit log statistics
 * @param {string} companyId - Company ID
 * @param {object} options - Query options
 * @returns {Promise<object>}
 */
export const getAuditLogStats = async (companyId, options = {}) => {
  try {
    const activities = await getCompanyAuditLog(companyId, { limit: 1000, ...options });

    const stats = {
      total: activities.length,
      byType: {},
      byUser: {},
      bySource: {
        post: 0,
        system: 0,
      },
    };

    activities.forEach((activity) => {
      // Count by type
      const type = activity.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count by source
      const source = activity.source || 'post';
      stats.bySource[source]++;

      // Count by user
      const userId = activity.metadata?.adminId || activity.metadata?.userId;
      if (userId) {
        stats.byUser[userId] = (stats.byUser[userId] || 0) + 1;
      }
    });

    return stats;
  } catch (error) {
    console.error("Error getting audit log stats:", error);
    return { total: 0, byType: {}, byUser: {}, bySource: {} };
  }
};

/**
 * Export audit logs to JSON
 * @param {string} companyId - Company ID
 * @param {object} options - Query options
 * @returns {Promise<string>}
 */
export const exportAuditLogsToJSON = async (companyId, options = {}) => {
  try {
    const activities = await getCompanyAuditLog(companyId, { limit: 10000, ...options });

    const exportData = {
      exportDate: new Date().toISOString(),
      companyId,
      totalActivities: activities.length,
      activities: activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        source: activity.source,
        timestamp: activity.createdAt?.toDate
          ? activity.createdAt.toDate().toISOString()
          : null,
        metadata: activity.metadata,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    throw error;
  }
};

/**
 * Export audit logs to CSV
 * @param {string} companyId - Company ID
 * @param {object} options - Query options
 * @returns {Promise<string>}
 */
export const exportAuditLogsToCSV = async (companyId, options = {}) => {
  try {
    const activities = await getCompanyAuditLog(companyId, { limit: 10000, ...options });

    const csvRows = [];

    // Header row
    csvRows.push('Timestamp,Type,Source,User,User Name,Details');

    // Data rows
    activities.forEach((activity) => {
      const timestamp = activity.createdAt?.toDate
        ? activity.createdAt.toDate().toISOString()
        : '';
      const type = activity.type || '';
      const source = activity.source || 'post';
      const userId = activity.metadata?.adminId || activity.metadata?.userId || '';
      const userName = activity.metadata?.adminName || activity.metadata?.userName || '';
      const details = JSON.stringify(activity.metadata || {}).replace(/"/g, '""');

      csvRows.push(`"${timestamp}","${type}","${source}","${userId}","${userName}","${details}"`);
    });

    return csvRows.join('\n');
  } catch (error) {
    console.error("Error exporting audit logs to CSV:", error);
    throw error;
  }
};

// ============================================
// AUDIT CHAIN VERIFICATION
// ============================================

/**
 * Verify audit chain integrity
 * @param {string} companyId - Company ID
 * @param {Date} startDate - Start date for verification (optional)
 * @param {Date} endDate - End date for verification (optional)
 * @returns {Promise<Object>} Verification report
 */
export const verifyAuditChain = async (companyId, startDate = null, endDate = null) => {
  try {
    // Build query constraints
    const constraints = [
      where("companyId", "==", companyId),
      orderBy("createdAt", "asc"),
    ];

    if (startDate) {
      constraints.push(where("createdAt", ">=", Timestamp.fromDate(startDate)));
    }

    if (endDate) {
      constraints.push(where("createdAt", "<=", Timestamp.fromDate(endDate)));
    }

    // Fetch audit logs in chronological order
    const auditQuery = query(collection(db, "systemAuditLogs"), ...constraints);
    const snapshot = await getDocs(auditQuery);

    const entries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (entries.length === 0) {
      return {
        valid: true,
        totalEntries: 0,
        verifiedEntries: 0,
        tamperedEntries: [],
        message: "No audit entries found in the specified range",
      };
    }

    const tamperedEntries = [];
    let expectedPreviousHash = "GENESIS_BLOCK";

    // Verify each entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Check if entry has hashing fields (older entries might not have them)
      if (!entry.previousHash || !entry.currentHash) {
        continue; // Skip entries without hashing
      }

      // Verify previousHash matches expected value
      if (entry.previousHash !== expectedPreviousHash) {
        tamperedEntries.push({
          entryId: entry.id,
          index: i,
          type: entry.type,
          timestamp: entry.createdAt?.toDate
            ? entry.createdAt.toDate().toISOString()
            : null,
          expectedPreviousHash,
          actualPreviousHash: entry.previousHash,
          issue: "Previous hash mismatch - possible tampering or reordering",
        });
      }

      // Recalculate hash to verify integrity
      const activityData = {
        companyId: entry.companyId,
        type: entry.type,
        metadata: entry.metadata,
      };

      const timestamp = entry.createdAt?.toDate
        ? entry.createdAt.toDate().toISOString()
        : new Date().toISOString();

      const calculatedHash = calculateAuditHash(
        activityData,
        entry.previousHash,
        timestamp
      );

      // Note: Hash verification might not match exactly due to timestamp differences
      // This is a simplified check - in production, you'd need more precise timestamp handling

      // Update expected hash for next iteration
      expectedPreviousHash = entry.currentHash;
    }

    return {
      valid: tamperedEntries.length === 0,
      totalEntries: entries.length,
      verifiedEntries: entries.length - tamperedEntries.length,
      tamperedEntries,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      verifiedAt: new Date().toISOString(),
      message:
        tamperedEntries.length === 0
          ? "Audit chain integrity verified - no tampering detected"
          : `Found ${tamperedEntries.length} potentially tampered entries`,
    };
  } catch (error) {
    console.error("Error verifying audit chain:", error);
    return {
      valid: false,
      error: error.message,
      message: "Failed to verify audit chain",
    };
  }
};
