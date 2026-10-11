import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { exportCaseToPdf } from "../../services/casePdfService";
import { showSuccess, showError } from "../../services/toastService";

// Downloads the case (details, notes and any anonymous conversation) as a PDF.
const ExportCasePdfButton = ({ post, currentUser, className = "" }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleClick = async (event) => {
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await exportCaseToPdf({ post, currentUser });
      showSuccess(t("hrInbox.pdfExported", "Case exported as PDF"));
    } catch (error) {
      console.error("Error exporting case PDF:", error);
      showError(t("hrInbox.pdfFailed", "Could not export the case"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#2D3E50] transition hover:border-[#1ABC9C] hover:text-[#16A085] disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Download aria-hidden="true" className="h-3.5 w-3.5" />}
      {busy ? t("hrInbox.exportingPdf", "Exporting...") : t("hrInbox.exportPdf", "Export PDF")}
    </button>
  );
};

export default ExportCasePdfButton;
