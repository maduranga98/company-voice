import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";
import Logo from "../components/brand/Logo";
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
  const location = useLocation();

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
      const from = location.state?.from;
      // Only same-app paths: `from` comes from router state set by PrivateRoute.
      const target = from?.pathname?.startsWith("/") && !from.pathname.startsWith("//")
        ? `${from.pathname}${from.search || ""}`
        : "/dashboard";
      navigate(target);
    } catch (error) {
      // Display the actual error message from the server
      setError(error.message || t("auth.login.invalidCredentials"));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-[15px] text-ink placeholder-gray-400 shadow-xs transition hover:border-gray-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <aside className="bg-gradient-ink relative hidden overflow-hidden lg:flex lg:w-[46%] xl:w-1/2">
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-brand-400/10 blur-3xl" />

        <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
          <Logo size={34} tone="light" />

          <div className="max-w-md">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
              <Shield className="h-3.5 w-3.5" />
              {t("auth.login.featureSecureTitle")}
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
              {t("auth.login.mainHeading")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              {t("auth.login.mainDescription")}
            </p>
            <p className="mt-8 border-l-2 border-brand-400 pl-4 text-sm leading-relaxed text-white/60">
              {t("auth.login.featureSecureText")}
            </p>
          </div>

          <p className="text-sm text-white/40">{t("auth.login.tagline")}</p>
        </div>
      </aside>

      {/* Form */}
      <main className="flex flex-1 flex-col bg-background-cream">
        <div className="flex items-center justify-between p-4 sm:p-6 lg:justify-end">
          <Logo size={28} className="lg:hidden" />
          <LanguageSwitcher />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
          <div className="animate-fade-up w-full max-w-[400px]">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
              {t("auth.login.welcome")}
            </h1>
            <p className="mt-2 text-[15px] text-gray-500">{t("auth.login.title")}</p>

            {error && (
              <div
                role="alert"
                className="animate-shake mt-6 flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50 p-3.5"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" />
                <p className="text-sm font-medium text-rose-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("auth.login.username")}
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className={fieldClass}
                    placeholder={t("auth.login.usernamePlaceholder")}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("auth.login.password")}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`${fieldClass} pr-12`}
                    placeholder={t("auth.login.passwordPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 transition hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <label className="group flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300"
                />
                <span className="ml-2.5 text-sm text-gray-600 transition group-hover:text-ink">
                  {t("auth.login.rememberMe")}
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white shadow-glow transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("auth.login.signingIn")}
                  </>
                ) : (
                  t("auth.login.signIn")
                )}
              </button>
            </form>

            <p className="mt-10 text-center text-xs text-gray-400">
              {t("auth.login.copyright")} &bull;{" "}
              <a
                href="https://www.lumoraventures.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-500 transition hover:text-brand-600"
              >
                Lumora Ventures PVT LTD
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
