import { useCallback, useEffect, useRef, useState } from "react";
import { uploadEvidenceFile } from "../services/publicReportService";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Evidence uploads for the public report form. Files start uploading as soon as
 * they are added. Validation errors are returned as { key, values } for i18n.
 */
export const useEvidenceUploads = (uploadId, limits) => {
  const [items, setItems] = useState([]);
  const [problem, setProblem] = useState(null);
  const tasks = useRef(new Map());
  const filesById = useRef(new Map());

  const patch = useCallback((id, changes) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const start = useCallback(
    (id) => {
      const file = filesById.current.get(id);
      if (!file) return;
      patch(id, { status: "uploading", progress: 0 });
      const { promise, cancel } = uploadEvidenceFile(uploadId, file, (progress) => patch(id, { progress }));
      tasks.current.set(id, cancel);
      promise
        .then((path) => patch(id, { status: "done", progress: 1, path }))
        .catch(() => patch(id, { status: "error" }))
        .finally(() => tasks.current.delete(id));
    },
    [patch, uploadId]
  );

  const addFiles = useCallback(
    (fileList) => {
      if (!limits) return;
      setProblem(null);
      const maxBytes = limits.maxFileMB * 1024 * 1024;
      const incoming = Array.from(fileList);
      const accepted = [];
      let remaining = limits.maxFiles - items.length;

      for (const file of incoming) {
        if (remaining <= 0) {
          setProblem({ key: "report.evidence.tooMany", values: { max: limits.maxFiles } });
          break;
        }
        if (!limits.allowedMimeTypes.includes(file.type)) {
          setProblem({ key: "report.evidence.badType", values: { name: file.name } });
          continue;
        }
        if (file.size > maxBytes) {
          setProblem({ key: "report.evidence.tooLarge", values: { name: file.name, max: limits.maxFileMB } });
          continue;
        }
        const id = newId();
        filesById.current.set(id, file);
        accepted.push({ id, name: file.name, size: file.size, type: file.type, status: "queued", progress: 0, path: null });
        remaining--;
      }

      if (accepted.length === 0) return;
      setItems((current) => [...current, ...accepted]);
      accepted.forEach((item) => start(item.id));
    },
    [items.length, limits, start]
  );

  const remove = useCallback((id) => {
    tasks.current.get(id)?.();
    tasks.current.delete(id);
    filesById.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
    setProblem(null);
  }, []);

  const reset = useCallback(() => {
    tasks.current.forEach((cancel) => cancel());
    tasks.current.clear();
    filesById.current.clear();
    setItems([]);
    setProblem(null);
  }, []);

  useEffect(() => {
    const running = tasks.current;
    const files = filesById.current;
    return () => {
      running.forEach((cancel) => cancel());
      running.clear();
      files.clear();
    };
  }, []);

  return {
    items,
    problem,
    addFiles,
    remove,
    retry: start,
    reset,
    uploading: items.some((item) => item.status === "uploading" || item.status === "queued"),
    failed: items.some((item) => item.status === "error"),
  };
};
