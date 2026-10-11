import { FileCheck2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import Logo from "../brand/Logo";
import PublicLanguageSwitcher from "./PublicLanguageSwitcher";

// Not the anonymous report header: names are collected on this page, so it says so.
const PolicyHeader = ({ companyName }) => {
  const { t } = useTranslation();

  return (
    <header className="bg-gradient-ink text-white">
      <div className="mx-auto max-w-xl px-4 pb-10 pt-5">
        <div className="flex items-center justify-between">
          <Logo size={28} tone="light" />
          <PublicLanguageSwitcher />
        </div>
        {companyName && (
          <h1 className="mt-6 text-2xl font-semibold leading-tight sm:text-3xl">{companyName}</h1>
        )}
        <p className="mt-3 flex items-start gap-2 text-sm text-white/80">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
          <span>{t("report.policy.eyebrow")}</span>
        </p>
      </div>
    </header>
  );
};

export default PolicyHeader;
