import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { checkUsernameExists, hashPassword } from "../services/authService";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { companyId, companyName } = location.state || {};

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    mobile: "",
    gender: "",
    password: "",
    confirmPassword: "",
  });

  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecked, setUsernameChecked] = useState(false);
  const usernameCheckTimeout = useRef(null);

  useEffect(() => {
    if (!companyId) {
      navigate("/login");
      return;
    }
    loadCompany();
  }, [companyId, navigate]);

  // Auto-check username availability with debounce
  useEffect(() => {
    // Clear any existing timeout
    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }

    // Reset states when username changes
    setUsernameAvailable(null);
    setUsernameChecked(false);

    // Don't check if username is too short or empty
    if (!formData.username || formData.username.length < 3) {
      return;
    }

    // Set a timeout to check username after 500ms of no typing
    usernameCheckTimeout.current = setTimeout(async () => {
      setCheckingUsername(true);
      setError("");

      try {
        const exists = await checkUsernameExists(formData.username);
        setUsernameAvailable(!exists);
        setUsernameChecked(true);

        if (exists) {
          setError("Username already taken. Please choose another.");
        }
      } catch (error) {
        console.error("Error checking username:", error);
        setError("Failed to check username availability.");
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    // Cleanup function
    return () => {
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }
    };
  }, [formData.username]);

  const loadCompany = async () => {
    try {
      const companyDoc = await getDoc(doc(db, "companies", companyId));
      if (companyDoc.exists()) {
        setCompany({ id: companyDoc.id, ...companyDoc.data() });
      } else {
        setError("Company not found. Please contact your HR department.");
      }
    } catch (error) {
      console.error("Error loading company:", error);
      setError("Failed to load company information.");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // For username, only allow alphanumeric characters
    if (name === "username") {
      const alphanumericValue = value.replace(/[^a-zA-Z0-9]/g, '');
      setFormData((prev) => ({
        ...prev,
        [name]: alphanumericValue,
      }));
      // Auto-check will be triggered by useEffect
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      setError("Full name is required");
      return false;
    }

    if (!formData.username || formData.username.length < 3) {
      setError("Username must be at least 3 characters long");
      return false;
    }

    // Validate alphanumeric username
    if (!/^[a-zA-Z0-9]+$/.test(formData.username)) {
      setError("Username must contain only letters and numbers (no spaces or special characters)");
      return false;
    }

    if (!usernameChecked || !usernameAvailable) {
      setError("Please check username availability");
      return false;
    }

    if (!formData.mobile || !/^\d{10}$/.test(formData.mobile)) {
      setError("Please enter a valid 10-digit mobile number");
      return false;
    }

    if (!formData.gender) {
      setError("Please select your gender");
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      await addDoc(collection(db, "users"), {
        username: formData.username.toLowerCase(),
        password: hashPassword(formData.password),
        displayName: formData.fullName,
        mobile: formData.mobile,
        gender: formData.gender,
        companyId: companyId,
        role: "employee",
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccess(
        "Registration successful! Your account is pending approval from your company admin."
      );

      setFormData({
        fullName: "",
        username: "",
        mobile: "",
        gender: "",
        password: "",
        confirmPassword: "",
      });
      setUsernameAvailable(null);
      setUsernameChecked(false);

      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      console.error("Registration error:", error);
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!company) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={() => navigate("/login")}
          className="flex items-center text-slate-600 hover:text-slate-900 transition-colors mb-6 group"
        >
          <svg
            className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Login
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-slate-900 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
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
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">
            Join {company.name}
          </h1>
          <p className="text-sm text-slate-500">Create your employee account</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
            <p className="text-sm text-emerald-700">{success}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Full Name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleInputChange}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
              placeholder="John Doe"
            />
          </div>

          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Username
            </label>
            <div className="relative">
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="w-full px-3.5 py-2.5 pr-10 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
                placeholder="johndoe"
              />
              {/* Status indicator */}
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                {checkingUsername && (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                )}
                {!checkingUsername && usernameChecked && usernameAvailable && (
                  <svg
                    className="w-5 h-5 text-emerald-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {!checkingUsername && usernameChecked && !usernameAvailable && (
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Only letters and numbers allowed (no spaces or special characters)
            </p>
            {usernameChecked && (
              <div
                className={`flex items-center gap-1.5 mt-2 text-sm ${
                  usernameAvailable ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {usernameAvailable ? (
                  <span>✓ Username is available</span>
                ) : (
                  <span>✗ Username already taken</span>
                )}
              </div>
            )}
          </div>

          {/* Mobile Number */}
          <div>
            <label
              htmlFor="mobile"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Mobile Number
            </label>
            <input
              id="mobile"
              name="mobile"
              type="tel"
              value={formData.mobile}
              onChange={handleInputChange}
              required
              pattern="[0-9]{10}"
              maxLength="10"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
              placeholder="1234567890"
            />
            <p className="text-xs text-slate-500 mt-1.5">10-digit number</p>
          </div>

          {/* Gender */}
          <div>
            <label
              htmlFor="gender"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              minLength="6"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
              placeholder="••••••••"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Minimum 6 characters
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
              placeholder="••••••••"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !usernameAvailable}
            className="w-full mt-6 bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating Account...
              </span>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-slate-900 font-medium hover:underline"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
