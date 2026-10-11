import { Link2Off } from "lucide-react";
import { useTranslation } from "react-i18next";
import PublicLanguageSwitcher from "./PublicLanguageSwitcher";

const InactiveLink = () => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="bg-[#2D3E50] px-4 py-4">
        <div className="mx-auto flex max-w-xl justify-end">
          <PublicLanguageSwitcher />
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
        <Link2Off className="h-10 w-10 text-gray-300" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-[#2D3E50]">{t("report.inactive.title")}</h1>
        <p className="mt-2 text-sm text-gray-500">{t("report.inactive.body")}</p>
      </main>
    </div>
  );
};

export default InactiveLink;
