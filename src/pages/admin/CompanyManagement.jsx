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
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
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
  const [showPassword, setShowPassword] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [newCredentials, setNewCredentials] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState(null);

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

      // Store credentials to display to user
      setNewCredentials({
        companyName: formData.companyName,
        username: formData.username,
        password: formData.password,
        adminName: formData.adminName,
        adminEmail: formData.adminEmail,
      });

      setFormData({
        companyName: "",
        industry: "",
        username: "",
        password: "",
        adminName: "",
        adminEmail: "",
      });

      setShowModal(false);
      setShowCredentialsModal(true);
      loadCompanies();
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

  const handleViewDetails = async (company) => {
    try {
      // Fetch the complete company details
      const companyDoc = await getDoc(doc(db, "companies", company.id));
      if (companyDoc.exists()) {
        setSelectedCompany({ id: companyDoc.id, ...companyDoc.data() });
        setShowDetailsModal(true);
      }
    } catch (error) {
      console.error("Error loading company details:", error);
      setError("Failed to load company details.");
    }
  };

  const handleToggleStatus = async (company) => {
    try {
      setLoading(true);
      const companyRef = doc(db, "companies", company.id);
      await updateDoc(companyRef, {
        isActive: !company.isActive,
        updatedAt: serverTimestamp(),
      });

      setSuccess(`Company ${!company.isActive ? 'activated' : 'deactivated'} successfully!`);
      loadCompanies();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error updating company status:", error);
      setError("Failed to update company status.");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (company) => {
    setCompanyToDelete(company);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!companyToDelete) return;

    try {
      setLoading(true);

      // Delete company
      await deleteDoc(doc(db, "companies", companyToDelete.id));

      // Note: In production, you should also delete or deactivate all associated users and data
      // For now, we'll just delete the company document

      setSuccess(`Company "${companyToDelete.name}" deleted successfully!`);
      setShowDeleteModal(false);
      setCompanyToDelete(null);
      loadCompanies();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error deleting company:", error);
      setError("Failed to delete company. Please try again.");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile Responsive */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 space-y-3 sm:space-y-0">
            {/* Title & Navigation */}
            <div className="flex flex-col space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Super Admin Panel
              </h1>
              <div className="flex space-x-4">
                <button
                  onClick={() => navigate("/admin/companies")}
                  className="text-sm font-medium text-indigo-600 border-b-2 border-indigo-600"
                >
                  Companies
                </button>
                <button
                  onClick={() => navigate("/admin/billing")}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
                >
                  Billing
                </button>
              </div>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
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
                        <button
                          onClick={() => handleViewDetails(company)}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-900"
                        >
                          {company.name}
                        </button>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewDetails(company)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="View Details"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(company)}
                            className={company.isActive ? "text-yellow-600 hover:text-yellow-900" : "text-green-600 hover:text-green-900"}
                            title={company.isActive ? "Deactivate" : "Activate"}
                          >
                            {company.isActive ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteClick(company)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
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
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
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

                    {/* Action Buttons - Mobile */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => handleViewDetails(company)}
                        className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleToggleStatus(company)}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition ${
                          company.isActive
                            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                            : "bg-green-100 text-green-800 hover:bg-green-200"
                        }`}
                      >
                        {company.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDeleteClick(company)}
                        className="px-3 py-2 bg-red-100 text-red-800 text-sm font-medium rounded-lg hover:bg-red-200 transition"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            required
                            minLength={6}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm sm:text-base pr-10"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
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

      {/* Credentials Display Modal */}
      {showCredentialsModal && newCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Company Created Successfully!
              </h3>
              <p className="text-sm text-gray-600 text-center mb-6">
                Please save these credentials securely
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Company Name</label>
                  <p className="text-sm font-semibold text-gray-900">{newCredentials.companyName}</p>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Admin Name</label>
                  <p className="text-sm font-semibold text-gray-900">{newCredentials.adminName}</p>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Admin Email</label>
                  <p className="text-sm font-semibold text-gray-900">{newCredentials.adminEmail}</p>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                    <code className="text-sm font-mono text-gray-900">{newCredentials.username}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newCredentials.username);
                      }}
                      className="text-indigo-600 hover:text-indigo-800"
                      title="Copy username"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                    <code className="text-sm font-mono text-gray-900">{newCredentials.password}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newCredentials.password);
                      }}
                      className="text-indigo-600 hover:text-indigo-800"
                      title="Copy password"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-yellow-800">
                    <strong>Important:</strong> These credentials will not be shown again. Please save them securely.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setNewCredentials(null);
                  setSuccess(`Company "${newCredentials.companyName}" created successfully!`);
                  setTimeout(() => setSuccess(""), 5000);
                }}
                className="w-full px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
              >
                I've Saved These Credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Company Details Modal */}
      {showDetailsModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedCompany.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">Company Details</p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Company ID</label>
                    <code className="text-sm font-mono text-gray-900 break-all">{selectedCompany.id}</code>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedCompany.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                      {selectedCompany.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Industry</label>
                  <p className="text-sm font-semibold text-gray-900">{selectedCompany.industry || "Not specified"}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Employees</label>
                    <p className="text-sm font-semibold text-gray-900">{selectedCompany.employeeCount || 0}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Subscription</label>
                    <p className="text-sm font-semibold text-gray-900 capitalize">{selectedCompany.subscriptionStatus || "trial"}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Created At</label>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedCompany.createdAt?.toDate ? selectedCompany.createdAt.toDate().toLocaleString() : "N/A"}
                  </p>
                </div>

                {selectedCompany.updatedAt && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Last Updated</label>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedCompany.updatedAt.toDate ? selectedCompany.updatedAt.toDate().toLocaleString() : "N/A"}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleToggleStatus(selectedCompany);
                  }}
                  className={`flex-1 px-4 py-3 ${
                    selectedCompany.isActive
                      ? "bg-yellow-600 hover:bg-yellow-700"
                      : "bg-green-600 hover:bg-green-700"
                  } text-white font-medium rounded-lg transition`}
                >
                  {selectedCompany.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleDeleteClick(selectedCompany);
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition"
                >
                  Delete Company
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && companyToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Company?
              </h3>
              <p className="text-sm text-gray-600 text-center mb-6">
                Are you sure you want to delete <strong>{companyToDelete.name}</strong>? This action cannot be undone.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                <p className="text-xs text-red-800">
                  <strong>Warning:</strong> This will permanently delete the company and may affect associated users and data.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setCompanyToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  {loading ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManagement;
