import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  limit as firestoreLimit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Action types that are considered "legal disclosure" events
const LEGAL_TYPES = [
  "identity_disclosure",
  "court_order",
  "subpoena",
  "content_preservation",
  "legal_disclosure",
];

/**
 * Format a Firestore timestamp to a readable string.
 * @param {*} ts - Firestore Timestamp or Date or null
 * @returns {string}
 */
export const formatTimestamp = (ts) => {
  if (!ts) return "N/A";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const options = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  return date.toLocaleString("en-US", options).replace(/,(?=\s\d{2}:)/, "");
};

/**
 * Format the JSON details into a human-readable string nicely.
 * @param {object} details
 * @returns {string}
 */
export const formatDetails = (details) => {
  if (!details || Object.keys(details).length === 0) return "—";
  return Object.entries(details)
    .filter(([key, value]) => value !== undefined && value !== null && key !== "ipAddress" && key !== "ip")
    .map(([key, value]) => {
      const formattedKey = key
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .trim();
      const capitalizedKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);

      let formattedValue = value;
      if (typeof value === "object") {
        if (value.toDate) {
          formattedValue = formatTimestamp(value);
        } else {
          try {
            formattedValue = JSON.stringify(value);
          } catch (e) {
            formattedValue = String(value);
          }
        }
      }

      return `${capitalizedKey}: ${formattedValue}`;
    })
    .join("\n");
};

/**
 * Extract the actor name from a log entry (works for both collections).
 * @param {object} log
 * @returns {string}
 */
const extractActor = (log) => {
  const meta = log.metadata || {};
  return (
    meta.actorName ||
    meta.adminName ||
    meta.userName ||
    meta.createdByName ||
    meta.changedByName ||
    meta.updatedByName ||
    meta.deletedByName ||
    meta.suspendedByName ||
    meta.activatedByName ||
    "Unknown"
  );
};

/**
 * Extract a human-readable target from a log entry.
 * @param {object} log
 * @returns {string}
 */
const extractTarget = (log) => {
  const meta = log.metadata || {};
  if (meta.postTitle) {
    return `Post: ${meta.postTitle.length > 30 ? meta.postTitle.substring(0, 30) + '...' : meta.postTitle}`;
  }
  if (meta.postId || log.postId) return `Post: ${(meta.postId || log.postId || "").substring(0, 8)}`;
  if (meta.userId) return `User: ${meta.userName || meta.userId.substring(0, 8)}`;
  if (meta.departmentName) return `Dept: ${meta.departmentName}`;
  if (meta.targetId) return meta.targetId.substring(0, 16);
  return "—";
};

/**
 * Query audit logs from both postActivities and systemAuditLogs, merge and sort.
 * @param {string} companyId
 * @param {object} filters
 * @param {string} [filters.fromDate]   - ISO date string "YYYY-MM-DD"
 * @param {string} [filters.toDate]     - ISO date string "YYYY-MM-DD"
 * @param {string} [filters.actionType] - "all" or a specific type key
 * @param {string} [filters.actorName]  - partial match on actor name (client-side)
 * @param {number} [filters.limit]      - max entries to return (default 500)
 * @returns {Promise<Array>}
 */
