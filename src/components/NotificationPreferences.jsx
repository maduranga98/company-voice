/**
 * Notification Preferences Component
 * Allows users to manage their notification settings
 */

import React, { useState, useEffect } from 'react';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../services/notificationService';
import { Bell, Mail, Clock, Save, Check } from 'lucide-react';

const NotificationPreferences = () => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await getNotificationPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateNotificationPreferences(preferences);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleInAppChange = (key, value) => {
    setPreferences((prev) => ({
      ...prev,
      inApp: {
        ...prev.inApp,
        [key]: value,
      },
    }));
  };

  const handleEmailChange = (path, value) => {
    setPreferences((prev) => {
      const newPrefs = { ...prev };
      const keys = path.split('.');
      let current = newPrefs.email;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newPrefs;
    });
  };

  const handleDigestScheduleChange = (key, value) => {
    setPreferences((prev) => ({
      ...prev,
      digestSchedule: {
        ...prev.digestSchedule,
        [key]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center p-8 text-gray-500">
        Failed to load preferences. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notification Preferences
          </h2>
          <p className="text-gray-600 mt-1">Manage how you receive notifications</p>
        </div>

        {/* In-App Notifications */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            In-App Notifications
          </h3>
          <div className="space-y-3">
            {[
              { key: 'comments', label: 'New comments on your posts' },
              { key: 'reactions', label: 'Reactions to your posts' },
              { key: 'mentions', label: 'When someone mentions you' },
              { key: 'statusChanges', label: 'Status changes on your posts' },
              { key: 'priorityChanges', label: 'Priority changes on your posts' },
              { key: 'newPosts', label: 'New posts in your department' },
              { key: 'assignedToYou', label: 'When a post is assigned to you' },
              { key: 'departmentUpdates', label: 'Department announcements' },
              { key: 'systemAnnouncements', label: 'System announcements' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                <span className="text-gray-700">{label}</span>
                <input
                  type="checkbox"
                  checked={preferences.inApp[key]}
                  onChange={(e) => handleInAppChange(key, e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Email Notifications */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Notifications
          </h3>

          {/* Enable Email */}
          <label className="flex items-center justify-between p-3 bg-blue-50 rounded-lg cursor-pointer mb-4">
            <span className="font-medium text-gray-900">Enable email notifications</span>
            <input
              type="checkbox"
              checked={preferences.email.enabled}
              onChange={(e) => handleEmailChange('enabled', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
            />
          </label>

          {preferences.email.enabled && (
            <>
              {/* Digest Options */}
              <div className="space-y-3 mb-4">
                <h4 className="font-medium text-gray-900">Digest Emails</h4>
                <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <span className="text-gray-700">Daily digest</span>
                  <input
                    type="checkbox"
                    checked={preferences.email.dailyDigest}
                    onChange={(e) => handleEmailChange('dailyDigest', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                  />
                </label>
                <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <span className="text-gray-700">Weekly digest</span>
                  <input
                    type="checkbox"
                    checked={preferences.email.weeklyDigest}
                    onChange={(e) => handleEmailChange('weeklyDigest', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                  />
                </label>
              </div>

              {/* Immediate Email Notifications */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Immediate Email Alerts</h4>
                {[
                  { key: 'mentions', label: 'When someone mentions you' },
                  { key: 'assignedToYou', label: 'When a post is assigned to you' },
                  { key: 'statusChanges', label: 'Status changes on your posts' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <span className="text-gray-700">{label}</span>
                    <input
                      type="checkbox"
                      checked={preferences.email.immediate[key]}
                      onChange={(e) => handleEmailChange(`immediate.${key}`, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Digest Schedule */}
        {preferences.email.enabled && (preferences.email.dailyDigest || preferences.email.weeklyDigest) && (
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Digest Schedule
            </h3>

            <div className="space-y-4">
              {preferences.email.dailyDigest && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Daily Digest Time (24-hour format)
                  </label>
                  <input
                    type="time"
                    value={preferences.digestSchedule.dailyTime}
                    onChange={(e) => handleDigestScheduleChange('dailyTime', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {preferences.email.weeklyDigest && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weekly Digest Day
                  </label>
                  <select
                    value={preferences.digestSchedule.weeklyDay}
                    onChange={(e) => handleDigestScheduleChange('weeklyDay', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                <input
                  type="text"
                  value={preferences.digestSchedule.timezone}
                  onChange={(e) => handleDigestScheduleChange('timezone', e.target.value)}
                  placeholder="e.g., America/New_York"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use IANA timezone format (e.g., America/New_York, Europe/London)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="p-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="w-5 h-5" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Preferences
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferences;
