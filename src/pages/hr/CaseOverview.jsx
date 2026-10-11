import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Columns3, List, RefreshCw, User, UserX } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { PostPriorityConfig, UserRole } from "../../utils/constants";
import { CaseType, CaseAdapters, caseHref } from "../../utils/caseTypes";
import { summarizeOverview } from "../../utils/caseOverview";
import { loadOverviewCases } from "../../services/caseOverviewService";
import CaseSlaBadge from "../../components/case/CaseSlaBadge";

const TYPES = [CaseType.POST, CaseType.VENDOR, CaseType.MODERATION];
const VIEW_KEY = "caseOverview.view";

const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list";
  } catch {
    return "list";
  }
};

const Chip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-[#2D3E50] text-white" : "border border-gray-100 bg-background-white text-gray-500 hover:border-gray-200"
    }`}
  >
    {children}
  </button>
);

const Tile = ({ label, value, tone, active, onClick }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`rounded-xl border bg-background-white p-4 text-left transition-colors ${
      active ? "border-[#1ABC9C]" : "border-gray-100 hover:border-gray-200"
    }`}
  >
    <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
    <p className="mt-0.5 text-xs text-gray-500">{label}</p>
  </button>
);

const StatusBadge = ({ item }) => {
  const cfg = CaseAdapters[item.caseType].statusConfig[item.status];
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${cfg?.bgColor} ${cfg?.textColor}`}>
      {cfg?.label || item.status}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const cfg = PostPriorityConfig[priority];
  if (!cfg) return null;
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${cfg.bgColor} ${cfg.textColor}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

// Everything that tells HR when this case needs attention, most urgent first.
const Deadlines = ({ item, now }) => (
  <>
    {item.pendingTimer && (
      <CaseSlaBadge kind={item.pendingTimer.kind} dueMs={item.pendingTimer.dueMs} now={now} />
    )}
    {item.slaSource === "assigned" && <CaseSlaBadge kind="assigned" dueMs={item.slaDueMs} now={now} />}
  </>
);

