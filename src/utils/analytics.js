/**
 * Firebase Analytics Utility
 *
 * This module provides easy-to-use wrappers for Firebase Analytics events.
 * It helps track user behavior, engagement, and custom events throughout the app.
 *
 * Usage:
 * import { logEvent, logPageView, logUserLogin, etc. } from '@/utils/analytics';
 */

import { logEvent as firebaseLogEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { analytics } from '@/config/firebase';

/**
 * Log a custom event to Firebase Analytics
 * @param {string} eventName - The name of the event
 * @param {object} eventParams - Optional parameters for the event
 */
export const logEvent = (eventName, eventParams = {}) => {
  if (analytics) {
    try {
      firebaseLogEvent(analytics, eventName, eventParams);
    } catch (error) {
      console.error('Error logging analytics event:', error);
    }
  }
};

/**
 * Log page view events
 * @param {string} pagePath - The path of the page
 * @param {string} pageTitle - The title of the page
 */
export const logPageView = (pagePath, pageTitle) => {
  logEvent('page_view', {
    page_path: pagePath,
    page_title: pageTitle,
  });
};

/**
 * Log user login events
 * @param {string} method - The login method (e.g., 'email', 'google', 'microsoft')
 */
export const logUserLogin = (method) => {
  logEvent('login', {
    method: method,
  });
};

/**
 * Log user sign up events
 * @param {string} method - The sign up method
 */
export const logUserSignUp = (method) => {
  logEvent('sign_up', {
    method: method,
  });
};

/**
 * Log when a user creates a post
 * @param {string} postType - The type of post (e.g., 'suggestion', 'complaint', 'question')
 * @param {boolean} isAnonymous - Whether the post is anonymous
 */
export const logPostCreated = (postType, isAnonymous = false) => {
  logEvent('post_created', {
    post_type: postType,
    is_anonymous: isAnonymous,
  });
};

/**
 * Log when a user comments on a post
 * @param {string} postId - The ID of the post
 */
export const logCommentCreated = (postId) => {
  logEvent('comment_created', {
    post_id: postId,
  });
};

/**
 * Log when a user likes a post
 * @param {string} postId - The ID of the post
 */
export const logPostLiked = (postId) => {
  logEvent('post_liked', {
    post_id: postId,
  });
};

/**
 * Log when a user views a post
 * @param {string} postId - The ID of the post
 * @param {string} postType - The type of post
 */
export const logPostViewed = (postId, postType) => {
  logEvent('post_viewed', {
    post_id: postId,
    post_type: postType,
  });
};

/**
 * Log search queries
 * @param {string} searchTerm - The search term
 * @param {number} resultsCount - Number of results returned
 */
export const logSearch = (searchTerm, resultsCount) => {
  logEvent('search', {
    search_term: searchTerm,
    results_count: resultsCount,
  });
};

/**
 * Log when filters are applied
 * @param {object} filters - The filters applied
 */
export const logFiltersApplied = (filters) => {
  logEvent('filters_applied', {
    filter_type: Object.keys(filters).join(','),
    filter_count: Object.keys(filters).length,
  });
};

/**
 * Log admin actions
 * @param {string} action - The admin action (e.g., 'create_user', 'delete_post', 'update_status')
 * @param {object} details - Additional details about the action
 */
export const logAdminAction = (action, details = {}) => {
  logEvent('admin_action', {
    action: action,
    ...details,
  });
};

/**
 * Log when a user exports data
 * @param {string} exportType - The type of export (e.g., 'posts', 'analytics', 'users')
 * @param {string} format - The export format (e.g., 'csv', 'pdf', 'excel')
 */
export const logDataExport = (exportType, format) => {
  logEvent('data_export', {
    export_type: exportType,
    format: format,
  });
};

/**
 * Log notification events
 * @param {string} notificationType - Type of notification
 * @param {string} action - Action taken (e.g., 'sent', 'clicked', 'dismissed')
 */
export const logNotificationEvent = (notificationType, action) => {
  logEvent('notification_event', {
    notification_type: notificationType,
    action: action,
  });
};

/**
 * Log billing/subscription events
 * @param {string} event - The billing event (e.g., 'subscription_started', 'payment_success', 'subscription_cancelled')
 * @param {object} details - Additional details
 */
export const logBillingEvent = (event, details = {}) => {
  logEvent(event, details);
};

/**
 * Log content moderation events
 * @param {string} action - The moderation action (e.g., 'report_submitted', 'content_removed', 'user_restricted')
 * @param {object} details - Additional details
 */
export const logModerationEvent = (action, details = {}) => {
  logEvent('moderation_action', {
    action: action,
    ...details,
  });
};

/**
 * Log errors for tracking
 * @param {string} errorType - The type of error
 * @param {string} errorMessage - The error message
 * @param {boolean} fatal - Whether the error is fatal
 */
export const logError = (errorType, errorMessage, fatal = false) => {
  logEvent('app_error', {
    error_type: errorType,
    error_message: errorMessage,
    fatal: fatal,
  });
};

/**
 * Set the user ID for analytics
 * @param {string} userId - The user ID
 */
export const setAnalyticsUserId = (userId) => {
  if (analytics && userId) {
    try {
      setUserId(analytics, userId);
    } catch (error) {
      console.error('Error setting analytics user ID:', error);
    }
  }
};

/**
 * Set user properties for analytics
 * @param {object} properties - User properties to set
 * Example: { role: 'admin', company: 'company123', isPremium: true }
 */
export const setAnalyticsUserProperties = (properties) => {
  if (analytics && properties) {
    try {
      setUserProperties(analytics, properties);
    } catch (error) {
      console.error('Error setting analytics user properties:', error);
    }
  }
};

/**
 * Track feature usage
 * @param {string} featureName - Name of the feature used
 * @param {object} context - Additional context about feature usage
 */
export const logFeatureUsage = (featureName, context = {}) => {
  logEvent('feature_used', {
    feature_name: featureName,
    ...context,
  });
};

/**
 * Track user engagement time
 * @param {string} section - The section/page where engagement is tracked
 * @param {number} timeInSeconds - Time spent in seconds
 */
export const logEngagementTime = (section, timeInSeconds) => {
  logEvent('user_engagement', {
    section: section,
    time_seconds: timeInSeconds,
  });
};

// Export all analytics functions
export default {
  logEvent,
  logPageView,
  logUserLogin,
  logUserSignUp,
  logPostCreated,
  logCommentCreated,
  logPostLiked,
  logPostViewed,
  logSearch,
  logFiltersApplied,
  logAdminAction,
  logDataExport,
  logNotificationEvent,
  logBillingEvent,
  logModerationEvent,
  logError,
  setAnalyticsUserId,
  setAnalyticsUserProperties,
  logFeatureUsage,
  logEngagementTime,
};
