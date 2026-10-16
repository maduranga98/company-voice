import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail, Scale, X } from "lucide-react";
import { createCaseShare, getCaseShares, revokeCaseShare } from "../../services/caseShareService";
import { showError, showSuccess } from "../../services/toastService";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-background-white px-3 py-2.5 text-sm text-[#2D3E50] focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20";

const fmt = (ts) => (ts?.toDate ? ts.toDate().toLocaleDateString() : "-");

const stateOf = (share) => {
  if (share.revoked) return "Revoked";
  const expires = share.expiresAt?.toMillis ? share.expiresAt.toMillis() : 0;
  return expires <= Date.now() ? "Expired" : "Active";
};

const Toggle = ({ checked, onChange, label, hint }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1ABC9C]"
    />
    <span>
      <span className="block text-sm font-semibold text-[#2D3E50]">{label}</span>
      <span className="block text-xs text-gray-500">{hint}</span>
    </span>
  </label>
);

// "Send to lawyer": finalizes the case into a frozen snapshot and emails a private,
// read-only link (no login for the lawyer, PDF download on that page).
const ShareWithCounselButton = ({ caseType, caseId, caseTitle, currentUser, variant = "light", className = "" }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shares, setShares] = useState([]);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    recipientName: "",
    recipientEmail: "",
    message: "",
    expiresInDays: 14,
    notes: false,
    conversation: false,
    attachments: true,
  });
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const loadShares = useCallback(async () => {
    try {
      setShares(await getCaseShares(currentUser.companyId, caseType, caseId));
    } catch (error) {
      console.error("Error loading case shares:", error);
    }
  }, [currentUser.companyId, caseType, caseId]);

  useEffect(() => {
    if (open) loadShares();
  }, [open, loadShares]);

  const close = () => {
    setOpen(false);
    setResult(null);
    setCopied(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const data = await createCaseShare({
        caseType,
        caseId,
        recipientName: form.recipientName,
        recipientEmail: form.recipientEmail,
        message: form.message,
        expiresInDays: Number(form.expiresInDays),
        include: { notes: form.notes, conversation: form.conversation, attachments: form.attachments },
      });
      setResult(data);
      showSuccess("Case finalized and link created");
      loadShares();
    } catch (error) {
      console.error("Error sharing case:", error);
      showError("Could not share the case. Check the email address and try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Could not copy. Select the link and copy it manually.");
    }
  };

  const revoke = async (shareId) => {
    try {
      await revokeCaseShare(shareId);
      showSuccess("Link revoked");
      loadShares();
    } catch (error) {
      console.error("Error revoking share:", error);
      showError("Could not revoke the link");
    }
  };

  const mailto = result
    ? `mailto:${encodeURIComponent(form.recipientEmail)}?subject=${encodeURIComponent(
        `Confidential case file: ${caseTitle || "case"}`
      )}&body=${encodeURIComponent(`${form.message ? `${form.message}\n\n` : ""}Open the case file (private, read-only, expires ${new Date(result.expiresAt).toLocaleDateString()}):\n${result.link}`)}`
    : "#";

  const buttonClass =
    variant === "dark"
      ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
      : "border-gray-200 bg-background-white text-[#2D3E50] hover:border-[#1ABC9C] hover:text-[#16A085]";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${buttonClass} ${className}`}
      >
        <Scale aria-hidden="true" className="h-3.5 w-3.5" />
        Send to lawyer
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="my-8 w-full max-w-lg rounded-2xl bg-background-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="share-title" className="text-lg font-semibold text-[#2D3E50]">
                  Send case to a lawyer
                </h3>
                <p className="mt-0.5 text-sm text-gray-500 line-clamp-1">{caseTitle}</p>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {result ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                  The case is finalized as a frozen copy. Later edits to the case are not included. The link works without a
                  login, is read-only, and expires on {new Date(result.expiresAt).toLocaleDateString()}.
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-700" title={result.link}>
                    {result.link}
                  </span>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-100"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  The link has been queued for email to {form.recipientEmail}. If your email sender is not set up yet, send it
                  yourself:
                </p>
                <div className="flex justify-end gap-2">
                  <a
                    href={mailto}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2 text-sm font-semibold text-[#2D3E50] hover:bg-gray-50"
                  >
                    <Mail className="h-4 w-4" /> Open in email app
                  </a>
                  <button type="button" onClick={close} className="rounded-xl bg-[#2D3E50] px-4 py-2 text-sm font-semibold text-white hover:bg-[#24333F]">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="share-name" className="mb-1 block text-sm font-semibold text-[#2D3E50]">Lawyer's name</label>
                    <input id="share-name" className={inputClass} value={form.recipientName} maxLength={100} onChange={(e) => set({ recipientName: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="share-email" className="mb-1 block text-sm font-semibold text-[#2D3E50]">Email</label>
                    <input id="share-email" type="email" required className={inputClass} value={form.recipientEmail} maxLength={200} onChange={(e) => set({ recipientEmail: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label htmlFor="share-message" className="mb-1 block text-sm font-semibold text-[#2D3E50]">Message (optional)</label>
                  <textarea id="share-message" rows={3} maxLength={2000} className={`${inputClass} resize-none`} value={form.message} onChange={(e) => set({ message: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Toggle checked={form.attachments} onChange={(v) => set({ attachments: v })} label="Evidence files" hint="Photos, PDFs and audio the reporter attached." />
                  <Toggle checked={form.notes} onChange={(v) => set({ notes: v })} label="Internal notes" hint="Staff notes on the case." />
                  <Toggle checked={form.conversation} onChange={(v) => set({ conversation: v })} label="Anonymous conversation" hint="Messages between the reporter and your team." />
                </div>
                <div>
                  <label htmlFor="share-days" className="mb-1 block text-sm font-semibold text-[#2D3E50]">Link expires after</label>
                  <select id="share-days" className={inputClass} value={form.expiresInDays} onChange={(e) => set({ expiresInDays: e.target.value })}>
                    {[3, 7, 14, 30].map((d) => (
                      <option key={d} value={d}>{d} days</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500">
                  The reporter's identity is never included. The lawyer gets a private, read-only page with a PDF download, and
                  every share is recorded on the case.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">Cancel</button>
                  <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#2D3E50] px-4 py-2 text-sm font-semibold text-white hover:bg-[#24333F] disabled:opacity-50">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Finalize and send
                  </button>
                </div>
              </form>
            )}

            {shares.length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Previously shared</h4>
                <ul className="space-y-2">
                  {shares.map((s) => {
                    const state = stateOf(s);
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 text-xs">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[#2D3E50]">{s.recipientEmail}</span>
                          <span className="text-gray-500">
                            {fmt(s.createdAt)} · {state} · viewed {s.viewCount || 0}x
                          </span>
                        </span>
                        {state === "Active" && (
                          <button type="button" onClick={() => revoke(s.id)} className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1 font-semibold text-red-600 hover:bg-red-50">
                            Revoke
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ShareWithCounselButton;