const ListRow = ({ item, now, t }) => (
  <Link
    to={caseHref(item.caseType, item.id)}
    className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-background-white p-4 transition-colors hover:border-[#1ABC9C] sm:flex-row sm:items-center"
  >
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
          {t(`caseDetail.type.${item.caseType}`)}
        </span>
        <StatusBadge item={item} />
        <PriorityBadge priority={item.priority} />
      </div>
      <p className="truncate text-sm font-medium text-[#2D3E50]">{item.title || t("caseOverview.untitled")}</p>
    </div>
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <Deadlines item={item} now={now} />
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        {item.assignedTo ? (
          <>
            <User size={12} /> {item.assignedTo.name}
          </>
        ) : (
          <>
            <UserX size={12} className="text-gray-300" /> <span className="text-gray-400">{t("caseOverview.unassigned")}</span>
          </>
        )}
      </span>
    </div>
  </Link>
);

const BoardCard = ({ item, now }) => (
  <Link
    to={caseHref(item.caseType, item.id)}
    className="block space-y-2 rounded-lg border border-gray-100 bg-background-white p-3 transition-colors hover:border-[#1ABC9C]"
  >
    <p className="line-clamp-2 text-sm font-medium text-[#2D3E50]">{item.title}</p>
    <div className="flex flex-wrap items-center gap-1.5">
      <PriorityBadge priority={item.priority} />
      <Deadlines item={item} now={now} />
    </div>
    {item.assignedTo && (
      <p className="inline-flex items-center gap-1 text-[11px] text-gray-500">
        <User size={10} /> {item.assignedTo.name}
      </p>
    )}
  </Link>
);

// Columns = the type's own open statuses; each type keeps its own vocabulary.
const BoardSection = ({ caseType, items, now, t, showHeading }) => {
  const adapter = CaseAdapters[caseType];
  const columns = adapter.statusValues.filter((s) => !adapter.closedStatuses.includes(s));
  return (
    <section>
      {showHeading && (
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {t(`caseDetail.type.${caseType}`)}
        </h2>
      )}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((status) => {
          const cfg = adapter.statusConfig[status];
          const column = items.filter((i) => i.status === status);
          return (
            <div key={status} className="w-64 flex-shrink-0 rounded-xl bg-gray-50 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${cfg?.bgColor} ${cfg?.textColor}`}>
                  {cfg?.label || status}
                </span>
                <span className="text-xs text-gray-400">{column.length}</span>
              </div>
              <div className="space-y-2">
                {column.map((item) => (
                  <BoardCard key={item.key} item={item} now={now} />
                ))}
                {column.length === 0 && <p className="px-1 py-3 text-center text-xs text-gray-300">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const CaseOverview = () => {
  const { userData } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [failed, setFailed] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [typeFilter, setTypeFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all"); // all | overdue | atRisk
  const [mineOnly, setMineOnly] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [view, setView] = useState(readView);

  const allowed = [UserRole.COMPANY_ADMIN, UserRole.HR].includes(userData?.role);

  useEffect(() => {
    if (userData && !allowed) navigate("/");
  }, [userData, allowed, navigate]);

  const load = useCallback(async () => {
    if (!userData?.companyId || !allowed) return;
    try {
      const result = await loadOverviewCases(userData);
      setCases(result.cases);
      setFailed(result.failed);
      setTruncated(result.truncated);
      setNow(Date.now());
    } catch (error) {
      console.error("Error loading case overview:", error);
      setFailed(TYPES);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userData, allowed]);

  useEffect(() => {
    load();
  }, [load]);

  const changeView = (next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // preference just isn't remembered
    }
  };

  const counts = useMemo(() => {
    const byType = Object.fromEntries(TYPES.map((type) => [type, 0]));
    cases.forEach((c) => { byType[c.caseType] += 1; });
    return byType;
  }, [cases]);

  const summary = useMemo(() => summarizeOverview(cases), [cases]);

  const visible = useMemo(
    () =>
      cases.filter(
        (c) =>
          (typeFilter === "all" || c.caseType === typeFilter) &&
          (slaFilter === "all" || c.slaState === slaFilter) &&
          (!mineOnly || c.assignedTo?.id === userData?.id) &&
          (!unassignedOnly || !c.assignedTo)
      ),
    [cases, typeFilter, slaFilter, mineOnly, unassignedOnly, userData?.id]
  );

  const toggleSla = (next) => setSlaFilter((current) => (current === next ? "all" : next));

  if (!userData || !allowed) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1ABC9C] border-t-transparent" />
      </div>
    );
  }

  const boardTypes = TYPES.filter((type) => typeFilter === "all" || typeFilter === type).filter((type) =>
    visible.some((c) => c.caseType === type)
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3E50]">{t("caseOverview.title")}</h1>
          <p className="text-sm text-gray-500">{t("caseOverview.subtitle")}</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); load(); }}
          disabled={refreshing}
          aria-label={t("caseOverview.refresh")}
          className="rounded-lg border border-gray-100 bg-background-white p-2 text-gray-500 hover:border-gray-200 disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {failed.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          {t("caseOverview.partialFailure", { types: failed.map((f) => t(`caseDetail.type.${f}`)).join(", ") })}
        </div>
      )}
      {truncated && (
        <p className="text-xs text-gray-400">{t("caseOverview.truncated")}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={t("caseOverview.open")} value={summary.open} tone="text-[#2D3E50]" active={slaFilter === "all"} onClick={() => setSlaFilter("all")} />
        <Tile label={t("caseOverview.overdue")} value={summary.overdue} tone={summary.overdue ? "text-red-600" : "text-gray-300"} active={slaFilter === "overdue"} onClick={() => toggleSla("overdue")} />
        <Tile label={t("caseOverview.atRisk")} value={summary.atRisk} tone={summary.atRisk ? "text-amber-600" : "text-gray-300"} active={slaFilter === "atRisk"} onClick={() => toggleSla("atRisk")} />
        <Tile label={t("caseOverview.unassigned")} value={summary.unassigned} tone="text-gray-500" active={unassignedOnly} onClick={() => { setUnassignedOnly((v) => !v); setMineOnly(false); }} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2 overflow-x-auto">
          <Chip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
            {t("caseOverview.allTypes")} ({cases.length})
          </Chip>
          {TYPES.map((type) => (
            <Chip key={type} active={typeFilter === type} onClick={() => setTypeFilter(type)}>
              {t(`caseDetail.type.${type}`)} ({counts[type]})
            </Chip>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Chip active={mineOnly} onClick={() => { setMineOnly((v) => !v); setUnassignedOnly(false); }}>
            {t("caseOverview.mine")}
          </Chip>
          <div className="flex rounded-lg border border-gray-100 bg-background-white p-0.5" role="group" aria-label={t("caseOverview.view")}>
            <button
              onClick={() => changeView("list")}
              aria-pressed={view === "list"}
              aria-label={t("caseOverview.list")}
              className={`rounded-md p-1.5 ${view === "list" ? "bg-[#2D3E50] text-white" : "text-gray-400 hover:text-gray-600"}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => changeView("board")}
              aria-pressed={view === "board"}
              aria-label={t("caseOverview.board")}
              className={`rounded-md p-1.5 ${view === "board" ? "bg-[#2D3E50] text-white" : "text-gray-400 hover:text-gray-600"}`}
            >
              <Columns3 size={16} />
            </button>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm font-medium text-gray-500">{t("caseOverview.emptyTitle")}</p>
          <p className="mt-1 text-xs text-gray-400">{t("caseOverview.emptyBody")}</p>
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {visible.map((item) => (
            <ListRow key={item.key} item={item} now={now} t={t} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {boardTypes.map((type) => (
            <BoardSection
              key={type}
              caseType={type}
              items={visible.filter((c) => c.caseType === type)}
              now={now}
              t={t}
              showHeading={boardTypes.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CaseOverview;
