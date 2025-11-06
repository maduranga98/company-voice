import { useState, useEffect } from "react";
import {
  getDepartments,
  assignUserToDepartment,
  bulkAssignUsersToDepartment,
} from "../services/departmentService";

const DepartmentAssignment = ({
  users, // Array of users or single user
  companyId,
  onSuccess,
  onClose,
  mode = "single", // "single" or "bulk"
}) => {
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [error, setError] = useState("");

  const usersList = Array.isArray(users) ? users : [users];
  const isBulk = mode === "bulk" || usersList.length > 1;

  useEffect(() => {
    loadDepartments();
  }, [companyId]);

  const loadDepartments = async () => {
    try {
      setLoadingDepts(true);
      const depts = await getDepartments(companyId, false);
      setDepartments(depts);

      // Pre-select current department if single user
      if (!isBulk && usersList[0]?.departmentId) {
        setSelectedDepartment(usersList[0].departmentId);
      }
    } catch (error) {
      console.error("Error loading departments:", error);
      setError("Failed to load departments");
    } finally {
      setLoadingDepts(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedDepartment) {
      setError("Please select a department");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isBulk) {
        const userIds = usersList.map((u) => u.id);
        const result = await bulkAssignUsersToDepartment(
          userIds,
          selectedDepartment
        );

        if (result.success) {
          onSuccess && onSuccess(result);
          onClose && onClose();
        } else {
          setError("Some assignments failed. Please check the results.");
        }
      } else {
        const result = await assignUserToDepartment(
          usersList[0].id,
          selectedDepartment
        );

        if (result.success) {
          onSuccess && onSuccess(result);
          onClose && onClose();
        }
      }
    } catch (error) {
      console.error("Error assigning to department:", error);
      setError(error.message || "Failed to assign to department");
    } finally {
      setLoading(false);
    }
  };

  const selectedDept = departments.find((d) => d.id === selectedDepartment);

  if (loadingDepts) {
    return (
      <div className="p-6 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-gray-600">Loading departments...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {isBulk
          ? `Assign ${usersList.length} Users to Department`
          : `Assign ${usersList[0]?.displayName || "User"} to Department`}
      </h3>

      {/* User Preview */}
      {!isBulk && usersList[0] && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
              {usersList[0].displayName?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {usersList[0].displayName}
              </p>
              <p className="text-sm text-gray-500">{usersList[0].email}</p>
            </div>
          </div>
          {usersList[0].departmentId && (
            <p className="text-sm text-gray-600 mt-2">
              Currently in:{" "}
              {departments.find((d) => d.id === usersList[0].departmentId)
                ?.name || "Unknown"}
            </p>
          )}
        </div>
      )}

      {/* Bulk Users List */}
      {isBulk && (
        <div className="mb-4 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
          <p className="text-sm text-gray-600 mb-2">Selected users:</p>
          <div className="space-y-1">
            {usersList.map((user) => (
              <div key={user.id} className="flex items-center gap-2 text-sm">
                <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
                  {user.displayName?.charAt(0).toUpperCase()}
                </span>
                <span>{user.displayName}</span>
                {user.departmentId && (
                  <span className="text-gray-500">
                    ({departments.find((d) => d.id === user.departmentId)?.name}
                    )
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Department Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Department <span className="text-red-500">*</span>
        </label>

        {departments.length === 0 ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              No departments available. Please create a department first.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
            {departments.map((dept) => (
              <label
                key={dept.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedDepartment === dept.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="department"
                  value={dept.id}
                  checked={selectedDepartment === dept.id}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{dept.icon}</span>
                    <span className="font-medium text-gray-900">
                      {dept.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      ({dept.memberCount || 0} members)
                    </span>
                  </div>
                  {dept.description && (
                    <p className="text-sm text-gray-600 mt-1 ml-7">
                      {dept.description}
                    </p>
                  )}
                  {dept.headUserName && (
                    <p className="text-sm text-gray-500 mt-1 ml-7">
                      Led by {dept.headUserName}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Selected Department Preview */}
      {selectedDept && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Assigning to:</strong> {selectedDept.name}
          </p>
          {isBulk && (
            <p className="text-sm text-blue-600 mt-1">
              This will update the department for all {usersList.length}{" "}
              selected users.
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleAssign}
          disabled={loading || !selectedDepartment || departments.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading && (
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {isBulk ? `Assign ${usersList.length} Users` : "Assign to Department"}
        </button>
      </div>
    </div>
  );
};

export default DepartmentAssignment;
