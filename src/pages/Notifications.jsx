import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../config/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { useTranslation } from 'react-i18next';
import {
  Bell,
  MessageCircle,
  Heart,
  FileText,
  Info,
  CheckCheck,
  Check,
  Trash2,
  BellOff,
} from "lucide-react";

const Notifications = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, unread, read

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", currentUser.id),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotifications(notifList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const markAsRead = async (notificationId) => {
    try {
      const notifRef = doc(db, "notifications", notificationId);
      await updateDoc(notifRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter((n) => !n.read);
      const promises = unreadNotifications.map((n) =>
        updateDoc(doc(db, "notifications", n.id), { read: true })
      );
      await Promise.all(promises);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await deleteDoc(doc(db, "notifications", notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const getNotificationIcon = (type) => {
    const iconMap = {
      comment: { bg: "bg-blue-50", icon: <MessageCircle className="w-5 h-5 text-blue-500" /> },
      like: { bg: "bg-rose-50", icon: <Heart className="w-5 h-5 text-rose-500" fill="currentColor" /> },
      post: { bg: "bg-emerald-50", icon: <FileText className="w-5 h-5 text-emerald-500" /> },
      system: { bg: "bg-violet-50", icon: <Info className="w-5 h-5 text-violet-500" /> },
    };
    const config = iconMap[type] || { bg: "bg-gray-50", icon: <Bell className="w-5 h-5 text-gray-400" /> };
    return (
      <div className={`w-10 h-10 rounded-2xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
        {config.icon}
      </div>
    );
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return t('notifications.justNow');
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return t('notifications.justNow');
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch (error) {
      return "Recently";
    }
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "unread") return !notification.read;
    if (filter === "read") return notification.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-50/50">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
                style={{ backgroundColor: "#1ABC9C" }}
              >
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#2D3E50" }}>
                  {t('notifications.notifications')}
                </h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  {t('notifications.stayUpdated')}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                style={{ backgroundColor: "#1ABC9C" }}
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">{t('notifications.markAllAsRead')}</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="mt-6 inline-flex gap-1 p-1 bg-white rounded-xl border border-gray-100 shadow-sm">
            {[
              { key: "all", label: t('notifications.all'), count: notifications.length },
              { key: "unread", label: t('notifications.unread'), count: unreadCount },
              { key: "read", label: t('notifications.read'), count: notifications.length - unreadCount },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className="px-4 py-2 text-sm font-medium rounded-xl transition-all"
                style={{
                  backgroundColor: filter === tab.key ? "#2D3E50" : "transparent",
                  color: filter === tab.key ? "white" : "#6b7280",
                }}
              >
                {tab.label}
                <span
                  className="ml-1.5 px-1.5 py-0.5 text-xs rounded-lg font-semibold"
                  style={{
                    backgroundColor: filter === tab.key ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.05)",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 mx-auto" style={{ borderTopColor: "#1ABC9C" }}></div>
            <p className="mt-4 text-sm text-gray-500">{t('notifications.loading')}</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <BellOff className="w-7 h-7 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "#2D3E50" }}>
              {t('notifications.noNotifications')}
            </h3>
            <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto">
              {filter === "unread"
                ? t('notifications.allCaughtUp')
                : t('notifications.noNotificationsYet')}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`group px-5 py-4 hover:bg-gray-50/50 transition-colors ${
                  !notification.read ? "bg-[#1ABC9C]/[0.03]" : ""
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Unread indicator dot */}
                  <div className="relative">
                    {getNotificationIcon(notification.type)}
                    {!notification.read && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                        style={{ backgroundColor: "#1ABC9C" }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm leading-snug ${
                            !notification.read
                              ? "font-semibold"
                              : "text-gray-600"
                          }`}
                          style={{ color: !notification.read ? "#2D3E50" : undefined }}
                        >
                          {notification.title}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="mt-1.5 text-xs text-gray-400">
                          {formatTimestamp(notification.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-2 rounded-xl text-gray-400 hover:text-[#1ABC9C] hover:bg-[#1ABC9C]/10 transition-colors"
                            title={t('notifications.markAsReadTitle')}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
