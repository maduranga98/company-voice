import { useState, useRef, useEffect, useId } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * Pill-style dropdown (replaces native <select>). Options render as rich content
 * (e.g. a StatusBadge), keyboard accessible: arrows/Home/End move, Enter/Space picks,
 * Escape closes, Tab leaves.
 *
 * options: [{ value, label, node }]  — `node` is what's drawn for the option.
 */
const PillSelect = ({ label, value, options, onChange, disabled = false, className = "" }) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);
  const labelId = useId();

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  const openMenu = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (option) => {
    close();
    if (option.value !== value) onChange(option.value);
  };

  const onTriggerKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    }
  };

  const onMenuKeyDown = (event) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); setActive((i) => (i >= last ? 0 : i + 1)); break;
      case "ArrowUp": event.preventDefault(); setActive((i) => (i <= 0 ? last : i - 1)); break;
      case "Home": event.preventDefault(); setActive(0); break;
      case "End": event.preventDefault(); setActive(last); break;
      case "Escape": event.preventDefault(); close(); break;
      case "Tab": close(false); break;
      default:
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <span id={labelId} className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-background-white px-2.5 py-2 transition hover:border-gray-300 focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 truncate">{selected?.node ?? selected?.label}</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-labelledby={labelId}
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 z-30 mt-1.5 max-h-72 w-max min-w-full max-w-[16rem] overflow-y-auto rounded-xl border border-gray-100 bg-background-white p-1 shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="presentation">
                <button
                  ref={(el) => { itemRefs.current[index] = el; }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  onClick={() => choose(option)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition focus:outline-none ${
                    index === active ? "bg-gray-50" : "hover:bg-gray-50"
                  }`}
                >
                  {option.node ?? <span className="text-sm text-[#2D3E50]">{option.label}</span>}
                  {isSelected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[#1ABC9C]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default PillSelect;
