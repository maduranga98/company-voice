import { useState } from "react";

const DepartmentCard = ({
  department,
  stats,
  viewMode,
  onEdit,
  onDelete,
  onViewDetails,
}) => {
  const [showActions, setShowActions] = useState(false);

  // Get color classes - complete class names for Tailwind JIT
  const getColorClasses = (colorName) => {
    const colorMap = {
      blue: {
        bg: "bg-blue-100",
        bgGradientFrom: "from-blue-500",
        bgGradientTo: "to-blue-600",
        bgLight: "bg-blue-50",
        textDark: "text-blue-700",
        hoverBg: "hover:bg-blue-100",
      },
      purple: {
        bg: "bg-purple-100",
        bgGradientFrom: "from-purple-500",
        bgGradientTo: "to-purple-600",
        bgLight: "bg-purple-50",
        textDark: "text-purple-700",
        hoverBg: "hover:bg-purple-100",
      },
      green: {
        bg: "bg-green-100",
        bgGradientFrom: "from-green-500",
        bgGradientTo: "to-green-600",
        bgLight: "bg-green-50",
        textDark: "text-green-700",
        hoverBg: "hover:bg-green-100",
      },
      orange: {
        bg: "bg-orange-100",
        bgGradientFrom: "from-orange-500",
        bgGradientTo: "to-orange-600",
        bgLight: "bg-orange-50",
        textDark: "text-orange-700",
        hoverBg: "hover:bg-orange-100",
      },
      red: {
        bg: "bg-red-100",
        bgGradientFrom: "from-red-500",
        bgGradientTo: "to-red-600",
        bgLight: "bg-red-50",
        textDark: "text-red-700",
        hoverBg: "hover:bg-red-100",
      },
      yellow: {
        bg: "bg-yellow-100",
        bgGradientFrom: "from-yellow-500",
        bgGradientTo: "to-yellow-600",
        bgLight: "bg-yellow-50",
        textDark: "text-yellow-700",
        hoverBg: "hover:bg-yellow-100",
      },
      indigo: {
        bg: "bg-indigo-100",
        bgGradientFrom: "from-indigo-500",
        bgGradientTo: "to-indigo-600",
        bgLight: "bg-indigo-50",
        textDark: "text-indigo-700",
        hoverBg: "hover:bg-indigo-100",
      },
      pink: {
        bg: "bg-pink-100",
        bgGradientFrom: "from-pink-500",
        bgGradientTo: "to-pink-600",
        bgLight: "bg-pink-50",
        textDark: "text-pink-700",
        hoverBg: "hover:bg-pink-100",
      },
      teal: {
        bg: "bg-teal-100",
        bgGradientFrom: "from-teal-500",
        bgGradientTo: "to-teal-600",
        bgLight: "bg-teal-50",
        textDark: "text-teal-700",
        hoverBg: "hover:bg-teal-100",
      },
      gray: {
        bg: "bg-gray-100",
        bgGradientFrom: "from-gray-500",
        bgGradientTo: "to-gray-600",
        bgLight: "bg-gray-50",
        textDark: "text-gray-700",
        hoverBg: "hover:bg-gray-100",
      },
    };
    return colorMap[colorName] || colorMap.blue;
  };

  // Default department colors based on name
  const getDepartmentColorName = (name) => {
    const nameMap = {
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
    for (const [dept, color] of Object.entries(nameMap)) {
      if (key.includes(dept)) return color;
    }
    return "blue"; // default color
  };

  const colorName = department.color || getDepartmentColorName(department.name);
  const colorClasses = getColorClasses(colorName);
  const isInactive = department.isActive === false;

  if (viewMode === "list") {
    return (
      <div
        className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow ${
          isInactive ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Department Icon */}
            <div
              className={`w-12 h-12 ${colorClasses.bg} rounded-lg flex items-center justify-center`}
            >
              <span className="text-2xl">{department.icon || "🏢"}</span>
            </div>

            {/* Department Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {department.name}
                </h3>
                {isInactive && (
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                    Inactive
                  </span>
                )}
                {department.headUserName && (
                  <span className="text-sm text-gray-500">
                    • Led by {department.headUserName}
                  </span>
                )}
              </div>
              {department.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {department.description}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {department.memberCount || 0}
                </p>
                <p className="text-xs text-gray-500">Members</p>
              </div>
              {stats && (
                <>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {stats.resolvedIssues || 0}
                    </p>
                    <p className="text-xs text-gray-500">Resolved</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {stats.pendingIssues || 0}
                    </p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onViewDetails(department)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="View details"
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
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
              <button
                onClick={() => onEdit(department)}
                className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                title="Edit"
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
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={() => onDelete(department.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
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
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className={`bg-white rounded-lg shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden ${
        isInactive ? "opacity-60" : ""
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header */}
      <div
        className={`bg-gradient-to-r ${colorClasses.bgGradientFrom} ${colorClasses.bgGradientTo} p-4 relative`}
      >
        <div className="flex items-center justify-between">
          <div
            className={`w-14 h-14 bg-white bg-opacity-20 backdrop-blur rounded-lg flex items-center justify-center`}
          >
            <span className="text-3xl">{department.icon || "🏢"}</span>
          </div>

          {/* Action buttons - Always visible on mobile, hover on desktop */}
          <div
            className={`flex gap-1 transition-opacity ${
              showActions ? "opacity-100" : "md:opacity-0 opacity-100"
            }`}
          >
            <button
              onClick={() => onEdit(department)}
              className="p-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition-colors"
              title="Edit"
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            <button
              onClick={() => onDelete(department.id)}
              className="p-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition-colors"
              title="Delete"
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">
            {department.name}
          </h3>
          {isInactive && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
              Inactive
            </span>
          )}
        </div>

        {department.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {department.description}
          </p>
        )}

        {/* Department Head */}
        {department.headUserName && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded">
            <svg
              className="w-4 h-4 text-gray-500"
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
            <span className="text-sm text-gray-700">
              Led by{" "}
              <span className="font-medium">{department.headUserName}</span>
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-lg font-bold text-gray-900">
              {department.memberCount || 0}
            </p>
            <p className="text-xs text-gray-500">Members</p>
          </div>
          {stats && (
            <>
              <div className="text-center p-2 bg-green-50 rounded">
                <p className="text-lg font-bold text-green-600">
                  {stats.resolvedIssues || 0}
                </p>
                <p className="text-xs text-gray-500">Resolved</p>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded">
                <p className="text-lg font-bold text-orange-600">
                  {stats.pendingIssues || 0}
                </p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
            </>
          )}
        </div>

        {/* View Details Button */}
        <button
          onClick={() => onViewDetails(department)}
          className={`w-full py-2 ${colorClasses.bgLight} ${colorClasses.textDark} rounded-lg ${colorClasses.hoverBg} transition-colors text-sm font-medium`}
        >
          View Details
        </button>
      </div>
    </div>
  );
};

export default DepartmentCard;
