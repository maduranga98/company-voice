import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, Info, Loader2, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import PolicyHeader from "../../components/public/PolicyHeader";
import InactiveLink from "../../components/public/InactiveLink";
import { REPORT_LANGUAGES } from "../../utils/reportLanguages";
import { useNoIndex } from "../../hooks/useNoIndex";
import {
  createAckToken,
  fetchPolicyForLink,
  policyErrorKey,
  submitPolicyResponse,
} from "../../services/policyAckService";

const MIN_CONCERN = 10;
const MAX_CONCERN = 2000;
const CATEGORIES = [
  "code_of_conduct",
  "anti_harassment",
  "data_privacy",
  "whistleblower",
  "safety",
  "gdpr",
  "other",
];

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-background-white px-3.5 py-3 shadow-xs transition hover:border-gray-300 text-sm text-[#2D3E50] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100";

const formatDate = (iso, locale) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
};

const useOnline = () => {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
};

// One policy: category, version, text and the optional attached document. In a bundle each
// policy collapses so a long pack stays scannable.
const PolicyCard = ({ policy, collapsible, t, locale }) => {
  const body = (
    <>
      {policy.content ? (
        <div
          tabIndex={0}
          aria-label={policy.title}
          className="mt-4 max-h-[26rem] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-background-softGray p-4 text-sm leading-relaxed text-[#2D3E50] focus:outline-none focus:ring-4 focus:ring-brand-100"
        >
          {policy.content}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">{t("report.policy.documentOnly")}</p>
      )}

      {policy.fileUrl && (
        <a
          href={policy.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1ABC9C] hover:text-[#16A085]"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {t("report.policy.openDocument", { name: policy.fileName || policy.title })}
        </a>
      )}
    </>
  );

  const meta = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-[#2D3E50]">
        {CATEGORIES.includes(policy.category)
          ? t(`report.policy.categories.${policy.category}`)
          : t("report.policy.categories.other")}
      </span>
      <span className="text-gray-500">{t("report.policy.version", { version: policy.version })}</span>
      {policy.effectiveDate && (
        <span className="text-gray-500">
          {t("report.policy.effective", { date: formatDate(policy.effectiveDate, locale) })}
        </span>
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <article className="rounded-2xl border border-gray-200 bg-background-white p-5">
        {meta}
        <h2 className="mt-3 text-lg font-semibold leading-snug text-[#2D3E50]">{policy.title}</h2>
        {body}
      </article>
    );
  }

  return (
    <details className="group rounded-2xl border border-gray-200 bg-background-white p-5">
      <summary className="cursor-pointer list-none">
        {meta}
        <span className="mt-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold leading-snug text-[#2D3E50]">{policy.title}</h2>
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-gray-400 transition group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      {body}
    </details>
  );
};

const PolicyAckPage = () => {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const online = useOnline();
  useNoIndex();

  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | inactive
  const idempotencyToken = useRef(createAckToken());
  const openedAt = useRef(Date.now());
  const submitting = useRef(false);

  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [mode, setMode] = useState("acknowledge"); // acknowledge | concern
  const [confirmed, setConfirmed] = useState(false);
  const [concernText, setConcernText] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: real people never see or fill this
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [concernPolicyId, setConcernPolicyId] = useState(""); // bundle: which policy the concern is about
  const [result, setResult] = useState(null); // { status, name, policyTitle, version, count }

  const locale = i18n.resolvedLanguage || i18n.language;

  const loadPolicy = useCallback(
    (initial) =>
      fetchPolicyForLink(slug)
        .then((data) => {
          if (initial) {
            const browser = (navigator.language || "").slice(0, 2);
            if (!REPORT_LANGUAGES.some((l) => l.code === browser)) {
              i18n.changeLanguage(data.defaultLanguage);
            }
          }
          setConfig(data);
          setStatus("ready");
        })
        .catch(() => setStatus("inactive")),
    [slug, i18n]
  );

  useEffect(() => {
    loadPolicy(true);
  }, [loadPolicy]);

  // A single link carries one policy, a bundle link several to acknowledge together.
  const isBundle = Boolean(config?.bundle);
  const policies = config ? config.policies || [config.policy] : [];

  const trimmedConcern = concernText.trim().length;
  const detailsOk = employeeId.trim().length > 0 && employeeName.trim().length >= 2;
  const canSubmit =
    detailsOk &&
    !busy &&
    (mode === "acknowledge" ? confirmed : trimmedConcern >= MIN_CONCERN && trimmedConcern <= MAX_CONCERN);

  const resetForm = () => {
    setResult(null);
    setEmployeeId("");
    setEmployeeName("");
    setMode("acknowledge");
    setConfirmed(false);
    setConcernText("");
    setConcernPolicyId("");
    setError("");
    idempotencyToken.current = createAckToken();
    openedAt.current = Date.now();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current || !canSubmit) return;
    if (!navigator.onLine) {
      setError("report.submit.offline");
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      // A bundle acknowledges every policy it shows; a concern is about the one chosen.
      const concernTarget = policies.find((p) => p.id === concernPolicyId) || policies[0];
      const targets = mode === "concern" ? [concernTarget] : policies;
      const response = await submitPolicyResponse({
        slug,
        employeeId: employeeId.trim(),
        employeeName: employeeName.trim(),
        response: mode === "acknowledge" ? "acknowledged" : "concern",
        ...(mode === "concern" ? { concernText: concernText.trim() } : {}),
        ...(isBundle
          ? { items: targets.map((p) => ({ policyId: p.id, policyVersion: p.version })) }
          : { policyVersion: policies[0].version }),
        idempotencyToken: idempotencyToken.current,
        website,
        elapsedMs: Date.now() - openedAt.current,
        clientLang: (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2),
      });
      setResult({
        status: response.status,
        name: employeeName.trim(),
        policyTitle: (mode === "concern" ? concernTarget : policies[0]).title,
        version: (mode === "concern" ? concernTarget : policies[0]).version,
        count: policies.length,
      });
    } catch (err) {
      // The first try of a concern may have landed even though the answer was lost.
      if (err?.code === "functions/already-exists") {
        const target = policies.find((p) => p.id === concernPolicyId) || policies[0];
        setResult({
          status: "concern_received",
          name: employeeName.trim(),
          policyTitle: target.title,
          version: target.version,
          count: policies.length,
        });
      } else {
        const key = policyErrorKey(err);
        if (key === "report.policy.errors.inactive") setStatus("inactive");
        // A new version went live while the page was open: show it, keep what was typed.
        if (key === "report.policy.errors.updated") {
          setConfirmed(false);
          await loadPolicy(false);
        }
        setError(key);
      }
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  };

  if (status === "inactive") {
    return <InactiveLink titleKey="report.policy.inactive.title" bodyKey="report.policy.inactive.body" />;
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-page">
        <Loader2 className="h-8 w-8 animate-spin text-[#1ABC9C]" aria-label={t("report.loading")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-page">
      <PolicyHeader companyName={config.companyName} />

      <main className="mx-auto -mt-4 max-w-xl rounded-t-3xl bg-background-page px-4 pb-16 pt-6">
        {!online && (
          <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-[#FF6B6B]/10 p-3 text-sm text-[#2D3E50]">
            <WifiOff className="h-4 w-4 shrink-0 text-[#FF6B6B]" aria-hidden="true" />
            {t("report.submit.offline")}
          </p>
        )}

        {result ? (
          <div className="rounded-2xl border border-gray-200 bg-background-white p-6 text-center" role="status">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#1ABC9C]" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold text-[#2D3E50]">
              {result.status === "concern_received"
                ? t("report.policy.success.concernTitle")
                : result.status === "already_acknowledged"
                  ? t("report.policy.success.alreadyTitle")
                  : t("report.policy.success.acknowledgedTitle", { name: result.name })}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {t(
                result.status === "concern_received"
                  ? "report.policy.success.concernBody"
                  : result.status === "already_acknowledged"
                    ? isBundle
                      ? "report.policy.success.bundleAlreadyBody"
                      : "report.policy.success.alreadyBody"
                    : isBundle
                      ? "report.policy.success.bundleAcknowledgedBody"
                      : "report.policy.success.acknowledgedBody",
                { policy: result.policyTitle, version: result.version, count: result.count }
              )}
            </p>
            <button
              type="button"
              onClick={resetForm}
              className="mt-6 text-xs font-semibold text-[#2D3E50] underline underline-offset-2 hover:text-[#1ABC9C]"
            >
              {t("report.policy.success.another")}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {isBundle ? (
              <section aria-label={config.bundle.title || t("report.policy.bundle.defaultTitle")} className="space-y-3">
                <div>
                  <h1 className="text-lg font-semibold text-[#2D3E50]">
                    {config.bundle.title || t("report.policy.bundle.defaultTitle")}
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {t("report.policy.bundle.intro", { count: policies.length })}
                  </p>
                </div>
                {policies.map((policy) => (
                  <PolicyCard key={policy.id} policy={policy} collapsible t={t} locale={locale} />
                ))}
              </section>
            ) : (
              <PolicyCard policy={policies[0]} t={t} locale={locale} />
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="policy-employee-id" className="mb-1.5 block text-sm font-semibold text-[#2D3E50]">
                    {t("report.policy.form.employeeIdLabel")}
                  </label>
                  <input
                    id="policy-employee-id"
                    type="text"
                    autoComplete="off"
                    maxLength={40}
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="policy-employee-name" className="mb-1.5 block text-sm font-semibold text-[#2D3E50]">
                    {t("report.policy.form.employeeNameLabel")}
                  </label>
                  <input
                    id="policy-employee-name"
                    type="text"
                    autoComplete="name"
                    maxLength={100}
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="group" aria-label={t("report.policy.mode.label")}>
                {["acknowledge", "concern"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      mode === value ? "bg-background-white text-[#2D3E50] shadow-xs" : "text-gray-500 hover:text-[#2D3E50]"
                    }`}
                  >
                    {t(`report.policy.mode.${value}`)}
                  </button>
                ))}
              </div>

              {mode === "acknowledge" ? (
                <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-background-white p-4">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1ABC9C]"
                  />
                  <span className="text-sm font-semibold text-[#2D3E50]">
                    {isBundle
                      ? t("report.policy.bundle.checkbox", { count: policies.length })
                      : t("report.policy.acknowledge.checkbox")}
                  </span>
                </label>
              ) : (
                <div>
                  {isBundle && (
                    <div className="mb-4">
                      <label htmlFor="policy-concern-about" className="mb-1.5 block text-sm font-semibold text-[#2D3E50]">
                        {t("report.policy.bundle.concernAbout")}
                      </label>
                      <select
                        id="policy-concern-about"
                        value={concernPolicyId || policies[0].id}
                        onChange={(e) => setConcernPolicyId(e.target.value)}
                        className={inputClass}
                      >
                        {policies.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <label htmlFor="policy-concern" className="mb-1.5 block text-sm font-semibold text-[#2D3E50]">
                    {t("report.policy.concern.label")}
                  </label>
                  <textarea
                    id="policy-concern"
                    value={concernText}
                    onChange={(e) => setConcernText(e.target.value)}
                    maxLength={MAX_CONCERN}
                    rows={6}
                    autoComplete="off"
                    placeholder={t("report.policy.concern.placeholder")}
                    className={`${inputClass} resize-y`}
                  />
                  <div className="mt-1 flex justify-between gap-3 text-xs text-gray-500">
                    <span>
                      {trimmedConcern > 0 && trimmedConcern < MIN_CONCERN
                        ? t("report.policy.concern.minHint", { min: MIN_CONCERN })
                        : ""}
                    </span>
                    <span>{t("report.policy.concern.counter", { count: concernText.length, max: MAX_CONCERN })}</span>
                  </div>
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-background-white p-3 text-xs text-gray-600">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2D3E50]" aria-hidden="true" />
                    {t("report.policy.concern.note")}
                  </p>
                </div>
              )}

              {/* Honeypot: hidden from people and assistive tech, so only bots fill it. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="policy-website">Website</label>
                <input
                  id="policy-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
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
                disabled={!canSubmit}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${
                  mode === "acknowledge" ? "bg-[#1ABC9C] hover:bg-[#16A085]" : "bg-[#2D3E50] hover:bg-[#243242]"
                }`}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {busy
                  ? t("report.policy.sending")
                  : mode === "acknowledge"
                    ? isBundle
                      ? t("report.policy.bundle.button", { count: policies.length })
                      : t("report.policy.acknowledge.button")
                    : t("report.policy.concern.button")}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default PolicyAckPage;
