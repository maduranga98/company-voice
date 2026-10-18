import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { TOUR_STEPS, TOUR_START_EVENT } from "./tourSteps";

const STORAGE_PREFIX = "voxwel.tour.v1.";
const POPOVER_W = 320;
const GAP = 14;
const MARGIN = 12;
const AUTO_START_DELAY_MS = 900;
const TARGET_WAIT_MS = 1500;
const POLL_MS = 250;

// The staff layout remounts on every route change, so a running tour lives here, not in state.
let session = null;

const readDone = (uid) => {
  try {
    return localStorage.getItem(STORAGE_PREFIX + uid) === "done";
  } catch {
    return false;
  }
};

const writeDone = (uid) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + uid, "done");
  } catch {
    /* storage unavailable: the tour may show again, which is harmless */
  }
};

// The same data-tour id can exist in the sidebar and the mobile tab bar; use whichever is on screen.
const findTarget = (target) => {
  if (!target) return null;
  const matches = document.querySelectorAll(`[data-tour="${target}"]`);
  return Array.from(matches).find((el) => el.getBoundingClientRect().width > 0) || null;
};

const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));

const place = (rect, popH) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(POPOVER_W, vw - MARGIN * 2);
  if (!rect) {
    return { left: (vw - w) / 2, top: Math.max(MARGIN, (vh - popH) / 2), width: w };
  }
  // Sidebar items sit at the far left on desktop: open the card to their right.
  if (vw >= 1024 && rect.right < 320) {
    return {
      left: rect.right + GAP,
      top: clamp(rect.top + rect.height / 2 - popH / 2, MARGIN, vh - popH - MARGIN),
      width: w,
    };
  }
  const below = rect.top + rect.height / 2 < vh / 2;
  return {
    left: clamp(rect.left + rect.width / 2 - w / 2, MARGIN, vw - w - MARGIN),
    top: below
      ? Math.min(rect.bottom + GAP, vh - popH - MARGIN)
      : Math.max(MARGIN, rect.top - popH - GAP),
    width: w,
  };
};

/**
 * First-run guided tour for staff. Spotlights navigation items (marked with data-tour) and
 * explains them. Starts once per user and can be replayed with the TOUR_START_EVENT window event.
 */
const ProductTour = () => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const uid = userData?.id;
  const role = userData?.role;

  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [steps, setSteps] = useState(session?.steps ?? null);
  const [index, setIndexState] = useState(session?.index ?? 0);
  const [rect, setRect] = useState(null);
  const [pos, setPos] = useState(null);
  const [searching, setSearching] = useState(true);
  const popRef = useRef(null);
  const scrolled = useRef(false);

  const setIndex = useCallback((next) => {
    if (session) session.index = next;
    setIndexState(next);
  }, []);

  const start = useCallback(() => {
    // Skip navigation steps whose target is not on this screen (for example the sidebar on mobile).
    // Steps with a route are always kept: their target only exists once that page has loaded.
    const available = TOUR_STEPS.filter(
      (s) => (!s.roles || s.roles.includes(role)) && (s.route || !s.target || findTarget(s.target))
    );
    if (available.length === 0) return;
    session = { steps: available, index: 0 };
    setIndexState(0);
    setSteps(available);
  }, [role]);

  const close = useCallback(() => {
    if (uid) writeDone(uid);
    session = null;
    setSteps(null);
  }, [uid]);

  useEffect(() => {
    if (!uid || session || readDone(uid)) return undefined;
    const timer = setTimeout(start, AUTO_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [uid, start]);

  useEffect(() => {
    window.addEventListener(TOUR_START_EVENT, start);
    return () => window.removeEventListener(TOUR_START_EVENT, start);
  }, [start]);

  const step = steps?.[index];
  const isLast = steps ? index === steps.length - 1 : false;

  const go = useCallback(
    (delta) => {
      if (!steps) return;
      const next = index + delta;
      if (next < 0) return;
      if (next >= steps.length) close();
      else setIndex(next);
    },
    [steps, index, close, setIndex]
  );

  // Pages load their data after the route changes, so keep looking for the target until it shows up.
  const measure = useCallback(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (el && !scrolled.current) {
      scrolled.current = true;
      el.scrollIntoView({ block: step.route ? "center" : "nearest", inline: "nearest" });
    }
    const r = el?.getBoundingClientRect();
    const next = r
      ? { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
      : null;
    setRect((prev) => {
      if (!prev || !next) return prev === next ? prev : next;
      return Object.keys(next).every((k) => prev[k] === next[k]) ? prev : next;
    });
  }, [step]);

  useEffect(() => {
    if (step?.route && pathname !== step.route) navigate(step.route);
  }, [step, pathname, navigate]);

  useLayoutEffect(() => {
    if (!step) return undefined;
    scrolled.current = false;
    setSearching(true);
    const giveUp = setTimeout(() => setSearching(false), TARGET_WAIT_MS);
    measure();
    const poll = setInterval(measure, POLL_MS);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(giveUp);
      clearInterval(poll);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, measure]);

  useLayoutEffect(() => {
    if (!step) return;
    setPos(place(rect, popRef.current?.offsetHeight || 0));
  }, [step, rect]);

  useEffect(() => {
    if (!step) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "Enter") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, go, close]);

  if (!step) return null;

  const pad = 6;
  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      {/* Keeps the page inert while the tour is open */}
      <div className="absolute inset-0" aria-hidden="true" />

      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-brand-400 transition-all duration-200"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(45, 62, 80, 0.6)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-ink/60" />
      )}

      <div
        ref={popRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute rounded-2xl border border-gray-200 bg-white p-4 shadow-xl transition-all duration-200"
        style={pos && (rect || !searching || !step.target) ? { ...pos } : { visibility: "hidden" }}
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("tour.close")}
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-ink"
        >
          <X size={15} />
        </button>

        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
          {t("tour.stepOf", { current: index + 1, total: steps.length })}
        </p>
        <h3 id="tour-title" className="mt-1 pr-6 text-[15px] font-semibold text-ink">
          {t(`tour.steps.${step.id}.title`)}
        </h3>
        <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-gray-600">
          {t(`tour.steps.${step.id}.body`)}
        </p>

        <div className="mt-4 flex items-center justify-between">
          {isLast ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={close}
              className="text-xs font-medium text-gray-400 transition-colors hover:text-gray-600"
            >
              {t("tour.skip")}
            </button>
          )}
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                <ArrowLeft size={14} />
                {t("tour.back")}
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => go(1)}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              {isLast ? t("tour.done") : t("tour.next")}
              {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProductTour;
