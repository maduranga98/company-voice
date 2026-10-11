import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Link2, Shield, User, Calendar, ExternalLink } from "lucide-react";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { PostPriorityConfig, ReportReasonConfig, UserRole } from "../utils/constants";
import { getCaseAdapter, isValidCaseType, CaseType } from "../utils/caseTypes";
import { getVendorReport } from "../services/vendorRiskService";
import { getReportById } from "../services/moderationService";
import { getCaseTimeline } from "../services/caseTimelineService";
import { showSuccess } from "../services/toastService";
import CaseHandlingPanel from "../components/case/CaseHandlingPanel";
import CaseTimeline from "../components/case/CaseTimeline";
import CaseAttachments from "../components/CaseAttachments";
import AnonymousThread from "../components/AnonymousThread";

const STAFF_ROLES = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR];

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const Card = ({ title, children }) => (
  <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
    {title && (
      <h2 className="border-b border-gray-100 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </h2>
    )}
    {children}
  </section>
);

const Message = ({ title, body, onBack, backLabel }) => (
  <div className="mx-auto max-w-md px-4 py-24 text-center">
    <h1 className="text-lg font-semibold text-[#2D3E50]">{title}</h1>
    <p className="mt-2 text-sm text-gray-500">{body}</p>
    <button
      onClick={onBack}
      className="mt-6 rounded-lg bg-[#2D3E50] px-4 py-2 text-sm font-medium text-white hover:bg-[#24333F]"
    >
      {backLabel}
    </button>
  </div>
);

// ---------- per-type submission content ----------

const PostSubmission = ({ post, t }) => (
  <>
    {post.source === "policy_link" && (
      <div className="border-b border-gray-100 bg-gray-50/60 px-6 py-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">{t("caseDetail.policyConcern")}</p>
        <p className="text-sm text-gray-700">
          {post.policyTitle}
          {post.policyVersion ? ` (v${post.policyVersion})` : ""}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {post.authorName} · {t("caseDetail.employeeId")} {post.employeeId}
        </p>
      </div>
    )}
    <div className="px-6 py-4">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{post.description || post.content}</p>
    </div>
    <CaseAttachments attachments={post.attachments} />
  </>
);

const VendorSubmission = ({ report, t }) => (
  <>
    <div className="px-6 py-4">
      <dl className="mb-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-gray-400">{t("caseDetail.vendor.category")}</dt>
          <dd className="capitalize text-gray-700">{(report.riskCategory || "").replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-gray-400">{t("caseDetail.vendor.severity")}</dt>
          <dd className="capitalize text-gray-700">{report.severity}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-gray-400">{t("caseDetail.vendor.corroborations")}</dt>
          <dd className="text-gray-700">{report.corroborationCount ?? 0}</dd>
        </div>
      </dl>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{report.description}</p>
      {report.reviewNotes && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider">{t("caseDetail.vendor.earlierNotes")}</p>
          {report.reviewNotes}
        </div>
      )}
    </div>
    <CaseAttachments
      attachments={(report.attachmentUrls || []).map((url, i) => ({
        url,
        name: t("caseDetail.vendor.evidenceFile", { n: i + 1 }),
      }))}
    />
    {report.corroborations?.length > 0 && (
      <div className="border-t border-gray-100 px-6 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {t("caseDetail.vendor.corroborations")} ({report.corroborations.length})
        </p>
        <ul className="space-y-2">
          {report.corroborations.map((c, i) => (
            <li key={c.id || i} className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <span className="mr-2 text-[11px] font-semibold uppercase text-gray-400">
                {(c.relationship || "").replace(/_/g, " ")}
              </span>
              {c.account}
            </li>
          ))}
        </ul>
      </div>
    )}
  </>
);

const ModerationSubmission = ({ report, t }) => {
  const reason = ReportReasonConfig[report.reason];
  return (
    <div className="px-6 py-4">
      <p className="mb-2 text-sm font-medium text-[#2D3E50]">
        {reason?.icon} {reason?.label || report.reason}
        <span className="ml-2 text-xs font-normal text-gray-400">{report.contentType}</span>
      </p>
      <p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
        {report.content?.text || report.content?.description || report.contentPreview}
      </p>
      {report.description && (
        <p className="mt-3 text-sm text-gray-500">
          <span className="font-medium text-gray-600">{t("caseDetail.moderation.reporterNotes")}: </span>
          {report.description}
        </p>
      )}
      <Link
        to={`/moderation/report/${report.id}`}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#1ABC9C] hover:underline"
      >
        <ExternalLink size={14} /> {t("caseDetail.moderation.openActions")}
      </Link>
    </div>
  );
};

// ---------- page ----------

