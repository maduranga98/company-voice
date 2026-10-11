import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useTranslation } from "react-i18next";

const MAX_MESSAGE_LENGTH = 5000;

const formatTimestamp = (iso, locale) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
};

/**
 * The private thread between an anonymous reporter and the company. Messages are
 * decrypted by the caller (publicCaseService); this component only renders and sends.
 */
const CaseReplyThread = ({ messages, onSend, sending }) => {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    const ok = await onSend(text);
    if (ok) setDraft("");
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-[#2D3E50]">{t("report.checkCase.thread.heading")}</h2>
      </div>

      <div className="max-h-96 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">{t("report.checkCase.thread.empty")}</p>
        ) : (
          messages.map((m) => {
            const fromReporter = m.sender === "reporter";
            return (
              <div key={m.id} className={`flex ${fromReporter ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    fromReporter ? "bg-[#1ABC9C] text-white" : "bg-gray-100 text-[#2D3E50]"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content || t("report.checkCase.thread.unreadable")}</p>
                  <p className={`mt-1 text-[11px] ${fromReporter ? "text-white/70" : "text-gray-400"}`}>
                    {fromReporter ? t("report.checkCase.thread.you") : t("report.checkCase.thread.them")}
                    {" · "}
                    {formatTimestamp(m.timestamp, i18n.resolvedLanguage || i18n.language)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-gray-100 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          rows={2}
          placeholder={t("report.checkCase.thread.placeholder")}
          className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[#2D3E50] focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1ABC9C] text-white transition hover:bg-[#17a589] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("report.checkCase.thread.send")}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
};

export default CaseReplyThread;
