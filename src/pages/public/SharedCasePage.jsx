import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, FileText, Loader2, Lock, Paperclip, ShieldOff } from "lucide-react";
import { fetchSharedCase } from "../../services/caseShareService";

// Read-only case file for outside counsel. No login: the private token is in the URL
// fragment (never sent to a server with the page request) and is exchanged for the frozen
// case snapshot. Not indexed and no referrer.

const LABEL = {
  low: "Low", medium: "Medium", high: "High", critical: "Critical",
  labor: "Labor practices", data_privacy: "Data privacy", safety: "Health and safety",
  fraud: "Fraud or corruption", compliance: "Regulatory non-compliance", other: "Other",
  harassment: "Harassment or bullying", discrimination: "Discrimination", fraud_ethics: "Fraud or ethics",
  management: "Management conduct", workplace_conditions: "Workplace conditions", pay_benefits: "Pay and benefits",
};
const pretty = (v) => LABEL[v] || (v ? v.replace(/_/g, " ") : "-");
const when = (v) => (v ? new Date(v).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "-");

const useNoIndex = () => {
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow";
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    return () => {
      robots.remove();
      referrer.remove();
    };
  }, []);
};

const buildPdf = async (data) => {
  const { jsPDF } = await import("jspdf");
  const c = data.case;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  let y = M;
  const ensure = (n) => {
    if (y + n > H - 16) {
      doc.addPage();
      y = M;
    }
  };
  const write = (text, { size = 10, bold = false, color = [45, 62, 80], gap = 1.5 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size).setTextColor(...color);
    doc.splitTextToSize(String(text || "-"), W - M * 2).forEach((line) => {
      ensure(size * 0.5);
      doc.text(line, M, y);
      y += size * 0.45;
    });
    y += gap;
  };
  const heading = (text) => {
    ensure(14);
    y += 3;
    write(text.toUpperCase(), { size: 10, bold: true, color: [26, 188, 156], gap: 2 });
  };

  write("CONFIDENTIAL - PREPARED FOR LEGAL COUNSEL", { size: 8, bold: true, color: [120, 130, 142], gap: 3 });
  write(c.title, { size: 17, bold: true, gap: 3 });
  write(`Shared by ${data.sharedByName || data.companyName} (${data.companyName}) on ${new Date().toLocaleDateString()}`, { size: 9, color: [120, 130, 142], gap: 4 });

  heading("Case details");
  const rows = [
    c.reference && ["Reference", c.reference],
    ["Status", pretty(c.status)],
    ["Priority", pretty(c.priority)],
    c.caseType === "vendor" ? ["Vendor", c.vendorName] : ["Category", pretty(c.category)],
    c.caseType === "vendor" && ["Risk category", pretty(c.riskCategory)],
    c.caseType === "vendor" && ["Severity", pretty(c.severity)],
    ["Submitted", when(c.submittedAt)],
  ].filter(Boolean);
  rows.forEach(([k, v]) => write(`${k}: ${v}`));

  heading("Description");
  write(c.description);

  if (c.corroborations?.length) {
    heading(`Additional accounts (${c.corroborations.length})`);
    c.corroborations.forEach((x, i) => write(`${i + 1}. ${pretty(x.relationship)} - ${x.account}`));
  }
  if (c.attachments?.length) {
    heading("Evidence files");
    c.attachments.forEach((a, i) => write(`${i + 1}. ${a.name}${a.url ? "" : " (unavailable)"}`));
    write("Files are available from the online case file while the link is active.", { size: 8, color: [120, 130, 142] });
  }
  if (c.notes?.length) {
    heading("Internal notes");
    c.notes.forEach((n) => write(`${n.author} (${when(n.createdAt)}): ${n.text}`));
  }
  if (c.conversation?.length) {
    heading("Conversation with reporter");
    c.conversation.forEach((m) => write(`${m.sender} (${when(m.timestamp)}): ${m.content}`));
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i).setFont("helvetica", "normal").setFontSize(8).setTextColor(150, 150, 150);
    doc.text(`Confidential - ${data.companyName} - page ${i} of ${pages}`, M, H - 8);
  }
  doc.save(`${(c.title || "case").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "case"}.pdf`);
};

const Field = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-xs text-gray-400">{label}</dt>
    <dd className="mt-0.5 truncate text-sm font-medium text-[#2D3E50]">{value}</dd>
  </div>
);

const Section = ({ title, children }) => (
  <section className="rounded-2xl border border-gray-100 bg-background-white p-5 shadow-sm">
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h2>
    {children}
  </section>
);

