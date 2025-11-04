import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Html5Qrcode } from "html5-qrcode";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";

const Login = () => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
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

      await login(username, password);
      navigate("/dashboard");
    } catch (error) {
      setError(t('auth.login.invalidCredentials'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = async (decodedText) => {
    try {
      setError("");
      const qrData = JSON.parse(decodedText);

      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
      }

      if (qrData.type === "company_registration" && qrData.companyId) {
        navigate("/register", {
          state: {
            companyId: qrData.companyId,
            companyName: qrData.companyName,
          },
        });
      } else {
        setError(t('auth.login.invalidQR'));
        setShowQRScanner(false);
        setScanning(false);
      }
    } catch (error) {
      console.error("QR Scan error:", error);
      setError(t('qr.scanError'));
      setScanning(false);
    }
  };

  const startQRScanner = async () => {
    try {
      setShowQRScanner(true);
      setScanning(true);
      setError("");

      setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode("qr-reader");
          html5QrCodeRef.current = html5QrCode;

          await html5QrCode.start(
            { facingMode: "environment" },
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
          setError("Unable to access camera. Please check permissions.");
          setScanning(false);
          setShowQRScanner(false);
        }
      }, 100);
    } catch (error) {
      console.error("QR Scanner error:", error);
      setError("Failed to start QR scanner. Please try manual login.");
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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-primary p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent-coral rounded-full blur-3xl animate-pulse delay-700"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-teal rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center space-x-4 mb-8">
            <img
              src="/logo.png"
              alt="ANCHORA Logo"
              className="w-16 h-16 object-contain bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-2"
            />
            <div>
              <span className="text-3xl font-bold text-white block">
                ANCHORA
              </span>
              <span className="text-sm text-primary-teal font-medium">
                Your Anchor in Every Storm
              </span>
            </div>
          </div>

          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Your Voice
            <br />
            Matters Here
          </h1>

          <p className="text-xl text-white text-opacity-90 mb-8 max-w-md">
            A platform where every employee can share ideas, report concerns,
            and collaborate to build a better workplace together.
          </p>

          {/* Feature List */}
          <div className="space-y-4">
            {[
              {
                icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
                text: "Share creative ideas and innovations",
              },
              {
                icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
                text: "Report workplace issues safely",
              },
              {
                icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
                text: "Engage in meaningful discussions",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 text-white"
              >
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-2">
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
                      d={feature.icon}
                    />
                  </svg>
                </div>
                <span className="text-white text-opacity-90">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-6">
          {[
            { number: "10K+", label: "Active Users" },
            { number: "50K+", label: "Ideas Shared" },
            { number: "95%", label: "Satisfaction" },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl font-bold text-white mb-1">
                {stat.number}
              </div>
              <div className="text-sm text-white text-opacity-90">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <img
                src="/logo.png"
                alt="ANCHORA Logo"
                className="w-24 h-24 object-contain"
              />
            </div>
            <h2 className="text-3xl font-bold text-primary-navy">ANCHORA</h2>
            <p className="text-sm text-primary-teal font-medium">Your Anchor in Every Storm</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {!showQRScanner ? (
              <>
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {t('auth.login.welcome')}
                    </h1>
                    <p className="text-gray-600">
                      {t('auth.login.title')}
                    </p>
                  </div>
                  <LanguageSwitcher />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
                    <svg
                      className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label
                      htmlFor="username"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      {t('auth.login.username')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="w-full pl-12 pr-4 py-3 border border-border-light rounded-xl focus:ring-2 focus:ring-primary-teal focus:border-transparent transition bg-background-softGray hover:bg-white"
                        placeholder="Enter your username"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      {t('auth.login.password')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      </div>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-12 pr-12 py-3 border border-border-light rounded-xl focus:ring-2 focus:ring-primary-teal focus:border-transparent transition bg-background-softGray hover:bg-white"
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
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
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            />
                          </svg>
                        ) : (
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
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-primary-teal border-gray-300 rounded focus:ring-primary-teal cursor-pointer"
                      />
                      <span className="ml-2 text-sm text-text-secondary group-hover:text-text-primary">
                        Remember me
                      </span>
                    </label>
                    <a
                      href="#"
                      className="text-sm font-medium text-primary-teal hover:text-opacity-80"
                    >
                      Forgot password?
                    </a>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent-coral text-white py-3.5 rounded-xl font-semibold hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-accent-coral focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-coral/30 transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <svg
                          className="animate-spin h-5 w-5 text-white"
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
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      t('auth.login.signIn')
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500 font-medium">
                      or continue with
                    </span>
                  </div>
                </div>

                {/* QR Code Button */}
                <button
                  type="button"
                  onClick={startQRScanner}
                  disabled={loading}
                  className="w-full flex items-center justify-center px-4 py-3.5 border-2 border-border-medium rounded-xl text-text-secondary font-semibold hover:border-primary-teal hover:text-primary-teal hover:bg-background-lightMist focus:outline-none focus:ring-2 focus:ring-primary-teal focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <svg
                    className="w-6 h-6 mr-3 text-text-tertiary group-hover:text-primary-teal"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
{t('auth.login.scanQRCode')}
                </button>

                {/* Footer */}
                <p className="mt-8 text-center text-sm text-text-tertiary">
                  New to ANCHORA?{" "}
                  <a
                    href="#"
                    className="font-medium text-primary-teal hover:text-opacity-80"
                  >
                    Contact your HR
                  </a>
                </p>
              </>
            ) : (
              <>
                {/* QR Scanner View */}
                <div className="space-y-6">
                  <button
                    onClick={stopQRScanner}
                    className="flex items-center text-gray-600 hover:text-gray-900 transition"
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
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                      />
                    </svg>
                    {t('common.back')}
                  </button>

                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-background-lightMist rounded-full mb-4">
                      <svg
                        className="w-8 h-8 text-primary-teal"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {t('qr.scan')}
                    </h3>
                    <p className="text-gray-600">
                      {t('qr.scanInstructions')}
                    </p>
                  </div>

                  {/* QR Reader */}
                  <div className="relative">
                    <div
                      id="qr-reader"
                      className="rounded-xl overflow-hidden border-4 border-primary-teal shadow-lg"
                    ></div>
                    {scanning && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-64 border-4 border-primary-teal rounded-xl animate-pulse"></div>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="bg-gradient-soft border border-primary-teal/30 rounded-xl p-4">
                    <div className="flex items-start space-x-3">
                      <svg
                        className="w-5 h-5 text-primary-teal flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div className="text-sm">
                        <p className="font-semibold text-primary-navy mb-2">
                          How to scan:
                        </p>
                        <ul className="space-y-1 text-text-secondary">
                          <li>• Get QR code from your HR department</li>
                          <li>• Hold it steady within the frame</li>
                          <li>• Ensure good lighting</li>
                          <li>• Auto-redirect upon successful scan</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Copyright */}
          <p className="mt-8 text-center text-sm text-text-tertiary">
            © 2025 ANCHORA. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
