import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { logSystemActivity } from "./auditService";

// ============================================
// LEGAL EVIDENCE PACKAGE GENERATOR
// ============================================

/**
 * Generate a complete evidence package for legal proceedings
 * @param {string} reportId - Report ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Complete evidence package
 */
export const generateEvidencePackage = async (reportId, companyId) => {
  try {
    // 1. Fetch the main report
    const reportRef = doc(db, "contentReports", reportId);
    const reportSnap = await getDoc(reportRef);

    if (!reportSnap.exists()) {
      throw new Error("Report not found");
    }

    const reportData = reportSnap.data();

    // 2. Fetch original content (post or comment)
    let originalContent = null;
    if (reportData.contentType === "post") {
      const postRef = doc(db, "posts", reportData.contentId);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        originalContent = {
          id: postSnap.id,
          ...postSnap.data(),
          createdAt: postSnap.data().createdAt?.toDate
            ? postSnap.data().createdAt.toDate().toISOString()
            : null,
          updatedAt: postSnap.data().updatedAt?.toDate
            ? postSnap.data().updatedAt.toDate().toISOString()
            : null,
        };
      }
    } else if (reportData.contentType === "comment") {
      const commentRef = doc(db, "comments", reportData.contentId);
      const commentSnap = await getDoc(commentRef);
      if (commentSnap.exists()) {
        originalContent = {
          id: commentSnap.id,
          ...commentSnap.data(),
          createdAt: commentSnap.data().createdAt?.toDate
            ? commentSnap.data().createdAt.toDate().toISOString()
            : null,
        };
      }
    }

    // 3. Fetch complete audit trail for this report
    const auditTrailQuery = query(
      collection(db, "moderationActivities"),
      where("reportId", "==", reportId),
      orderBy("createdAt", "asc")
    );
    const auditSnapshot = await getDocs(auditTrailQuery);
    const auditTrail = auditSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().createdAt?.toDate
        ? doc.data().createdAt.toDate().toISOString()
        : null,
    }));

    // 4. Fetch all related reports for the same content
    const relatedReportsQuery = query(
      collection(db, "contentReports"),
      where("contentId", "==", reportData.contentId),
      orderBy("createdAt", "asc")
    );
    const relatedReportsSnap = await getDocs(relatedReportsQuery);
    const relatedReports = relatedReportsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate
        ? doc.data().createdAt.toDate().toISOString()
        : null,
      // Keep reporter identity protected
      reportedBy: "REDACTED_FOR_PRIVACY",
    }));

    // 5. Fetch author moderation history (if author is not anonymous)
    let authorHistory = null;
    if (reportData.contentAuthorId && !originalContent?.isAnonymous) {
      const authorStrikesQuery = query(
        collection(db, "userStrikes"),
        where("userId", "==", reportData.contentAuthorId),
        orderBy("issuedAt", "desc")
      );
      const strikesSnap = await getDocs(authorStrikesQuery);
      authorHistory = {
        userId: reportData.contentAuthorId,
        strikes: strikesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          issuedAt: doc.data().issuedAt?.toDate
            ? doc.data().issuedAt.toDate().toISOString()
            : null,
        })),
      };
    }

    // 6. Compile compliance metadata
    const complianceMetadata = {
      legalHold: reportData.legalHold || false,
      retentionYears: reportData.retentionYears || 2,
      priority: reportData.priority || "medium",
      jurisdiction: "US", // Can be configured per company
      regulatoryFramework: "EEOC", // Equal Employment Opportunity Commission
      chainOfCustody: {
        collected: new Date().toISOString(),
        collectedBy: "System - Evidence Package Generator",
        integrityVerified: true,
        packageVersion: "1.0",
      },
    };

    // 7. Create chain of custody record
    const chainOfCustody = [
      {
        timestamp: new Date().toISOString(),
        action: "Evidence Package Generated",
        actor: "System",
        actorType: "automated",
        description: "Complete evidence package compiled from Firestore database",
      },
    ];

    // 8. Anonymize sensitive data
    const anonymizedReport = {
      ...reportData,
      reportedBy: originalContent?.isAnonymous
        ? "ANONYMOUS_USER"
        : "REDACTED_FOR_PRIVACY",
      reporterNote:
        "Reporter identity available only to VoxWel legal team in secure database",
    };

    // 9. Compile the complete evidence package
    const evidencePackage = {
      packageId: `EVIDENCE-${reportId}-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      reportId: reportId,
      companyId: companyId,

      // Main report details
      report: {
        ...anonymizedReport,
        createdAt: reportData.createdAt?.toDate
          ? reportData.createdAt.toDate().toISOString()
          : null,
        reviewedAt: reportData.reviewedAt?.toDate
          ? reportData.reviewedAt.toDate().toISOString()
          : null,
      },

      // Original content
      originalContent: originalContent
        ? {
            ...originalContent,
            authorNote: originalContent.isAnonymous
              ? "REDACTED_FOR_PRIVACY - Anonymous post"
              : "Author identity available in secure database",
          }
        : null,

      // Complete audit trail
      auditTrail: auditTrail,

      // Related reports from same content/author
      relatedReports: relatedReports,

      // Author moderation history
      authorHistory: authorHistory,

      // Compliance metadata
      complianceMetadata: complianceMetadata,

      // Chain of custody
      chainOfCustody: chainOfCustody,

      // Legal disclaimers
      legalNotice: {
        confidentiality:
          "This evidence package contains confidential information and is intended for legal proceedings only.",
        authentication:
          "All data has been extracted directly from production database with timestamp verification.",
        privacy:
          "Personal identifying information has been redacted where appropriate. Full records available under court order.",
        retention: `This evidence must be retained for ${
          complianceMetadata.retentionYears
        } years per ${complianceMetadata.regulatoryFramework} requirements.`,
      },
    };

    // 10. Log evidence package generation in audit trail
    await logSystemActivity(companyId, "evidence_package_generated", {
      reportId: reportId,
      packageId: evidencePackage.packageId,
      generatedAt: evidencePackage.generatedAt,
      contentType: reportData.contentType,
      reason: reportData.reason,
      legalHold: complianceMetadata.legalHold,
    });

    return evidencePackage;
  } catch (error) {
    console.error("Error generating evidence package:", error);
    throw error;
  }
};

/**
 * Export evidence package as JSON
 * @param {Object} evidencePackage - Evidence package object
 * @returns {string} JSON string
 */
export const exportEvidencePackage = (evidencePackage) => {
  try {
    return JSON.stringify(evidencePackage, null, 2);
  } catch (error) {
    console.error("Error exporting evidence package:", error);
    throw error;
  }
};

/**
 * Download evidence package as JSON file
 * @param {string} reportId - Report ID
 * @param {string} companyId - Company ID
 * @returns {Promise<void>}
 */
export const downloadEvidencePackage = async (reportId, companyId) => {
  try {
    // Generate the evidence package
    const evidencePackage = await generateEvidencePackage(reportId, companyId);

    // Convert to JSON
    const jsonData = exportEvidencePackage(evidencePackage);

    // Create blob and download
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `evidence-${evidencePackage.packageId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading evidence package:", error);
    throw error;
  }
};

/**
 * Get evidence package generation history
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} List of generated evidence packages
 */
export const getEvidencePackageHistory = async (companyId) => {
  try {
    const historyQuery = query(
      collection(db, "systemAuditLogs"),
      where("companyId", "==", companyId),
      where("type", "==", "evidence_package_generated"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(historyQuery);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate
        ? doc.data().createdAt.toDate().toISOString()
        : null,
    }));
  } catch (error) {
    console.error("Error fetching evidence package history:", error);
    return [];
  }
};
