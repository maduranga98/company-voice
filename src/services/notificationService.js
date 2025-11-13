/**
 * Enhanced Notification Service
 * Frontend service for notification management and preferences
 */

import { httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db, functions } from '../config/firebase';

/**
 * Get notification preferences
 * @returns {Promise<Object>} User's notification preferences
 */
export const getNotificationPreferences = async () => {
  try {
    const getPrefsFunction = httpsCallable(functions, 'getNotificationPreferences');
    const result = await getPrefsFunction();

    return result.data.preferences;
  } catch (error) {
    console.error('Error in getNotificationPreferences:', error);
    throw error;
  }
};

/**
 * Update notification preferences
 * @param {Object} preferences - Updated preferences
 * @returns {Promise<Object>} Result
 */
export const updateNotificationPreferences = async (preferences) => {
  try {
    const updatePrefsFunction = httpsCallable(functions, 'updateNotificationPreferences');
    const result = await updatePrefsFunction({ preferences });

    return result.data;
  } catch (error) {
    console.error('Error in updateNotificationPreferences:', error);
    throw error;
  }
};

/**
 * Get notifications with pagination
 * @param {Object} params - Parameters
 * @param {number} params.limit - Results per page
 * @param {string} params.startAfter - ID of last notification from previous page
 * @param {string} params.filter - Filter: 'all', 'unread', 'read'
 * @param {string} params.type - Filter by notification type
 * @returns {Promise<Object>} Notifications and metadata
 */
export const getNotifications = async ({
  limit = 20,
  startAfter = null,
  filter = 'all',
  type = null,
}) => {
  try {
    const getNotificationsFunction = httpsCallable(functions, 'getNotifications');
    const result = await getNotificationsFunction({
      limit,
      startAfter,
      filter,
      type,
    });

    return result.data;
  } catch (error) {
    console.error('Error in getNotifications:', error);
    throw error;
  }
};

/**
 * Mark notifications as read
 * @param {Array<string>} notificationIds - Array of notification IDs
 * @param {boolean} markAll - Mark all as read
 * @returns {Promise<Object>} Result
 */
export const markNotificationsAsRead = async (notificationIds = [], markAll = false) => {
  try {
    const markReadFunction = httpsCallable(functions, 'markNotificationsAsRead');
    const result = await markReadFunction({ notificationIds, markAll });

    return result.data;
  } catch (error) {
    console.error('Error in markNotificationsAsRead:', error);
    throw error;
  }
};

/**
 * Mark notifications as unread
 * @param {Array<string>} notificationIds - Array of notification IDs
 * @returns {Promise<Object>} Result
 */
export const markNotificationsAsUnread = async (notificationIds) => {
  try {
    const markUnreadFunction = httpsCallable(functions, 'markNotificationsAsUnread');
    const result = await markUnreadFunction({ notificationIds });

    return result.data;
  } catch (error) {
    console.error('Error in markNotificationsAsUnread:', error);
    throw error;
  }
};

/**
 * Delete notifications
 * @param {Array<string>} notificationIds - Array of notification IDs
 * @param {boolean} deleteAll - Delete all notifications
 * @returns {Promise<Object>} Result
 */
export const deleteNotifications = async (notificationIds = [], deleteAll = false) => {
  try {
    const deleteFunction = httpsCallable(functions, 'deleteNotifications');
    const result = await deleteFunction({ notificationIds, deleteAll });

    return result.data;
  } catch (error) {
    console.error('Error in deleteNotifications:', error);
    throw error;
  }
};

/**
 * Get unread notification count
 * @returns {Promise<Object>} Unread count by type
 */
export const getUnreadCount = async () => {
  try {
    const getUnreadCountFunction = httpsCallable(functions, 'getUnreadCount');
    const result = await getUnreadCountFunction();

    return result.data;
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time notifications
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function for updates
 * @param {Object} options - Options
 * @param {number} options.limit - Number of notifications to fetch
 * @param {boolean} options.unreadOnly - Only fetch unread notifications
 * @returns {Function} Unsubscribe function
 */
export const subscribeToNotifications = (userId, callback, options = {}) => {
  const { limit = 10, unreadOnly = false } = options;

  try {
    let q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit)
    );

    if (unreadOnly) {
      q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifications = [];
        snapshot.forEach((doc) => {
          notifications.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        callback(notifications);
      },
      (error) => {
        console.error('Error in notifications subscription:', error);
        callback([], error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up notifications subscription:', error);
    throw error;
  }
};

/**
 * Subscribe to unread count
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function for count updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToUnreadCount = (userId, callback) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const count = snapshot.size;
        const byType = {};

        snapshot.forEach((doc) => {
          const type = doc.data().type;
          byType[type] = (byType[type] || 0) + 1;
        });

        callback({ total: count, byType });
      },
      (error) => {
        console.error('Error in unread count subscription:', error);
        callback({ total: 0, byType: {} }, error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up unread count subscription:', error);
    throw error;
  }
};
