import { useEffect, useState } from "react";
import { FileText, Loader2, Mic, Paperclip } from "lucide-react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../config/firebase";

const isAudio = (attachment) => typeof attachment?.type === "string" && attachment.type.startsWith("audio/");

// Inline player for voice notes. The link is resolved when the row mounts (staff-only Storage
// read) and the browser streams the file; nothing is downloaded until the player is used.
const AudioAttachment = ({ attachment, label }) => {
  const [src, setSrc] = useState(attachment.url || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (attachment.url || !attachment.path) return undefined;
    let cancelled = false;
    getDownloadURL(ref(storage, attachment.path))
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [attachment.url, attachment.path]);

  return (
    <div className="rounded-lg border border-gray-100 px-3 py-2">
      <p className="mb-1.5 flex items-center gap-2 text-sm text-[#2D3E50]">
        <Mic size={14} className="text-gray-400" />
        <span className="truncate">{label}</span>
      </p>
      {failed ? (
        <p className="text-xs text-[#FF6B6B]">Could not load the audio.</p>
      ) : src ? (
        <audio controls preload="none" src={src} className="h-9 w-full" />
      ) : (
        <Loader2 size={14} className="animate-spin text-[#1ABC9C]" />
      )}
    </div>
  );
};

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
            {isAudio(attachment) ? (
              <AudioAttachment attachment={attachment} label={attachment.name || `Voice note ${index + 1}`} />
            ) : (
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
            )}
          </li>
        ))}
      </ul>
      {failed && <p className="mt-2 text-xs text-[#FF6B6B]">Could not open the attachment.</p>}
    </div>
  );
};

export default CaseAttachments;
