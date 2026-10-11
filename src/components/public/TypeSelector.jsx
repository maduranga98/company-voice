import { CircleHelp, Lightbulb, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

const TYPES = [
  { id: "concern", icon: ShieldAlert },
  { id: "idea", icon: Lightbulb },
  { id: "question", icon: CircleHelp },
];

const TypeSelector = ({ value, onChange }) => {
  const { t } = useTranslation();

  return (
    <fieldset>
      <legend className="mb-3 text-base font-semibold text-[#2D3E50]">{t("report.type.heading")}</legend>
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
        {TYPES.map(({ id, icon }) => {
          const Icon = icon;
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(id)}
              className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition sm:flex-col sm:items-start ${
                selected
                  ? "border-[#1ABC9C] bg-[#1ABC9C]/10"
                  : "border-gray-200 bg-white hover:border-[#1ABC9C]/50"
              }`}
            >
              <Icon
                className={`h-6 w-6 shrink-0 ${selected ? "text-[#1ABC9C]" : "text-[#2D3E50]"}`}
                aria-hidden="true"
              />
              <span>
                <span className="block text-sm font-semibold text-[#2D3E50]">{t(`report.type.${id}.title`)}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{t(`report.type.${id}.description`)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};

export default TypeSelector;
