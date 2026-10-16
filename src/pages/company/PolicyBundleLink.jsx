import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { AlertTriangle, ArrowLeft, CheckCircle2, Inbox, Loader2, Search } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../config/firebase";
import PolicyLinkPanel from "../../components/PolicyLinkPanel";
import { getPolicies } from "../../services/policyService";
import { buildBundleReport } from "../../utils/policyAckReport";

const STATUS_STYLE = {
  acknowledged: "bg-emerald-50 text-emerald-700",
  partial: "bg-sky-50 text-sky-700",
  pending: "bg-amber-50 text-amber-700",
  concern: "bg-[#FF6B6B]/10 text-[#C0392B]",
};

const cardClass = "rounded-2xl border border-gray-200 bg-background-white p-5";

const FILTERS = ["all", "pending", "partial", "acknowledged", "concern"];

const formatDate = (ms) =>
  ms ? new Date(ms).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

const PolicyBundleLink = () => {
  const { t } = useTranslation();
  const { slug } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [link, setLink] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [roster, setRoster] = useState([]);
  const [responses, setResponses] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (userData && userData.role !== "company_admin" && userData.role !== "hr") {
      navigate("/dashboard");
    }
  }, [userData, navigate]);

  useEffect(() => {
    if (!userData?.companyId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [linkSnap, rosterSnap] = await Promise.all([
          getDoc(doc(db, "policyLinks", slug)),
          getDoc(doc(db, "policyLinkRosters", slug)),
        ]);
        const linkData = linkSnap.data();
        if (!linkData || linkData.companyId !== userData.companyId || !Array.isArray(linkData.policyIds)) {
          throw new Error("not-found");
        }
        const [allPolicies, responseSnap] = await Promise.all([
          getPolicies(userData.companyId),
          getDocs(
            query(
              collection(db, "companies", userData.companyId, "policyResponses"),
              where("policyId", "in", linkData.policyIds)
            )
          ),
        ]);
        if (cancelled) return;
        setLink(linkData);
        setPolicies(linkData.policyIds.map((id) => allPolicies.find((p) => p.id === id)).filter(Boolean));
        setRoster(rosterSnap.exists() ? rosterSnap.data().employees || [] : []);
        setResponses(responseSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error loading policy bundle:", err);
        if (!cancelled) setError(t("report.policyBundle.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userData?.companyId, slug, t]);

  // Archived or unpublished policies no longer take part: the public page hides them too.
  const live = useMemo(
    () => policies.filter((p) => p.status === "published").map((p) => ({ id: p.id, title: p.title, version: String(p.version || "1.0") })),
    [policies]
  );
  const titleOf = useMemo(() => Object.fromEntries(live.map((p) => [p.id, p.title])), [live]);

  const report = useMemo(
    () => buildBundleReport({ roster, responses, policies: live }),
    [roster, responses, live]
  );

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return report.rows.filter((row) => {
      if (filter === "concern" ? row.concerns === 0 : filter !== "all" && row.status !== filter) return false;
      return !needle || row.employeeId.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle);
    });
  }, [report.rows, filter, search]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1ABC9C]" aria-label={t("common.loading")} />
      </div>
    );
  }

  const { summary, perPolicy } = report;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link
          to="/company/policies"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2D3E50] hover:text-[#1ABC9C]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("report.policyLink.back")}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-[#2D3E50]">
          {link?.title || t("report.policyBundle.defaultTitle")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("report.policyBundle.intro", { count: live.length })}
        </p>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#FF6B6B]/10 p-3 text-sm text-[#2D3E50]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B6B]" aria-hidden="true" />
          {error}
        </p>
      )}

      {link && live.length < link.policyIds.length && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          {t("report.policyBundle.someInactive", { count: link.policyIds.length - live.length })}
        </p>
      )}

      {link && (
        <>
          <section className={cardClass}>
            <h2 className="text-base font-semibold text-[#2D3E50]">{t("report.policyBundle.included")}</h2>
            <ul className="mt-3 divide-y divide-gray-50">
              {live.map((p) => {
                const done = perPolicy.find((x) => x.id === p.id)?.acknowledged ?? 0;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate font-medium text-[#2D3E50]">
                      {p.title} <span className="font-mono text-xs text-gray-400">v{p.version}</span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {t("report.policyBundle.acknowledgedBy", { count: done })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <PolicyLinkPanel
            slug={slug}
            initialActive={link.active !== false}
            initialRequireRoster={link.requireRoster === true}
            initialRoster={roster}
            onRosterChange={setRoster}
          />
        </>
      )}

      <section className={cardClass}>
        <h2 className="text-base font-semibold text-[#2D3E50]">{t("report.policyLink.table.title")}</h2>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["acknowledged", summary.acknowledged],
            ["partial", summary.partial],
            ["pending", summary.rosterTotal > 0 ? summary.pending : "–"],
            ["concerns", summary.concerns],
            ["outsideRoster", summary.rosterTotal > 0 ? summary.offRoster : "–"],
          ].map(([key, value]) => (
            <div key={key} className="rounded-xl bg-background-softGray p-3">
              <dt className="text-xs text-gray-500">{t(`report.policyBundle.stats.${key}`)}</dt>
              <dd className="mt-0.5 text-2xl font-semibold text-[#2D3E50]">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap rounded-xl bg-gray-100 p-1" role="group">
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === value ? "bg-background-white text-[#2D3E50] shadow-xs" : "text-gray-500 hover:text-[#2D3E50]"
                }`}
              >
                {t(`report.policyBundle.filter.${value}`)}
              </button>
            ))}
          </div>
          <div className="relative min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("report.policyLink.table.search")}
              className="w-full rounded-xl border border-gray-200 bg-background-white py-2 pl-9 pr-3 text-sm text-[#2D3E50] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
          </div>
          {summary.concerns > 0 && (
            <Link
              to="/hr/inbox"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D3E50] hover:text-[#1ABC9C]"
            >
              <Inbox className="h-4 w-4" aria-hidden="true" />
              {t("report.policyLink.table.inbox")}
            </Link>
          )}
        </div>

        {visibleRows.length === 0 ? (
          <p className="mt-6 text-center text-sm text-gray-500">{t("report.policyLink.table.empty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4 font-semibold">{t("report.policyLink.table.employeeId")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("report.policyLink.table.name")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("report.policyLink.table.status")}</th>
                  <th className="py-2 font-semibold">{t("report.policyLink.table.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleRows.map((row) => (
                  <tr key={row.employeeKey}>
                    <td className="py-2.5 pr-4 font-mono text-xs text-[#2D3E50]">{row.employeeId}</td>
                    <td className="py-2.5 pr-4 text-[#2D3E50]">
                      {row.name || "–"}
                      {!row.onRoster && summary.rosterTotal > 0 && (
                        <span className="ml-2 text-xs text-gray-400">{t("report.policyLink.table.notOnRoster")}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        title={
                          row.missing.length > 0
                            ? t("report.policyBundle.missing", {
                                policies: row.missing.map((id) => titleOf[id]).join(", "),
                              })
                            : undefined
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[row.status]}`}
                      >
                        {row.status === "acknowledged" && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                        {row.status === "partial"
                          ? t("report.policyBundle.statuses.partial", { done: row.acknowledgedCount, total: row.total })
                          : t(`report.policyLink.table.statuses.${row.status}`)}
                      </span>
                      {row.concerns > 0 && row.status !== "concern" && (
                        <span className="ml-2 text-xs text-[#C0392B]">
                          {t("report.policyLink.table.alsoConcern", { count: row.concerns })}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-xs text-gray-500">
                      {row.status === "acknowledged" ? formatDate(row.acknowledgedAt) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default PolicyBundleLink;
