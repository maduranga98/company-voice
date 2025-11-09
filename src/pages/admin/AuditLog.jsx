import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  getCompanyAuditLog,
  searchAuditLogs,
  getAuditLogStats,
  exportAuditLogsToJSON,
  exportAuditLogsToCSV,
} from "../../services/auditService";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import {
  PostActivityType,
  PostActivityTypeConfig,
  SystemActivityType,
  SystemActivityTypeConfig,
} from "../../utils/constants";

const AuditLog = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  // State
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, byType: {}, byUser: {}, bySource: {} });

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Data
  const [admins, setAdmins] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  useEffect(() => {
    if (!userData?.companyId) {
      navigate("/dashboard");
      return;
    }

    // Check if user is admin
    const isAdmin = ["company_admin", "hr", "super_admin"].includes(userData.role);
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    fetchAdmins();
    fetchActivities();
    fetchStats();
  }, [userData]);

  const fetchAdmins = async () => {
    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("companyId", "==", userData.companyId)
      );

      const snapshot = await getDocs(q);
      const userList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAdmins(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);

      const options = {
        limit: 500,
      };

      // Apply filters
      if (filterType !== "all") {
        options.activityType = filterType;
      }

      if (filterUser !== "all") {
        options.userId = filterUser;
      }

      if (startDate) {
        options.startDate = startDate;
      }

      if (endDate) {
        options.endDate = endDate;
      }

      // Apply source filter
      if (filterSource === "post") {
        options.includeSystemActivities = false;
      } else if (filterSource === "system") {
        options.includePostActivities = false;
      }

      let data;
      if (searchQuery.trim()) {
        data = await searchAuditLogs(userData.companyId, searchQuery, 500);
      } else {
        data = await getCompanyAuditLog(userData.companyId, options);
      }

      setActivities(data);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await getAuditLogStats(userData.companyId);
      setStats(statsData);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
    fetchActivities();
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchActivities();
  };

  const handleExportJSON = async () => {
    try {
      const json = await exportAuditLogsToJSON(userData.companyId, {
        activityType: filterType !== "all" ? filterType : null,
        userId: filterUser !== "all" ? filterUser : null,
        startDate: startDate || null,
        endDate: endDate || null,
      });

      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-log-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting to JSON:", error);
      alert("Failed to export audit log");
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = await exportAuditLogsToCSV(userData.companyId, {
        activityType: filterType !== "all" ? filterType : null,
        userId: filterUser !== "all" ? filterUser : null,
        startDate: startDate || null,
        endDate: endDate || null,
      });

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-log-${new Date().toISOString()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      alert("Failed to export audit log");
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const getActivityConfig = (activityType, source) => {
    if (source === "system") {
      return (
        SystemActivityTypeConfig[activityType] || {
          label: activityType,
          icon: "📋",
          color: "gray",
        }
      );
    }
    return (
      PostActivityTypeConfig[activityType] || {
        label: activityType,
        icon: "📋",
        color: "gray",
      }
    );
  };

  const allActivityTypes = [
    ...Object.entries(PostActivityType).map(([key, value]) => ({
      value,
      label: PostActivityTypeConfig[value]?.label || value,
      source: "post",
    })),
    ...Object.entries(SystemActivityType).map(([key, value]) => ({
      value,
      label: SystemActivityTypeConfig[value]?.label || value,
      source: "system",
    })),
  ];

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentActivities = activities.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(activities.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading && activities.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-2 text-gray-600">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive chronological history of all actions in the system
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-gray-600 text-sm font-medium">Total Activities</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-gray-600 text-sm font-medium">Post Activities</p>
          <p className="text-3xl font-bold text-indigo-600 mt-1">
            {stats.bySource.post || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-gray-600 text-sm font-medium">System Activities</p>
          <p className="text-3xl font-bold text-purple-600 mt-1">
            {stats.bySource.system || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-gray-600 text-sm font-medium">Active Users</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {Object.keys(stats.byUser).length}
          </p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Advanced Filters & Search
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* Activity Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Activity Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Activities</option>
              <optgroup label="Post Activities">
                {Object.entries(PostActivityType).map(([key, value]) => (
                  <option key={value} value={value}>
                    {PostActivityTypeConfig[value]?.label || value}
                  </option>
                ))}
              </optgroup>
              <optgroup label="System Activities">
                {Object.entries(SystemActivityType).map(([key, value]) => (
                  <option key={value} value={value}>
                    {SystemActivityTypeConfig[value]?.label || value}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by User
            </label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Users</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.displayName || admin.username} ({admin.role})
                </option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Activity Source
            </label>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Sources</option>
              <option value="post">Post Activities</option>
              <option value="system">System Activities</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in metadata..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleFilterChange}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Apply Filters
          </button>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Search
          </button>
          <button
            onClick={() => {
              setFilterType("all");
              setFilterUser("all");
              setFilterSource("all");
              setSearchQuery("");
              setStartDate("");
              setEndDate("");
              setCurrentPage(1);
              setTimeout(fetchActivities, 100);
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors"
          >
            Clear Filters
          </button>
          <button
            onClick={handleExportJSON}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        {activities.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p className="text-lg">No activities found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentActivities.map((activity) => {
                    const config = getActivityConfig(activity.type, activity.source);
                    const meta = activity.metadata || {};
                    const userName =
                      meta.adminName || meta.userName || meta.createdByName || "Unknown";

                    return (
                      <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                          {formatDate(activity.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="mr-2 text-lg">{config.icon}</span>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
                            >
                              {config.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              activity.source === "system"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-indigo-100 text-indigo-800"
                            }`}
                          >
                            {activity.source === "system" ? "System" : "Post"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>
                            <p className="font-medium">{userName}</p>
                            <p className="text-xs text-gray-500">
                              {meta.adminId || meta.userId || "N/A"}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                          <div className="space-y-1">
                            {meta.oldStatus && meta.newStatus && (
                              <p>
                                Status: <span className="font-mono">{meta.oldStatus}</span> →{" "}
                                <span className="font-mono">{meta.newStatus}</span>
                              </p>
                            )}
                            {meta.oldRole && meta.newRole && (
                              <p>
                                Role: <span className="font-mono">{meta.oldRole}</span> →{" "}
                                <span className="font-mono">{meta.newRole}</span>
                              </p>
                            )}
                            {meta.comment && (
                              <p className="italic truncate">"{meta.comment}"</p>
                            )}
                            {meta.reason && <p className="italic">Reason: {meta.reason}</p>}
                            {activity.postId && (
                              <p className="text-xs text-gray-500">
                                Post: {activity.postId.substring(0, 8)}...
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {indexOfFirstItem + 1} to{" "}
                    {Math.min(indexOfLastItem, activities.length)} of {activities.length}{" "}
                    activities
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                      const pageNum = currentPage - 2 + i;
                      if (pageNum < 1 || pageNum > totalPages) return null;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            currentPage === pageNum
                              ? "bg-indigo-600 text-white"
                              : "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Compliance Note */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Compliance & Data Integrity
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                All audit logs are immutable and cannot be modified or deleted. This ensures
                compliance with data integrity requirements for auditing purposes. Logs are
                retained according to your company's data retention policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLog;
