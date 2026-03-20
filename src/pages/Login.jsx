import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Html5Qrcode } from "html5-qrcode";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Lightbulb,
  Shield,
  MessageSquare,
  QrCode,
  ArrowLeft,
  Info,
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
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    // Load remembered username
    const rememberedUsername = localStorage.getItem("rememberedUsername");
    if (rememberedUsername) {
      setUsername(rememberedUsername);
      setRememberMe(true);
    }

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch((err) => console.error(err));
      }
    };
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

  const handleQRScan = async (decodedText) => {
    try {
      setError("");

      let handled = false;

      try {
        const qrData = JSON.parse(decodedText);

        // Handle company registration QR codes
        if (qrData.type === "company_registration" && qrData.companyId) {
          if (html5QrCodeRef.current) {
            await html5QrCodeRef.current.stop();
          }
          navigate("/register", {
            state: {
              companyId: qrData.companyId,
              companyName: qrData.companyName,
            },
          });
          handled = true;
        }
        // Handle credential QR codes (username + password)
        else if (qrData.username && qrData.password) {
          if (html5QrCodeRef.current) {
            await html5QrCodeRef.current.stop();
          }
          setShowQRScanner(false);
          setScanning(false);
          setLoading(true);
          try {
            await login(qrData.username, qrData.password);
            navigate("/dashboard");
          } catch (loginError) {
            setError(loginError.message || t("auth.login.invalidCredentials"));
          } finally {
            setLoading(false);
          }
          handled = true;
        }
      } catch {
        // Not JSON — try parsing as URL
        try {
          const url = new URL(decodedText);
          const companyId = url.searchParams.get('companyId');
          const companyName = url.searchParams.get('companyName');
          if (companyId) {
            if (html5QrCodeRef.current) {
              await html5QrCodeRef.current.stop();
            }
            navigate('/register', { state: { companyId, companyName } });
            handled = true;
          }
        } catch {}
      }

      if (!handled) {
        setError(t("auth.login.invalidQRCode") || "Invalid QR code. Please scan a valid QR code.");
        setShowQRScanner(false);
        setScanning(false);
      }
    } catch (error) {
      console.error("QR Scan error:", error);
      setError(t("auth.login.invalidQRCode") || "Invalid QR code. Please scan a valid QR code.");
      setScanning(false);
      setShowQRScanner(false);
    }
  };

  const startQRScanner = async () => {
    try {
      setShowQRScanner(true);
      setScanning(true);
      setError("");

      // Request camera permission explicitly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        // Stop the test stream immediately
        stream.getTracks().forEach(track => track.stop());
      } catch (permErr) {
        console.error("Camera permission error:", permErr);
        setError(t("auth.login.cameraAccessError"));
        setScanning(false);
        setShowQRScanner(false);
        return;
      }

      setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode("qr-reader");
          html5QrCodeRef.current = html5QrCode;

          // Get available cameras
          const devices = await Html5Qrcode.getCameras();

          if (!devices || devices.length === 0) {
            throw new Error("No cameras found");
          }

          // Prefer back camera if available
          const backCamera = devices.find(device =>
            device.label && (
              device.label.toLowerCase().includes('back') ||
              device.label.toLowerCase().includes('rear')
            )
          );

          const cameraId = backCamera ? backCamera.id : devices[0].id;

          await html5QrCode.start(
            cameraId,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            handleQRScan,
            (errorMessage) => {
              // Ignore errors during scanning
            }
          );
        } catch (err) {
          console.error("Error starting scanner:", err);
          setError(t("auth.login.cameraAccessError"));
          setScanning(false);
          setShowQRScanner(false);
        }
      }, 100);
    } catch (error) {
      console.error("QR Scanner error:", error);
      setError(t("auth.login.qrScannerError"));
      setScanning(false);
      setShowQRScanner(false);
    }
  };

  const stopQRScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch (error) {
      console.error("Error stopping scanner:", error);
    } finally {
      setShowQRScanner(false);
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding/Info */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[53%] p-8 lg:p-10 xl:p-12 flex-col justify-center relative overflow-hidden" style={{ background: "linear-gradient(135deg, #2D3E50 0%, #1a2a3a 100%)" }}>
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
        <div className="relative z-10 max-w-md lg:max-w-lg mx-auto">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4 mb-8 lg:mb-10">
            <img
              src="/voxwel-logo.png"
              alt="VoxWel Logo"
              className="w-24 h-24 lg:w-28 lg:h-28 object-contain bg-white/20 backdrop-blur-sm rounded-2xl shadow-2xl"
            />
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">
                VoxWel
              </h1>
              <p className="font-bold text-sm lg:text-base" style={{ color: "#1ABC9C" }}>
                {t("auth.login.tagline")}
              </p>
            </div>
          </div>

          {/* Main Heading */}
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4 lg:mb-5 leading-tight">
            {t("auth.login.mainHeading")}
          </h2>

          <p className="text-sm lg:text-base text-white/90 mb-8 lg:mb-10 leading-relaxed font-medium">
            {t("auth.login.mainDescription")}
          </p>

          {/* Feature List */}
          <div className="space-y-3 lg:space-y-3.5">
            {[
              {
                icon: <Lightbulb className="w-5 h-5 text-white" strokeWidth={2.5} />,
                titleKey: "auth.login.featureCreativeTitle",
                textKey: "auth.login.featureCreativeText",
              },
              {
                icon: <Shield className="w-5 h-5 text-white" strokeWidth={2.5} />,
                titleKey: "auth.login.featureSecureTitle",
                textKey: "auth.login.featureSecureText",
              },
              {
                icon: <MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} />,
                titleKey: "auth.login.featureDiscussionsTitle",
                textKey: "auth.login.featureDiscussionsText",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 bg-white rounded-xl lg:rounded-2xl p-3.5 lg:p-4 transform hover:scale-[1.02] transition-all duration-300 shadow-sm border border-gray-100"
              >
                <div className="rounded-lg lg:rounded-xl p-2.5 flex-shrink-0 shadow-sm" style={{ backgroundColor: "#1ABC9C" }}>
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-0.5" style={{ color: "#2D3E50" }}>
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-gray-500 text-xs lg:text-sm leading-relaxed">
                    {t(feature.textKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-10 bg-gray-50 overflow-y-auto">
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
          <div className="bg-white rounded-2xl shadow-sm p-7 sm:p-8 border border-gray-100">
            {!showQRScanner ? (
              <>
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

                {/* Divider */}
                <div className="relative my-7">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-400 font-medium">
                      {t("auth.login.orContinueWith")}
                    </span>
                  </div>
                </div>

                {/* QR Code Button */}
                <button
                  type="button"
                  onClick={startQRScanner}
                  disabled={loading}
                  className="w-full flex items-center justify-center px-4 py-3.5 border border-gray-100 rounded-xl text-gray-600 font-semibold hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-30 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1ABC9C"; e.currentTarget.style.color = "#1ABC9C"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.color = ""; }}
                >
                  <QrCode className="w-5 h-5 mr-3 text-gray-400 group-hover:text-current transition" />
                  {t("auth.login.scanQRCode")}
                </button>

                {/* Footer */}
                <p className="mt-7 text-center text-sm text-gray-400">
                  {t("auth.login.newToVoxWel")}{" "}
                  <a
                    href="https://www.voxwel.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold hover:opacity-80 transition"
                    style={{ color: "#1ABC9C" }}
                  >
                    {t("auth.login.contactHR")}
                  </a>
                </p>
              </>
            ) : (
              <>
                {/* QR Scanner View */}
                <div className="space-y-6">
                  <button
                    onClick={stopQRScanner}
                    className="flex items-center text-gray-500 hover:text-gray-800 transition group"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                    {t("common.back")}
                  </button>

                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: "#1ABC9C15" }}>
                      <QrCode className="w-8 h-8" style={{ color: "#1ABC9C" }} />
                    </div>
                    <h3 className="text-xl font-bold mb-2" style={{ color: "#2D3E50" }}>
                      {t("qr.scan")}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {t("qr.scanInstructions")}
                    </p>
                  </div>

                  {/* QR Reader */}
                  <div className="relative">
                    <div
                      id="qr-reader"
                      className="rounded-xl overflow-hidden border-2 shadow-sm"
                      style={{ borderColor: "#1ABC9C" }}
                    ></div>
                    {scanning && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-64 border-2 rounded-xl animate-pulse" style={{ borderColor: "#1ABC9C" }}></div>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="border rounded-2xl p-5" style={{ backgroundColor: "#1ABC9C08", borderColor: "#1ABC9C30" }}>
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#1ABC9C" }} />
                      <div className="text-sm">
                        <p className="font-bold mb-3 text-sm" style={{ color: "#2D3E50" }}>
                          {t("qr.howToScan")}
                        </p>
                        <ul className="space-y-2 text-gray-500 text-xs">
                          <li className="flex items-start">
                            <span className="mr-2" style={{ color: "#1ABC9C" }}>&#8226;</span>
                            <span>{t("qr.instruction1")}</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2" style={{ color: "#1ABC9C" }}>&#8226;</span>
                            <span>{t("qr.instruction2")}</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2" style={{ color: "#1ABC9C" }}>&#8226;</span>
                            <span>{t("qr.instruction3")}</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2" style={{ color: "#1ABC9C" }}>&#8226;</span>
                            <span>{t("qr.instruction4")}</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
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
