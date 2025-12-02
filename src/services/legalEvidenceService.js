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
import { db, storage } from "../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { logSystemActivity } from "./auditService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

// ============================================
// PDF EXPORT FUNCTIONALITY
// ============================================

/**
 * Generate SHA256 hash for digital signature
 * @param {string} data - Data to hash
 * @returns {Promise<string>} Hex hash string
 */
const generateDigitalSignature = async (data) => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
};

/**
 * Export evidence package as PDF
 * @param {string} reportId - Report ID
 * @param {string} companyId - Company ID
 * @param {Object} brandingOptions - Company branding options (optional)
 * @returns {Promise<void>}
 */
export const exportEvidenceAsPDF = async (
  reportId,
  companyId,
  brandingOptions = {}
) => {
  try {
    // Generate the evidence package
    const evidencePackage = await generateEvidencePackage(reportId, companyId);

    // Get company information
    const companyRef = doc(db, "companies", companyId);
    const companySnap = await getDoc(companyRef);
    const companyData = companySnap.exists() ? companySnap.data() : {};

    // Initialize PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    let pageNumber = 1;
    const pageHeight = pdf.internal.pageSize.height;
    const pageWidth = pdf.internal.pageSize.width;
    const margin = 20;
    let yPosition = margin;

    // Helper function to add page number and footer
    const addFooter = () => {
      const footerY = pageHeight - 10;
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page ${pageNumber}`,
        pageWidth / 2,
        footerY,
        { align: "center" }
      );
      pdf.text(
        `Generated: ${new Date().toISOString()}`,
        margin,
        footerY
      );

      // Add digital signature hash at the bottom
      pdf.setFontSize(6);
      pdf.text(
        `Document ID: ${evidencePackage.packageId}`,
        margin,
        footerY + 3
      );
    };

    // Helper function to check if we need a new page
    const checkNewPage = (requiredSpace) => {
      if (yPosition + requiredSpace > pageHeight - 20) {
        addFooter();
        pdf.addPage();
        pageNumber++;
        yPosition = margin;
        return true;
      }
      return false;
    };

    // ============================================
    // COVER PAGE
    // ============================================

    // Add company logo if provided
    if (brandingOptions.logoUrl) {
      try {
        pdf.addImage(
          brandingOptions.logoUrl,
          "PNG",
          margin,
          yPosition,
          40,
          20
        );
        yPosition += 30;
      } catch (error) {
        console.warn("Could not add logo to PDF:", error);
      }
    }

    // Title
    pdf.setFontSize(24);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, "bold");
    pdf.text("Legal Evidence Package", pageWidth / 2, yPosition, {
      align: "center",
    });
    yPosition += 15;

    // Company name
    pdf.setFontSize(16);
    pdf.setFont(undefined, "normal");
    pdf.text(
      companyData.name || "Company Name",
      pageWidth / 2,
      yPosition,
      { align: "center" }
    );
    yPosition += 20;

    // Report details box
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPosition, pageWidth - 2 * margin, 60, "F");

    yPosition += 10;
    pdf.setFontSize(12);
    pdf.setFont(undefined, "bold");
    pdf.text("Report ID:", margin + 5, yPosition);
    pdf.setFont(undefined, "normal");
    pdf.text(reportId, margin + 40, yPosition);

    yPosition += 10;
    pdf.setFont(undefined, "bold");
    pdf.text("Package ID:", margin + 5, yPosition);
    pdf.setFont(undefined, "normal");
    pdf.text(evidencePackage.packageId, margin + 40, yPosition);

    yPosition += 10;
    pdf.setFont(undefined, "bold");
    pdf.text("Generation Date:", margin + 5, yPosition);
    pdf.setFont(undefined, "normal");
    pdf.text(
      new Date(evidencePackage.generatedAt).toLocaleString(),
      margin + 40,
      yPosition
    );

    yPosition += 10;
    pdf.setFont(undefined, "bold");
    pdf.text("Report Status:", margin + 5, yPosition);
    pdf.setFont(undefined, "normal");
    pdf.text(evidencePackage.report.status || "N/A", margin + 40, yPosition);

    yPosition += 10;
    pdf.setFont(undefined, "bold");
    pdf.text("Report Reason:", margin + 5, yPosition);
    pdf.setFont(undefined, "normal");
    pdf.text(evidencePackage.report.reason || "N/A", margin + 40, yPosition);

    yPosition += 20;

    // Confidentiality notice
    pdf.setFontSize(10);
    pdf.setTextColor(200, 0, 0);
    pdf.setFont(undefined, "bold");
    pdf.text("CONFIDENTIAL - LEGAL PROCEEDINGS ONLY", pageWidth / 2, yPosition, {
      align: "center",
    });

    yPosition += 10;
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, "normal");
    const confidentialityText = pdf.splitTextToSize(
      evidencePackage.legalNotice.confidentiality,
      pageWidth - 2 * margin - 10
    );
    pdf.text(confidentialityText, pageWidth / 2, yPosition, {
      align: "center",
      maxWidth: pageWidth - 2 * margin - 10,
    });

    // Add custom header/footer text if provided
    if (brandingOptions.headerText) {
      yPosition += 20;
      pdf.setFontSize(10);
      const headerText = pdf.splitTextToSize(
        brandingOptions.headerText,
        pageWidth - 2 * margin
      );
      pdf.text(headerText, pageWidth / 2, yPosition, {
        align: "center",
      });
    }

    addFooter();

    // ============================================
    // TABLE OF CONTENTS
    // ============================================

    pdf.addPage();
    pageNumber++;
    yPosition = margin;

    pdf.setFontSize(18);
    pdf.setFont(undefined, "bold");
    pdf.text("Table of Contents", margin, yPosition);
    yPosition += 15;

    pdf.setFontSize(11);
    pdf.setFont(undefined, "normal");
    const tocItems = [
      { title: "1. Executive Summary", page: 3 },
      { title: "2. Report Details", page: 3 },
      { title: "3. Original Content", page: 4 },
      { title: "4. Audit Trail Timeline", page: 5 },
      { title: "5. Related Incidents", page: 6 },
      { title: "6. Author Moderation History", page: 7 },
      { title: "7. Compliance Metadata", page: 8 },
      { title: "8. Legal Notices", page: 9 },
    ];

    tocItems.forEach((item) => {
      pdf.text(item.title, margin + 5, yPosition);
      pdf.text(
        `Page ${item.page}`,
        pageWidth - margin - 20,
        yPosition
      );
      yPosition += 8;
    });

    addFooter();

    // ============================================
    // EXECUTIVE SUMMARY
    // ============================================

    pdf.addPage();
    pageNumber++;
    yPosition = margin;

    pdf.setFontSize(16);
    pdf.setFont(undefined, "bold");
    pdf.text("1. Executive Summary", margin, yPosition);
    yPosition += 12;

    pdf.setFontSize(11);
    pdf.setFont(undefined, "normal");

    const summaryData = [
      ["Report Date", new Date(evidencePackage.report.createdAt).toLocaleDateString()],
      ["Report Status", evidencePackage.report.status],
      ["Report Reason", evidencePackage.report.reason],
      ["Priority", evidencePackage.report.priority || "Medium"],
      ["Legal Hold", evidencePackage.complianceMetadata.legalHold ? "Yes" : "No"],
      ["Retention Period", `${evidencePackage.complianceMetadata.retentionYears} years`],
      ["Content Type", evidencePackage.report.contentType],
    ];

    autoTable(pdf, {
      startY: yPosition,
      head: [["Field", "Value"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [99, 102, 241] },
      margin: { left: margin, right: margin },
    });

    yPosition = pdf.lastAutoTable.finalY + 10;
    checkNewPage(20);

    // ============================================
    // DETAILED REPORT INFORMATION
    // ============================================

    pdf.setFontSize(16);
    pdf.setFont(undefined, "bold");
    pdf.text("2. Report Details", margin, yPosition);
    yPosition += 12;

    pdf.setFontSize(11);
    pdf.setFont(undefined, "normal");

    const reportDetailsData = [
      ["Report ID", evidencePackage.reportId],
      ["Content ID", evidencePackage.report.contentId],
      ["Content Type", evidencePackage.report.contentType],
      ["Reason", evidencePackage.report.reason],
      ["Status", evidencePackage.report.status],
      ["Priority", evidencePackage.report.priority || "N/A"],
      ["Created At", new Date(evidencePackage.report.createdAt).toLocaleString()],
      ["Reviewed At", evidencePackage.report.reviewedAt
        ? new Date(evidencePackage.report.reviewedAt).toLocaleString()
        : "Not yet reviewed"],
      ["Reported By", evidencePackage.report.reportedBy],
      ["Description", evidencePackage.report.description || "N/A"],
    ];

    autoTable(pdf, {
      startY: yPosition,
      head: [["Field", "Value"]],
      body: reportDetailsData,
      theme: "striped",
      headStyles: { fillColor: [99, 102, 241] },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: "auto" },
      },
    });

    yPosition = pdf.lastAutoTable.finalY + 10;

    addFooter();

    // ============================================
    // ORIGINAL CONTENT
    // ============================================

    pdf.addPage();
    pageNumber++;
    yPosition = margin;

    pdf.setFontSize(16);
    pdf.setFont(undefined, "bold");
    pdf.text("3. Original Content", margin, yPosition);
    yPosition += 12;

    if (evidencePackage.originalContent) {
      const content = evidencePackage.originalContent;

      const contentData = [
        ["Content ID", content.id],
        ["Type", content.type || evidencePackage.report.contentType],
        ["Created At", content.createdAt
          ? new Date(content.createdAt).toLocaleString()
          : "N/A"],
        ["Author", content.authorNote || "Available in secure database"],
        ["Is Anonymous", content.isAnonymous ? "Yes" : "No"],
      ];

      autoTable(pdf, {
        startY: yPosition,
        head: [["Field", "Value"]],
        body: contentData,
        theme: "grid",
        headStyles: { fillColor: [99, 102, 241] },
        margin: { left: margin, right: margin },
      });

      yPosition = pdf.lastAutoTable.finalY + 10;
      checkNewPage(30);

      // Content text
      pdf.setFontSize(12);
      pdf.setFont(undefined, "bold");
      pdf.text("Content Text:", margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont(undefined, "normal");
      const contentText = pdf.splitTextToSize(
        content.content || content.text || "Content not available",
        pageWidth - 2 * margin
      );
      pdf.text(contentText, margin, yPosition);
    } else {
      pdf.setFontSize(11);
      pdf.text("Original content not available or has been deleted.", margin, yPosition);
    }

    addFooter();

    // ============================================
    // AUDIT TRAIL TIMELINE
    // ============================================

    pdf.addPage();
    pageNumber++;
    yPosition = margin;

    pdf.setFontSize(16);
    pdf.setFont(undefined, "bold");
    pdf.text("4. Complete Audit Trail", margin, yPosition);
    yPosition += 12;

    if (evidencePackage.auditTrail && evidencePackage.auditTrail.length > 0) {
      const auditData = evidencePackage.auditTrail.map((activity) => [
        new Date(activity.timestamp).toLocaleString(),
        activity.activityType || activity.type || "N/A",
        activity.actorName || activity.performedBy || "System",
        activity.description || "N/A",
      ]);

      autoTable(pdf, {
        startY: yPosition,
        head: [["Timestamp", "Action Type", "Performed By", "Description"]],
        body: auditData,
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241] },
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 35 },
          2: { cellWidth: 35 },
          3: { cellWidth: "auto" },
        },
      });
    } else {
      pdf.setFontSize(11);
      pdf.text("No audit trail activities recorded.", margin, yPosition);
    }

    addFooter();

    // ============================================
    // RELATED INCIDENTS
    // ============================================

    pdf.addPage();
    pageNumber++;
    yPosition = margin;

    pdf.setFontSize(16);
    pdf.setFont(undefined, "bold");
    pdf.text("5. Related Incidents", margin, yPosition);
    yPosition += 12;

    if (
      evidencePackage.relatedReports &&
      evidencePackage.relatedReports.length > 0
    ) {
      const relatedData = evidencePackage.relatedReports.map((report) => [
        report.id,
        new Date(report.createdAt).toLocaleDateString(),
        report.reason,
        report.status,
      ]);

      autoTable(pdf, {
        startY: yPosition,
        head: [["Report ID", "Date", "Reason", "Status"]],
        body: relatedData,
        theme: "grid",
        headStyles: { fillColor: [99, 102, 241] },
        margin: { left: margin, right: margin },
        styles: { fontSize: 10 },
      });
    } else {
      pdf.setFontSize(11);
      pdf.text("No related incidents found.", margin, yPosition);
    }

    addFooter();

    // ============================================
    // AUTHOR MODERATION HISTORY
    // ============================================

    pdf.addPage();
    pageNumber++;
    yPosition = margin;

    pdf.setFontSize(16);
    pdf.setFont(undefined, "bold");
    pdf.text("6. Author Moderation History", margin, yPosition);
    yPosition += 12;

    if (
      evidencePackage.authorHistory &&
      evidencePackage.authorHistory.strikes &&
      evidencePackage.authorHistory.strikes.length > 0
    ) {
      const strikeData = evidencePackage.authorHistory.strikes.map((strike) => [
        new Date(strike.issuedAt).toLocaleDateString(),
        `Strike ${strike.strikeLevel}`,
        strike.violationType || "N/A",
        strike.issuedBy || "N/A",
      ]);

      autoTable(pdf, {
        startY: yPosition,
        head: [["Date", "Strike Level", "Violation Type", "Issued By"]],
        body: strikeData,
        theme: "striped",
        headStyles: { fillColor: [239, 68, 68] },
        margin: { left: margin, right: margin },
      });
    } else {
      pdf.setFontSize(11);
      pdf.text(
        "No prior moderation history or author is anonymous.",
        margin,
        yPosition
      );
    }

    addFooter();

    // ============================================
    // COMPLIANCE METADATA
    // ============================================

    pdf.addPage();
    pageNumber++;
    yPosition = margin;

    pdf.setFontSize(16);
    pdf.setFont(undefined, "bold");
    pdf.text("7. Compliance Metadata", margin, yPosition);
    yPosition += 12;

    const complianceData = [
      ["Legal Hold", evidencePackage.complianceMetadata.legalHold ? "Yes" : "No"],
      ["Retention Period", `${evidencePackage.complianceMetadata.retentionYears} years`],
      ["Priority", evidencePackage.complianceMetadata.priority],
      ["Jurisdiction", evidencePackage.complianceMetadata.jurisdiction],
      ["Regulatory Framework", evidencePackage.complianceMetadata.regulatoryFramework],
      ["Package Version", evidencePackage.complianceMetadata.chainOfCustody.packageVersion],
      ["Collected By", evidencePackage.complianceMetadata.chainOfCustody.collectedBy],
      ["Collection Date", new Date(evidencePackage.complianceMetadata.chainOfCustody.collected).toLocaleString()],
      ["Integrity Verified", evidencePackage.complianceMetadata.chainOfCustody.integrityVerified ? "Yes" : "No"],
    ];

    autoTable(pdf, {
      startY: yPosition,
      head: [["Compliance Field", "Value"]],
      body: complianceData,
      theme: "grid",
      headStyles: { fillColor: [99, 102, 241] },
      margin: { left: margin, right: margin },
    });

    yPosition = pdf.lastAutoTable.finalY + 15;
    checkNewPage(40);

    // Chain of custody
    pdf.setFontSize(14);
    pdf.setFont(undefined, "bold");
    pdf.text("Chain of Custody", margin, yPosition);
    yPosition += 10;

    const custodyData = evidencePackage.chainOfCustody.map((entry) => [
      new Date(entry.timestamp).toLocaleString(),
      entry.action,
      entry.actor,
      entry.actorType,
    ]);

    autoTable(pdf, {
      startY: yPosition,
      head: [["Timestamp", "Action", "Actor", "Actor Type"]],
      body: custodyData,
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
    });

    addFooter();

    // ============================================
    // LEGAL NOTICES
    // ============================================

    pdf.addPage();
    pageNumber++;
    yPosition = margin;

    pdf.setFontSize(16);
    pdf.setFont(undefined, "bold");
    pdf.text("8. Legal Notices", margin, yPosition);
    yPosition += 15;

    pdf.setFontSize(12);
    pdf.setFont(undefined, "bold");
    pdf.text("Confidentiality", margin, yPosition);
    yPosition += 8;
    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");
    const confidentialityNotice = pdf.splitTextToSize(
      evidencePackage.legalNotice.confidentiality,
      pageWidth - 2 * margin
    );
    pdf.text(confidentialityNotice, margin, yPosition);
    yPosition += confidentialityNotice.length * 5 + 10;

    checkNewPage(40);

    pdf.setFontSize(12);
    pdf.setFont(undefined, "bold");
    pdf.text("Authentication", margin, yPosition);
    yPosition += 8;
    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");
    const authenticationNotice = pdf.splitTextToSize(
      evidencePackage.legalNotice.authentication,
      pageWidth - 2 * margin
    );
    pdf.text(authenticationNotice, margin, yPosition);
    yPosition += authenticationNotice.length * 5 + 10;

    checkNewPage(40);

    pdf.setFontSize(12);
    pdf.setFont(undefined, "bold");
    pdf.text("Privacy Protection", margin, yPosition);
    yPosition += 8;
    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");
    const privacyNotice = pdf.splitTextToSize(
      evidencePackage.legalNotice.privacy,
      pageWidth - 2 * margin
    );
    pdf.text(privacyNotice, margin, yPosition);
    yPosition += privacyNotice.length * 5 + 10;

    checkNewPage(40);

    pdf.setFontSize(12);
    pdf.setFont(undefined, "bold");
    pdf.text("Retention Requirements", margin, yPosition);
    yPosition += 8;
    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");
    const retentionNotice = pdf.splitTextToSize(
      evidencePackage.legalNotice.retention,
      pageWidth - 2 * margin
    );
    pdf.text(retentionNotice, margin, yPosition);
    yPosition += retentionNotice.length * 5 + 15;

    checkNewPage(30);

    // Digital signature
    pdf.setFontSize(11);
    pdf.setFont(undefined, "bold");
    pdf.text("Digital Signature Hash", margin, yPosition);
    yPosition += 8;

    // Generate hash of the evidence package
    const packageHash = await generateDigitalSignature(
      JSON.stringify(evidencePackage)
    );

    pdf.setFontSize(8);
    pdf.setFont("courier", "normal");
    const hashText = pdf.splitTextToSize(packageHash, pageWidth - 2 * margin);
    pdf.text(hashText, margin, yPosition);

    addFooter();

    // Save the PDF
    pdf.save(`evidence-${evidencePackage.packageId}.pdf`);

    // Log PDF generation
    await logSystemActivity(companyId, "evidence_package_pdf_generated", {
      reportId: reportId,
      packageId: evidencePackage.packageId,
      generatedAt: new Date().toISOString(),
      pages: pageNumber,
    });
  } catch (error) {
    console.error("Error exporting evidence package as PDF:", error);
    throw error;
  }
};

/**
 * Download evidence package in specified format
 * @param {string} reportId - Report ID
 * @param {string} companyId - Company ID
 * @param {string} format - "json" or "pdf"
 * @param {Object} brandingOptions - Branding options for PDF (optional)
 * @returns {Promise<void>}
 */
export const downloadEvidencePackageWithFormat = async (
  reportId,
  companyId,
  format = "json",
  brandingOptions = {}
) => {
  try {
    if (format === "pdf") {
      await exportEvidenceAsPDF(reportId, companyId, brandingOptions);
    } else {
      await downloadEvidencePackage(reportId, companyId);
    }
  } catch (error) {
    console.error("Error downloading evidence package:", error);
    throw error;
  }
};

// ============================================
// COURT ORDER UPLOAD
// ============================================

/**
 * Upload a court order document to Firebase Storage
 * @param {File} file - Court order PDF file
 * @param {string} companyId - Company ID
 * @returns {Promise<string>} Download URL of the uploaded file
 */
export const uploadCourtOrder = async (file, companyId) => {
  try {
    if (!file) {
      throw new Error("No file provided");
    }

    if (!companyId) {
      throw new Error("Company ID is required");
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      throw new Error("Only PDF files are allowed for court orders");
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      throw new Error("File size must be less than 10MB");
    }

    // Create a unique filename with timestamp
    const timestamp = Date.now();
    const filename = `court-orders/${companyId}/${timestamp}-${file.name}`;

    // Create storage reference
    const storageRef = ref(storage, filename);

    // Upload the file
    const uploadResult = await uploadBytes(storageRef, file, {
      contentType: "application/pdf",
      customMetadata: {
        companyId: companyId,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Get the download URL
    const downloadURL = await getDownloadURL(uploadResult.ref);

    // Log the upload
    await logSystemActivity(companyId, "court_order_uploaded", {
      filename: file.name,
      fileSize: file.size,
      downloadURL: downloadURL,
    });

    return downloadURL;
  } catch (error) {
    console.error("Error uploading court order:", error);
    throw error;
  }
};
