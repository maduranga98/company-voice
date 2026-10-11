import { getThread } from "./anonymousThreadService";
import { getCaseNotes } from "./caseService";
import { CaseType, toDate } from "../utils/caseTypes";
import { PostStatusConfig, PostPriorityConfig, PostPriority, ThreadSender } from "../utils/constants";
import { getDueInfo } from "../utils/caseDisplay";

// Exports one HR case as a PDF: details, submission, attachments, internal notes and,
// when the anonymous thread has messages, the full conversation. jsPDF is loaded on
// demand so it stays out of the main bundle.

const INK = [45, 62, 80];
const TEAL = [26, 188, 156];
const MUTED = [120, 130, 142];
const MARGIN = 16;

const fmtDateTime = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
};

const safeFileName = (title) =>
  (title || "case").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "case";

export const exportCaseToPdf = async ({ post, currentUser }) => {
  const companyId = post.companyId || currentUser.companyId;

  const [pdfModule, tableModule, notes, thread] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    getCaseNotes(CaseType.POST, post.id, companyId).catch(() => []),
    post.isAnonymous ? getThread(post.id, companyId) : Promise.resolve(null),
  ]);
  const jsPDF = pdfModule.jsPDF || pdfModule.default?.jsPDF || pdfModule.default;
  const autoTable = tableModule.default?.default || tableModule.default || tableModule.autoTable;
  const messages = [...(thread?.messages || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  let y = 0;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - 18) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const heading = (text) => {
    ensureSpace(14);
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK);
    doc.text(text.toUpperCase(), MARGIN, y);
    doc.setDrawColor(...TEAL).setLineWidth(0.6).line(MARGIN, y + 1.8, MARGIN + 12, y + 1.8);
    y += 7;
  };

  const paragraph = (text, { size = 10, color = INK, indent = 0, bold = false } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size).setTextColor(...color);
    const lines = doc.splitTextToSize(String(text || "-"), contentW - indent);
    const lineH = size * 0.45;
    lines.forEach((line) => {
      ensureSpace(lineH + 1);
      doc.text(line, MARGIN + indent, y);
      y += lineH;
    });
    y += 1.5;
  };

  // Banner
  doc.setFillColor(...INK).rect(0, 0, pageW, 24, "F");
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(255, 255, 255);
  doc.text("VoxWel", MARGIN, 11);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(200, 210, 220);
  doc.text("Case report - confidential", MARGIN, 17);
  doc.text(`Exported ${fmtDateTime(new Date())} by ${currentUser.displayName || "HR"}`, pageW - MARGIN, 17, { align: "right" });
  y = 34;

  paragraph(post.title || "Untitled case", { size: 15, bold: true });

  const priority = post.priority || PostPriority.MEDIUM;
  const due = getDueInfo(post.dueDate);
  const rows = [
    ["Type", (post.type || "").replace(/_/g, " ") || "-"],
    ["Status", PostStatusConfig[post.status]?.label || "Open"],
    ["Priority", PostPriorityConfig[priority]?.label || priority],
    ["Submitted", fmtDateTime(post.createdAt)],
    ["Reporter", post.isAnonymous ? "Anonymous" : post.authorName || "-"],
    ["Assigned to", post.assignedTo?.name || "Unassigned"],
    ["Due date", due ? due.date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "-"],
  ];
  if (post.source === "policy_link") {
    rows.push(["Policy", `${post.policyTitle || "-"}${post.policyVersion ? ` (v${post.policyVersion})` : ""}`]);
  }
  autoTable(doc, {
    startY: y,
    body: rows,
    theme: "plain",
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 9.5, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, textColor: INK },
    columnStyles: { 0: { fontStyle: "bold", textColor: MUTED, cellWidth: 32 } },
  });
  y = doc.lastAutoTable.finalY + 2;

  heading("Submission");
  paragraph(post.description || post.content || "-");

  if (Array.isArray(post.attachments) && post.attachments.length > 0) {
    heading(`Attachments (${post.attachments.length})`);
    post.attachments.forEach((a, i) => paragraph(`${i + 1}. ${a.name || a.fileName || a.path || a.url || "File"}`, { size: 9.5 }));
  }

  if (notes.length > 0) {
    heading(`Internal notes (${notes.length})`);
    notes.forEach((note) => {
      paragraph(`${note.authorName || "Staff"} - ${fmtDateTime(note.createdAt)}`, { size: 8.5, color: MUTED });
      paragraph(note.text, { indent: 3 });
    });
  }

  if (messages.length > 0) {
    heading(`Conversation (${messages.length} messages)`);
    messages.forEach((msg) => {
      const fromHr = msg.sender === ThreadSender.INVESTIGATOR;
      paragraph(`${fromHr ? "HR team" : "Anonymous reporter"} - ${fmtDateTime(msg.timestamp)}`, {
        size: 8.5,
        color: fromHr ? TEAL : MUTED,
        bold: true,
      });
      paragraph(msg.content || "[Message could not be decrypted]", { indent: 3 });
    });
  }

  // Footer on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text("Confidential - contains sensitive HR information", MARGIN, pageH - 8);
    doc.text(`Page ${i} of ${total}`, pageW - MARGIN, pageH - 8, { align: "right" });
  }

  doc.save(`voxwel-case-${safeFileName(post.title)}.pdf`);
  return { messageCount: messages.length };
};
