import { useEffect, useState } from "react";
import { AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import PublicLanguageSwitcher from "../../components/public/PublicLanguageSwitcher";
import CaseTimers from "../../components/public/CaseTimers";
import CaseReplyThread from "../../components/public/CaseReplyThread";
import { caseErrorKey, fetchCaseStatus, sendCaseReply } from "../../services/publicCaseService";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm uppercase tracking-wider text-[#2D3E50] focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20";

const STATUSES = [
  "open",
  "acknowledged",
  "in_progress",
  "under_review",
  "working_on",
  "resolved",
  "closed",
  "rejected",
  "not_a_problem",
];

const STATUS_STYLE = {
  open: "bg-gray-100 text-gray-800",
  acknowledged: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  under_review: "bg-purple-100 text-purple-800",
  working_on: "bg-indigo-100 text-indigo-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-slate-100 text-slate-800",
  rejected: "bg-red-100 text-red-800",
  not_a_problem: "bg-slate-100 text-slate-800",
};

// Search engines and referrers must never see case lookups, same as the report form.
const useNoIndex = () => {
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow";
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    return () => {
      robots.remove();
      referrer.remove();
    };
  }, []);
};

const formatDate = (iso, locale) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
};

const CheckCasePage = () => {
  const { t, i18n } = useTranslation();
  useNoIndex();

  const [caseCode, setCaseCode] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [credentials, setCredentials] = useState(null); // { caseCode, secretKey } once verified
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState("");

  const locale = i18n.resolvedLanguage || i18n.language;

  const resetToLookup = () => {
    setCredentials(null);
    setCaseData(null);
    setCaseCode("");
    setSecretKey("");
    setError("");
    setReplyError("");
  };

  // Secret key never leaves component state and is dropped on unmount, same guarantee
  // the report form's success screen makes for it.
  useEffect(() => () => setCredentials(null), []);

  const handleLookup = async (event) => {
    event.preventDefault();
    if (loading) return;
    const code = caseCode.trim().toUpperCase();
    const key = secretKey.trim();
    if (!code || !key) return;

    setLoading(true);
    setError("");
    try {
      const result = await fetchCaseStatus({ caseCode: code, secretKey: key });
      setCaseData(result);
      setCredentials({ caseCode: code, secretKey: key });
    } catch (err) {
      setError(caseErrorKey(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (text) => {
    if (!credentials) return false;
    setSendingReply(true);
    setReplyError("");
    try {
      await sendCaseReply({ caseCode: credentials.caseCode, secretKey: credentials.secretKey, message: text });
      setCaseData((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                { id: `local-${Date.now()}`, sender: "reporter", content: text, timestamp: new Date().toISOString() },
              ],
            }
          : prev
      );
      return true;
    } catch (err) {
      setReplyError(caseErrorKey(err));
      return false;
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#2D3E50] text-white">
        <div className="mx-auto max-w-xl px-4 pb-8 pt-4">
          <div className="flex items-center justify-between">
            <img src="/voxwel-logo.png" alt="VoxWel" className="h-8 w-8 rounded-lg bg-white/10 p-1" />
            <PublicLanguageSwitcher />
          </div>
          <h1 className="mt-6 flex items-center gap-2 text-2xl font-semibold leading-tight sm:text-3xl">
            <KeyRound className="h-6 w-6 text-[#1ABC9C]" aria-hidden="true" />
            {t("report.checkCase.heading")}
          </h1>
          <p className="mt-3 text-sm text-white/80">{t("report.checkCase.intro")}</p>
        </div>
      </header>

      <main className="mx-auto -mt-4 max-w-xl rounded-t-3xl bg-gray-50 px-4 pb-16 pt-6">
        {!caseData ? (
          <form onSubmit={handleLookup} className="space-y-5" noValidate>
            <div>
              <label htmlFor="case-code" className="mb-1.5 block text-sm font-semibold text-[#2D3E50]">
                {t("report.checkCase.caseCodeLabel")}
              </label>
              <input
                id="case-code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="VW-XXXX-XXXX"
                value={caseCode}
                onChange={(e) => setCaseCode(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="case-key" className="mb-1.5 block text-sm font-semibold text-[#2D3E50]">
                {t("report.checkCase.secretKeyLabel")}
              </label>
              <input
                id="case-key"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#FF6B6B]/10 p-3 text-sm text-[#2D3E50]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B6B]" aria-hidden="true" />
                {t(error)}
              </p>
            )}

            <button
              type="submit"
              disabled={!caseCode.trim() || !secretKey.trim() || loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1ABC9C] px-4 py-3.5 text-base font-semibold text-white transition hover:bg-[#17a589] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? t("report.checkCase.loading") : t("report.checkCase.submitButton")}
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  STATUS_STYLE[caseData.status] || STATUS_STYLE.open
                }`}
              >
                {STATUSES.includes(caseData.status)
                  ? t(`report.checkCase.status.${caseData.status}`)
                  : caseData.status}
              </span>
              <button
                type="button"
                onClick={resetToLookup}
                className="text-xs font-semibold text-[#2D3E50] underline underline-offset-2 hover:text-[#1ABC9C]"
              >
                {t("report.checkCase.checkAnother")}
              </button>
            </div>

            <p className="text-xs text-gray-500">
              {t("report.checkCase.submittedOn", { date: formatDate(caseData.createdAt, locale) })}
            </p>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("report.checkCase.yourReport")}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#2D3E50]">{caseData.description}</p>
            </div>

            <CaseTimers timers={caseData.timers} />

            {replyError && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#FF6B6B]/10 p-3 text-sm text-[#2D3E50]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B6B]" aria-hidden="true" />
                {t(replyError)}
              </p>
            )}

            <CaseReplyThread messages={caseData.messages} onSend={handleSend} sending={sendingReply} />
          </div>
        )}
      </main>
    </div>
  );
};

export default CheckCasePage;
