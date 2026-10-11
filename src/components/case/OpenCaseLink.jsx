import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Maximize2 } from "lucide-react";
import { caseHref } from "../../utils/caseTypes";

// "Open full case": navigates to the shareable /cases/:caseType/:caseId page.
// stopPropagation so it works inside rows whose click expands or selects the case.
const OpenCaseLink = ({ caseType, caseId, className = "", variant = "light" }) => {
  const { t } = useTranslation();
  const tone =
    variant === "dark"
      ? "bg-white/10 text-white hover:bg-white/20"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200";
  return (
    <Link
      to={caseHref(caseType, caseId)}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${tone} ${className}`}
    >
      <Maximize2 size={12} />
      {t("caseDetail.openFullCase")}
    </Link>
  );
};

export default OpenCaseLink;
