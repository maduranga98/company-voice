import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  ReportStatus,
  ReportableContentType,
  ModerationActionType,
  StrikeLevel,
  StrikeConfig,
  RestrictionType,
  ModerationActivityType,
  NotificationType,
  UserStatus,
} from "../utils/constants";

// ============================================
// CONTENT REPORTING
// ============================================

/**
 * Create a new content report
 * @param {Object} reportData - Report details
 * @returns {Promise<string>} Report ID
 */
export const createContentReport = async (reportData) => {
  try {
    const {
      contentType, // 'post' or 'comment'
      contentId,
      reason,
      description,
      reportedBy,
      companyId,
    } = reportData;

    // Fetch content details
    let contentRef;
    let contentSnapshot;
    let content;

    if (contentType === ReportableContentType.POST) {
      contentRef = doc(db, "posts", contentId);
      contentSnapshot = await getDoc(contentRef);
      content = { id: contentSnapshot.id, ...contentSnapshot.data() };
    } else if (contentType === ReportableContentType.COMMENT) {
      contentRef = doc(db, "comments", contentId);
      contentSnapshot = await getDoc(contentRef);
      content = { id: contentSnapshot.id, ...contentSnapshot.data() };
    }

    if (!contentSnapshot.exists()) {
      throw new Error("Content not found");
    }

    // Check if user already reported this content
    const existingReportsQuery = query(
      collection(db, "contentReports"),
      where("contentId", "==", contentId),
      where("reportedBy", "==", reportedBy)
    );
    const existingReports = await getDocs(existingReportsQuery);

    if (!existingReports.empty) {
      throw new Error("You have already reported this content");
    }

    // Create report
    const report = {
      contentType,
      contentId,
      reason,
      description: description || "",
      reportedBy,
      companyId,
      status: ReportStatus.PENDING,
      contentAuthorId: content.authorId || content.userId,
      contentPreview:
        contentType === ReportableContentType.POST
          ? content.title || content.description?.substring(0, 200)
          : content.text?.substring(0, 200),
      reviewedBy: null,
      reviewedAt: null,
      moderatorNotes: "",
      actionTaken: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const reportRef = await addDoc(collection(db, "contentReports"), report);

    // Update report count on content
    await updateDoc(contentRef, {
      reportCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    // Log activity
    await logModerationActivity({
      activityType: ModerationActivityType.REPORT_CREATED,
      reportId: reportRef.id,
      contentType,
      contentId,
      userId: reportedBy,
      companyId,
      metadata: {
        reason,
        description: description || "",
      },
    });

    // Notify company admins
    await notifyAdminsOfNewReport(companyId, reportRef.id, contentType);

    return reportRef.id;
  } catch (error) {
    console.error("Error creating content report:", error);
    throw error;
  }
};

/**
 * Get all reports for a company (for admins)
 * @param {string} companyId - Company ID
 * @param {string} status - Filter by status (optional)
 * @returns {Promise<Array>} List of reports
 */
export const getCompanyReports = async (companyId, status = null) => {
  try {
    let reportsQuery;

    if (status) {
      reportsQuery = query(
        collection(db, "contentReports"),
        where("companyId", "==", companyId),
        where("status", "==", status),
        orderBy("createdAt", "desc"),
        firestoreLimit(100)
      );
    } else {
      reportsQuery = query(
        collection(db, "contentReports"),
        where("companyId", "==", companyId),
        orderBy("createdAt", "desc"),
        firestoreLimit(100)
      );
    }

    const snapshot = await getDocs(reportsQuery);
    const reports = [];

    for (const doc of snapshot.docs) {
      const reportData = { id: doc.id, ...doc.data() };

      // Get reporter info (without revealing identity to avoid retaliation)
      reportData.reporterDisplayName = "Anonymous Reporter";

      // Get content author info (respecting anonymity)
      if (reportData.contentType === ReportableContentType.POST) {
        const postDoc = await getDoc(db.collection("posts").doc(reportData.contentId));
        if (postDoc.exists()) {
          const postData = postDoc.data();
          if (postData.isAnonymous) {
            reportData.contentAuthorName = "Anonymous User";
          } else {
            const authorDoc = await getDoc(db.collection("users").doc(postData.authorId));
            reportData.contentAuthorName = authorDoc.exists()
              ? authorDoc.data().displayName
              : "Unknown";
          }
        }
      } else {
        const commentDoc = await getDoc(db.collection("comments").doc(reportData.contentId));
        if (commentDoc.exists()) {
          const authorDoc = await getDoc(
            db.collection("users").doc(commentDoc.data().authorId)
          );
          reportData.contentAuthorName = authorDoc.exists()
            ? authorDoc.data().displayName
            : "Unknown";
        }
      }

      // Get count of reports for same content
      const sameContentReportsQuery = query(
        collection(db, "contentReports"),
        where("contentId", "==", reportData.contentId)
      );
      const sameContentReports = await getDocs(sameContentReportsQuery);
      reportData.totalReportsForContent = sameContentReports.size;

      reports.push(reportData);
    }

    return reports;
  } catch (error) {
    console.error("Error getting company reports:", error);
    throw error;
  }
};

/**
 * Get all reports across all companies (for super admin)
 * @param {string} status - Filter by status (optional)
 * @returns {Promise<Array>} List of reports
 */
export const getAllReports = async (status = null) => {
  try {
    let reportsQuery;

    if (status) {
      reportsQuery = query(
        collection(db, "contentReports"),
        where("status", "==", status),
        orderBy("createdAt", "desc"),
        firestoreLimit(200)
      );
    } else {
      reportsQuery = query(
        collection(db, "contentReports"),
        orderBy("createdAt", "desc"),
        firestoreLimit(200)
      );
    }

    const snapshot = await getDocs(reportsQuery);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting all reports:", error);
    throw error;
  }
};

/**
 * Get a specific report by ID
 * @param {string} reportId - Report ID
 * @returns {Promise<Object>} Report data
 */
export const getReportById = async (reportId) => {
  try {
    const reportDoc = await getDoc(doc(db, "contentReports", reportId));

    if (!reportDoc.exists()) {
      throw new Error("Report not found");
    }

    const reportData = { id: reportDoc.id, ...reportDoc.data() };

    // Get full content details
    if (reportData.contentType === ReportableContentType.POST) {
      const postDoc = await getDoc(doc(db, "posts", reportData.contentId));
      if (postDoc.exists()) {
        reportData.content = { id: postDoc.id, ...postDoc.data() };
      }
    } else {
      const commentDoc = await getDoc(doc(db, "comments", reportData.contentId));
      if (commentDoc.exists()) {
        reportData.content = { id: commentDoc.id, ...commentDoc.data() };
      }
    }

    // Get author's moderation history
    if (reportData.contentAuthorId) {
      reportData.authorHistory = await getUserModerationHistory(
        reportData.contentAuthorId
      );
    }

    return reportData;
  } catch (error) {
    console.error("Error getting report:", error);
    throw error;
  }
};

// ============================================
// MODERATION ACTIONS
// ============================================

/**
 * Review and take action on a report
 * @param {Object} actionData - Action details
 * @returns {Promise<void>}
 */
export const reviewReport = async (actionData) => {
  try {
    const {
      reportId,
      actionType,
      moderatorId,
      moderatorNotes,
      violationType,
      explanation,
    } = actionData;

    // Get report
    const reportDoc = await getDoc(doc(db, "contentReports", reportId));
    if (!reportDoc.exists()) {
      throw new Error("Report not found");
    }

    const report = reportDoc.data();

    // Update report status
    await updateDoc(doc(db, "contentReports", reportId), {
      status: ReportStatus.UNDER_REVIEW,
      reviewedBy: moderatorId,
      reviewedAt: serverTimestamp(),
      moderatorNotes: moderatorNotes || "",
      updatedAt: serverTimestamp(),
    });

    // Execute action
    switch (actionType) {
      case ModerationActionType.DISMISS:
        await dismissReport(reportId, moderatorId, moderatorNotes);
        break;

      case ModerationActionType.REMOVE_CONTENT:
        await removeContent(report, moderatorId, moderatorNotes, false);
        break;

      case ModerationActionType.REMOVE_AND_WARN:
        await removeContent(report, moderatorId, moderatorNotes, true, {
          violationType,
          explanation,
        });
        break;

      case ModerationActionType.ESCALATE:
        await escalateReport(reportId, moderatorId, moderatorNotes);
        break;

      case ModerationActionType.REMOVE_AND_SUSPEND:
        await removeAndSuspend(report, moderatorId, moderatorNotes, {
          violationType,
          explanation,
        });
        break;

      default:
        throw new Error("Invalid action type");
    }

    // Log activity
    await logModerationActivity({
      activityType: ModerationActivityType.REPORT_REVIEWED,
      reportId,
      contentType: report.contentType,
      contentId: report.contentId,
      userId: moderatorId,
      companyId: report.companyId,
      metadata: {
        actionType,
        moderatorNotes: moderatorNotes || "",
      },
    });
  } catch (error) {
    console.error("Error reviewing report:", error);
    throw error;
  }
};

/**
 * Dismiss a report (no violation found)
 */
const dismissReport = async (reportId, moderatorId, notes) => {
  await updateDoc(doc(db, "contentReports", reportId), {
    status: ReportStatus.DISMISSED,
    actionTaken: ModerationActionType.DISMISS,
    reviewedBy: moderatorId,
    reviewedAt: serverTimestamp(),
    moderatorNotes: notes || "",
    updatedAt: serverTimestamp(),
  });

  const reportDoc = await getDoc(doc(db, "contentReports", reportId));
  const report = reportDoc.data();

  await logModerationActivity({
    activityType: ModerationActivityType.REPORT_DISMISSED,
    reportId,
    contentType: report.contentType,
    contentId: report.contentId,
    userId: moderatorId,
    companyId: report.companyId,
    metadata: { notes },
  });
};

/**
 * Remove content and optionally issue strike
 */
const removeContent = async (
  report,
  moderatorId,
  notes,
  issueStrike = false,
  strikeInfo = {}
) => {
  const { contentType, contentId, contentAuthorId, companyId } = report;

  // Mark content as removed
  const contentRef =
    contentType === ReportableContentType.POST
      ? doc(db, "posts", contentId)
      : doc(db, "comments", contentId);

  await updateDoc(contentRef, {
    isRemoved: true,
    removedAt: serverTimestamp(),
    removedBy: moderatorId,
    removalReason: strikeInfo.violationType || "Content policy violation",
    updatedAt: serverTimestamp(),
  });

  // Update report
  await updateDoc(doc(db, "contentReports", report.id), {
    status: ReportStatus.RESOLVED,
    actionTaken: issueStrike
      ? ModerationActionType.REMOVE_AND_WARN
      : ModerationActionType.REMOVE_CONTENT,
    reviewedBy: moderatorId,
    reviewedAt: serverTimestamp(),
    moderatorNotes: notes || "",
    updatedAt: serverTimestamp(),
  });

  // Issue strike if requested
  if (issueStrike && contentAuthorId) {
    await issueStrike(contentAuthorId, companyId, {
      contentType,
      contentId,
      reportId: report.id,
      violationType: strikeInfo.violationType,
      explanation: strikeInfo.explanation,
      moderatorId,
    });
  }

  await logModerationActivity({
    activityType: ModerationActivityType.CONTENT_REMOVED,
    reportId: report.id,
    contentType,
    contentId,
    userId: moderatorId,
    companyId,
    metadata: {
      issueStrike,
      notes,
      violationType: strikeInfo.violationType,
    },
  });
};

/**
 * Escalate report to super admin
 */
const escalateReport = async (reportId, moderatorId, notes) => {
  await updateDoc(doc(db, "contentReports", reportId), {
    status: ReportStatus.UNDER_REVIEW,
    actionTaken: ModerationActionType.ESCALATE,
    escalatedTo: "super_admin",
    escalatedBy: moderatorId,
    escalatedAt: serverTimestamp(),
    moderatorNotes: notes || "",
    updatedAt: serverTimestamp(),
  });

  const reportDoc = await getDoc(doc(db, "contentReports", reportId));
  const report = reportDoc.data();

  // Notify super admins
  await notifySuperAdminsOfEscalation(reportId);

  await logModerationActivity({
    activityType: ModerationActivityType.REPORT_ESCALATED,
    reportId,
    contentType: report.contentType,
    contentId: report.contentId,
    userId: moderatorId,
    companyId: report.companyId,
    metadata: { notes },
  });
};

/**
 * Remove content and immediately suspend user
 */
const removeAndSuspend = async (report, moderatorId, notes, strikeInfo) => {
  const { contentType, contentId, contentAuthorId, companyId } = report;

  // Remove content
  const contentRef =
    contentType === ReportableContentType.POST
      ? doc(db, "posts", contentId)
      : doc(db, "comments", contentId);

  await updateDoc(contentRef, {
    isRemoved: true,
    removedAt: serverTimestamp(),
    removedBy: moderatorId,
    removalReason: strikeInfo.violationType || "Severe violation",
    updatedAt: serverTimestamp(),
  });

  // Suspend user immediately
  if (contentAuthorId) {
    const suspensionEnd = new Date();
    suspensionEnd.setDate(suspensionEnd.getDate() + 30); // 30-day suspension

    await updateDoc(doc(db, "users", contentAuthorId), {
      status: UserStatus.SUSPENDED,
      suspendedAt: serverTimestamp(),
      suspendedUntil: Timestamp.fromDate(suspensionEnd),
      suspensionReason: strikeInfo.violationType || "Severe content violation",
      suspendedBy: moderatorId,
      updatedAt: serverTimestamp(),
    });

    // Issue third strike automatically
    await issueStrikeDirectly(
      contentAuthorId,
      companyId,
      StrikeLevel.THIRD,
      {
        contentType,
        contentId,
        reportId: report.id,
        violationType: strikeInfo.violationType,
        explanation: strikeInfo.explanation,
        moderatorId,
      }
    );

    // Notify user
    await createNotification({
      userId: contentAuthorId,
      type: NotificationType.ACCOUNT_SUSPENDED,
      title: "Account Suspended",
      message: `Your account has been suspended for 30 days due to a severe violation: ${
        strikeInfo.violationType || "Content policy violation"
      }`,
      metadata: {
        suspensionEnd: suspensionEnd.toISOString(),
        reason: strikeInfo.explanation,
      },
    });
  }

  // Update report
  await updateDoc(doc(db, "contentReports", report.id), {
    status: ReportStatus.RESOLVED,
    actionTaken: ModerationActionType.REMOVE_AND_SUSPEND,
    reviewedBy: moderatorId,
    reviewedAt: serverTimestamp(),
    moderatorNotes: notes || "",
    updatedAt: serverTimestamp(),
  });

  await logModerationActivity({
    activityType: ModerationActivityType.USER_SUSPENDED,
    reportId: report.id,
    contentType,
    contentId,
    userId: moderatorId,
    companyId,
    metadata: {
      targetUserId: contentAuthorId,
      notes,
      violationType: strikeInfo.violationType,
    },
  });
};

// ============================================
// STRIKE SYSTEM
// ============================================

/**
 * Issue a strike to a user
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @param {Object} strikeInfo - Strike details
 * @returns {Promise<void>}
 */
const issueStrike = async (userId, companyId, strikeInfo) => {
  try {
    // Get user's current strikes
    const strikesQuery = query(
      collection(db, "userStrikes"),
      where("userId", "==", userId),
      where("companyId", "==", companyId)
    );
    const strikesSnapshot = await getDocs(strikesQuery);
    const currentStrikes = strikesSnapshot.size;

    const newStrikeLevel = Math.min(currentStrikes + 1, 3);

    // Create strike record
    const strike = {
      userId,
      companyId,
      strikeLevel: newStrikeLevel,
      contentType: strikeInfo.contentType,
      contentId: strikeInfo.contentId,
      reportId: strikeInfo.reportId,
      violationType: strikeInfo.violationType,
      explanation: strikeInfo.explanation,
      issuedBy: strikeInfo.moderatorId,
      issuedAt: serverTimestamp(),
      expiresAt: null, // Strikes don't expire unless reset
    };

    await addDoc(collection(db, "userStrikes"), strike);

    // Apply restrictions based on strike level
    await applyStrikeRestrictions(userId, newStrikeLevel);

    // Notify user
    const strikeConfig = StrikeConfig[newStrikeLevel];
    await createNotification({
      userId,
      type: NotificationType.STRIKE_RECEIVED,
      title: `Strike ${newStrikeLevel} - ${strikeConfig.label}`,
      message: `Your ${strikeInfo.contentType} violated community guidelines: ${strikeInfo.violationType}. ${strikeConfig.consequence}`,
      metadata: {
        strikeLevel: newStrikeLevel,
        violationType: strikeInfo.violationType,
        explanation: strikeInfo.explanation,
        contentType: strikeInfo.contentType,
      },
    });

    await logModerationActivity({
      activityType: ModerationActivityType.STRIKE_ISSUED,
      reportId: strikeInfo.reportId,
      contentType: strikeInfo.contentType,
      contentId: strikeInfo.contentId,
      userId: strikeInfo.moderatorId,
      companyId,
      metadata: {
        targetUserId: userId,
        strikeLevel: newStrikeLevel,
        violationType: strikeInfo.violationType,
      },
    });
  } catch (error) {
    console.error("Error issuing strike:", error);
    throw error;
  }
};

/**
 * Issue a specific strike level directly (for severe violations)
 */
const issueStrikeDirectly = async (userId, companyId, strikeLevel, strikeInfo) => {
  const strike = {
    userId,
    companyId,
    strikeLevel,
    contentType: strikeInfo.contentType,
    contentId: strikeInfo.contentId,
    reportId: strikeInfo.reportId,
    violationType: strikeInfo.violationType,
    explanation: strikeInfo.explanation,
    issuedBy: strikeInfo.moderatorId,
    issuedAt: serverTimestamp(),
    expiresAt: null,
  };

  await addDoc(collection(db, "userStrikes"), strike);
};

/**
 * Apply restrictions based on strike level
 */
const applyStrikeRestrictions = async (userId, strikeLevel) => {
  const config = StrikeConfig[strikeLevel];

  if (strikeLevel === StrikeLevel.SECOND) {
    // 7-day posting restriction
    const restrictionEnd = new Date();
    restrictionEnd.setDate(restrictionEnd.getDate() + 7);

    await addDoc(collection(db, "userRestrictions"), {
      userId,
      restrictionType: RestrictionType.POSTING,
      startedAt: serverTimestamp(),
      endsAt: Timestamp.fromDate(restrictionEnd),
      reason: "Strike 2 - Temporary restriction",
      isActive: true,
    });

    await createNotification({
      userId,
      type: NotificationType.ACCOUNT_RESTRICTED,
      title: "Posting Restricted",
      message: `You cannot post or comment for 7 days due to repeated violations.`,
      metadata: {
        restrictionEnd: restrictionEnd.toISOString(),
      },
    });

    await logModerationActivity({
      activityType: ModerationActivityType.USER_RESTRICTED,
      userId,
      metadata: {
        restrictionType: RestrictionType.POSTING,
        duration: "7 days",
      },
    });
  } else if (strikeLevel === StrikeLevel.THIRD) {
    // 30-day account suspension
    const suspensionEnd = new Date();
    suspensionEnd.setDate(suspensionEnd.getDate() + 30);

    await updateDoc(doc(db, "users", userId), {
      status: UserStatus.SUSPENDED,
      suspendedAt: serverTimestamp(),
      suspendedUntil: Timestamp.fromDate(suspensionEnd),
      suspensionReason: "Strike 3 - Account suspension",
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      userId,
      type: NotificationType.ACCOUNT_SUSPENDED,
      title: "Account Suspended",
      message: `Your account has been suspended for 30 days. All strikes will be reset after the suspension period.`,
      metadata: {
        suspensionEnd: suspensionEnd.toISOString(),
      },
    });

    await logModerationActivity({
      activityType: ModerationActivityType.USER_SUSPENDED,
      userId,
      metadata: {
        duration: "30 days",
        suspensionEnd: suspensionEnd.toISOString(),
      },
    });
  }
};

/**
 * Get user's moderation history
 */
export const getUserModerationHistory = async (userId) => {
  try {
    const strikesQuery = query(
      collection(db, "userStrikes"),
      where("userId", "==", userId),
      orderBy("issuedAt", "desc")
    );
    const strikesSnapshot = await getDocs(strikesQuery);

    const strikes = strikesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get active restrictions
    const restrictionsQuery = query(
      collection(db, "userRestrictions"),
      where("userId", "==", userId),
      where("isActive", "==", true)
    );
    const restrictionsSnapshot = await getDocs(restrictionsQuery);
    const restrictions = restrictionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      strikes,
      currentStrikeCount: strikes.length,
      activeRestrictions: restrictions,
    };
  } catch (error) {
    console.error("Error getting user moderation history:", error);
    throw error;
  }
};

/**
 * Check if user is currently restricted
 */
export const checkUserRestrictions = async (userId) => {
  try {
    const now = new Date();

    const restrictionsQuery = query(
      collection(db, "userRestrictions"),
      where("userId", "==", userId),
      where("isActive", "==", true)
    );
    const restrictionsSnapshot = await getDocs(restrictionsQuery);

    const activeRestrictions = [];

    for (const doc of restrictionsSnapshot.docs) {
      const restriction = { id: doc.id, ...doc.data() };

      // Check if restriction has expired
      if (restriction.endsAt && restriction.endsAt.toDate() <= now) {
        // Deactivate expired restriction
        await updateDoc(doc.ref, { isActive: false });
      } else {
        activeRestrictions.push(restriction);
      }
    }

    return {
      isRestricted: activeRestrictions.length > 0,
      restrictions: activeRestrictions,
    };
  } catch (error) {
    console.error("Error checking user restrictions:", error);
    throw error;
  }
};

// ============================================
// AUDIT TRAIL
// ============================================

/**
 * Log moderation activity
 */
const logModerationActivity = async (activityData) => {
  try {
    await addDoc(collection(db, "moderationActivities"), {
      ...activityData,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging moderation activity:", error);
  }
};

/**
 * Get moderation activity logs
 */
export const getModerationActivityLogs = async (companyId = null, limit = 50) => {
  try {
    let logsQuery;

    if (companyId) {
      logsQuery = query(
        collection(db, "moderationActivities"),
        where("companyId", "==", companyId),
        orderBy("createdAt", "desc"),
        firestoreLimit(limit)
      );
    } else {
      logsQuery = query(
        collection(db, "moderationActivities"),
        orderBy("createdAt", "desc"),
        firestoreLimit(limit)
      );
    }

    const snapshot = await getDocs(logsQuery);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting moderation activity logs:", error);
    throw error;
  }
};

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Create a notification
 */
const createNotification = async (notificationData) => {
  try {
    await addDoc(collection(db, "notifications"), {
      ...notificationData,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

/**
 * Notify company admins of new report
 */
const notifyAdminsOfNewReport = async (companyId, reportId, contentType) => {
  try {
    const adminsQuery = query(
      collection(db, "users"),
      where("companyId", "==", companyId),
      where("role", "in", ["company_admin", "hr"])
    );
    const adminsSnapshot = await getDocs(adminsQuery);

    for (const adminDoc of adminsSnapshot.docs) {
      await createNotification({
        userId: adminDoc.id,
        type: NotificationType.CONTENT_REPORTED,
        title: "New Content Report",
        message: `A ${contentType} has been reported and needs review.`,
        metadata: {
          reportId,
          contentType,
        },
      });
    }
  } catch (error) {
    console.error("Error notifying admins:", error);
  }
};

/**
 * Notify super admins of escalated report
 */
const notifySuperAdminsOfEscalation = async (reportId) => {
  try {
    const superAdminsQuery = query(
      collection(db, "users"),
      where("role", "==", "super_admin")
    );
    const superAdminsSnapshot = await getDocs(superAdminsQuery);

    for (const adminDoc of superAdminsSnapshot.docs) {
      await createNotification({
        userId: adminDoc.id,
        type: NotificationType.CONTENT_REPORTED,
        title: "Report Escalated",
        message: `A content report has been escalated and requires your review.`,
        metadata: {
          reportId,
          escalated: true,
        },
      });
    }
  } catch (error) {
    console.error("Error notifying super admins:", error);
  }
};

// ============================================
// ANALYTICS
// ============================================

/**
 * Get moderation statistics for a company
 */
export const getModerationStats = async (companyId) => {
  try {
    const reportsQuery = query(
      collection(db, "contentReports"),
      where("companyId", "==", companyId)
    );
    const reportsSnapshot = await getDocs(reportsQuery);

    const stats = {
      totalReports: reportsSnapshot.size,
      pendingReports: 0,
      underReviewReports: 0,
      resolvedReports: 0,
      dismissedReports: 0,
    };

    reportsSnapshot.forEach((doc) => {
      const report = doc.data();
      if (report.status === ReportStatus.PENDING) stats.pendingReports++;
      else if (report.status === ReportStatus.UNDER_REVIEW) stats.underReviewReports++;
      else if (report.status === ReportStatus.RESOLVED) stats.resolvedReports++;
      else if (report.status === ReportStatus.DISMISSED) stats.dismissedReports++;
    });

    // Get strikes issued
    const strikesQuery = query(
      collection(db, "userStrikes"),
      where("companyId", "==", companyId)
    );
    const strikesSnapshot = await getDocs(strikesQuery);
    stats.totalStrikesIssued = strikesSnapshot.size;

    return stats;
  } catch (error) {
    console.error("Error getting moderation stats:", error);
    throw error;
  }
};