const SharedCasePage = () => {
  const { shareId } = useParams();
  useNoIndex();
  const [state, setState] = useState("loading"); // loading | ready | unavailable
  const [data, setData] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    const token = window.location.hash.replace(/^#/, "");
    // Keep the token out of history, screenshots of the address bar and later navigation.
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setState("unavailable");
      return undefined;
    }
    let cancelled = false;
    fetchSharedCase(shareId, token)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setState("ready");
      })
      .catch(() => !cancelled && setState("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-page">
        <Loader2 className="h-8 w-8 animate-spin text-[#1ABC9C]" aria-label="Loading" />
      </div>
    );
  }

  if (state === "unavailable") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-page px-4">
        <div className="max-w-sm text-center">
          <ShieldOff className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-[#2D3E50]">This link is not available</h1>
          <p className="mt-1 text-sm text-gray-500">It may have expired or been withdrawn. Please contact the person who sent it.</p>
        </div>
      </div>
    );
  }

  const c = data.case;
  const download = async () => {
    setPdfBusy(true);
    try {
      await buildPdf(data);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-page">
      <header className="bg-[#2D3E50] px-4 py-8 text-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#1ABC9C]">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Confidential case file
            </p>
            <h1 className="mt-2 text-xl font-bold leading-tight">{c.title}</h1>
            <p className="mt-1 text-sm text-white/60">
              Shared by {data.sharedByName || "the company"} · {data.companyName}
            </p>
          </div>
          <button
            type="button"
            onClick={download}
            disabled={pdfBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1ABC9C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16A085] disabled:opacity-60 print:hidden"
          >
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            Download PDF
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {data.note && (
          <Section title={`Message${data.recipientName ? ` for ${data.recipientName}` : ""}`}>
            <p className="whitespace-pre-wrap text-sm text-[#2D3E50]">{data.note}</p>
          </Section>
        )}

        <Section title="Case details">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {c.reference && <Field label="Reference" value={c.reference} />}
            <Field label="Status" value={pretty(c.status)} />
            <Field label="Priority" value={pretty(c.priority)} />
            {c.caseType === "vendor" ? (
              <>
                <Field label="Vendor" value={c.vendorName} />
                <Field label="Risk category" value={pretty(c.riskCategory)} />
                <Field label="Severity" value={pretty(c.severity)} />
              </>
            ) : (
              <Field label="Category" value={pretty(c.category)} />
            )}
            <Field label="Submitted" value={when(c.submittedAt)} />
          </dl>
        </Section>

        <Section title="Description">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2D3E50]">{c.description}</p>
        </Section>

        {c.corroborations?.length > 0 && (
          <Section title={`Additional accounts (${c.corroborations.length})`}>
            <ul className="space-y-3">
              {c.corroborations.map((x, i) => (
                <li key={i} className="rounded-xl bg-gray-50 p-3 text-sm text-[#2D3E50]">
                  <span className="text-xs font-semibold text-gray-500">{pretty(x.relationship)}</span>
                  <p className="mt-1 whitespace-pre-wrap">{x.account}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {c.attachments?.length > 0 && (
          <Section title="Evidence files">
            <ul className="space-y-2">
              {c.attachments.map((a, i) => (
                <li key={i}>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm font-medium text-[#2D3E50] hover:bg-gray-100">
                      <Paperclip className="h-4 w-4 text-gray-400" aria-hidden="true" /> {a.name}
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-400">
                      <Paperclip className="h-4 w-4" aria-hidden="true" /> {a.name} (unavailable)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {c.notes?.length > 0 && (
          <Section title="Internal notes">
            <ul className="space-y-3">
              {c.notes.map((n, i) => (
                <li key={i} className="text-sm text-[#2D3E50]">
                  <span className="text-xs text-gray-400">{n.author} · {when(n.createdAt)}</span>
                  <p className="whitespace-pre-wrap">{n.text}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {c.conversation?.length > 0 && (
          <Section title="Conversation with the reporter">
            <ul className="space-y-3">
              {c.conversation.map((m, i) => (
                <li key={i} className="text-sm text-[#2D3E50]">
                  <span className="text-xs text-gray-400">{m.sender} · {when(m.timestamp)}</span>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-gray-400">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Read-only copy. This link expires on {new Date(data.expiresAt).toLocaleDateString()}.
        </p>
      </main>
    </div>
  );
};

export default SharedCasePage;
