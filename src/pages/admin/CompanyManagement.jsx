import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { hashPassword, checkUsernameExists } from "../../services/authService";

const CompanyManagement = () => {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    companyName: "",
    industry: "",
    username: "",
    password: "",
    adminName: "",
    adminEmail: "",
  });

  useEffect(() => {
    // Check if user is super admin
    if (userData?.role !== "super_admin") {
      navigate("/dashboard");
    }

    loadCompanies();
  }, [userData, navigate]);

  const loadCompanies = async () => {
    try {
      const companiesRef = collection(db, "companies");
      const q = query(companiesRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const companiesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setCompanies(companiesList);
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Validate username
      const usernameExists = await checkUsernameExists(formData.username);
      if (usernameExists) {
        setError("Username already exists. Please choose another.");
        setLoading(false);
        return;
      }

      // Create company
      const companyRef = await addDoc(collection(db, "companies"), {
        name: formData.companyName,
        industry: formData.industry,
        isActive: true,
        subscriptionStatus: "trial",
        employeeCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create company admin user
      await addDoc(collection(db, "users"), {
        username: formData.username.toLowerCase(),
        password: hashPassword(formData.password),
        displayName: formData.adminName,
        email: formData.adminEmail,
        companyId: companyRef.id,
        role: "company_admin",
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccess(`Company "${formData.companyName}" created successfully!`);
      setFormData({
        companyName: "",
        industry: "",
        username: "",
        password: "",
        adminName: "",
        adminEmail: "",
      });

      setShowModal(false);
      loadCompanies();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(""), 5000);
    } catch (error) {
      console.error("Error creating company:", error);
      setError("Failed to create company. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile Responsive */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 space-y-3 sm:space-y-0">
            {/* Title */}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Super Admin Panel
              </h1>
            </div>

            {/* User Info & Actions */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-gray-700 truncate max-w-[150px] sm:max-w-none">
                {userData?.displayName || userData?.username}
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded whitespace-nowrap">
                SUPER ADMIN
              </span>
              <button
                onClick={handleLogout}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-start">
            <svg
              className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm sm:text-base">{success}</span>
          </div>
        )}

        {/* Header Section - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Company Management
            </h2>
            <p className="text-sm sm:text-base text-gray-600 mt-2">
              Manage companies and create admin accounts
            </p>
          </div>

          {/* Add Company Button - Fixed Colors */}
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center px-4 sm:px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition shadow-lg text-sm sm:text-base w-full sm:w-auto"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add New Company
          </button>
        </div>

        {/* Companies Table - Mobile Responsive */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <svg
                          className="w-12 h-12 text-gray-400 mb-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No companies yet
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Get started by creating your first company
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  companies.map((company) => (
                    <tr
                      key={company.id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {company.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {company.industry || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            company.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {company.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {company.employeeCount || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {company.createdAt?.toDate().toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden">
            {companies.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <svg
                  className="w-12 h-12 text-gray-400 mb-4 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No companies yet
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Get started by creating your first company
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="p-4 hover:bg-gray-50 transition"
                  >
                    {/* Company Name */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900">
                          {company.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {company.industry || "N/A"}
                        </p>
                      </div>
                      <span
                        className={`ml-2 px-2 py-1 text-xs leading-4 font-semibold rounded-full whitespace-nowrap ${
                          company.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {company.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Employees:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {company.employeeCount || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Created:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {company.createdAt?.toDate().toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Company Modal - Mobile Responsive */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              {/* Modal Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Add New Company
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Create a new company and admin account
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setError("");
                  }}
                  className="text-gray-400 hover:text-gray-600 transition flex-shrink-0 ml-4"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Company Information */}
                <div>
                  <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                    Company Information
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm sm:text-base"
                        placeholder="Acme Corporation"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Industry
                      </label>
                      <input
                        type="text"
                        name="industry"
                        value={formData.industry}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm sm:text-base"
                        placeholder="Technology"
                      />
                    </div>
                  </div>
                </div>

                {/* Admin Account */}
                <div>
                  <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                    Admin Account
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Username *
                        </label>
                        <input
                          type="text"
                          name="username"
                          value={formData.username}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm sm:text-base"
                          placeholder="admin.acme"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Password *
                        </label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required
                          minLength={6}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm sm:text-base"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Admin Name *
                        </label>
                        <input
                          type="text"
                          name="adminName"
                          value={formData.adminName}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm sm:text-base"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Admin Email *
                        </label>
                        <input
                          type="email"
                          name="adminEmail"
                          value={formData.adminEmail}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm sm:text-base"
                          placeholder="admin@acme.com"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buttons - Fixed Colors & Mobile Friendly */}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end space-y-3 space-y-reverse sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setError("");
                    }}
                    className="w-full sm:w-auto px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 active:bg-gray-100 transition text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm sm:text-base"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Creating...
                      </span>
                    ) : (
                      "Create Company"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManagement;
