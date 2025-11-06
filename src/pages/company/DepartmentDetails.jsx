import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDepartmentById, getDepartmentStats } from "../../services/departmentservice";

const DepartmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDepartmentDetails();
  }, [id]);

  const loadDepartmentDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const deptData = await getDepartmentById(id);
      const deptStats = await getDepartmentStats(id);
      setDepartment(deptData);
      setStats(deptStats);
    } catch (error) {
      console.error("Error loading department details:", error);
      setError("Failed to load department details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading department details...</p>
        </div>
      </div>
    );
  }

  if (error || !department) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-red-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {error || "Department not found"}
            </h3>
            <button
              onClick={() => navigate("/company/departments")}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Departments
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getDepartmentColor = (name) => {
    const colorMap = {
      engineering: "blue",
      hr: "purple",
      finance: "green",
      marketing: "orange",
      sales: "red",
      operations: "yellow",
      it: "indigo",
      legal: "gray",
      admin: "pink",
      facilities: "teal",
    };

    const key = name.toLowerCase();
    for (const [dept, color] of Object.entries(colorMap)) {
      if (key.includes(dept)) return color;
    }
    return "blue";
  };

  const color = getDepartmentColor(department.name);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate("/company/departments")}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Departments
        </button>

        {/* Department Header */}
        <div className={`bg-gradient-to-r from-${color}-500 to-${color}-600 rounded-xl shadow-lg p-8 mb-6 text-white`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-white bg-opacity-20 backdrop-blur rounded-xl flex items-center justify-center">
                <span className="text-5xl">{department.icon || "🏢"}</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{department.name}</h1>
                {department.description && (
                  <p className="text-lg text-white text-opacity-90">
                    {department.description}
                  </p>
                )}
                {department.headUserName && (
                  <div className="flex items-center gap-2 mt-3">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span className="text-white text-opacity-90">
                      Led by <span className="font-semibold">{department.headUserName}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {department.isActive ? (
                <span className="px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-full">
                  Active
                </span>
              ) : (
                <span className="px-3 py-1 bg-gray-500 text-white text-sm font-medium rounded-full">
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Members</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {department.memberCount || 0}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Posts</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats?.totalPosts || 0}
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resolved Issues</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {stats?.resolvedIssues || 0}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Issues</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {stats?.pendingIssues || 0}
                </p>
              </div>
              <div className="bg-orange-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Members List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Department Members</h2>
            <p className="text-sm text-gray-600 mt-1">
              {department.memberCount || 0} {department.memberCount === 1 ? "member" : "members"} in this department
            </p>
          </div>

          {department.members && department.members.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {department.members.map((member) => (
                <div
                  key={member.id}
                  className="px-6 py-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        {member.displayName?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {member.displayName || "Unknown"}
                          {member.id === department.headUserId && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              Head
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">{member.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          member.role === "company_admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {member.role === "company_admin" ? "Admin" : "Employee"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <svg
                className="w-16 h-16 mx-auto text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Members Yet
              </h3>
              <p className="text-gray-600">
                This department doesn't have any members assigned yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepartmentDetails;
