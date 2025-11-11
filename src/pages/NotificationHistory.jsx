/**
 * Notification History Page
 * Full page view of all notifications with filtering and management
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markNotificationsAsRead,
  markNotificationsAsUnread,
  deleteNotifications,
  subscribeToUnreadCount,
} from '../services/notificationService';
import {
  Bell,
  BellOff,
  Mail,
  MailOpen,
  Trash2,
  Filter,
  RefreshCw,
  CheckCheck,
  Settings,
  Calendar,
} from 'lucide-react';

const NotificationHistory = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState({ total: 0, byType: {} });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState(null);
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = subscribeToUnreadCount(currentUser.id, (count) => {
      setUnreadCount(count);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    loadNotifications();
  }, [filter, typeFilter]);

  const loadNotifications = async (startAfter = null) => {
    setLoading(true);
    try {
      const result = await getNotifications({
        limit: 50,
        startAfter,
        filter,
        type: typeFilter,
      });

      if (startAfter) {
        setNotifications((prev) => [...prev, ...result.notifications]);
      } else {
        setNotifications(result.notifications);
      }

      setPagination({
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
        unreadCount: result.unreadCount,
      });
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationIds) => {
    try {
      await markNotificationsAsRead(notificationIds);
      loadNotifications();
      setSelectedNotifications([]);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAsUnread = async (notificationIds) => {
    try {
      await markNotificationsAsUnread(notificationIds);
      loadNotifications();
      setSelectedNotifications([]);
    } catch (error) {
      console.error('Error marking as unread:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markNotificationsAsRead([], true);
      loadNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (notificationIds) => {
    if (!confirm('Are you sure you want to delete these notifications?')) return;

    try {
      await deleteNotifications(notificationIds);
      loadNotifications();
      setSelectedNotifications([]);
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      handleMarkAsRead([notification.id]);
    }

    if (notification.postId) {
      navigate(`/post/${notification.postId}`);
    }
  };

  const toggleSelectNotification = (notificationId) => {
    setSelectedNotifications((prev) =>
      prev.includes(notificationId)
        ? prev.filter((id) => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedNotifications.length === notifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(notifications.map((n) => n.id));
    }
  };

  const getNotificationIcon = (type) => {
    const iconMap = {
      comment: '💬',
      reaction: '❤️',
      mention: '@',
      status_change: '✓',
      priority_change: '⚠️',
      assigned: '👤',
      department_update: '📢',
      system_announcement: '📣',
    };

    return iconMap[type] || '🔔';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const notificationTypes = [
    { value: null, label: 'All Types' },
    { value: 'comment', label: 'Comments' },
    { value: 'reaction', label: 'Reactions' },
    { value: 'mention', label: 'Mentions' },
    { value: 'status_change', label: 'Status Changes' },
    { value: 'priority_change', label: 'Priority Changes' },
    { value: 'assigned', label: 'Assignments' },
    { value: 'department_update', label: 'Department Updates' },
    { value: 'system_announcement', label: 'Announcements' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Bell className="w-8 h-8 text-blue-600" />
                Notifications
              </h1>
              <p className="text-gray-600 mt-1">
                {unreadCount.total > 0
                  ? `You have ${unreadCount.total} unread notification${unreadCount.total > 1 ? 's' : ''}`
                  : 'You're all caught up!'}
              </p>
            </div>
            <button
              onClick={() => navigate('/settings/notifications')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              Settings
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'unread'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unread {unreadCount.total > 0 && `(${unreadCount.total})`}
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'read'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Read
            </button>

            <div className="ml-auto flex gap-2">
              <select
                value={typeFilter || ''}
                onChange={(e) => setTypeFilter(e.target.value || null)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {notificationTypes.map((type) => (
                  <option key={type.value || 'all'} value={type.value || ''}>
                    {type.label}
                  </option>
                ))}
              </select>

              {unreadCount.total > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <CheckCheck className="w-5 h-5" />
                  Mark All Read
                </button>
              )}

              <button
                onClick={() => loadNotifications()}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedNotifications.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-4">
            <span className="font-medium text-gray-900">
              {selectedNotifications.length} selected
            </span>
            <button
              onClick={() => handleMarkAsRead(selectedNotifications)}
              className="px-4 py-2 bg-white rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <MailOpen className="w-4 h-4" />
              Mark Read
            </button>
            <button
              onClick={() => handleMarkAsUnread(selectedNotifications)}
              className="px-4 py-2 bg-white rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Mark Unread
            </button>
            <button
              onClick={() => handleDelete(selectedNotifications)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              onClick={() => setSelectedNotifications([])}
              className="ml-auto px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
              <BellOff className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No notifications</p>
              <p className="text-sm">
                {filter === 'unread'
                  ? "You don't have any unread notifications"
                  : "You don't have any notifications yet"}
              </p>
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="border-b border-gray-200 p-4 bg-gray-50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      notifications.length > 0 && selectedNotifications.length === notifications.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Select all</span>
                </label>
              </div>

              {/* Notifications */}
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex gap-4">
                      <input
                        type="checkbox"
                        checked={selectedNotifications.includes(notification.id)}
                        onChange={() => toggleSelectNotification(notification.id)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />

                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm ${
                                !notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'
                              }`}
                            >
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <Calendar className="w-3 h-3" />
                              {formatTimestamp(notification.createdAt)}
                            </div>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More */}
              {pagination?.hasMore && (
                <div className="p-4 text-center border-t border-gray-200">
                  <button
                    onClick={() => loadNotifications(pagination.lastDoc)}
                    disabled={loading}
                    className="px-6 py-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationHistory;
