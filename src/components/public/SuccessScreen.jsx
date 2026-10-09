import { useEffect, useState } from "react";
import { Check, Copy, Download, Printer, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
};

const CopyButton = ({ text }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => setCopied(await copyText(text))}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#2D3E50] hover:border-[#1ABC9C] print:hidden"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[#1ABC9C]" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? t("report.success.copied") : t("report.success.copy")}
    </button>
  );
};

const Credential = ({ label, value }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
      <p className="select-all break-all font-mono text-2xl font-bold tracking-wider text-[#2D3E50] sm:text-3xl">{value}</p>
      <CopyButton text={value} />
    </div>
  </div>
);

/**
 * Shows the case code and secret key once. They live only in this component's props:
 * never in the URL, localStorage or any cache. The parent clears them on `onDone`.
 */
const SuccessScreen = ({ companyName, caseCode, secretKey, onDone }) => {
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (confirmed) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = t("report.success.leaveWarning");
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [confirmed, t]);

  const download = () => {
    const lines = [
      t("report.success.fileHeading"),
      companyName,
      "",
      `${t("report.success.caseCode")}: ${caseCode}`,
      `${t("report.success.secretKey")}: ${secretKey}`,
      "",
      t("report.success.warning"),
      t("report.success.fileNote"),
      "",
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `voxwel-${caseCode}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1ABC9C]/15">
          <Check className="h-6 w-6 text-[#1ABC9C]" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-2xl font-semibold text-[#2D3E50]">{t("report.success.title")}</h2>
        <p className="mt-1 text-sm text-gray-600">{t("report.success.intro")}</p>
      </div>

      <div className="hidden print:block">
        <h2 className="text-xl font-bold">{t("report.success.fileHeading")}</h2>
        <p className="text-sm">{companyName}</p>
      </div>

      <Credential label={t("report.success.caseCode")} value={caseCode} />
      <Credential label={t("report.success.secretKey")} value={secretKey} />

      <div role="alert" className="flex gap-3 rounded-2xl border-2 border-[#FF6B6B] bg-[#FF6B6B]/10 p-4">
        <TriangleAlert className="h-5 w-5 shrink-0 text-[#FF6B6B]" aria-hidden="true" />
        <p className="text-sm font-semibold text-[#2D3E50]">{t("report.success.warning")}</p>
      </div>

      <div className="flex flex-wrap gap-3 print:hidden">
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2D3E50] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#243242]"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {t("report.success.download")}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#2D3E50] hover:border-[#1ABC9C]"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t("report.success.print")}
        </button>
      </div>

      {/* TODO(step2): link to the "Check my case" page here once it exists. */}
      <p className="text-sm text-gray-500 print:hidden">{t("report.success.comingSoon")}</p>

      <div className="space-y-3 border-t border-gray-200 pt-5 print:hidden">
        <label className="flex items-start gap-3 text-sm text-[#2D3E50]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1ABC9C]"
          />
          {t("report.success.confirmSaved")}
        </label>
        <button
          type="button"
          disabled={!confirmed}
          onClick={onDone}
          className="w-full rounded-xl bg-[#1ABC9C] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17a589] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("report.success.done")}
        </button>
      </div>
    </div>
  );
};

export default SuccessScreen;
