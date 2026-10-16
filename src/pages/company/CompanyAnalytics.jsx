import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { PostPriorityConfig } from "../../utils/constants";
import { CaseType } from "../../utils/caseTypes";
import { fetchAnalyticsData } from "../../services/analyticsService";
import {
  PERIOD_OPTIONS,
  ACK_WINDOW_DAYS,
  FEEDBACK_WINDOW_DAYS,
  CASE_TYPE_LABELS,
  REPORT_TYPE_LABELS,
  CATEGORY_LABELS,
  computeAnalytics,
  exportToCSV,
  downloadCSV,
} from "../../utils/analyticsHelpers";
import { PriorityBadge } from "../../components/case/CaseBadges";
import PageHeader, { PageContainer } from "../../components/PageHeader";
import {
  BarChart3,
  FileText,
  Download,
  ChevronDown,
  TrendingUp,
  Clock,
  Timer,
  ShieldCheck,
  AlertTriangle,
  Users,
} from "lucide-react";

const card = "rounded-2xl border border-gray-200/70 bg-background-white p-5 shadow-xs lg:p-6";

const happiness = (score) => {
  if (score >= 80) return { emoji: "😊", text: "text-emerald-600", bar: "bg-emerald-500" };
  if (score >= 60) return { emoji: "🙂", text: "text-brand-600", bar: "bg-brand-500" };
  if (score >= 40) return { emoji: "😐", text: "text-amber-600", bar: "bg-amber-500" };
  if (score >= 20) return { emoji: "😟", text: "text-orange-600", bar: "bg-orange-500" };
  return { emoji: "😢", text: "text-rose-600", bar: "bg-rose-500" };
};

