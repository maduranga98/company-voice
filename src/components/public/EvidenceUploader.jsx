import { useRef, useState } from "react";
import { AlertTriangle, Camera, FileText, Loader2, Music, RotateCw, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";

const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const FileIcon = ({ type }) =>
  type.startsWith("audio/") ? (
    <Music className="h-5 w-5 text-[#2D3E50]" aria-hidden="true" />
  ) : (
    <FileText className="h-5 w-5 text-[#2D3E50]" aria-hidden="true" />
  );

const EvidenceUploader = ({ uploads, limits }) => {
  const { t } = useTranslation();
  const { items, problem, addFiles, remove, retry } = uploads;
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const cameraInput = useRef(null);
  const accept = limits.allowedMimeTypes.join(",");
  const full = items.length >= limits.maxFiles;

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const onPicked = (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  return (
    <section>
      <h2 className="mb-1 text-base font-semibold text-[#2D3E50]">
        {t("report.evidence.heading")}{" "}
        <span className="text-sm font-normal text-gray-400">({t("report.evidence.optional")})</span>
      </h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition ${
          dragging ? "border-[#1ABC9C] bg-[#1ABC9C]/10" : "border-gray-300 bg-white"
        } ${full ? "opacity-60" : ""}`}
      >
        <Upload className="mx-auto h-6 w-6 text-[#1ABC9C]" aria-hidden="true" />
        <p className="mt-2 text-sm text-gray-600">
          {t("report.evidence.drop")}{" "}
          <button
            type="button"
            disabled={full}
            onClick={() => fileInput.current?.click()}
            className="font-semibold text-[#1ABC9C] underline-offset-2 hover:underline disabled:no-underline"
          >
            {t("report.evidence.choose")}
          </button>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {t("report.evidence.hint", { maxFiles: limits.maxFiles, maxMB: limits.maxFileMB })}
        </p>
        <button
          type="button"
          disabled={full}
          onClick={() => cameraInput.current?.click()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-[#2D3E50] hover:border-[#1ABC9C] disabled:opacity-50 sm:hidden"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          {t("report.evidence.camera")}
        </button>
        <input ref={fileInput} type="file" multiple accept={accept} onChange={onPicked} className="hidden" />
        <input
          ref={cameraInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={onPicked}
          className="hidden"
        />
      </div>

      {problem && (
        <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-[#FF6B6B]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t(problem.key, problem.values)}
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <FileIcon type={item.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#2D3E50]">{item.name}</p>
                <p className="text-xs text-gray-400">
                  {formatSize(item.size)} ·{" "}
                  {item.status === "done" && t("report.evidence.ready")}
                  {(item.status === "uploading" || item.status === "queued") && t("report.evidence.uploading")}
                  {item.status === "error" && (
                    <span className="text-[#FF6B6B]">{t("report.evidence.uploadFailed")}</span>
                  )}
                </p>
                {(item.status === "uploading" || item.status === "queued") && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#1ABC9C] transition-all"
                      style={{ width: `${Math.round(item.progress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-[#1ABC9C]" aria-hidden="true" />}
              {item.status === "error" && (
                <button
                  type="button"
                  onClick={() => retry(item.id)}
                  aria-label={t("report.evidence.retry")}
                  className="rounded-lg p-1.5 text-[#2D3E50] hover:bg-gray-100"
                >
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={t("report.evidence.remove")}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#FF6B6B]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default EvidenceUploader;
