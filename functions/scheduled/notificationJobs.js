/**
 * Scheduled jobs for notification system
 * Handles email digests (daily and weekly)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Daily email digest job
 * Runs every day at different times based on user preferences
 */
exports.dailyEmailDigestJob = functions.pubsub
  .schedule('0 * * * *') // Run every hour
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      console.log('Running daily email digest job...');

      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentTime = `${String(currentHour).padStart(2, '0')}:00`;

      // Get all users who want daily digest at this hour
      const prefsSnapshot = await db.collection('notificationPreferences')
        .where('email.enabled', '==', true)
        .where('email.dailyDigest', '==', true)
        .where('digestSchedule.dailyTime', '==', currentTime)
        .get();

      console.log(`Found ${prefsSnapshot.size} users for daily digest at ${currentTime}`);

      const promises = [];

      for (const prefDoc of prefsSnapshot.docs) {
        const userId = prefDoc.id;
        promises.push(sendDailyDigest(userId));
      }

      await Promise.all(promises);

      console.log('Daily email digest job completed');
      return null;
    } catch (error) {
      console.error('Error in dailyEmailDigestJob:', error);
      return null;
    }
  });

/**
 * Weekly email digest job
 * Runs every day at 09:00 UTC to check for weekly digests
 */
exports.weeklyEmailDigestJob = functions.pubsub
  .schedule('0 9 * * *') // Run daily at 9 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      console.log('Running weekly email digest job...');

      const now = new Date();
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase' });

      // Get all users who want weekly digest on this day
      const prefsSnapshot = await db.collection('notificationPreferences')
        .where('email.enabled', '==', true)
        .where('email.weeklyDigest', '==', true)
        .where('digestSchedule.weeklyDay', '==', dayOfWeek)
        .get();

      console.log(`Found ${prefsSnapshot.size} users for weekly digest on ${dayOfWeek}`);

      const promises = [];

      for (const prefDoc of prefsSnapshot.docs) {
        const userId = prefDoc.id;
        promises.push(sendWeeklyDigest(userId));
      }

      await Promise.all(promises);

      console.log('Weekly email digest job completed');
      return null;
    } catch (error) {
      console.error('Error in weeklyEmailDigestJob:', error);
      return null;
    }
  });

/**
 * Send daily digest to a user
 */
async function sendDailyDigest(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const email = userData.email;

    if (!email) return;

    // Get notifications from the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const notificationsSnapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('createdAt', '>=', yesterday)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    if (notificationsSnapshot.empty) {
      console.log(`No notifications for user ${userId}, skipping daily digest`);
      return;
    }

    const notifications = [];
    notificationsSnapshot.forEach(doc => {
      notifications.push(doc.data());
    });

    // Group notifications by type
    const groupedNotifications = groupNotificationsByType(notifications);

    // Create digest email
    const emailContent = createDigestEmail(userData, groupedNotifications, 'daily');

    // Save to email queue (you would need to implement actual email sending)
    await db.collection('emailQueue').add({
      to: email,
      subject: `Your Daily Digest - ${notifications.length} new notifications`,
      html: emailContent,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending',
      type: 'daily_digest',
    });

    console.log(`Daily digest queued for user ${userId}`);
  } catch (error) {
    console.error(`Error sending daily digest to user ${userId}:`, error);
  }
}

/**
 * Send weekly digest to a user
 */
async function sendWeeklyDigest(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const email = userData.email;

    if (!email) return;

    // Get notifications from the last 7 days
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const notificationsSnapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('createdAt', '>=', lastWeek)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    if (notificationsSnapshot.empty) {
      console.log(`No notifications for user ${userId}, skipping weekly digest`);
      return;
    }

    const notifications = [];
    notificationsSnapshot.forEach(doc => {
      notifications.push(doc.data());
    });

    // Group notifications by type
    const groupedNotifications = groupNotificationsByType(notifications);

    // Get weekly stats
    const companyId = userData.companyId;
    const weeklyStats = await getWeeklyStats(companyId, lastWeek);

    // Create digest email
    const emailContent = createDigestEmail(userData, groupedNotifications, 'weekly', weeklyStats);

    // Save to email queue
    await db.collection('emailQueue').add({
      to: email,
      subject: `Your Weekly Digest - ${notifications.length} notifications this week`,
      html: emailContent,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending',
      type: 'weekly_digest',
    });

    console.log(`Weekly digest queued for user ${userId}`);
  } catch (error) {
    console.error(`Error sending weekly digest to user ${userId}:`, error);
  }
}

