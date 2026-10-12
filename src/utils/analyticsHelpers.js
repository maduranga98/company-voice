/**
 * Analytics Helper Functions
 * Pure metric calculations for the company Analytics & Insights page.
 *
 * The unit of analysis is a *case*: a report (posts), a vendor-risk report or a
 * content-moderation report. Everything is derived from case fields, the staff
 * activity log and anonymous investigator threads.
 */

import { CaseType, CaseAdapters, toDate } from "./caseTypes";
import { PostType, PostPriority, AssignmentType } from "./constants";

export { toDate };

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;

export const PERIOD_OPTIONS = [7, 30, 90];

// EU Whistleblower Directive windows (mirrors functions/utils/caseTimers.js)
export const ACK_WINDOW_DAYS = 7;
export const FEEDBACK_WINDOW_DAYS = 90;

export const CASE_TYPE_LABELS = {
  [CaseType.POST]: "Reports",
  [CaseType.VENDOR]: "Vendor risk",
  [CaseType.MODERATION]: "Moderation",
};

export const REPORT_TYPE_LABELS = {
  [PostType.PROBLEM_REPORT]: "Concerns",
  [PostType.IDEA_SUGGESTION]: "Ideas",
  [PostType.TEAM_DISCUSSION]: "Questions",
  [PostType.CREATIVE_CONTENT]: "Other",
};

export const CATEGORY_LABELS = {
  harassment: "Harassment",
  discrimination: "Discrimination",
  safety: "Safety",
  fraud_ethics: "Fraud & ethics",
  management: "Management",
  workplace_conditions: "Workplace conditions",
  pay_benefits: "Pay & benefits",
  other: "Other",
};

export const AGE_BUCKETS = [
  { key: "lt7", label: "Under 7 days", max: 7 },
  { key: "7to30", label: "7–30 days", max: 30 },
  { key: "30to90", label: "30–90 days", max: 90 },
  { key: "gt90", label: "Over 90 days", max: Infinity },
];

