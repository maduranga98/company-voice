# STEP 6 notes: in-browser voice messages on the public report form

Branch: `claude/optimistic-brahmagupta-d9iwku`. Note: `STEP6_NOTES.md` already exists (the per-company
"check my case" toggle), so this file is `STEP6_VOICE_NOTES.md` to avoid overwriting it.

## 1. What was built

- **`src/components/public/VoiceRecorder.jsx`** (new). Idle -> requesting mic -> recording
  (live `m:ss / 2:00`, Stop, Cancel) -> preview (`<audio controls>`, Re-record, Attach). Attach calls
  the **same `uploads.addFiles([file])`** the file picker uses, so the note is just another row in
  the `EvidenceUploader` list (progress, retry, remove, 5-file / 10 MB caps all apply). No second
  upload path.
- **Rendered via `children`** of `EvidenceUploader` (one-line change) so the recorder sits directly
  under the drop zone, above the problem message and file list. `ReportPage.jsx` passes it in.
- **`CaseAttachments.jsx` (HR side)**: had **no audio branch**; every attachment was a button that
  opened a new tab. Added `AudioAttachment`: for `type` starting with `audio/`, resolves the download
  URL (staff-only Storage read, same as before) and shows an inline `<audio controls preload="none">`.
  Non-audio rows are unchanged.
- **i18n**: new `report.voiceNote.*` namespace (prompt, record, max, requesting, recording, stop, cancel,
  preview, reRecord, attach, denied, noMic, failed) right after `report.evidence` in all 5 locales.
  Non-English strings are my translations; worth a native pass, especially `si`.

## 2. Things the upload pipeline did NOT do for free (found by reading the server code)

- **Exact content type.** `storage.rules` and `submitPublicReport` compare `contentType` verbatim
  against `audio/webm` / `audio/mp4`. `MediaRecorder` blobs often report `audio/webm;codecs=opus`,
  which would be rejected. The recorder builds the Blob/File with the bare base type.
- **Magic-byte sniffing.** The server checks the first bytes (EBML `1A 45 DF A3` for webm, `ftyp` for
  mp4). Real recordings satisfy this (verified, see below).
- **Safari records only `audio/mp4`.** Recorder candidates are `audio/webm;codecs=opus`, `audio/webm`,
  `audio/mp4`, filtered by what the server allows and `MediaRecorder.isTypeSupported`, so Safari works
  without a backend change (`audio/mp4` was already allowed).
- **`File`, not bare `Blob`.** `addFiles` reads `file.name`, `file.type`, `file.size`; a Blob has no
  `name`, so the recording is wrapped in a `File` (`voice-note.webm` / `.m4a`).

## 3. Failure modes

- Permission denied / `SecurityError`: neutral message pointing to browser site settings or the file
  picker; the Record button stays usable (no dead end, grey icon, no alarm colour).
- No microphone, or other recorder failure: separate calm messages.
- No `MediaRecorder` / `getUserMedia` / usable mime type: component returns `null` (file picker only).
  Feature detection runs at render.
- Time cap enforced in code: an interval auto-stops the recorder at 120 s (copy only mirrors it).
- Cap vs. size: 32 kbps audio bitrate set explicitly; 120 s is about 0.5 MB, far under 10 MB. If a
  browser ignores the bitrate hint, `addFiles` still rejects oversize files with the normal message.
- Record button is disabled when the 5-file cap is reached. Mic tracks are released on stop, cancel
  and unmount; object URLs are revoked.
- `getUserMedia` needs HTTPS or `localhost`; plain-HTTP LAN testing will hit the "denied" message.

## 4. Verified

Headless Chromium (fake mic device) against a dev harness that mounts the real `VoiceRecorder`
with a stub `addFiles`:
- record 3.5 s -> timer showed `0:03 / 2:00` -> stop -> preview rendered -> Attach: `addFiles`
  received a real `File`, `type === "audio/webm"` (no codecs suffix), 8 KB, first bytes `1a 45 df a3`.
- Mic permission rejected -> calm message shown, Record button still visible.
- `MediaRecorder` removed -> component renders nothing.
- 120 s: recorder auto-stopped at the cap by itself; resulting blob was 486 KB (about 4.6% of the 10 MB limit).
- `eslint` clean on touched files; `vite build` passes.

## 5. NOT verified (needs a manual pass on a deployed/emulated project)

- Full end-to-end: record -> Attach -> Firebase upload -> submit -> HR opens the case and plays the
  note in `CaseAttachments`. No Firebase project/emulator was available here. The pieces are checked
  individually (valid bytes + exact type reach `addFiles`; server accepts `audio/webm`; HR component
  builds), but please run this once on staging, including an `involvesHR` case.
- Safari / iOS (mp4 path) and Firefox were not tested; only Chromium.
- Playback of `audio/webm` in Safari for HR users (Safari >= 17ish plays webm/opus; older may not).
  If HR uses Safari, consider server-side transcoding to mp4/m4a later.

## 6. Out of scope / follow-ups

- Voice replies in `CaseReplyThread` / `AnonymousThread`: text-only today, needs a new attachment
  pipeline (Storage paths, Firestore fields, HR playback). Natural next step.
- Speech-to-text transcription (separate paid dependency).
- `casePdfService` lists attachments by name only; voice notes appear as `evidence-N.webm`.
- HR-side audio hides behind the existing staff-only Storage read rule; no rule changes were needed.
