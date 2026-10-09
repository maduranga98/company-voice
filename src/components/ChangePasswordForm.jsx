import { useState } from "react";
import { useTranslation } from "react-i18next";
import { changeOwnPassword } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";

/**
 * Changes the signed-in user's own password. The server revokes every session on success, so the
 * user is signed out and signs in again with the new password.
 */
const ChangePasswordForm = ({ required = false }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.next.length < 8 || form.next.length > 128) {
      setError("staff.password.tooShort");
      return;
    }
    if (form.next !== form.confirm) {
      setError("staff.password.mismatch");
      return;
    }
    setBusy(true);
    try {
      await changeOwnPassword(form.current, form.next);
      await logout();
    } catch (err) {
      setError(err?.code === "functions/permission-denied" ? "staff.password.wrongCurrent" : "staff.errors.generic");
      setBusy(false);
    }
  };

  const field = (name, label) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{t(label)}</span>
      <input
        type="password"
        value={form[name]}
        autoComplete={name === "current" ? "current-password" : "new-password"}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        required
        maxLength={128}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      {required && <p className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">{t("staff.password.required")}</p>}
      {field("current", "staff.password.current")}
      {field("next", "staff.password.new")}
      {field("confirm", "staff.password.confirm")}
      <p className="text-xs text-gray-500">{t("staff.password.signOutNote")}</p>
      {error && <p role="alert" className="text-sm text-red-600">{t(error)}</p>}
      <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
        {t("staff.password.submit")}
      </button>
    </form>
  );
};

export default ChangePasswordForm;
