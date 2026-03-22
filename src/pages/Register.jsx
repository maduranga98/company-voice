import { useState, useEffect, useRef } from "react";
import {
  useNavigate,
  useLocation,
  useSearchParams,
  Link,
} from "react-router-dom";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { signInAnonymously } from "firebase/auth";
import { checkUsernameExists, hashPassword } from "../services/authService";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  UserPlus,
  User,
  AtSign,
  Phone,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  CircleCheck,
  Users,
} from "lucide-react";

const Register = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { companyId: stateCompanyId, companyName: stateCompanyName } =
    location.state || {};
  const companyId = stateCompanyId || searchParams.get("companyId");
  const companyName = stateCompanyName || searchParams.get("companyName");

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
          setError(t("auth.register.usernameAlreadyTaken"));
        }
      } catch (error) {
        console.error("Error checking username:", error);
        setError(t("auth.register.usernameAvailabilityFailed"));
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
      // Wait for anonymous auth — mobile cold-starts need this
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      // Small delay to ensure auth state is propagated
      await new Promise((resolve) => setTimeout(resolve, 300));

      const companyDoc = await getDoc(doc(db, "companies", companyId));
      if (companyDoc.exists()) {
        setCompany({ id: companyDoc.id, ...companyDoc.data() });
      } else {
        setError(t("auth.register.companyNotFound"));
      }
    } catch (error) {
      console.error("Error loading company:", error);
      // Retry once — mobile networks can be flaky on first load
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
        const companyDoc = await getDoc(doc(db, "companies", companyId));
        if (companyDoc.exists()) {
          setCompany({ id: companyDoc.id, ...companyDoc.data() });
        } else {
          setError(t("auth.register.companyNotFound"));
        }
      } catch (retryError) {
        console.error("Retry failed:", retryError);
        setError(t("auth.register.companyLoadFailed"));
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // For username, only allow alphanumeric characters
    if (name === "username") {
      const alphanumericValue = value.replace(/[^a-zA-Z0-9]/g, "");
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
      setError(
        "Username must contain only letters and numbers (no spaces or special characters)",
      );
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

      setSuccess(t("auth.register.registrationPending"));

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

  const inputClasses =
    "w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 transition-all hover:bg-white focus:outline-none";

  const handleFocus = (e) => {
    e.target.style.boxShadow = "0 0 0 2px #1ABC9C40";
    e.target.style.borderColor = "#1ABC9C";
    e.target.style.backgroundColor = "#fff";
  };

  const handleBlur = (e) => {
    e.target.style.boxShadow = "none";
    e.target.style.borderColor = "";
    e.target.style.backgroundColor = "";
  };

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          {error ? (
            <div className="max-w-sm mx-auto">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
              <p className="text-red-700 text-sm font-medium mb-4">{error}</p>
              <button
                onClick={() => navigate("/login")}
                className="text-sm font-semibold hover:opacity-80 transition"
                style={{ color: "#1ABC9C" }}
              >
                {t("auth.register.backToLogin")}
              </button>
            </div>
          ) : (
            <>
              <Loader2
                className="w-10 h-10 animate-spin mx-auto mb-4"
                style={{ color: "#1ABC9C" }}
              />
              <p className="text-gray-500 text-sm">{t("common.loading")}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={() => navigate("/login")}
          className="flex items-center text-gray-500 hover:text-gray-800 transition-colors mb-6 group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          {t("auth.register.backToLogin")}
        </button>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7 sm:p-8">
          {/* Header */}
          <div className="text-center mb-7">
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: "#2D3E50" }}
            >
              <UserPlus className="w-7 h-7 text-white" />
            </div>
            <h1
              className="text-2xl font-bold mb-1"
              style={{ color: "#2D3E50" }}
            >
              {t("auth.register.joinCompany", { companyName: company.name })}
            </h1>
            <p className="text-sm text-gray-500">
              {t("auth.register.createEmployeeAccount")}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div
              className="mb-6 p-4 border rounded-xl flex items-start space-x-3"
              style={{ backgroundColor: "#1ABC9C10", borderColor: "#1ABC9C30" }}
            >
              <CircleCheck
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                style={{ color: "#1ABC9C" }}
              />
              <p className="text-sm" style={{ color: "#15967d" }}>
                {success}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-semibold mb-2"
                style={{ color: "#2D3E50" }}
              >
                {t("auth.register.fullName")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className={inputClasses}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-semibold mb-2"
                style={{ color: "#2D3E50" }}
              >
                {t("auth.register.username")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <AtSign className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  className={`${inputClasses} pr-10`}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="johndoe"
                />
                {/* Status indicator */}
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {checkingUsername && (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  )}
                  {!checkingUsername &&
                    usernameChecked &&
                    usernameAvailable && (
                      <CheckCircle2
                        className="w-5 h-5"
                        style={{ color: "#1ABC9C" }}
                      />
                    )}
                  {!checkingUsername &&
                    usernameChecked &&
                    !usernameAvailable && (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {t("auth.register.usernameHint")}
              </p>
              {usernameChecked && (
                <div
                  className={`flex items-center gap-1.5 mt-2 text-sm ${
                    usernameAvailable ? "" : "text-red-600"
                  }`}
                  style={usernameAvailable ? { color: "#1ABC9C" } : {}}
                >
                  {usernameAvailable ? (
                    <span>{t("auth.register.usernameAvailable")}</span>
                  ) : (
                    <span>{t("auth.register.usernameTaken")}</span>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Number */}
            <div>
              <label
                htmlFor="mobile"
                className="block text-sm font-semibold mb-2"
                style={{ color: "#2D3E50" }}
              >
                {t("auth.register.mobile")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  required
                  pattern="[0-9]{10}"
                  maxLength="10"
                  className={inputClasses}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="1234567890"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {t("auth.register.mobileHint")}
              </p>
            </div>

            {/* Gender */}
            <div>
              <label
                htmlFor="gender"
                className="block text-sm font-semibold mb-2"
                style={{ color: "#2D3E50" }}
              >
                {t("auth.register.gender")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Users className="w-5 h-5 text-gray-400" />
                </div>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 transition-all hover:bg-white focus:outline-none appearance-none"
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                >
                  <option value="">{t("auth.register.selectGender")}</option>
                  <option value="male">{t("auth.register.male")}</option>
                  <option value="female">{t("auth.register.female")}</option>
                  <option value="other">{t("auth.register.other")}</option>
                  <option value="prefer_not_to_say">
                    {t("auth.register.preferNotToSay")}
                  </option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold mb-2"
                style={{ color: "#2D3E50" }}
              >
                {t("auth.register.password")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength="6"
                  className={inputClasses}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {t("auth.register.passwordHint")}
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold mb-2"
                style={{ color: "#2D3E50" }}
              >
                {t("auth.register.confirmPassword")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  className={inputClasses}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !usernameAvailable}
              className="w-full mt-2 text-white py-3.5 rounded-xl font-semibold focus:outline-none focus:ring-4 focus:ring-opacity-30 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transform hover:scale-[1.01] active:scale-[0.99]"
              style={{ backgroundColor: "#1ABC9C" }}
              onMouseEnter={(e) => {
                if (!loading && usernameAvailable)
                  e.target.style.backgroundColor = "#17a88c";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#1ABC9C";
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  {t("auth.register.creatingAccount")}
                </span>
              ) : (
                t("auth.register.createAccount")
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-7 text-center">
            <p className="text-sm text-gray-500">
              {t("auth.register.haveAccount")}{" "}
              <Link
                to="/login"
                className="font-semibold hover:opacity-80 transition"
                style={{ color: "#1ABC9C" }}
              >
                {t("auth.register.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
