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
import {
  ArrowLeft,
  Activity,
  FileText,
  Monitor,
  Users,
  SlidersHorizontal,
  Search,
  FilterX,
  FileJson,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
} from "lucide-react";

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
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: "#1ABC9C" }} />
          <p className="mt-3 text-sm text-gray-500 font-medium">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-xl border border-gray-100 bg-white shadow-sm text-gray-500 hover:text-[#2D3E50] hover:border-gray-200 transition-all"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#2D3E50" }}>
                Audit Log
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Comprehensive chronological history of all actions in the system
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500">Total Activities</p>
              <div className="p-2 rounded-xl bg-gray-50">
                <Activity className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: "#2D3E50" }}>{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500">Post Activities</p>
              <div className="p-2 rounded-xl" style={{ backgroundColor: "rgba(26, 188, 156, 0.1)" }}>
                <FileText className="w-4 h-4" style={{ color: "#1ABC9C" }} />
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: "#1ABC9C" }}>
              {stats.bySource.post || 0}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500">System Activities</p>
              <div className="p-2 rounded-xl bg-purple-50">
                <Monitor className="w-4 h-4 text-purple-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-purple-600">
              {stats.bySource.system || 0}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500">Active Users</p>
              <div className="p-2 rounded-xl bg-emerald-50">
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-600">
              {Object.keys(stats.byUser).length}
            </p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-5">
            <SlidersHorizontal className="w-5 h-5" style={{ color: "#2D3E50" }} />
            <h2 className="text-lg font-semibold" style={{ color: "#2D3E50" }}>
              Advanced Filters & Search
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            {/* Activity Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Activity Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 text-sm focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] transition-all"
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
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Filter by User
              </label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 text-sm focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] transition-all"
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
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Activity Source
              </label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 text-sm focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] transition-all"
              >
                <option value="all">All Sources</option>
                <option value="post">Post Activities</option>
                <option value="system">System Activities</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 text-sm focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] transition-all"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 text-sm focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] transition-all"
              />
            </div>

            {/* Search Query */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in metadata..."
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 text-sm focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] transition-all"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleFilterChange}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all shadow-sm"
              style={{ backgroundColor: "#1ABC9C" }}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Apply Filters
            </button>
            <button
              onClick={handleSearch}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all shadow-sm"
              style={{ backgroundColor: "#2D3E50" }}
            >
              <Search className="w-4 h-4" />
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
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-all"
            >
              <FilterX className="w-4 h-4" />
              Clear Filters
            </button>
            <button
              onClick={handleExportJSON}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100"
            >
              <FileJson className="w-4 h-4" />
              Export JSON
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-xl hover:bg-blue-100 transition-all border border-blue-100"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Activity List */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {activities.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-500">No activities found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100" style={{ backgroundColor: "#f8fafb" }}>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {currentActivities.map((activity) => {
                      const config = getActivityConfig(activity.type, activity.source);
                      const meta = activity.metadata || {};
                      const userName =
                        meta.adminName || meta.userName || meta.createdByName || "Unknown";

                      return (
                        <tr key={activity.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                            {formatDate(activity.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="mr-2 text-lg">{config.icon}</span>
                              <span
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${config.bgColor} ${config.textColor}`}
                              >
                                {config.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                                activity.source === "system"
                                  ? "bg-purple-50 text-purple-700"
                                  : "bg-[#1ABC9C]/10 text-[#1ABC9C]"
                              }`}
                            >
                              {activity.source === "system" ? "System" : "Post"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div>
                              <p className="font-medium" style={{ color: "#2D3E50" }}>{userName}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {meta.adminId || meta.userId || "N/A"}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-md">
                            <div className="space-y-1">
                              {meta.oldStatus && meta.newStatus && (
                                <p>
                                  Status: <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{meta.oldStatus}</span> → <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{meta.newStatus}</span>
                                </p>
                              )}
                              {meta.oldRole && meta.newRole && (
                                <p>
                                  Role: <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{meta.oldRole}</span> → <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{meta.newRole}</span>
                                </p>
                              )}
                              {meta.comment && (
                                <p className="italic truncate text-gray-400">"{meta.comment}"</p>
                              )}
                              {meta.reason && <p className="italic text-gray-400">Reason: {meta.reason}</p>}
                              {activity.postId && (
                                <p className="text-xs text-gray-400">
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
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Showing <span className="font-medium" style={{ color: "#2D3E50" }}>{indexOfFirstItem + 1}</span> to{" "}
                      <span className="font-medium" style={{ color: "#2D3E50" }}>{Math.min(indexOfLastItem, activities.length)}</span> of{" "}
                      <span className="font-medium" style={{ color: "#2D3E50" }}>{activities.length}</span> activities
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Prev
                      </button>
                      {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                        const pageNum = currentPage - 2 + i;
                        if (pageNum < 1 || pageNum > totalPages) return null;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                              currentPage === pageNum
                                ? "text-white shadow-sm"
                                : "border border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
                            }`}
                            style={currentPage === pageNum ? { backgroundColor: "#1ABC9C" } : {}}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Compliance Note */}
        <div className="mt-6 bg-blue-50/70 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-start">
            <div className="p-2 rounded-xl bg-blue-100/60 mr-3 flex-shrink-0">
              <Info className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-800">
                Compliance & Data Integrity
              </h3>
              <p className="mt-1.5 text-sm text-blue-600 leading-relaxed">
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
