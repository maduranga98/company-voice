/**
 * Analytics Helper Functions
 * Pure metric calculations for the company Analytics & Insights page.
 */

import { PostType, PostStatus, PostPriority } from "./constants";

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;

export const PERIOD_OPTIONS = [7, 30, 90];

// Statuses that count as "resolved" for resolution rate
const RESOLVED_STATUSES = [PostStatus.RESOLVED, PostStatus.CLOSED];

export const toDate = (value) => {
  if (!value) return null;
  const d = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);
const round1 = (n) => Math.round(n * 10) / 10;

// Count reactions on a post regardless of storage shape
// ({emoji: [uids]}, {emoji: count}, {uid: emoji}) plus a legacy `likes` array.
export const countReactions = (post) => {
  let total = Array.isArray(post.likes) ? post.likes.length : 0;
  const r = post.reactions;
  if (r && typeof r === "object") {
    Object.values(r).forEach((v) => {
      if (Array.isArray(v)) total += v.length;
      else if (typeof v === "number") total += v;
      else if (v) total += 1;
    });
  }
  return total;
};

/**
 * Hours from post creation to the first admin response, i.e. the earlier of
 * the first staff comment or the first status change by staff.
 */
const firstResponseHours = (post, adminCommentTimes, statusTimes) => {
  const created = toDate(post.createdAt);
  if (!created) return null;
  const candidates = [...(adminCommentTimes.get(post.id) || []), ...(statusTimes.get(post.id) || [])]
    .filter((t) => t >= created);
  if (candidates.length === 0) return null;
  return (Math.min(...candidates) - created) / HOUR;
};

/**
 * Compute every metric on the Analytics page from raw collections.
 *
 * @param {{posts, comments, users, departments, activities}} data
 * @param {{days?: number, start?: Date, end?: Date, now?: Date}} range
 *   Either a rolling `days` window or an explicit start/end range.
 */