const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);
const round1 = (n) => Math.round(n * 10) / 10;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp = (n, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

/**
 * Normalise raw collections into one list of cases with the fields analytics needs.
 * `now` is only used to decide nothing here; kept pure.
 */
export const normalizeCases = (data) => {
  const { posts = [], vendorReports = [], contentReports = [], postActivities = [], caseActivities = [], threads = [] } = data;

  // Earliest investigator message per case (anonymous threads are keyed by post id)
  const threadReply = new Map();
  threads.forEach((th) => {
    const times = (th.messages || [])
      .filter((m) => m.sender === "investigator")
      .map((m) => toDate(m.timestamp))
      .filter(Boolean);
    if (times.length) threadReply.set(`${CaseType.POST}:${th.postId || th.id}`, new Date(Math.min(...times)));
  });

  // Staff actions per case; the reporter's own "created" record has no adminId
  const staffEvents = new Map();
  const closedEvents = new Map();
  const addEvent = (caseType, caseId, a) => {
    const t = toDate(a.createdAt);
    if (!t || !a.metadata?.adminId) return;
    const key = `${caseType}:${caseId}`;
    staffEvents.set(key, [...(staffEvents.get(key) || []), t]);
    if (a.type === "status_changed") {
      const closed = CaseAdapters[caseType].closedStatuses.includes(a.metadata.newStatus);
      if (closed) closedEvents.set(key, [...(closedEvents.get(key) || []), t]);
    }
  };
  postActivities.forEach((a) => addEvent(CaseType.POST, a.postId, a));
  caseActivities.forEach((a) => CaseAdapters[a.caseType] && addEvent(a.caseType, a.caseId, a));

  const build = (caseType, raw) => {
    const adapter = CaseAdapters[caseType];
    const key = `${caseType}:${raw.id}`;
    const createdAt = adapter.getCreatedAt(raw);
    const reply = [...(staffEvents.get(key) || []), ...(threadReply.has(key) ? [threadReply.get(key)] : [])]
      .filter((t) => createdAt && t >= createdAt);
    const closed = adapter.closedStatuses.includes(raw.status);
    const closedTimes = closedEvents.get(key);
    const closedAt = closed
      ? (closedTimes && new Date(Math.max(...closedTimes))) || toDate(raw.resolvedAt) || toDate(raw.updatedAt)
      : null;
    return {
      key,
      id: raw.id,
      caseType,
      title: adapter.getTitle(raw) || "Untitled",
      createdAt,
      status: raw.status || adapter.defaultStatus,
      statusLabel: adapter.statusConfig[raw.status]?.label || raw.status,
      closed,
      closedAt: closedAt && createdAt && closedAt >= createdAt ? closedAt : null,
      priority: adapter.getPriority(raw),
      reportType: caseType === CaseType.POST ? raw.type : null,
      category: caseType === CaseType.POST ? raw.category || null : null,
      publicLink: raw.source === "public_link",
      anonymous: raw.isAnonymous === true,
      involvesHR: raw.involvesHR === true,
      departmentId: raw.departmentId || (raw.assignedTo?.type === AssignmentType.DEPARTMENT ? raw.assignedTo.id : null),
      assignee: raw.assignedTo?.type === AssignmentType.USER ? { id: raw.assignedTo.id, name: raw.assignedTo.name || "Unknown" } : null,
      dueDate: toDate(raw.dueDate),
      firstResponseAt: reply.length ? new Date(Math.min(...reply)) : null,
    };
  };

  return [
    ...posts.map((p) => build(CaseType.POST, p)),
    ...vendorReports.map((p) => build(CaseType.VENDOR, p)),
    ...contentReports.map((p) => build(CaseType.MODERATION, p)),
  ].filter((c) => c.createdAt);
};

const countBy = (items, keyFn) => {
  const out = {};
  items.forEach((i) => {
    const k = keyFn(i);
    if (k) out[k] = (out[k] || 0) + 1;
  });
  return out;
};

/**
 * Compute every metric on the Analytics page.
 *
 * @param {object} data raw collections (see analyticsService.fetchAnalyticsData)
 * @param {{days?: number, start?: Date, end?: Date, now?: Date, caseType?: string}} range
 *   A rolling `days` window or explicit start/end; optional `caseType` filter.
 */
export const computeAnalytics = (data, range = {}) => {
  const now = range.now || new Date();
  const end = range.end || now;
  const start = range.start || new Date(end.getTime() - (range.days || 30) * DAY);
  const all = normalizeCases(data).filter((c) => !range.caseType || c.caseType === range.caseType);
  const cases = all.filter((c) => c.createdAt >= start && c.createdAt <= end);
  const hours = (a, b) => (b - a) / HOUR;

  // Responsiveness
  const responded = cases.filter((c) => c.firstResponseAt);
  const responseHours = responded.map((c) => hours(c.createdAt, c.firstResponseAt));
  const avgResponseHours = avg(responseHours);

  // Resolution
  const closed = cases.filter((c) => c.closed);
  const resolutionRate = pct(closed.length, cases.length);
  const resolveDays = closed.filter((c) => c.closedAt).map((c) => (c.closedAt - c.createdAt) / DAY);
  const avgResolutionDays = avg(resolveDays);

  // Acknowledgement within 7 days. Only cases whose window has elapsed (or that
  // were answered) are judged, so a brand-new case isn't counted as a miss.
  const ackWindow = ACK_WINDOW_DAYS * DAY;
  const ackJudged = cases.filter((c) => c.firstResponseAt || now - c.createdAt > ackWindow);
  const ackOnTime = ackJudged.filter((c) => c.firstResponseAt && c.firstResponseAt - c.createdAt <= ackWindow);
  const ackRate = ackJudged.length ? pct(ackOnTime.length, ackJudged.length) : null;

  // Feedback (closure) within 90 days, same judging rule
  const fbWindow = FEEDBACK_WINDOW_DAYS * DAY;
  const fbJudged = cases.filter((c) => c.closed || now - c.createdAt > fbWindow);
  const fbOnTime = fbJudged.filter((c) => c.closed && (!c.closedAt || c.closedAt - c.createdAt <= fbWindow));
  const feedbackRate = fbJudged.length ? pct(fbOnTime.length, fbJudged.length) : null;

  // Current backlog: all open cases regardless of period
  const open = all.filter((c) => !c.closed);
  const ageDays = (c) => (now - c.createdAt) / DAY;
  const backlogAge = AGE_BUCKETS.map((b, i) => {
    const min = i === 0 ? -Infinity : AGE_BUCKETS[i - 1].max;
    return { ...b, count: open.filter((c) => ageDays(c) >= min && ageDays(c) < b.max).length };
  });
  const overdue = open.filter((c) => c.dueDate && c.dueDate < now).length;
  const unassigned = open.filter((c) => !c.assignee && !c.departmentId).length;

  // Breakdowns
  const byCaseType = Object.fromEntries(Object.values(CaseType).map((t) => [t, cases.filter((c) => c.caseType === t).length]));
  const byReportType = countBy(cases, (c) => c.reportType);
  const byCategory = countBy(cases, (c) => c.category);
  const byStatus = countBy(cases, (c) => c.status);
  const statusLabels = Object.fromEntries(cases.map((c) => [c.status, c.statusLabel]));
  const byPriority = Object.fromEntries(
    Object.values(PostPriority).map((p) => [p, cases.filter((c) => c.priority === p).length])
  );

  // Intake
  const posts = cases.filter((c) => c.caseType === CaseType.POST);
  const intake = {
    publicLink: posts.filter((c) => c.publicLink).length,
    signedIn: posts.filter((c) => !c.publicLink).length,
    anonymous: posts.filter((c) => c.anonymous).length,
    anonymousRate: round1(pct(posts.filter((c) => c.anonymous).length, posts.length)),
    involvesHR: posts.filter((c) => c.involvesHR).length,
  };

  // Company happiness: resolution 40% + timely acknowledgement 30% + response speed 30%.
  // Response speed is 100 within 4h falling linearly to 0 at 72h. Unknown inputs are
  // neutral (50) so a company with no data yet doesn't read as unhappy or perfect.
  const responseScore = responseHours.length ? clamp(100 - ((avgResponseHours - 4) / 68) * 100) : 50;
  const ackScore = ackRate ?? 50;
  const happinessScore = cases.length ? resolutionRate * 0.4 + ackScore * 0.3 + responseScore * 0.3 : 0;

  // Departments
  const departmentStats = (data.departments || [])
    .map((dept) => {
      const dc = cases.filter((c) => c.departmentId === dept.id);
      const dClosed = dc.filter((c) => c.closed);
      const dh = dc.filter((c) => c.firstResponseAt).map((c) => hours(c.createdAt, c.firstResponseAt));
      return {
        id: dept.id,
        name: dept.name,
        icon: dept.icon || "🏢",
        memberCount: dept.memberCount || 0,
        total: dc.length,
        resolved: dClosed.length,
        pending: dc.length - dClosed.length,
        overdue: dc.filter((c) => !c.closed && c.dueDate && c.dueDate < now).length,
        resolutionRate: round1(pct(dClosed.length, dc.length)),
        avgResponseHours: round1(avg(dh)),
      };
    })
    .sort((a, b) => b.total - a.total);

  // Handler workload (cases assigned to a person, in period)
  const handlerMap = new Map();
  cases.forEach((c) => {
    if (!c.assignee) return;
    const h = handlerMap.get(c.assignee.id) || { id: c.assignee.id, name: c.assignee.name, assigned: 0, resolved: 0, open: 0 };
    h.assigned++;
    c.closed ? h.resolved++ : h.open++;
    handlerMap.set(c.assignee.id, h);
  });
  const handlers = [...handlerMap.values()].sort((a, b) => b.assigned - a.assigned).slice(0, 10);

  // Daily intake over local calendar days
  const dayKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const trendMap = new Map();
  for (
    let t = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    t <= end && trendMap.size < 400;
    t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)
  ) {
    trendMap.set(dayKey(t), 0);
  }
  cases.forEach((c) => {
    const k = dayKey(c.createdAt);
    if (trendMap.has(k)) trendMap.set(k, trendMap.get(k) + 1);
  });
  const trend = [...trendMap].map(([date, count]) => ({ date, count }));

  return {
    range: { start, end },
    overview: { total: cases.length, open: cases.filter((c) => !c.closed).length, resolved: closed.length },
    byCaseType,
    byReportType,
    byCategory,
    byStatus,
    statusLabels,
    byPriority,
    intake,
    resolutionRate: round1(resolutionRate),
    avgResolutionDays: round1(avgResolutionDays),
    avgResponseHours: round1(avgResponseHours),
    respondedCount: responded.length,
    ack: { rate: ackRate === null ? null : round1(ackRate), onTime: ackOnTime.length, judged: ackJudged.length },
    feedback: { rate: feedbackRate === null ? null : round1(feedbackRate), onTime: fbOnTime.length, judged: fbJudged.length },
    backlog: { total: open.length, age: backlogAge, overdue, unassigned },
    happinessScore: round1(happinessScore),
    departmentStats,
    handlers,
    trend,
  };
};

