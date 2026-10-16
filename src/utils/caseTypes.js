import {
  PostStatus,
  PostStatusConfig,
  PostPriority,
  ReportStatus,
  ReportStatusConfig,
} from "./constants";

// ============================================
// CASE TYPES
// ============================================
// One adapter per case source. The shared case-handling panel and caseService read
// everything collection- or vocabulary-specific from here, so a page keeps its own
// status vocabulary and only the generic handling (priority, assignment, due date,
// notes) is shared.

export const CaseType = {
  POST: "post",
  VENDOR: "vendor",
  MODERATION: "moderation",
};

// Vendor-risk status vocabulary (kept as-is; deliberately not folded into PostStatus)
export const VendorStatus = {
  OPEN: "open",
  INVESTIGATING: "investigating",
  ESCALATED: "escalated",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

// Vendor Risk's own visibility tier — deliberately separate from PrivacyLevel
// (company_public / department_only / hr_only), which is a posts-only vocabulary.
// A vendor report is "standard" by default (readable by any staff member, as
// before); "restricted" narrows it to company_admin/super_admin only, mirroring
// how involvesHR keeps a post out of HR's hands. Enforced in firestore.rules
// (isHRVisibleVendorReport) — HR's list queries simply omit restricted docs
// rather than erroring.
export const VendorVisibility = {
  STANDARD: "standard",
  RESTRICTED: "restricted",
};

export const VendorVisibilityConfig = {
  [VendorVisibility.STANDARD]: {
    label: "Standard",
    description: "Visible to Company Admin and HR",
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
    borderColor: "border-gray-300",
  },
  [VendorVisibility.RESTRICTED]: {
    label: "Restricted",
    description: "Visible to Company Admin only — hidden from HR",
    bgColor: "bg-purple-100",
    textColor: "text-purple-800",
    borderColor: "border-purple-300",
  },
};

export const VendorStatusConfig = {
  [VendorStatus.OPEN]: { label: "Open", bgColor: "bg-blue-100", textColor: "text-blue-800", borderColor: "border-blue-300" },
  [VendorStatus.INVESTIGATING]: { label: "Investigating", bgColor: "bg-amber-100", textColor: "text-amber-800", borderColor: "border-amber-300" },
  [VendorStatus.ESCALATED]: { label: "Escalated", bgColor: "bg-red-100", textColor: "text-red-800", borderColor: "border-red-300" },
  [VendorStatus.RESOLVED]: { label: "Resolved", bgColor: "bg-emerald-100", textColor: "text-emerald-800", borderColor: "border-emerald-300" },
  [VendorStatus.CLOSED]: { label: "Closed", bgColor: "bg-gray-100", textColor: "text-gray-700", borderColor: "border-gray-300" },
};

// vendorReports severity (low/medium/high) maps onto the shared priority scale
const VENDOR_SEVERITY_TO_PRIORITY = {
  low: PostPriority.LOW,
  medium: PostPriority.MEDIUM,
  high: PostPriority.HIGH,
};

export const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const CaseAdapters = {
  [CaseType.POST]: {
    type: CaseType.POST,
    collection: "posts",
    statusValues: Object.values(PostStatus),
    statusConfig: PostStatusConfig,
    defaultStatus: PostStatus.OPEN,
    closedStatuses: [PostStatus.RESOLVED, PostStatus.CLOSED, PostStatus.REJECTED, PostStatus.NOT_A_PROBLEM],
    statusEditable: true,
    getTitle: (c) => c.title || "",
    getCreatedAt: (c) => toDate(c.createdAt),
    getPriority: (c) => c.priority || PostPriority.MEDIUM,
  },
  [CaseType.VENDOR]: {
    type: CaseType.VENDOR,
    collection: "vendorReports",
    statusValues: Object.values(VendorStatus),
    statusConfig: VendorStatusConfig,
    defaultStatus: VendorStatus.OPEN,
    closedStatuses: [VendorStatus.RESOLVED, VendorStatus.CLOSED],
    statusEditable: true,
    getTitle: (c) => c.vendorName || c.referenceCode || "",
    getCreatedAt: (c) => toDate(c.submittedAt),
    getPriority: (c) => c.priority || VENDOR_SEVERITY_TO_PRIORITY[c.severity] || PostPriority.MEDIUM,
  },
  [CaseType.MODERATION]: {
    type: CaseType.MODERATION,
    collection: "contentReports",
    statusValues: Object.values(ReportStatus),
    statusConfig: ReportStatusConfig,
    defaultStatus: ReportStatus.PENDING,
    closedStatuses: [ReportStatus.RESOLVED, ReportStatus.DISMISSED],
    // Moderation status only moves through reviewReport() (dismiss / remove / strike /
    // escalate), which also performs the side effects. A free status dropdown would
    // let a status drift away from what was actually done to the content.
    statusEditable: false,
    getTitle: (c) => c.contentPreview || c.reason || "",
    getCreatedAt: (c) => toDate(c.createdAt),
    getPriority: (c) => c.priority || PostPriority.MEDIUM,
  },
};

export const getCaseAdapter = (caseType) => {
  const adapter = CaseAdapters[caseType];
  if (!adapter) throw new Error(`Unknown case type: ${caseType}`);
  return adapter;
};

export const isValidCaseType = (caseType) => Object.prototype.hasOwnProperty.call(CaseAdapters, caseType);

export const getCasePriority = (caseType, caseData) => getCaseAdapter(caseType).getPriority(caseData);

export const isCaseClosed = (caseType, caseData) =>
  getCaseAdapter(caseType).closedStatuses.includes(caseData.status);

// Stable, shareable URL for a case. The one URL shape used everywhere.
export const caseHref = (caseType, caseId) => `/cases/${caseType}/${caseId}`;
