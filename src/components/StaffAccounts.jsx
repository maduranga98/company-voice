import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createStaffUser, resetStaffPassword } from "../services/userAdminService";

const errorKey = (error) => {
  switch (error?.code) {
    case "functions/already-exists":
      return "staff.errors.usernameTaken";
    case "functions/invalid-argument":
      return "staff.errors.invalid";
    case "functions/permission-denied":
      return "staff.errors.forbidden";
    default:
      return "staff.errors.generic";
  }
};

const Modal = ({ title, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  </div>
);

/** Shown once after a temporary password is generated; the password is never stored client-side. */
const TemporaryPassword = ({ username, password, onClose }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal title={t("staff.tempTitle")}>
      <p className="mt-2 text-sm text-gray-600">{t("staff.tempBody")}</p>
      <p className="mt-4 text-xs text-gray-500">{t("staff.username")}: <span className="font-mono">{username}</span></p>
      <p className="mt-2 select-all break-all rounded-lg bg-gray-50 px-4 py-3 font-mono text-lg text-gray-900">{password}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={copy} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          {copied ? t("staff.copied") : t("staff.copy")}
        </button>
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          {t("staff.close")}
        </button>
      </div>
    </Modal>
  );
};

export const AddStaffButton = ({ onCreated }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const close = () => {
    setOpen(false);
    setForm({ username: "", displayName: "", email: "", password: "" });
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await createStaffUser({ ...form, password: form.password || undefined });
      if (result.temporaryPassword) {
        setCreated({ username: result.username, password: result.temporaryPassword });
      }
      close();
      onCreated?.();
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (name, type = "text", extra = {}) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{t(`staff.${name}`)}</span>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
        {...extra}
      />
    </label>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        {t("staff.addButton")}
      </button>

      {open && (
        <Modal title={t("staff.addTitle")}>
          <form onSubmit={submit} className="mt-4 space-y-3">
            {field("username", "text", { required: true, autoComplete: "off", maxLength: 64 })}
            {field("displayName", "text", { required: true, maxLength: 100 })}
            {field("email", "email", { maxLength: 200 })}
            {field("password", "password", { autoComplete: "new-password", maxLength: 128 })}
            <p className="text-xs text-gray-500">{t("staff.passwordHint")}</p>
            {error && <p role="alert" className="text-sm text-red-600">{t(error)}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={close} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                {t("staff.cancel")}
              </button>
              <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {busy ? t("staff.creating") : t("staff.create")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {created && <TemporaryPassword {...created} onClose={() => setCreated(null)} />}
    </>
  );
};

export const ResetPasswordButton = ({ member, className }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [temp, setTemp] = useState(null);

  const reset = async () => {
    if (!confirm(t("staff.resetConfirm", { name: member.displayName || member.username }))) return;
    setBusy(true);
    setError("");
    try {
      const result = await resetStaffPassword(member.id);
      setTemp({ username: member.username, password: result.temporaryPassword });
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={reset} disabled={busy} className={className} title={error ? t(error) : undefined}>
        {t("staff.resetButton")}
      </button>
      {temp && <TemporaryPassword {...temp} onClose={() => setTemp(null)} />}
    </>
  );
};