const Stat = ({ icon, tone, value, label, hint }) => (
  <div className="rounded-2xl border border-gray-200/70 bg-background-white p-4 shadow-xs lg:p-5">
    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
      {icon}
    </div>
    <p className="tabular mt-4 text-3xl font-semibold tracking-tight text-ink">{value}</p>
    <p className="mt-1 text-[13px] font-medium text-gray-500">{label}</p>
    {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
  </div>
);

const BarRow = ({ left, count, total, barClass = "bg-brand-500" }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="min-w-0 flex-1 text-sm text-gray-700">{left}</div>
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-gray-100">
        <div className={`h-2 rounded-full ${barClass}`} style={{ width: `${(count / Math.max(total, 1)) * 100}%` }} />
      </div>
      <span className="tabular w-8 text-right text-sm font-semibold text-ink">{count}</span>
    </div>
  </div>
);

const labelFor = (labels, key) => labels[key] || key.replace(/_/g, " ");

const Breakdown = ({ title, entries, total, empty = "No data in this period" }) => (
  <div className={card}>
    <h3 className="mb-4 text-base font-semibold text-ink">{title}</h3>
    <div className="space-y-3">
      {entries.map(([label, count]) => (
        <BarRow key={label} left={label} count={count} total={total} />
      ))}
      {entries.length === 0 && <p className="text-sm text-gray-400">{empty}</p>}
    </div>
  </div>
);

const Compliance = ({ title, window, data }) => (
  <div className={card}>
    <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
      <ShieldCheck size={16} className="text-gray-400" /> {title}
    </h3>
    <div className="mt-3 flex items-baseline">
      <p className="tabular text-4xl font-semibold text-ink">{data.rate === null ? "–" : `${data.rate}%`}</p>
    </div>
    <p className="mt-2 text-[13px] text-gray-500">
      {data.rate === null
        ? `No cases have reached the ${window}-day mark yet`
        : `${data.onTime} of ${data.judged} cases within ${window} days`}
    </p>
  </div>
);

const SCOPES = [["", "All cases"], ...Object.values(CaseType).map((t) => [t, CASE_TYPE_LABELS[t]])];

const CompanyAnalytics = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState("");
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [useCustom, setUseCustom] = useState(false);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    if (!userData?.companyId) return;
    let cancelled = false;
    setLoading(true);
    fetchAnalyticsData(userData.companyId, userData.role)
      .then((d) => !cancelled && setRaw(d))
      .catch((e) => {
        console.error("Error fetching analytics:", e);
        if (!cancelled) setError("Couldn't load analytics. Please try again.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userData?.companyId, userData?.role]);

  const a = useMemo(() => {
    if (!raw) return null;
    const caseType = scope || undefined;
    if (useCustom && custom.start && custom.end) {
      const start = new Date(custom.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(custom.end);
      end.setHours(23, 59, 59, 999);
      return computeAnalytics(raw, { start, end, caseType });
    }
    return computeAnalytics(raw, { days, caseType });
  }, [raw, days, scope, useCustom, custom]);

  if (loading) {
    return (
      <div className="space-y-6 lg:space-y-8" aria-busy="true">
        <div className="h-16 w-64 animate-pulse rounded-xl bg-gray-200/60" />
        <div className="h-24 animate-pulse rounded-2xl bg-gray-200/60" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200/60" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-gray-200/60" />
      </div>
    );
  }

  if (error || !a) {
    return <p className="py-16 text-center text-sm text-gray-500">{error || "No data available."}</p>;
  }

  const h = happiness(a.happinessScore);
  const total = a.overview.total;
  const maxTrend = Math.max(...a.trend.map((d) => d.count), 1);
  const maxAge = Math.max(...a.backlog.age.map((b) => b.count), 1);
  const periodLabel = useCustom
    ? `${new Date(custom.start).toLocaleDateString()} – ${new Date(custom.end).toLocaleDateString()}`
    : `the last ${days} days`;
  const stamp = new Date().toISOString().slice(0, 10);
  const exportAs = (type, name) => {
    downloadCSV(exportToCSV(a, type), `${name}-${stamp}.csv`);
    setShowExport(false);
  };
  const segBtn = (active) =>
    `rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;
  const sorted = (obj, labels) =>
    Object.entries(obj)
      .filter(([, n]) => n > 0)
      .sort((x, y) => y[1] - x[1])
      .map(([k, n]) => [labelFor(labels, k), n]);

  return (
    <PageContainer>
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        subtitle="How your company handles reports and concerns"
      />

      {/* Controls */}
      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time period">
              {PERIOD_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDays(d);
                    setUseCustom(false);
                  }}
                  className={segBtn(!useCustom && days === d)}
                >
                  {d} days
                </button>
              ))}
              <span className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" />
              {SCOPES.map(([value, label]) => (
                <button key={value} onClick={() => setScope(value)} className={segBtn(scope === value)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <input
                type="date"
                aria-label="Start date"
                value={custom.start}
                max={custom.end || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              to
              <input
                type="date"
                aria-label="End date"
                value={custom.end}
                min={custom.start || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              <button
                onClick={() => setUseCustom(true)}
                disabled={!custom.start || !custom.end}
                className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => exportAs("full", "analytics-report")}
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-soft"
            >
              <Download size={16} />
              Export report
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExport((p) => !p)}
                aria-expanded={showExport}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-background-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                More
                <ChevronDown size={15} />
              </button>
              {showExport && (
                <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-gray-200/70 bg-background-white py-1 shadow-lg">
                  {[
                    ["overview", "overview", "Export overview"],
                    ["departments", "departments", "Export departments"],
                    ["handlers", "handlers", "Export handler workload"],
                  ].map(([type, name, label]) => (
                    <button
                      key={type}
                      onClick={() => exportAs(type, name)}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="mt-4 text-[13px] font-medium text-brand-700">
          Showing {SCOPES.find(([v]) => v === scope)[1].toLowerCase()} received {useCustom ? "between" : "in"} {periodLabel}
        </p>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat icon={<FileText size={18} />} tone="bg-brand-50 text-brand-600" value={total} label="Cases received" hint={`${a.overview.open} still open`} />
        <Stat icon={<TrendingUp size={18} />} tone="bg-emerald-50 text-emerald-600" value={`${a.resolutionRate}%`} label="Resolution rate" hint={`${a.overview.resolved} resolved or closed`} />
        <Stat icon={<Clock size={18} />} tone="bg-violet-50 text-violet-600" value={`${a.avgResponseHours}h`} label="Avg first response" hint={`${a.respondedCount} of ${total} answered`} />
        <Stat icon={<Timer size={18} />} tone="bg-amber-50 text-amber-600" value={a.avgResolutionDays} label="Avg days to resolve" />
      </section>

      {/* Happiness */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-ink">Company happiness score</h3>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Resolution rate (40%), acknowledgement within {ACK_WINDOW_DAYS} days (30%) and response speed (30%)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-5xl" aria-hidden="true">{h.emoji}</span>
            <div className="text-center">
              <p className={`tabular text-4xl font-semibold ${h.text}`}>{a.happinessScore}</p>
              <p className="text-xs text-gray-400">out of 100</p>
            </div>
          </div>
        </div>
        <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div className={`h-3 rounded-full transition-all duration-500 ${h.bar}`} style={{ width: `${a.happinessScore}%` }} />
        </div>
      </section>

      {/* Compliance */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
        <Compliance title="Acknowledged on time" window={ACK_WINDOW_DAYS} data={a.ack} />
        <Compliance title="Closed with feedback on time" window={FEEDBACK_WINDOW_DAYS} data={a.feedback} />
      </section>

      {/* Backlog */}
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-ink">Open backlog</h3>
            <p className="mt-0.5 text-[13px] text-gray-500">All currently open cases, regardless of period</p>
          </div>
          <div className="flex gap-6">
            {[
              [a.backlog.total, "Open"],
              [a.backlog.overdue, "Overdue", a.backlog.overdue > 0],
              [a.backlog.unassigned, "Unassigned"],
            ].map(([n, label, alert]) => (
              <div key={label} className="text-right">
                <p className={`tabular text-2xl font-semibold ${alert ? "text-rose-600" : "text-ink"}`}>{n}</p>
                <p className="flex items-center justify-end gap-1 text-xs text-gray-500">
                  {alert && <AlertTriangle size={12} />} {label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-4 items-end gap-3">
          {a.backlog.age.map((b) => (
            <div key={b.key} className="flex flex-col items-center gap-2">
              <span className="tabular text-sm font-semibold text-ink">{b.count}</span>
              <div
                className={`w-full rounded-t ${b.key === "gt90" ? "bg-rose-400" : "bg-brand-500"}`}
                style={{ height: `${(b.count / maxAge) * 80}px`, minHeight: b.count > 0 ? 4 : 0 }}
              />
              <span className="text-center text-xs text-gray-500">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Breakdowns */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <Breakdown title="Cases by source" entries={sorted(a.byCaseType, CASE_TYPE_LABELS)} total={total} />
        <Breakdown title="Reports by type" entries={sorted(a.byReportType, REPORT_TYPE_LABELS)} total={total} />
        <Breakdown title="Reports by category" entries={sorted(a.byCategory, CATEGORY_LABELS)} total={total} />
        <Breakdown title="Cases by status" entries={sorted(a.byStatus, a.statusLabels)} total={total} />
        <div className={card}>
          <h3 className="mb-4 text-base font-semibold text-ink">Cases by priority</h3>
          <div className="space-y-3">
            {Object.entries(a.byPriority).map(([priority, count]) => (
              <BarRow
                key={priority}
                left={<PriorityBadge priority={priority} />}
                count={count}
                total={total}
                barClass={PostPriorityConfig[priority]?.badgeBg || "bg-gray-400"}
              />
            ))}
          </div>
        </div>
        <div className={card}>
          <h3 className="mb-4 text-base font-semibold text-ink">How reports arrive</h3>
          <div className="space-y-3 text-sm">
            {[
              ["Public report link", a.intake.publicLink],
              ["Signed-in employees", a.intake.signedIn],
              ["Submitted anonymously", `${a.intake.anonymous} (${a.intake.anonymousRate}%)`],
              ["Involving HR", a.intake.involvesHR],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-gray-700">{label}</span>
                <span className="tabular font-semibold text-ink">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trend */}
      <section className={card}>
        <h3 className="text-base font-semibold text-ink">Cases received</h3>
        <p className="mt-0.5 text-[13px] text-gray-500">
          {total} cases · {(total / Math.max(a.trend.length, 1)).toFixed(1)} per day
        </p>
        <div className="mt-5 flex h-56 items-end gap-px" role="img" aria-label="Cases per day">
          {a.trend.map((d) => (
            <div key={d.date} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-brand-500 transition-colors group-hover:bg-brand-600"
                style={{ height: `${(d.count / maxTrend) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white group-hover:block">
                {new Date(`${d.date}T00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}: {d.count}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between text-xs text-gray-400">
          <span>{a.trend[0]?.date}</span>
          <span>{a.trend[a.trend.length - 1]?.date}</span>
        </div>
      </section>

      {/* Departments */}
      {a.departmentStats.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-gray-200/70 bg-background-white shadow-xs">
          <div className="border-b border-gray-100 px-5 py-4 lg:px-6">
            <h3 className="text-base font-semibold text-ink">Department performance</h3>
            <p className="mt-0.5 text-[13px] text-gray-500">Cases assigned to each department</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80">
                <tr>
                  {["Department", "Cases", "Resolved", "Pending", "Overdue", "Response (h)", "Resolution"].map((c) => (
                    <th key={c} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 lg:px-6">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {a.departmentStats.map((d) => (
                  <tr key={d.id} className="cursor-pointer transition hover:bg-gray-50" onClick={() => navigate(`/departments/${d.id}`)}>
                    <td className="whitespace-nowrap px-5 py-4 lg:px-6">
                      <span className="mr-2 text-lg">{d.icon}</span>
                      <span className="text-sm font-semibold text-ink">{d.name}</span>
                    </td>
                    <td className="tabular px-5 py-4 text-sm text-gray-600 lg:px-6">{d.total}</td>
                    <td className="px-5 py-4 lg:px-6">
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{d.resolved}</span>
                    </td>
                    <td className="px-5 py-4 lg:px-6">
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{d.pending}</span>
                    </td>
                    <td className="px-5 py-4 lg:px-6">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${d.overdue ? "bg-rose-50 text-rose-700" : "bg-gray-50 text-gray-500"}`}>{d.overdue}</span>
                    </td>
                    <td className="tabular px-5 py-4 text-sm text-gray-600 lg:px-6">{d.avgResponseHours}</td>
                    <td className="whitespace-nowrap px-5 py-4 lg:px-6">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-gray-100">
                          <div className="h-2 rounded-full bg-brand-500" style={{ width: `${d.resolutionRate}%` }} />
                        </div>
                        <span className="tabular text-sm font-semibold text-ink">{d.resolutionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Handler workload */}
      <section className={card}>
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
          <Users size={16} className="text-gray-400" /> Handler workload
        </h3>
        <div className="space-y-2">
          {a.handlers.map((u, i) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</div>
                <div>
                  <p className="text-sm font-semibold text-ink">{u.name}</p>
                  <p className="text-xs text-gray-500">
                    {u.resolved} resolved · {u.open} open
                  </p>
                </div>
              </div>
              <p className="tabular text-lg font-semibold text-brand-600">{u.assigned}</p>
            </div>
          ))}
          {a.handlers.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No cases assigned to individuals in this period</p>}
        </div>
      </section>
    </PageContainer>
  );
};

export default CompanyAnalytics;
