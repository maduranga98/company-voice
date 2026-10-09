import { useTranslation } from "react-i18next";
import { REPORT_LANGUAGES } from "../../utils/reportLanguages";

const PublicLanguageSwitcher = () => {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);

  return (
    <select
      value={REPORT_LANGUAGES.some((l) => l.code === current) ? current : "en"}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label={t("report.languageLabel")}
      className="rounded-lg border border-white/30 bg-white/10 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
    >
      {REPORT_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code} className="text-gray-900">
          {lang.label}
        </option>
      ))}
    </select>
  );
};

export default PublicLanguageSwitcher;
