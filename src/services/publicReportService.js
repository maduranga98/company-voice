import { httpsCallable } from "firebase/functions";
import { ref, uploadBytesResumable } from "firebase/storage";
import { functions, storage } from "../config/firebase";

// Public (no-login) report line. Nothing here reads or stores reporter identity.

const randomToken = (bytes = 16) => {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
};

// 32 hex chars: matches the server's token pattern for upload folders and idempotency.
export const createReportToken = () => randomToken(16);

export const fetchReportConfig = async (slug) => {
  const response = await httpsCallable(functions, "getPublicReportConfig")({ slug });
  return response.data;
};

export const submitReport = async (payload) => {
  const response = await httpsCallable(functions, "submitPublicReport")(payload);
  return response.data;
};

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
};

/**
 * Upload one evidence file to the pending folder. The original file name is never
 * sent; the server replaces names anyway.
 * @returns {{ promise: Promise<string>, cancel: () => void }} promise resolves to the storage path
 */
export const uploadEvidenceFile = (uploadId, file, onProgress) => {
  const extension = EXTENSIONS[file.type] || "bin";
  const path = `public-reports/pending/${uploadId}/${randomToken(8)}.${extension}`;
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });

  const promise = new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes),
      reject,
      () => resolve(path)
    );
  });

  return { promise, cancel: () => task.cancel() };
};

// Maps callable errors to report.errors.* translation keys.
export const submitErrorKey = (error) => {
  switch (error?.code) {
    case "functions/not-found":
      return "report.errors.inactive";
    case "functions/failed-precondition":
      return error.message === "Attachment missing."
        ? "report.errors.attachmentsMissing"
        : "report.errors.verification";
    case "functions/invalid-argument":
      return "report.errors.invalidInput";
    case "functions/resource-exhausted":
      return "report.errors.rateLimited";
    case "functions/already-exists":
      return "report.errors.duplicate";
    case "functions/unavailable":
    case "functions/deadline-exceeded":
      return "report.errors.network";
    default:
      return "report.errors.generic";
  }
};
