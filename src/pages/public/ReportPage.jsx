import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import ReportHeader from "../../components/public/ReportHeader";
import TypeSelector from "../../components/public/TypeSelector";
import EvidenceUploader from "../../components/public/EvidenceUploader";
import ContactSection from "../../components/public/ContactSection";
import SuccessScreen from "../../components/public/SuccessScreen";
import InactiveLink from "../../components/public/InactiveLink";
import { REPORT_LANGUAGES } from "../../utils/reportLanguages";
import { useEvidenceUploads } from "../../hooks/useEvidenceUploads";
import {
  createReportToken,
  fetchReportConfig,
  submitErrorKey,
  submitReport,
} from "../../services/publicReportService";

const MIN_DESCRIPTION = 20;
const MAX_DESCRIPTION = 5000;
const EMPTY_CONTACT = { name: "", email: "", phone: "" };

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#2D3E50] focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20";

// Search engines and referrers must never see report links.
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

const ReportPage = () => {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const online = useOnline();
  useNoIndex();

  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | inactive
  const [uploadId, setUploadId] = useState(createReportToken);
  const idempotencyToken = useRef(createReportToken());
  const openedAt = useRef(Date.now());
  const submitting = useRef(false);

  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [involvesHR, setInvolvesHR] = useState(false);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [website, setWebsite] = useState(""); // honeypot: real people never see or fill this
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const uploads = useEvidenceUploads(uploadId, config?.limits);
  const resetUploads = uploads.reset;

  useEffect(() => {
    let cancelled = false;
    fetchReportConfig(slug)
      .then((result) => {
        if (cancelled) return;
        const browser = (navigator.language || "").slice(0, 2);
        if (!REPORT_LANGUAGES.some((l) => l.code === browser)) {
          i18n.changeLanguage(result.defaultLanguage);
        }
        setConfig(result);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("inactive");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, i18n]);

  const clearForm = useCallback(() => {
    setType("");
    setCategory("");
    setDescription("");
    setInvolvesHR(false);
    setContact(EMPTY_CONTACT);
    setWebsite("");
    resetUploads();
    setUploadId(createReportToken());
    idempotencyToken.current = createReportToken();
    openedAt.current = Date.now();
  }, [resetUploads]);

  const handleDone = () => {
    setCredentials(null);
    clearForm();
  };

  useEffect(() => () => setCredentials(null), []);

  const trimmedLength = description.trim().length;
  const canSubmit =
    !!type &&
    !!category &&
    trimmedLength >= MIN_DESCRIPTION &&
    trimmedLength <= MAX_DESCRIPTION &&
    !uploads.uploading &&
    !uploads.failed &&
    !busy;

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
      const paths = uploads.items.map((item) => ({ path: item.path }));
      const hasContact = Object.values(contact).some((v) => v.trim());
      const result = await submitReport({
        slug,
        type,
        category,
        description: description.trim(),
        involvesHR,
        ...(hasContact ? { contact } : {}),
        attachments: paths,
        ...(paths.length > 0 ? { uploadId } : {}),
        idempotencyToken: idempotencyToken.current,
        website,
        elapsedMs: Date.now() - openedAt.current,
        clientLang: (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2),
      });
      setCredentials({ caseCode: result.caseCode, secretKey: result.secretKey });
      setDescription("");
      setContact(EMPTY_CONTACT);
    } catch (err) {
      const key = submitErrorKey(err);
      if (key === "report.errors.inactive") setStatus("inactive");
      setError(key);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  };

  if (status === "inactive") return <InactiveLink />;

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#1ABC9C]" aria-label={t("report.loading")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ReportHeader companyName={config.companyName} />

      <main className="mx-auto -mt-4 max-w-xl rounded-t-3xl bg-gray-50 px-4 pb-16 pt-6 print:mt-0 print:bg-white">
        {!online && (
          <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-[#FF6B6B]/10 p-3 text-sm text-[#2D3E50] print:hidden">
            <WifiOff className="h-4 w-4 shrink-0 text-[#FF6B6B]" aria-hidden="true" />
            {t("report.submit.offline")}
          </p>
        )}

        {credentials ? (
          <SuccessScreen
            companyName={config.companyName}
            caseCode={credentials.caseCode}
            secretKey={credentials.secretKey}
            onDone={handleDone}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <TypeSelector value={type} onChange={setType} />

            <div>
              <label htmlFor="report-category" className="mb-1.5 block text-sm font-semibold text-[#2D3E50]">
                {t("report.category.label")}
              </label>
              <select
                id="report-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                <option value="">{t("report.category.placeholder")}</option>
                {config.categories.map((id) => (
                  <option key={id} value={id}>
                    {t(`report.category.options.${id}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-description" className="mb-1.5 block text-sm font-semibold text-[#2D3E50]">
                {t("report.description.label")}
              </label>
              <textarea
                id="report-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={MAX_DESCRIPTION}
                rows={7}
                autoComplete="off"
                placeholder={t("report.description.placeholder")}
                className={`${inputClass} resize-y`}
              />
              <div className="mt-1 flex justify-between gap-3 text-xs text-gray-500">
                <span>
                  {trimmedLength > 0 && trimmedLength < MIN_DESCRIPTION
                    ? t("report.description.minHint", { min: MIN_DESCRIPTION })
                    : ""}
                </span>
                <span>{t("report.description.counter", { count: description.length, max: MAX_DESCRIPTION })}</span>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
              <input
                type="checkbox"
                checked={involvesHR}
                onChange={(e) => setInvolvesHR(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1ABC9C]"
              />
              <span>
                <span className="block text-sm font-semibold text-[#2D3E50]">{t("report.involvesHR.label")}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{t("report.involvesHR.helper")}</span>
              </span>
            </label>

            <EvidenceUploader uploads={uploads} limits={config.limits} />

            <ContactSection value={contact} onChange={setContact} />

            {/* Honeypot: hidden from people and assistive tech, so only bots fill it. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="report-website">Website</label>
              <input
                id="report-website"
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

            {uploads.uploading && <p className="text-xs text-gray-500">{t("report.submit.uploadsPending")}</p>}

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1ABC9C] px-4 py-3.5 text-base font-semibold text-white transition hover:bg-[#17a589] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy ? t("report.submit.sending") : t("report.submit.button")}
            </button>
          </form>
        )}
      </main>
    </div>
  );
};

export default ReportPage;
