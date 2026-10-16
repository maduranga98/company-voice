import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { doc, getDoc } from "firebase/firestore";
import QRCode from "qrcode";
import { toast } from "react-toastify";
import { AlertTriangle, Copy, Download, ExternalLink, Loader2 } from "lucide-react";
import { db } from "../config/firebase";
import { savePolicyLinkRoster, setPolicyLinkActive } from "../services/policyAckService";

const buildLinkUrl = (slug) =>
  `${(import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, "")}/p/${slug}`;

const rosterToText = (employees) =>
  employees.map((e) => (e.name ? `${e.employeeId}, ${e.name}` : e.employeeId)).join("\n");

const cardClass = "rounded-2xl border border-gray-200 bg-background-white p-5";

/**
 * Public link, QR code, pause switch and employee roster of a policy link. Shared by the
 * single-policy and the bundle management pages. `onRosterChange(employees)` fires after a save.
 */
const PolicyLinkPanel = ({ slug, initialActive, initialRequireRoster, initialRoster, onRosterChange }) => {
  const { t } = useTranslation();
  const [active, setActive] = useState(initialActive);
  const [requireRoster, setRequireRoster] = useState(initialRequireRoster);
  const [rosterText, setRosterText] = useState(() => rosterToText(initialRoster));
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [rosterNote, setRosterNote] = useState("");
  const [error, setError] = useState("");

  const linkUrl = buildLinkUrl(slug);

  useEffect(() => {
    QRCode.toDataURL(linkUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#0284c7", light: "#ffffff" },
      errorCorrectionLevel: "H",
    })
      .then(setQrCodeUrl)
      .catch((err) => console.error("Error generating QR code:", err));
  }, [linkUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(linkUrl);
      toast.success(t("report.policyLink.copied"));
    } catch {
      toast.error(t("report.policyLink.saveError"));
    }
  };

  const downloadQr = () => {
    const a = document.createElement("a");
    a.href = qrCodeUrl;
    a.download = `policy-${slug}.png`;
    a.click();
  };

  const toggleActive = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await setPolicyLinkActive(slug, !active);
      setActive(result.active);
    } catch (err) {
      console.error("Error updating link status:", err);
      setError(t("report.policyLink.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const saveRoster = async () => {
    setBusy(true);
    setError("");
    setRosterNote("");
    try {
      const result = await savePolicyLinkRoster(slug, { rosterText, requireRoster });
      setRequireRoster(result.requireRoster);
      const snap = await getDoc(doc(db, "policyLinkRosters", slug));
      const employees = snap.exists() ? snap.data().employees || [] : [];
      setRosterText(rosterToText(employees));
      onRosterChange(employees);
      setRosterNote(
        result.rejectedLines.length > 0
          ? t("report.policyLink.roster.savedWithSkipped", {
              count: result.rosterCount,
              lines: result.rejectedLines.join(", "),
            })
          : t("report.policyLink.roster.saved", { count: result.rosterCount })
      );
    } catch (err) {
      console.error("Error saving roster:", err);
      setError(t("report.policyLink.saveError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#FF6B6B]/10 p-3 text-sm text-[#2D3E50]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B6B]" aria-hidden="true" />
          {error}
        </p>
      )}

      <section className={`${cardClass} grid gap-6 sm:grid-cols-[1fr_auto]`}>
        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("report.policyLink.linkLabel")}
            </p>
            <p className="mt-1 break-all rounded-xl bg-background-softGray px-3.5 py-3 font-mono text-sm text-[#2D3E50]">
              {linkUrl}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1ABC9C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16A085]"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              {t("report.policyLink.copy")}
            </button>
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#2D3E50] transition hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t("report.policyLink.open")}
            </a>
          </div>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={active}
              disabled={busy}
              onChange={toggleActive}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1ABC9C]"
            />
            <span>
              <span className="block text-sm font-semibold text-[#2D3E50]">
                {active ? t("report.policyLink.active") : t("report.policyLink.paused")}
              </span>
              <span className="block text-xs text-gray-500">{t("report.policyLink.activeHelp")}</span>
            </span>
          </label>
        </div>

        {qrCodeUrl && (
          <div className="flex flex-col items-center gap-2">
            <img src={qrCodeUrl} alt={t("report.policyLink.qrAlt")} className="h-36 w-36 rounded-xl border border-gray-200" />
            <button
              type="button"
              onClick={downloadQr}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D3E50] hover:text-[#1ABC9C]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t("report.policyLink.downloadQr")}
            </button>
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="text-base font-semibold text-[#2D3E50]">{t("report.policyLink.roster.title")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("report.policyLink.roster.help")}</p>
        <textarea
          value={rosterText}
          onChange={(e) => setRosterText(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={t("report.policyLink.roster.placeholder")}
          className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-background-white px-3.5 py-3 font-mono text-xs text-[#2D3E50] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
        <label className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            checked={requireRoster}
            onChange={(e) => setRequireRoster(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1ABC9C]"
          />
          <span>
            <span className="block text-sm font-semibold text-[#2D3E50]">{t("report.policyLink.roster.require")}</span>
            <span className="block text-xs text-gray-500">{t("report.policyLink.roster.requireHelp")}</span>
          </span>
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveRoster}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D3E50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#243242] disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("report.policyLink.roster.save")}
          </button>
          {rosterNote && <span className="text-xs text-gray-600">{rosterNote}</span>}
        </div>
      </section>
    </>
  );
};

export default PolicyLinkPanel;