/**
 * Group notifications by type
 */
function groupNotificationsByType(notifications) {
  const grouped = {};

  notifications.forEach(notif => {
    const type = notif.type || 'other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(notif);
  });

  return grouped;
}

/**
 * Get weekly stats for company
 */
async function getWeeklyStats(companyId, since) {
  try {
    const postsSnapshot = await db.collection('posts')
      .where('companyId', '==', companyId)
      .where('createdAt', '>=', since)
      .get();

    const commentsSnapshot = await db.collection('comments')
      .where('companyId', '==', companyId)
      .where('createdAt', '>=', since)
      .get();

    const stats = {
      totalPosts: postsSnapshot.size,
      totalComments: commentsSnapshot.size,
      postsByType: {},
      postsByStatus: {},
    };

    postsSnapshot.forEach(doc => {
      const post = doc.data();

      // Count by type
      const type = post.type || 'other';
      stats.postsByType[type] = (stats.postsByType[type] || 0) + 1;

      // Count by status
      const status = post.status || 'unknown';
      stats.postsByStatus[status] = (stats.postsByStatus[status] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Error getting weekly stats:', error);
    return {};
  }
}

/**
 * Create HTML email content for digest
 */
function createDigestEmail(userData, groupedNotifications, digestType, weeklyStats = null) {
  const username = userData.username || 'User';
  const types = Object.keys(groupedNotifications);
  const totalNotifications = Object.values(groupedNotifications).reduce((sum, arr) => sum + arr.length, 0);

  let html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .notification-group { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .notification-type { color: #667eea; font-weight: bold; font-size: 18px; margin-bottom: 15px; }
    .notification-item { padding: 10px 0; border-bottom: 1px solid #eee; }
    .notification-item:last-child { border-bottom: none; }
    .stats { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-item { display: inline-block; margin: 10px 20px 10px 0; }
    .stat-value { font-size: 24px; font-weight: bold; color: #667eea; }
    .stat-label { font-size: 14px; color: #666; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Your ${digestType.charAt(0).toUpperCase() + digestType.slice(1)} Digest</h1>
    <p>Hi ${username}, here's what happened ${digestType === 'daily' ? 'today' : 'this week'}!</p>
  </div>

  <div class="content">
    <p><strong>${totalNotifications}</strong> new notifications</p>
  `;

  // Add weekly stats if available
  if (weeklyStats && Object.keys(weeklyStats).length > 0) {
    html += `
    <div class="stats">
      <h3>Company Activity This Week</h3>
      <div class="stat-item">
        <div class="stat-value">${weeklyStats.totalPosts || 0}</div>
        <div class="stat-label">New Posts</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${weeklyStats.totalComments || 0}</div>
        <div class="stat-label">Comments</div>
      </div>
    </div>
    `;
  }

  // Add notification groups
  types.forEach(type => {
    const notifications = groupedNotifications[type];
    const typeLabel = formatNotificationType(type);

    html += `
    <div class="notification-group">
      <div class="notification-type">${typeLabel} (${notifications.length})</div>
    `;

    notifications.slice(0, 5).forEach(notif => {
      html += `
      <div class="notification-item">
        <div>${notif.message || 'New notification'}</div>
        <div style="font-size: 12px; color: #999;">${formatDate(notif.createdAt)}</div>
      </div>
      `;
    });

    if (notifications.length > 5) {
      html += `<p style="color: #667eea; margin-top: 10px;">And ${notifications.length - 5} more...</p>`;
    }

    html += `</div>`;
  });

  html += `
    <div style="text-align: center;">
      <a href="https://your-app-url.com/notifications" class="button">View All Notifications</a>
    </div>

    <div class="footer">
      <p>You're receiving this email because you have digest notifications enabled.</p>
      <p><a href="https://your-app-url.com/settings/notifications" style="color: #667eea;">Update your notification preferences</a></p>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Format notification type for display
 */
function formatNotificationType(type) {
  const typeMap = {
    comment: 'Comments',
    reaction: 'Reactions',
    mention: 'Mentions',
    status_change: 'Status Changes',
    priority_change: 'Priority Changes',
    new_post: 'New Posts',
    assigned: 'Assignments',
    department_update: 'Department Updates',
    system_announcement: 'System Announcements',
  };

  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format date for display
 */
function formatDate(timestamp) {
  if (!timestamp) return 'Unknown date';

  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return 'Unknown date';
  }
}