export const queryAuditLogs = async (companyId, filters = {}) => {
  const {
    fromDate = null,
    toDate = null,
    actionType = "all",
    actorName = "",
    limit = 500,
  } = filters;

  const fromTs = fromDate ? Timestamp.fromDate(new Date(fromDate + "T00:00:00")) : null;
  // Add 1 day to toDate to make it inclusive of the whole end day
  const toTs = toDate
    ? Timestamp.fromDate(new Date(new Date(toDate + "T23:59:59").getTime()))
    : null;

  const isLegalFilter = actionType === "legal_disclosure";

  // ---- postActivities ----
  const buildPostConstraints = () => {
    const constraints = [where("companyId", "==", companyId)];
    if (actionType !== "all" && !isLegalFilter) {
      constraints.push(where("type", "==", actionType));
    }
    if (fromTs) constraints.push(where("createdAt", ">=", fromTs));
    if (toTs) constraints.push(where("createdAt", "<=", toTs));
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(firestoreLimit(limit));
    return constraints;
  };

  // ---- systemAuditLogs ----
  const buildSystemConstraints = () => {
    const constraints = [where("companyId", "==", companyId)];
    if (actionType !== "all" && !isLegalFilter) {
      constraints.push(where("type", "==", actionType));
    }
    if (fromTs) constraints.push(where("createdAt", ">=", fromTs));
    if (toTs) constraints.push(where("createdAt", "<=", toTs));
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(firestoreLimit(limit));
    return constraints;
  };

  let postLogs = [];
  let systemLogs = [];

  try {
    // Only fetch postActivities when action type isn't a system-only type
    const isSystemOnlyType = [
      "user_login", "user_logout", "user_created", "user_updated",
      "user_deleted", "user_suspended", "user_activated", "role_changed",
      "department_created", "department_updated", "department_deleted",
      "password_changed", "profile_updated",
    ].includes(actionType);

    const isPostOnlyType = [
      "created", "status_changed", "priority_changed", "assigned", "unassigned",
      "due_date_set", "due_date_changed", "admin_comment", "resolved",
      "reopened", "edited", "pinned", "unpinned", "archived", "unarchived", "post_deleted",
    ].includes(actionType);

    if (!isSystemOnlyType) {
      const postQ = query(collection(db, "postActivities"), ...buildPostConstraints());
      const postSnap = await getDocs(postQ);
      postLogs = postSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        _source: "post",
      }));
    }

    if (!isPostOnlyType) {
      const sysQ = query(collection(db, "systemAuditLogs"), ...buildSystemConstraints());
      const sysSnap = await getDocs(sysQ);
      systemLogs = sysSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        _source: "system",
      }));
    }
  } catch (err) {
    console.error("queryAuditLogs error:", err);
  }

  let merged = [...postLogs, ...systemLogs];

  // Fetch missing post titles so extractTarget can show useful post names
  try {
    const postIdsToFetch = [...new Set(
      merged
        .map(log => log.postId || log.metadata?.postId)
        .filter(id => id && !merged.find(l => (l.postId === id || l.metadata?.postId === id) && l.metadata?.postTitle))
    )];
    
    if (postIdsToFetch.length > 0) {
      const postTitles = {};
      const chunkSize = 20;
      for (let i = 0; i < postIdsToFetch.length; i += chunkSize) {
        const chunk = postIdsToFetch.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (pId) => {
          try {
            const pDoc = await getDoc(doc(db, "posts", pId));
            if (pDoc.exists() && pDoc.data().title) {
              postTitles[pId] = pDoc.data().title;
            }
          } catch (e) {
            console.error("Error fetching post title for audit log", e);
          }
        }));
      }

      merged = merged.map(log => {
        const pId = log.postId || log.metadata?.postId;
        if (pId && postTitles[pId]) {
          if (!log.metadata) log.metadata = {};
          if (!log.metadata.postTitle) log.metadata.postTitle = postTitles[pId];
        }
        return log;
      });
    }
  } catch (err) {
    console.error("Error hydrating post titles in audit logs:", err);
  }

  // Client-side: legal disclosure filter
  if (isLegalFilter) {
    merged = merged.filter((log) => LEGAL_TYPES.includes(log.type));
  }

  // Client-side: actor name filter (partial, case-insensitive)
  if (actorName.trim()) {
    const needle = actorName.trim().toLowerCase();
    merged = merged.filter((log) => extractActor(log).toLowerCase().includes(needle));
  }

  // Sort by createdAt desc
  merged.sort((a, b) => {
    const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bMs - aMs;
  });

  return merged.slice(0, limit);
};

/**
 * Compute summary statistics from a set of log entries.
 * @param {Array} logs
 * @returns {{ total: number, uniqueActors: number, legalCount: number, mostActiveDept: string }}
 */
