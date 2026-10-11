import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Mic, RotateCcw, Square, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export const MAX_SECONDS = 120;
// 32 kbps Opus/AAC is plenty for speech: 120 s is about 0.5 MB, far under the 10 MB cap.
const AUDIO_BITS_PER_SECOND = 32000;
// Preferred recorder types. Chrome/Firefox/Edge give webm; Safari only gives mp4.
const CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

const baseType = (mime) => mime.split(";")[0];
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Returns the first recorder type the browser can produce AND the server accepts, or null.
const pickMimeType = (allowed) => {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder.isTypeSupported !== "function") return null;
  return CANDIDATES.find((c) => allowed.includes(baseType(c)) && MediaRecorder.isTypeSupported(c)) || null;
};

const errorKey = (error) => {
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") return "report.voiceNote.denied";
  if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") return "report.voiceNote.noMic";
  return "report.voiceNote.failed";
};

/**
 * Records a voice message and hands it to the same `uploads.addFiles` the file picker uses.
 * Renders nothing when the browser cannot record, so the form falls back to file picking.
 */
const VoiceRecorder = ({ uploads, limits }) => {
  const { t } = useTranslation();
  const mimeType = pickMimeType(limits.allowedMimeTypes);
  const full = uploads.items.length >= limits.maxFiles;

  const [phase, setPhase] = useState("idle"); // idle | requesting | recording | preview
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [recording, setRecording] = useState(null); // { file, url }

  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const discard = useRef(false);

  const release = useCallback(() => {
    clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const clearRecording = useCallback(() => {
    setRecording((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  useEffect(
    () => () => {
      discard.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    },
    [release]
  );
  useEffect(() => () => recording && URL.revokeObjectURL(recording.url), [recording]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const cancel = () => {
    discard.current = true;
    stop();
  };

  const start = async () => {
    setError(null);
    clearRecording();
    setPhase("requesting");
    let media;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError(errorKey(e));
      setPhase("idle");
      return;
    }

    try {
      const chunks = [];
      const rec = new MediaRecorder(media, { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
      stream.current = media;
      recorder.current = rec;
      discard.current = false;

      rec.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      rec.onerror = () => {
        discard.current = true;
        setError("report.voiceNote.failed");
        if (rec.state === "recording") rec.stop();
      };
      rec.onstop = () => {
        release();
        if (discard.current || chunks.length === 0) {
          setPhase("idle");
          return;
        }
        // The type must be exactly the allowed base type (no ";codecs=..."): Storage rules
        // and the submit function both compare it verbatim.
        const type = baseType(mimeType);
        const blob = new Blob(chunks, { type });
        const file = new File([blob], `voice-note.${type === "audio/mp4" ? "m4a" : "webm"}`, { type });
        setRecording({ file, url: URL.createObjectURL(blob) });
        setPhase("preview");
      };

      rec.start(1000);
      const startedAt = Date.now();
      setSeconds(0);
      setPhase("recording");
      // Time cap enforced here, not just in the copy.
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(Math.min(elapsed, MAX_SECONDS));
        if (elapsed >= MAX_SECONDS) stop();
      }, 250);
    } catch {
      media.getTracks().forEach((track) => track.stop());
      setError("report.voiceNote.failed");
      setPhase("idle");
    }
  };

  const attach = () => {
    if (!recording) return;
    uploads.addFiles([recording.file]);
    clearRecording();
    setPhase("idle");
  };

  const reRecord = () => {
    clearRecording();
    setPhase("idle");
    start();
  };

  if (!mimeType) return null;

  return (
    <div className="mt-3 rounded-2xl border-2 border-dashed border-gray-300 bg-background-white p-5 text-center">
      {phase === "idle" && (
        <>
          <Mic className="mx-auto h-6 w-6 text-[#1ABC9C]" aria-hidden="true" />
          <p className="mt-2 text-sm text-gray-600">{t("report.voiceNote.prompt")}</p>
          <button
            type="button"
            disabled={full}
            onClick={start}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-[#2D3E50] hover:border-[#1ABC9C] disabled:opacity-50"
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
            {t("report.voiceNote.record")}
          </button>
          <p className="mt-2 text-xs text-gray-400">{t("report.voiceNote.max", { time: clock(MAX_SECONDS) })}</p>
        </>
      )}

      {phase === "requesting" && (
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin text-[#1ABC9C]" aria-hidden="true" />
          {t("report.voiceNote.requesting")}
        </p>
      )}

      {phase === "recording" && (
        <>
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-[#2D3E50]">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#FF6B6B]" aria-hidden="true" />
            {t("report.voiceNote.recording")}
          </p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-[#2D3E50]" aria-live="off">
            {clock(seconds)}
            <span className="text-sm text-gray-400"> / {clock(MAX_SECONDS)}</span>
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D3E50] px-4 py-2 text-sm font-semibold text-white hover:bg-[#243242]"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              {t("report.voiceNote.stop")}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 hover:border-gray-300"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t("report.voiceNote.cancel")}
            </button>
          </div>
        </>
      )}

      {phase === "preview" && recording && (
        <>
          <p className="text-sm font-medium text-[#2D3E50]">{t("report.voiceNote.preview")}</p>
          <audio controls src={recording.url} className="mx-auto mt-3 w-full max-w-sm" />
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={reRecord}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-[#2D3E50] hover:border-[#1ABC9C]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t("report.voiceNote.reRecord")}
            </button>
            <button
              type="button"
              onClick={attach}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1ABC9C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17a589]"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {t("report.voiceNote.attach")}
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-start justify-center gap-2 text-left text-sm text-gray-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          {t(error)}
        </p>
      )}
    </div>
  );
};

export default VoiceRecorder;
