import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

const FIELDS = [
  { id: "name", type: "text", autoComplete: "off", max: 100 },
  { id: "email", type: "email", autoComplete: "off", max: 200 },
  { id: "phone", type: "tel", autoComplete: "off", max: 40 },
];

const ContactSection = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-semibold text-[#2D3E50]"
      >
        {t("report.contact.toggle")}
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="space-y-3 border-t border-gray-100 p-4">
          <p className="text-xs text-gray-500">{t("report.contact.note")}</p>
          {FIELDS.map(({ id, type, autoComplete, max }) => (
            <label key={id} className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{t(`report.contact.${id}`)}</span>
              <input
                type={type}
                value={value[id]}
                maxLength={max}
                autoComplete={autoComplete}
                onChange={(e) => onChange({ ...value, [id]: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20"
              />
            </label>
          ))}
        </div>
      )}
    </section>
  );
};

export default ContactSection;
