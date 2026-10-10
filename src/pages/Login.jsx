import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Shield,
  AlertCircle,
  Loader2,
} from "lucide-react";

const Login = () => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Load remembered username
    const rememberedUsername = localStorage.getItem("rememberedUsername");
    if (rememberedUsername) {
      setUsername(rememberedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setError("");
      setLoading(true);

      // Handle remember me
      if (rememberMe) {
        localStorage.setItem("rememberedUsername", username);
      } else {
        localStorage.removeItem("rememberedUsername");
      }

      await login(username, password);
      navigate("/dashboard");
    } catch (error) {
      // Display the actual error message from the server
      setError(error.message || t("auth.login.invalidCredentials"));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding/Info */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 2xl:w-[53%] py-6 px-6 lg:py-8 lg:px-8 xl:p-10 2xl:p-12 flex-col justify-center relative overflow-hidden overflow-y-auto" style={{ background: "linear-gradient(135deg, #2D3E50 0%, #1a2a3a 100%)" }}>
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div
            className="absolute bottom-20 right-20 w-96 h-96 rounded-full blur-3xl animate-pulse"
            style={{ backgroundColor: "#1ABC9C", animationDelay: "0.7s" }}
          ></div>
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl animate-pulse"
            style={{ backgroundColor: "#1ABC9C", animationDelay: "1s" }}
          ></div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-md mx-auto">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3 lg:space-x-4 mb-5 lg:mb-6 xl:mb-8">
            <img
              src="/voxwel-logo.png"
              alt="VoxWel Logo"
              className="w-16 h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 object-contain bg-white/20 backdrop-blur-sm rounded-xl lg:rounded-2xl shadow-2xl"
            />
            <div>
              <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold text-white mb-0.5 lg:mb-1">
                VoxWel
              </h1>
              <p className="font-bold text-xs lg:text-sm" style={{ color: "#1ABC9C" }}>
                {t("auth.login.tagline")}
              </p>
            </div>
          </div>

          {/* Main Heading */}
          <h2 className="text-lg lg:text-xl xl:text-2xl 2xl:text-3xl font-bold text-white mb-2 lg:mb-3 xl:mb-4 leading-tight">
            {t("auth.login.mainHeading")}
          </h2>

          <p className="text-xs lg:text-sm xl:text-base text-white/90 mb-5 lg:mb-6 xl:mb-8 leading-relaxed font-medium">
            {t("auth.login.mainDescription")}
          </p>

          {/* Feature List */}
          <div className="space-y-2 lg:space-y-2.5 xl:space-y-3">
            {[
              {
                icon: <Shield className="w-4 h-4 lg:w-5 lg:h-5 text-white" strokeWidth={2.5} />,
                titleKey: "auth.login.featureSecureTitle",
                textKey: "auth.login.featureSecureText",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="flex items-start space-x-2.5 lg:space-x-3 bg-white rounded-lg lg:rounded-xl xl:rounded-2xl p-2.5 lg:p-3 xl:p-3.5 transform hover:scale-[1.02] transition-all duration-300 shadow-sm border border-gray-100"
              >
                <div className="rounded-lg p-2 lg:p-2.5 flex-shrink-0 shadow-sm" style={{ backgroundColor: "#1ABC9C" }}>
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-bold text-xs lg:text-sm mb-0.5" style={{ color: "#2D3E50" }}>
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-gray-500 text-[11px] lg:text-xs xl:text-sm leading-relaxed">
                    {t(feature.textKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-10 bg-gray-50 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <img
                src="/voxwel-logo.png"
                alt="VoxWel Logo"
                className="w-24 h-24 object-contain"
              />
            </div>
            <h2 className="text-2xl font-bold mb-1" style={{ color: "#2D3E50" }}>
              VoxWel
            </h2>
            <p className="font-semibold text-sm" style={{ color: "#1ABC9C" }}>
              {t("auth.login.tagline")}
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 lg:p-7 xl:p-8 border border-gray-100">
            {/* Header */}
            <div className="mb-7">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl font-bold" style={{ color: "#2D3E50" }}>
                  {t("auth.login.welcome")}
                </h1>
                <LanguageSwitcher />
              </div>
              <p className="text-gray-500 text-sm">
                {t("auth.login.title")}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3 animate-shake">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Field */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "#2D3E50" }}
                >
                  {t("auth.login.username")}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3 border border-gray-100 rounded-xl focus:ring-2 focus:border-transparent transition-all bg-gray-50 hover:bg-white text-gray-900 placeholder-gray-400"
                    style={{ focusRingColor: "#1ABC9C" }}
                    onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px #1ABC9C40"; e.target.style.borderColor = "#1ABC9C"; }}
                    onBlur={(e) => { e.target.style.boxShadow = "none"; e.target.style.borderColor = ""; }}
                    placeholder={t("auth.login.usernamePlaceholder")}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "#2D3E50" }}
                >
                  {t("auth.login.password")}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-12 py-3 border border-gray-100 rounded-xl focus:ring-2 focus:border-transparent transition-all bg-gray-50 hover:bg-white text-gray-900 placeholder-gray-400"
                    onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px #1ABC9C40"; e.target.style.borderColor = "#1ABC9C"; }}
                    onBlur={(e) => { e.target.style.boxShadow = "none"; e.target.style.borderColor = ""; }}
                    placeholder={t("auth.login.passwordPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-700 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 border-gray-300 rounded focus:ring-offset-0 cursor-pointer"
                    style={{ accentColor: "#1ABC9C" }}
                  />
                  <span className="ml-2.5 text-sm text-gray-500 group-hover:text-gray-700 transition">
                    {t("auth.login.rememberMe")}
                  </span>
                </label>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-3.5 rounded-xl font-semibold text-base focus:outline-none focus:ring-4 focus:ring-opacity-30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transform hover:scale-[1.01] active:scale-[0.99]"
                style={{ backgroundColor: "#1ABC9C", focusRingColor: "#1ABC9C" }}
                onMouseEnter={(e) => { if (!loading) e.target.style.backgroundColor = "#17a88c"; }}
                onMouseLeave={(e) => { e.target.style.backgroundColor = "#1ABC9C"; }}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    <span>{t("auth.login.signingIn")}</span>
                  </div>
                ) : (
                  t("auth.login.signIn")
                )}
              </button>
            </form>
          </div>

          {/* Copyright */}
          <p className="mt-8 text-center text-sm text-gray-400">
            {t("auth.login.copyright")} &bull;{" "}
            <a
              href="https://www.lumoraventures.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition font-medium"
              style={{ color: "#1ABC9C" }}
            >
              Lumora Ventures PVT LTD
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
