import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userData) return;

    // Route based on user role
    if (userData.role === "super_admin") {
      navigate("/admin/companies");
    } else if (userData.role === "company_admin") {
      navigate("/company/dashboard");
    } else if (userData.role === "employee") {
      // Redirect directly to creative wall instead of dashboard
      navigate("/employee/creative-wall");
    }
  }, [userData, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full animate-ping opacity-20"></div>
          </div>
          <div className="relative bg-white rounded-full p-6 shadow-xl">
            <svg
              className="animate-spin h-12 w-12 text-purple-600 mx-auto"
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
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        </div>
        <p className="text-gray-600 mt-8 text-lg font-medium">
          Loading your workspace...
        </p>
        <p className="text-gray-400 text-sm mt-2">Please wait a moment</p>
      </div>
    </div>
  );
};

export default Dashboard;