export const computeSummary = (logs) => {
  const actors = new Set();
  const deptCounts = {};
  let legalCount = 0;

  logs.forEach((log) => {
    const actor = extractActor(log);
    if (actor !== "Unknown") actors.add(actor);

    if (LEGAL_TYPES.includes(log.type)) legalCount++;

    const meta = log.metadata || {};
    const dept =
      meta.departmentName ||
      meta.authorDepartmentName ||
      meta.userDepartment ||
      null;
    if (dept) {
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    }
  });

  const mostActiveDept =
    Object.keys(deptCounts).length > 0
      ? Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0][0]
      : "N/A";

  return {
    total: logs.length,
    uniqueActors: actors.size,
    legalCount,
    mostActiveDept,
  };
};

/**
 * Enrich a raw log entry into a normalized display object.
 * @param {object} log
 * @returns {object}
 */
export const normalizeLog = (log) => ({
  id: log.id,
  timestamp: log.createdAt,
  timestampStr: formatTimestamp(log.createdAt),
  actor: extractActor(log),
  actionType: log.type || "unknown",
  target: extractTarget(log),
  details: log.metadata || {},
  ip: log.metadata?.ipAddress || log.ipAddress || null,
  source: log._source || "post",
});

/**
 * Generate and download a CSV file from log entries.
 * @param {Array} logs - raw log entries
 */
export const exportToCSV = (logs) => {
  const rows = [["Timestamp", "Actor", "Action Type", "Target", "Details"]];

  logs.forEach((log) => {
    const n = normalizeLog(log);
    const details = formatDetails(n.details).replace(/"/g, '""');
    rows.push([
      `"${n.timestampStr}"`,
      `"${n.actor.replace(/"/g, '""')}"`,
      `"${n.actionType}"`,
      `"${n.target.replace(/"/g, '""')}"`,
      `"${details}"`,
    ]);
  });

  const csv = rows.map((r) => r.join(",")).join("\n");
  const dateStr = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `voxwel-audit-${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate and download a PDF compliance report.
 * @param {Array} logs         - raw log entries
 * @param {string} companyName - company display name
 * @param {object} filters     - current filters for the header
 */
export const exportToPDF = (logs, companyName = "Company", filters = {}) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const NAVY = [45, 62, 80];
  const TEAL = [0, 188, 212];
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();

  // ---- Header background ----
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 28, "F");

  // ---- VoxWel title ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("VoxWel", 14, 12);

  doc.setFontSize(11);
  doc.setTextColor(...TEAL);
  doc.text("Compliance Audit Report", 14, 20);

  // ---- Company + date range (right side) ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 210, 220);
  const rightX = PAGE_W - 14;
  doc.text(companyName, rightX, 10, { align: "right" });

  const dateLabel =
    filters.fromDate || filters.toDate
      ? `Period: ${filters.fromDate || "—"} to ${filters.toDate || "—"}`
      : "Period: All time";
  doc.text(dateLabel, rightX, 16, { align: "right" });
  doc.text(`Generated: ${formatTimestamp(new Date())}`, rightX, 22, { align: "right" });

  const tableBody = logs.map((log) => {
    const n = normalizeLog(log);
    const detailsStr = formatDetails(n.details);
    const detailsShort = detailsStr.slice(0, 120);
    return [
      n.timestampStr,
      n.actor,
      n.actionType,
      n.target,
      detailsShort + (detailsStr.length > 120 ? "…" : ""),
    ];
  });

  autoTable(doc, {
    head: [["Timestamp", "Actor", "Action Type", "Target", "Details"]],
    body: tableBody,
    startY: 32,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 248, 251],
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 35 },
      2: { cellWidth: 38 },
      3: { cellWidth: 38 },
      4: { cellWidth: "auto" },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer on every page
      doc.setFillColor(...NAVY);
      doc.rect(0, PAGE_H - 10, PAGE_W, 10, "F");
      doc.setFontSize(7);
      doc.setTextColor(180, 190, 200);
      doc.text(
        "This report is generated by VoxWel and is confidential.",
        PAGE_W / 2,
        PAGE_H - 3.5,
        { align: "center" }
      );
      doc.text(
        `Page ${data.pageNumber}`,
        PAGE_W - 14,
        PAGE_H - 3.5,
        { align: "right" }
      );
    },
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`voxwel-audit-${dateStr}.pdf`);
};