const csvCell = (v) => {
  let str = String(v ?? "");
  // Neutralise spreadsheet formula injection from user-supplied names/titles
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};
const csvRows = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n");
const rate = (v) => (v === null ? "n/a" : v);

/**
 * Export analytics data to CSV format
 * @param {Object} a - result of computeAnalytics
 * @param {string} reportType - overview | departments | handlers | full
 */
export const exportToCSV = (a, reportType) => {
  const period = `${a.range.start.toISOString().slice(0, 10)} to ${a.range.end.toISOString().slice(0, 10)}`;
  const labelled = (obj, labels) => Object.entries(obj).map(([k, n]) => [labels[k] || k, n]);
  const sections = {
    overview: () =>
      csvRows([
        ["Metric", "Value"],
        ["Period", period],
        ["Cases received", a.overview.total],
        ["Open", a.overview.open],
        ["Resolved or closed", a.overview.resolved],
        ["Resolution rate (%)", a.resolutionRate],
        ["Average first response (hours)", a.avgResponseHours],
        ["Average days to resolve", a.avgResolutionDays],
        [`Acknowledged within ${ACK_WINDOW_DAYS} days (%)`, rate(a.ack.rate)],
        [`Closed within ${FEEDBACK_WINDOW_DAYS} days (%)`, rate(a.feedback.rate)],
        ["Open cases (all time)", a.backlog.total],
        ["Overdue", a.backlog.overdue],
        ["Unassigned", a.backlog.unassigned],
        ["Company happiness score (0-100)", a.happinessScore],
        [],
        ["Cases by source", "Count"],
        ...labelled(a.byCaseType, CASE_TYPE_LABELS),
        [],
        ["Reports by type", "Count"],
        ...labelled(a.byReportType, REPORT_TYPE_LABELS),
        [],
        ["Reports by category", "Count"],
        ...labelled(a.byCategory, CATEGORY_LABELS),
        [],
        ["Cases by status", "Count"],
        ...labelled(a.byStatus, a.statusLabels),
        [],
        ["Cases by priority", "Count"],
        ...Object.entries(a.byPriority),
        [],
        ["Open case age", "Count"],
        ...a.backlog.age.map((b) => [b.label, b.count]),
      ]),
    departments: () =>
      csvRows([
        ["Department", "Cases", "Resolved", "Pending", "Overdue", "Resolution rate (%)", "Avg first response (hours)"],
        ...a.departmentStats.map((d) => [d.name, d.total, d.resolved, d.pending, d.overdue, d.resolutionRate, d.avgResponseHours]),
      ]),
    handlers: () =>
      csvRows([
        ["Handler", "Assigned", "Resolved", "Open"],
        ...a.handlers.map((h) => [h.name, h.assigned, h.resolved, h.open]),
      ]),
  };
  if (reportType === "full") {
    return ["overview", "departments", "handlers"].map((k) => `===== ${k.toUpperCase()} =====\n${sections[k]()}`).join("\n\n");
  }
  return sections[reportType] ? sections[reportType]() : "Invalid report type";
};

/**
 * Download CSV file
 * @param {string} csvContent - CSV content string
 * @param {string} filename - Filename for download
 */
export const downloadCSV = (csvContent, filename) => {
  // BOM so Excel reads UTF-8 correctly
  const blob = new Blob(["﻿", csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