const CaseDetail = () => {
  const { caseType, caseId } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [caseData, setCaseData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | notFound | noAccess | error

  const validType = isValidCaseType(caseType);
  const adapter = validType ? getCaseAdapter(caseType) : null;
  const isStaff = STAFF_ROLES.includes(userData?.role);

  const load = useCallback(async () => {
    if (!userData || !validType || !isStaff) return;
    try {
      let data;
      if (caseType === CaseType.VENDOR) data = await getVendorReport(caseId);
      else if (caseType === CaseType.MODERATION) data = await getReportById(caseId);
      else {
        const snap = await getDoc(doc(db, getCaseAdapter(caseType).collection, caseId));
        if (!snap.exists()) {
          setState("notFound");
          return;
        }
        data = { id: snap.id, ...snap.data() };
      }

      if (userData.role !== UserRole.SUPER_ADMIN && data.companyId !== userData.companyId) {
        setState("noAccess");
        return;
      }

      const history = await getCaseTimeline(caseType, caseId, data.companyId).catch((error) => {
        console.error("Error loading case timeline:", error);
        return [];
      });
      setCaseData(data);
      setTimeline(history);
      setState("ready");
    } catch (error) {
      console.error("Error loading case:", error);
      if (error.code === "permission-denied") setState("noAccess");
      else if (/not found/i.test(error.message || "")) setState("notFound");
      else setState("error");
    }
  }, [userData, validType, isStaff, caseType, caseId]);

  useEffect(() => {
    setState("loading");
    load();
  }, [load]);

  const goBack = () => navigate(-1);

  if (!userData) return null;
  if (!validType) {
    return <Message title={t("caseDetail.notFound.title")} body={t("caseDetail.notFound.body")} onBack={() => navigate("/dashboard")} backLabel={t("caseDetail.back")} />;
  }
  if (!isStaff || state === "noAccess") {
    return <Message title={t("caseDetail.noAccess.title")} body={t("caseDetail.noAccess.body")} onBack={goBack} backLabel={t("caseDetail.back")} />;
  }
  if (state === "notFound") {
    return <Message title={t("caseDetail.notFound.title")} body={t("caseDetail.notFound.body")} onBack={goBack} backLabel={t("caseDetail.back")} />;
  }
  if (state === "error") {
    return <Message title={t("caseDetail.error.title")} body={t("caseDetail.error.body")} onBack={goBack} backLabel={t("caseDetail.back")} />;
  }
  if (state === "loading" || !caseData) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1ABC9C] border-t-transparent" />
      </div>
    );
  }

  const status = caseData.status || adapter.defaultStatus;
  const statusCfg = adapter.statusConfig[status];
  const priority = adapter.getPriority(caseData);
  const priorityCfg = PostPriorityConfig[priority];
  const createdAt = adapter.getCreatedAt(caseData);
  const dueDate = toDate(caseData.dueDate);
  const title = adapter.getTitle(caseData) || t(`caseDetail.type.${caseType}`);

  // Add a synthetic "created" row unless the activity log already has one.
  const hasCreatedEntry = timeline.some((e) => e.type === "created" || e.type === "report_created");
  const entries =
    hasCreatedEntry || !createdAt
      ? timeline
      : [...timeline, { id: "created", type: "created", at: createdAt.getTime(), actorName: null, metadata: {} }];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showSuccess(t("caseDetail.linkCopied"));
    } catch {
      // Clipboard can be blocked (insecure context / permissions); the URL bar still works.
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <button onClick={goBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#2D3E50]">
        <ArrowLeft size={16} /> {t("caseDetail.back")}
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              {t(`caseDetail.type.${caseType}`)}
            </span>
            {caseData.referenceCode && (
              <span className="font-mono text-xs text-gray-400">{caseData.referenceCode}</span>
            )}
            {caseData.isAnonymous && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                <Shield size={10} /> {t("caseDetail.anonymous")}
              </span>
            )}
            {!caseData.isAnonymous && caseData.authorName && caseType === CaseType.POST && (
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
                <User size={10} /> {caseData.authorName}
              </span>
            )}
          </div>
          <h1 className="text-xl font-semibold leading-snug text-[#2D3E50]">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-md px-2 py-0.5 font-semibold ${statusCfg?.bgColor} ${statusCfg?.textColor}`}>
              {statusCfg?.label || status}
            </span>
            <span className={`rounded-md px-2 py-0.5 font-semibold ${priorityCfg?.bgColor} ${priorityCfg?.textColor}`}>
              {priorityCfg?.icon} {priorityCfg?.label}
            </span>
            {createdAt && <span className="text-gray-400">{createdAt.toLocaleDateString()}</span>}
            {dueDate && (
              <span className="inline-flex items-center gap-1 text-gray-500">
                <Calendar size={12} /> {t("caseDetail.due", { date: dueDate.toLocaleDateString() })}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={copyLink}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-[#1ABC9C] hover:text-[#1ABC9C]"
        >
          <Link2 size={14} /> {t("caseDetail.copyLink")}
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={t("caseDetail.submission")}>
            {caseType === CaseType.POST && <PostSubmission post={caseData} t={t} />}
            {caseType === CaseType.VENDOR && <VendorSubmission report={caseData} t={t} />}
            {caseType === CaseType.MODERATION && <ModerationSubmission report={caseData} t={t} />}
          </Card>

          {caseType === CaseType.POST && caseData.isAnonymous && (
            <Card title={t("caseDetail.conversation")}>
              <div className="px-4 py-3">
                <AnonymousThread
                  postId={caseData.id}
                  companyId={caseData.companyId}
                  currentUserRole={userData.role}
                  isAnonymousPost={caseData.isAnonymous}
                  defaultOpen
                />
              </div>
            </Card>
          )}

          <Card title={t("caseDetail.timeline.title")}>
            <div className="px-6 py-4">
              <CaseTimeline caseType={caseType} entries={entries} />
            </div>
          </Card>
        </div>

        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <Card title={t("caseDetail.handling")}>
              <div className="p-4">
                <CaseHandlingPanel caseType={caseType} caseData={caseData} currentUser={userData} onUpdate={load} />
              </div>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CaseDetail;
