import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import QRCode from "qrcode";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Inbox,
  Loader2,
  Search,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../config/firebase";
import {
  ensurePolicyLink,
  savePolicyLinkRoster,
  setPolicyLinkActive,
} from "../../services/policyAckService";
import { buildAckReport, listVersions } from "../../utils/policyAckReport";

const STATUS_STYLE = {
  acknowledged: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  concern: "bg-[#FF6B6B]/10 text-[#C0392B]",
};

const FILTERS = ["all", "pending", "acknowledged", "concern"];

const buildLinkUrl = (slug) =>
  `${(import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, "")}/p/${slug}`;

const rosterToText = (employees) =>
  employees.map((e) => (e.name ? `${e.employeeId}, ${e.name}` : e.employeeId)).join("\n");

const formatDateTime = (ms) =>
  ms ? new Date(ms).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

const PolicyAckLink = () => {
  const { t } = useTranslation();
  const { policyId } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState(null);
  const [slug, setSlug] = useState("");
  const [active, setActive] = useState(true);
  const [requireRoster, setRequireRoster] = useState(false);
  const [rosterText, setRosterText] = useState("");
  const [rosterEmployees, setRosterEmployees] = useState([]);
  const [responses, setResponses] = useState([]);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [rosterNote, setRosterNote] = useState("");
  const [version, setVersion] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const linkUrl = slug ? buildLinkUrl(slug) : "";

  useEffect(() => {
    if (userData && userData.role !== "company_admin" && userData.role !== "hr") {
      navigate("/dashboard");
    }
  }, [userData, navigate]);

  const loadResponses = useCallback(async () => {
    const snap = await getDocs(
      query(
        collection(db, "companies", userData.companyId, "policyResponses"),
        where("policyId", "==", policyId)
      )
    );
    setResponses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, [userData?.companyId, policyId]);

  useEffect(() => {
    if (!userData?.companyId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const policySnap = await getDoc(doc(db, "policies", policyId));
        if (!policySnap.exists() || policySnap.data().companyId !== userData.companyId) {
          throw new Error("not-found");
        }
        const policyData = { id: policySnap.id, ...policySnap.data() };
        if (cancelled) return;
        setPolicy(policyData);
        setVersion(String(policyData.version || "1.0"));

        if (policyData.status === "published") {
          const created = await ensurePolicyLink(policyId);
          if (cancelled) return;
          setSlug(created.slug);

          const [linkSnap, rosterSnap] = await Promise.all([
            getDoc(doc(db, "policyLinks", created.slug)),
            getDoc(doc(db, "policyLinkRosters", created.slug)),
          ]);
          if (cancelled) return;
          const link = linkSnap.data() || {};
          setActive(link.active !== false);
          setRequireRoster(link.requireRoster === true);
          const employees = rosterSnap.exists() ? rosterSnap.data().employees || [] : [];
          setRosterEmployees(employees);
          setRosterText(rosterToText(employees));
        }
        await loadResponses();
      } catch (err) {
        console.error("Error loading policy link:", err);
        if (!cancelled) setError(t("report.policyLink.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userData?.companyId, policyId, loadResponses, t]);

  useEffect(() => {
    if (!linkUrl) return;
    QRCode.toDataURL(linkUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#0284c7", light: "#ffffff" },
      errorCorrectionLevel: "H",
    })
      .then(setQrCodeUrl)
      .catch((err) => console.error("Error generating QR code:", err));
  }, [linkUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(linkUrl);
      toast.success(t("report.policyLink.copied"));
    } catch {
      toast.error(t("report.policyLink.saveError"));
    }
  };

  const downloadQr = () => {
    const a = document.createElement("a");
    a.href = qrCodeUrl;
    a.download = `policy-${slug}.png`;
    a.click();
  };

  const toggleActive = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await setPolicyLinkActive(slug, !active);
      setActive(result.active);
    } catch (err) {
      console.error("Error updating link status:", err);
      setError(t("report.policyLink.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const saveRoster = async () => {
    setBusy(true);
    setError("");
    setRosterNote("");
    try {
      const result = await savePolicyLinkRoster(slug, { rosterText, requireRoster });
      setRequireRoster(result.requireRoster);
      const snap = await getDoc(doc(db, "policyLinkRosters", slug));
      const employees = snap.exists() ? snap.data().employees || [] : [];
      setRosterEmployees(employees);
      setRosterText(rosterToText(employees));
      setRosterNote(
        result.rejectedLines.length > 0
          ? t("report.policyLink.roster.savedWithSkipped", {
              count: result.rosterCount,
              lines: result.rejectedLines.join(", "),
            })
          : t("report.policyLink.roster.saved", { count: result.rosterCount })
      );
    } catch (err) {
      console.error("Error saving roster:", err);
      setError(t("report.policyLink.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const versions = useMemo(
    () => listVersions(responses, policy ? String(policy.version || "1.0") : ""),
    [responses, policy]
  );

  const report = useMemo(
    () => buildAckReport({ roster: rosterEmployees, responses, version }),
    [rosterEmployees, responses, version]
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

  const { summary } = report;
  const cardClass = "rounded-2xl border border-gray-200 bg-white p-5";

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
          {policy ? policy.title : t("report.policyLink.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t("report.policyLink.intro")}</p>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#FF6B6B]/10 p-3 text-sm text-[#2D3E50]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B6B]" aria-hidden="true" />
          {error}
        </p>
      )}

      {policy && policy.status !== "published" && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{t("report.policyLink.notPublished")}</p>
      )}

      {slug && (
        <>
          <section className={`${cardClass} grid gap-6 sm:grid-cols-[1fr_auto]`}>
            <div className="min-w-0 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("report.policyLink.linkLabel")}
                </p>
                <p className="mt-1 break-all rounded-xl bg-background-softGray px-3.5 py-3 font-mono text-sm text-[#2D3E50]">
                  {linkUrl}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1ABC9C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16A085]"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {t("report.policyLink.copy")}
                </button>
                <a
                  href={linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#2D3E50] transition hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {t("report.policyLink.open")}
                </a>
              </div>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={active}
                  disabled={busy}
                  onChange={toggleActive}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1ABC9C]"
                />
                <span>
                  <span className="block text-sm font-semibold text-[#2D3E50]">
                    {active ? t("report.policyLink.active") : t("report.policyLink.paused")}
                  </span>
                  <span className="block text-xs text-gray-500">{t("report.policyLink.activeHelp")}</span>
                </span>
              </label>
            </div>

            {qrCodeUrl && (
              <div className="flex flex-col items-center gap-2">
                <img src={qrCodeUrl} alt={t("report.policyLink.qrAlt")} className="h-36 w-36 rounded-xl border border-gray-200" />
                <button
                  type="button"
                  onClick={downloadQr}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D3E50] hover:text-[#1ABC9C]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("report.policyLink.downloadQr")}
                </button>
              </div>
            )}
          </section>

          <section className={cardClass}>
            <h2 className="text-base font-semibold text-[#2D3E50]">{t("report.policyLink.roster.title")}</h2>
            <p className="mt-1 text-sm text-gray-500">{t("report.policyLink.roster.help")}</p>
            <textarea
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder={t("report.policyLink.roster.placeholder")}
              className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-white px-3.5 py-3 font-mono text-xs text-[#2D3E50] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
            <label className="mt-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={requireRoster}
                onChange={(e) => setRequireRoster(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1ABC9C]"
              />
              <span>
                <span className="block text-sm font-semibold text-[#2D3E50]">{t("report.policyLink.roster.require")}</span>
                <span className="block text-xs text-gray-500">{t("report.policyLink.roster.requireHelp")}</span>
              </span>
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={saveRoster}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2D3E50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#243242] disabled:opacity-40"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("report.policyLink.roster.save")}
              </button>
              {rosterNote && <span className="text-xs text-gray-600">{rosterNote}</span>}
            </div>
          </section>
        </>
      )}

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#2D3E50]">{t("report.policyLink.table.title")}</h2>
          {versions.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-gray-500">
              {t("report.policyLink.table.version")}
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-[#2D3E50]"
              >
                {versions.map((v) => (
                  <option key={v} value={v}>
                    v{v}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["acknowledged", summary.acknowledged],
            ["pending", summary.rosterTotal > 0 ? summary.pending : "–"],
            ["concerns", summary.concerns],
            ["outsideRoster", summary.rosterTotal > 0 ? summary.offRoster : "–"],
          ].map(([key, value]) => (
            <div key={key} className="rounded-xl bg-background-softGray p-3">
              <dt className="text-xs text-gray-500">{t(`report.policyLink.stats.${key}`)}</dt>
              <dd className="mt-0.5 text-2xl font-semibold text-[#2D3E50]">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-gray-100 p-1" role="group">
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === value ? "bg-white text-[#2D3E50] shadow-xs" : "text-gray-500 hover:text-[#2D3E50]"
                }`}
              >
                {t(`report.policyLink.table.filter.${value}`)}
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
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-[#2D3E50] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
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
                      {!row.onRoster && report.summary.rosterTotal > 0 && (
                        <span className="ml-2 text-xs text-gray-400">{t("report.policyLink.table.notOnRoster")}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[row.status]}`}>
                        {row.status === "acknowledged" && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                        {t(`report.policyLink.table.statuses.${row.status}`)}
                      </span>
                      {row.concerns > 0 && row.status !== "concern" && (
                        <span className="ml-2 text-xs text-[#C0392B]">
                          {t("report.policyLink.table.alsoConcern", { count: row.concerns })}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-xs text-gray-500">{formatDateTime(row.acknowledgedAt)}</td>
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

export default PolicyAckLink;
