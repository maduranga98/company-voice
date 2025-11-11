/**
 * Notification Center Component
 * In-app notification center with real-time updates
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeToNotifications,
  subscribeToUnreadCount,
  markNotificationsAsRead,
  markNotificationsAsUnread,
  deleteNotifications,
  getNotifications,
} from '../services/notificationService';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  X,
  Mail,
  MailOpen,
  Filter,
  RefreshCw,
} from 'lucide-react';

const NotificationCenter = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState({ total: 0, byType: {} });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState(null);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!currentUser) return;

    // Subscribe to unread count
    const unsubscribeCount = subscribeToUnreadCount(currentUser.id, (count) => {
      setUnreadCount(count);
    });

    return () => {
      unsubscribeCount();
    };
  }, [currentUser]);

  // Load notifications
  useEffect(() => {
    if (!currentUser || !isOpen) return;
    loadNotifications();
  }, [currentUser, isOpen, filter]);

  const loadNotifications = async (startAfter = null) => {
    setLoading(true);
    try {
      const result = await getNotifications({
        limit: 20,
        startAfter,
        filter,
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
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAsUnread = async (notificationIds) => {
    try {
      await markNotificationsAsUnread(notificationIds);
      loadNotifications();
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
    // Mark as read
    if (!notification.read) {
      handleMarkAsRead([notification.id]);
    }

    // Navigate to related content
    if (notification.postId) {
      onClose();
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

  const getNotificationIcon = (type) => {
    const iconClass = 'w-10 h-10 rounded-full flex items-center justify-center';

    switch (type) {
      case 'comment':
        return <div className={`${iconClass} bg-blue-100 text-blue-600`}>💬</div>;
      case 'reaction':
        return <div className={`${iconClass} bg-pink-100 text-pink-600`}>❤️</div>;
      case 'mention':
        return <div className={`${iconClass} bg-purple-100 text-purple-600`}>@</div>;
      case 'status_change':
        return <div className={`${iconClass} bg-green-100 text-green-600`}>✓</div>;
      case 'priority_change':
        return <div className={`${iconClass} bg-orange-100 text-orange-600`}>⚠️</div>;
      case 'assigned':
        return <div className={`${iconClass} bg-indigo-100 text-indigo-600`}>👤</div>;
      default:
        return <div className={`${iconClass} bg-gray-100 text-gray-600`}>🔔</div>;
    }
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

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />

      {/* Notification Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-6 h-6" />
              <h2 className="text-xl font-bold">Notifications</h2>
              {unreadCount.total > 0 && (
                <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full text-sm font-semibold">
                  {unreadCount.total}
                </span>
              )}
            </div>
            <button onClick={onClose} className="hover:bg-white hover:bg-opacity-20 rounded p-1">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded ${
                filter === 'all' ? 'bg-white text-blue-600' : 'bg-white bg-opacity-20'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded ${
                filter === 'unread' ? 'bg-white text-blue-600' : 'bg-white bg-opacity-20'
              }`}
            >
              Unread
            </button>
            <button
              onClick={handleMarkAllAsRead}
              className="ml-auto px-3 py-1 rounded bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center gap-1"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/settings/notifications')}
              className="px-3 py-1 rounded bg-white bg-opacity-20 hover:bg-opacity-30"
              title="Notification settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedNotifications.length > 0 && (
          <div className="bg-blue-50 border-b border-blue-200 p-3 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {selectedNotifications.length} selected
            </span>
            <button
              onClick={() => handleMarkAsRead(selectedNotifications)}
              className="ml-auto px-3 py-1 text-sm bg-white rounded hover:bg-gray-50 flex items-center gap-1"
            >
              <MailOpen className="w-4 h-4" />
              Mark Read
            </button>
            <button
              onClick={() => handleMarkAsUnread(selectedNotifications)}
              className="px-3 py-1 text-sm bg-white rounded hover:bg-gray-50 flex items-center gap-1"
            >
              <Mail className="w-4 h-4" />
              Mark Unread
            </button>
            <button
              onClick={() => handleDelete(selectedNotifications)}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <BellOff className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No notifications</p>
              <p className="text-sm">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectNotification(notification.id);
                      }}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />

                    {/* Icon */}
                    {getNotificationIcon(notification.type)}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.read ? 'font-semibold' : ''}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(notification.createdAt)}
                      </p>
                    </div>

                    {/* Unread Indicator */}
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load More */}
          {pagination?.hasMore && (
            <div className="p-4 text-center">
              <button
                onClick={() => loadNotifications(pagination.lastDoc)}
                disabled={loading}
                className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={() => {
              navigate('/notifications');
              onClose();
            }}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View All Notifications
          </button>
        </div>
      </div>
    </>
  );
};

export default NotificationCenter;