export const computeAnalytics = (data, range = {}) => {
  const { posts = [], comments = [], users = [], departments = [], activities = [] } = data;
  const now = range.now || new Date();
  const end = range.end || now;
  const start = range.start || new Date(end.getTime() - (range.days || 30) * DAY);

  const inRange = (d) => d && d >= start && d <= end;
  const scoped = posts.filter((p) => inRange(toDate(p.createdAt)));
  const scopedIds = new Set(scoped.map((p) => p.id));
  const scopedComments = comments.filter((c) => scopedIds.has(c.postId));

  // Response-time inputs
  const adminCommentTimes = new Map();
  scopedComments.forEach((c) => {
    if (!c.isAdminComment) return;
    const t = toDate(c.createdAt);
    if (t) adminCommentTimes.set(c.postId, [...(adminCommentTimes.get(c.postId) || []), t]);
  });
  const statusTimes = new Map();
  activities.forEach((a) => {
    if (a.type !== "status_changed" || !scopedIds.has(a.postId)) return;
    const t = toDate(a.createdAt || a.timestamp);
    if (t) statusTimes.set(a.postId, [...(statusTimes.get(a.postId) || []), t]);
  });

  const responseHours = scoped
    .map((p) => firstResponseHours(p, adminCommentTimes, statusTimes))
    .filter((h) => h !== null);
  const avgResponseHours = responseHours.length
    ? responseHours.reduce((a, b) => a + b, 0) / responseHours.length
    : 0;

  // Distributions
  const countBy = (values, key) =>
    Object.fromEntries(values.map((v) => [v, scoped.filter((p) => p[key] === v).length]));
  const postsByType = countBy(Object.values(PostType), "type");
  const postsByStatus = countBy(Object.values(PostStatus), "status");
  const postsByPriority = countBy(Object.values(PostPriority), "priority");

  // Resolution
  const resolved = scoped.filter((p) => RESOLVED_STATUSES.includes(p.status)).length;
  const resolutionRate = pct(resolved, scoped.length);

  // Engagement
  const reactionsTotal = scoped.reduce((sum, p) => sum + countReactions(p), 0);
  const commentsPerPost = scoped.length ? scopedComments.length / scoped.length : 0;
  // 0-10 index: 5+ comments per post maxes it out
  const engagementScore = Math.min(10, commentsPerPost * 2);
  const participants = new Set();
  scoped.forEach((p) => !p.isAnonymous && p.authorId && participants.add(p.authorId));
  scopedComments.forEach((c) => c.authorId && participants.add(c.authorId));
  const activeUsers = users.filter((u) => u.status === "active").length;

  const topPosts = scoped
    .map((p) => ({
      id: p.id,
      title: p.title || "Untitled",
      comments: scopedComments.filter((c) => c.postId === p.id).length,
      reactions: countReactions(p),
    }))
    .map((p) => ({ ...p, total: p.comments + p.reactions }))
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Happiness: resolution 40% + engagement 30% + responsiveness 30%.
  // Responsiveness is 100 within 4h, falling linearly to 0 at 72h; neutral
  // (50) when nothing has been responded to yet.
  const responseScore = responseHours.length
    ? Math.max(0, Math.min(100, 100 - ((avgResponseHours - 4) / 68) * 100))
    : 50;
  const happinessScore = scoped.length
    ? resolutionRate * 0.4 + engagementScore * 10 * 0.3 + responseScore * 0.3
    : 0;

  // Department performance (by post.departmentId or department assignment)
  const departmentStats = departments
    .map((dept) => {
      const dp = scoped.filter(
        (p) =>
          p.departmentId === dept.id ||
          (p.assignedTo?.type === "department" && p.assignedTo?.id === dept.id)
      );
      const ids = new Set(dp.map((p) => p.id));
      const dc = scopedComments.filter((c) => ids.has(c.postId)).length;
      const dr = dp.filter((p) => RESOLVED_STATUSES.includes(p.status)).length;
      const hrs = dp
        .map((p) => firstResponseHours(p, adminCommentTimes, statusTimes))
        .filter((h) => h !== null);
      return {
        id: dept.id,
        name: dept.name,
        icon: dept.icon || "🏢",
        memberCount: dept.memberCount || 0,
        totalPosts: dp.length,
        resolved: dr,
        pending: dp.length - dr,
        comments: dc,
        reactions: dp.reduce((s, p) => s + countReactions(p), 0),
        resolutionRate: round1(pct(dr, dp.length)),
        avgResponseHours: hrs.length ? round1(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0,
      };
    })
    .sort((a, b) => b.totalPosts - a.totalPosts);

  // Daily trend over local calendar days
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
  scoped.forEach((p) => {
    const k = dayKey(toDate(p.createdAt));
    if (trendMap.has(k)) trendMap.set(k, trendMap.get(k) + 1);
  });
  const trend = [...trendMap].map(([date, count]) => ({ date, count }));

  // Top contributors (non-anonymous authors + commenters)
  const contrib = new Map(users.map((u) => [u.id, { id: u.id, name: u.displayName || "Unknown", posts: 0, comments: 0 }]));
  scoped.forEach((p) => !p.isAnonymous && contrib.get(p.authorId) && contrib.get(p.authorId).posts++);
  scopedComments.forEach((c) => contrib.get(c.authorId) && contrib.get(c.authorId).comments++);
  const userEngagement = [...contrib.values()]
    .map((u) => ({ ...u, total: u.posts + u.comments }))
    .filter((u) => u.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    range: { start, end },
    overview: {
      totalPosts: scoped.length,
      totalComments: scopedComments.length,
      totalReactions: reactionsTotal,
      totalUsers: users.length,
      activeUsers,
      participants: participants.size,
      participationRate: round1(pct(participants.size, activeUsers)),
    },
    postsByType,
    postsByStatus,
    postsByPriority,
    resolutionRate: round1(resolutionRate),
    avgResponseHours: round1(avgResponseHours),
    respondedPosts: responseHours.length,
    commentsPerPost: round1(commentsPerPost),
    reactionsPerPost: round1(scoped.length ? reactionsTotal / scoped.length : 0),
    engagementScore: round1(engagementScore),
    happinessScore: round1(happinessScore),
    departmentStats,
    topPosts,
    userEngagement,
    trend,
  };
};

/**
 * Filter posts by date range
 * @param {Array} posts - Array of post objects
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Filtered posts
 */
export const filterPostsByDateRange = (posts, startDate, endDate) => {
  return posts.filter((post) => {
    if (!post.createdAt) return false;

    const postDate = post.createdAt.toDate
      ? post.createdAt.toDate()
      : new Date(post.createdAt);

    return postDate >= startDate && postDate <= endDate;
  });
};

const csvCell = (v) => {
  let str = String(v ?? "");
  // Neutralise spreadsheet formula injection from user-supplied names/titles
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};
const csvRows = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n");

/**
 * Export analytics data to CSV format
 * @param {Object} a - result of computeAnalytics
 * @param {string} reportType - overview | departments | engagement | full
 */
export const exportToCSV = (a, reportType) => {
  const period = `${a.range.start.toISOString().slice(0, 10)} to ${a.range.end.toISOString().slice(0, 10)}`;
  const sections = {
    overview: () =>
      csvRows([
        ["Metric", "Value"],
        ["Period", period],
        ["Total posts", a.overview.totalPosts],
        ["Total comments", a.overview.totalComments],
        ["Total reactions", a.overview.totalReactions],
        ["Active users", a.overview.activeUsers],
        ["Participation rate (%)", a.overview.participationRate],
        ["Average first response (hours)", a.avgResponseHours],
        ["Resolution rate (%)", a.resolutionRate],
        ["Engagement score (0-10)", a.engagementScore],
        ["Company happiness score (0-100)", a.happinessScore],
        [],
        ["Posts by type", "Count"],
        ...Object.entries(a.postsByType),
        [],
        ["Posts by status", "Count"],
        ...Object.entries(a.postsByStatus).filter(([, n]) => n > 0),
        [],
        ["Posts by priority", "Count"],
        ...Object.entries(a.postsByPriority),
      ]),
    departments: () =>
      csvRows([
        ["Department", "Posts", "Resolved", "Pending", "Comments", "Reactions", "Resolution rate (%)", "Avg first response (hours)"],
        ...a.departmentStats.map((d) => [d.name, d.totalPosts, d.resolved, d.pending, d.comments, d.reactions, d.resolutionRate, d.avgResponseHours]),
      ]),
    engagement: () =>
      csvRows([
        ["User", "Posts", "Comments", "Total"],
        ...a.userEngagement.map((u) => [u.name, u.posts, u.comments, u.total]),
      ]),
  };
  if (reportType === "full") {
    return ["overview", "departments", "engagement"]
      .map((k) => `===== ${k.toUpperCase()} =====\n${sections[k]()}`)
      .join("\n\n");
  }
  return sections[reportType] ? sections[reportType]() : "Invalid report type";
};

/**
 * Download CSV file
 * @param {string} csvContent - CSV content string
 * @param {string} filename - Filename for download
 */
export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
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
