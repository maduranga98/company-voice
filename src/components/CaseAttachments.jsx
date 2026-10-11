import { useState } from "react";
import { FileText, Loader2, Paperclip } from "lucide-react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../config/firebase";

// Lists a case's attachments. Public-report evidence is stored by path (resolved to a
// short-lived download link on click); older post attachments carry a ready-made url.
const CaseAttachments = ({ attachments }) => {
  const [opening, setOpening] = useState(null);
  const [failed, setFailed] = useState(false);

  if (!Array.isArray(attachments) || attachments.length === 0) return null;

  const open = async (attachment, index) => {
    setFailed(false);
    if (attachment.url) {
      window.open(attachment.url, "_blank", "noopener,noreferrer");
      return;
    }
    setOpening(index);
    try {
      const url = await getDownloadURL(ref(storage, attachment.path));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setFailed(true);
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Paperclip size={12} />
        Attachments
      </p>
      <ul className="space-y-1.5">
        {attachments.map((attachment, index) => (
          <li key={attachment.path || attachment.url || index}>
            <button
              type="button"
              onClick={() => open(attachment, index)}
              className="flex w-full items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-left text-sm text-[#2D3E50] hover:border-[#1ABC9C]"
            >
              {opening === index ? (
                <Loader2 size={14} className="animate-spin text-[#1ABC9C]" />
              ) : (
                <FileText size={14} className="text-gray-400" />
              )}
              <span className="truncate">{attachment.name || `Attachment ${index + 1}`}</span>
            </button>
          </li>
        ))}
      </ul>
      {failed && <p className="mt-2 text-xs text-[#FF6B6B]">Could not open the attachment.</p>}
    </div>
  );
};

export default CaseAttachments;
