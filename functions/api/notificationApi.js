/**
 * Enhanced Notification API
 * Provides notification preferences, email digests, and history
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get or create notification preferences for a user
 */
exports.getNotificationPreferences = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const prefsDoc = await db.collection('notificationPreferences').doc(userId).get();

    if (prefsDoc.exists) {
      return {
        success: true,
        preferences: prefsDoc.data(),
      };
    }

    // Create default preferences
    const defaultPreferences = {
      userId,
      inApp: {
        comments: true,
        reactions: true,
        mentions: true,
        statusChanges: true,
        priorityChanges: true,
        newPosts: false,
        assignedToYou: true,
        departmentUpdates: true,
        systemAnnouncements: true,
      },
      email: {
        enabled: false,
        weeklyDigest: false,
        dailyDigest: false,
        immediate: {
          mentions: false,
          assignedToYou: false,
          statusChanges: false,
        },
      },
      digestSchedule: {
        weeklyDay: 'monday', // Day of week for weekly digest
        dailyTime: '09:00', // Time for daily digest (24h format)
        timezone: 'UTC',
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('notificationPreferences').doc(userId).set(defaultPreferences);

    return {
      success: true,
      preferences: defaultPreferences,
    };
  } catch (error) {
    console.error('Error in getNotificationPreferences:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Update notification preferences
 */
exports.updateNotificationPreferences = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { preferences } = data;

    if (!preferences) {
      throw new functions.https.HttpsError('invalid-argument', 'Preferences object is required');
    }

    await db.collection('notificationPreferences').doc(userId).set({
      ...preferences,
      userId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      success: true,
      message: 'Preferences updated successfully',
    };
  } catch (error) {
    console.error('Error in updateNotificationPreferences:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Get notifications with pagination and filtering
 */
exports.getNotifications = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const {
      limit = 20,
      startAfter = null,
      filter = 'all', // 'all', 'unread', 'read'
      type = null, // filter by notification type
    } = data;

    let query = db.collection('notifications')
      .where('userId', '==', userId);

    // Apply filters
    if (filter === 'unread') {
      query = query.where('read', '==', false);
    } else if (filter === 'read') {
      query = query.where('read', '==', true);
    }

    if (type) {
      query = query.where('type', '==', type);
    }

    query = query.orderBy('createdAt', 'desc').limit(limit);

    if (startAfter) {
      const startDoc = await db.collection('notifications').doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    const snapshot = await query.get();
    const notifications = [];

    snapshot.forEach(doc => {
      notifications.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Get unread count
    const unreadSnapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    return {
      success: true,
      notifications,
      unreadCount: unreadSnapshot.size,
      hasMore: notifications.length === limit,
      lastDoc: notifications.length > 0 ? notifications[notifications.length - 1].id : null,
    };
  } catch (error) {
    console.error('Error in getNotifications:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Mark notification(s) as read
 */
exports.markNotificationsAsRead = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { notificationIds, markAll = false } = data;

    if (markAll) {
      // Mark all user's notifications as read
      const snapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .get();

      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.update(doc.ref, {
          read: true,
          readAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();

      return {
        success: true,
        message: 'All notifications marked as read',
        count: snapshot.size,
      };
    }

    if (!notificationIds || !Array.isArray(notificationIds)) {
      throw new functions.https.HttpsError('invalid-argument', 'notificationIds must be an array');
    }

    const batch = db.batch();

    for (const notificationId of notificationIds) {
      const notifDoc = await db.collection('notifications').doc(notificationId).get();

      if (notifDoc.exists && notifDoc.data().userId === userId) {
        batch.update(notifDoc.ref, {
          read: true,
          readAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    await batch.commit();

    return {
      success: true,
      message: 'Notifications marked as read',
      count: notificationIds.length,
    };
  } catch (error) {
    console.error('Error in markNotificationsAsRead:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Mark notification(s) as unread
 */
exports.markNotificationsAsUnread = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { notificationIds } = data;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      throw new functions.https.HttpsError('invalid-argument', 'notificationIds must be an array');
    }

    const batch = db.batch();

    for (const notificationId of notificationIds) {
      const notifDoc = await db.collection('notifications').doc(notificationId).get();

      if (notifDoc.exists && notifDoc.data().userId === userId) {
        batch.update(notifDoc.ref, {
          read: false,
          readAt: admin.firestore.FieldValue.delete(),
        });
      }
    }

    await batch.commit();

    return {
      success: true,
      message: 'Notifications marked as unread',
      count: notificationIds.length,
    };
  } catch (error) {
    console.error('Error in markNotificationsAsUnread:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Delete notification(s)
 */
exports.deleteNotifications = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { notificationIds, deleteAll = false } = data;

    if (deleteAll) {
      // Delete all user's notifications
      const snapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .get();

      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      return {
        success: true,
        message: 'All notifications deleted',
        count: snapshot.size,
      };
    }

    if (!notificationIds || !Array.isArray(notificationIds)) {
      throw new functions.https.HttpsError('invalid-argument', 'notificationIds must be an array');
    }

    const batch = db.batch();

    for (const notificationId of notificationIds) {
      const notifDoc = await db.collection('notifications').doc(notificationId).get();

      if (notifDoc.exists && notifDoc.data().userId === userId) {
        batch.delete(notifDoc.ref);
      }
    }

    await batch.commit();

    return {
      success: true,
      message: 'Notifications deleted',
      count: notificationIds.length,
    };
  } catch (error) {
    console.error('Error in deleteNotifications:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Get unread notification count
 */
exports.getUnreadCount = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;

    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    // Group by type
    const countByType = {};
    snapshot.forEach(doc => {
      const type = doc.data().type;
      countByType[type] = (countByType[type] || 0) + 1;
    });

    return {
      success: true,
      total: snapshot.size,
      byType: countByType,
    };
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
