import { useState } from "react";
import { Shield, Copy, Check, AlertTriangle, KeyRound } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { initializeCompanyKeyVault, rotateKey } from "../services/keyVaultService";

// Brand colors
const NAVY = "#2D3E50";
const TEAL = "#00BCD4";
const CORAL = "#FF6B6B";

/**
 * KeyVaultSetup — super admin component for initializing or rotating the
 * split-key identity vault for a company during onboarding.
 *
 * Props:
 *   companyId         - (optional) Override company ID; defaults to currentUser.companyId
 *   onVaultInitialized - (optional) Callback called after successful init/rotate
 */
const KeyVaultSetup = ({ companyId: propCompanyId, onVaultInitialized }) => {
  const { userData } = useAuth();

  const companyId = propCompanyId || userData?.companyId || "";

  const [dpoEmail, setDpoEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [keyPartB, setKeyPartB] = useState(null);
  const [keyVersion, setKeyVersion] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("init"); // "init" | "rotate"
  const [rotateConfirmed, setRotateConfirmed] = useState(false);

  const handleInitialize = async (e) => {
    e.preventDefault();
    setError("");

    if (!companyId.trim()) {
      setError("Company ID is required.");
      return;
    }
    if (!dpoEmail.trim() || !dpoEmail.includes("@")) {
      setError("A valid DPO email address is required.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await initializeCompanyKeyVault(companyId.trim(), dpoEmail.trim());

      if (result.existed) {
        setError(
          "A key vault already exists for this company. Use the Key Rotation tab to generate a new key pair."
        );
        setSubmitting(false);
        return;
      }

      setKeyPartB(result.keyPartB);
      setKeyVersion(1);
      if (onVaultInitialized) onVaultInitialized({ companyId, keyVersion: 1 });
    } catch (err) {
      console.error("Error initializing vault:", err);
      setError(`Initialization failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRotate = async (e) => {
    e.preventDefault();
    setError("");

    if (!rotateConfirmed) {
      setError("You must confirm the consequences of key rotation before proceeding.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await rotateKey(companyId.trim());
      setKeyPartB(result.keyPartB);
      setKeyVersion(result.keyVersion);
      setRotateConfirmed(false);
      if (onVaultInitialized) onVaultInitialized({ companyId, keyVersion: result.keyVersion });
    } catch (err) {
      console.error("Error rotating key:", err);
      setError(`Key rotation failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!keyPartB) return;
    try {
      await navigator.clipboard.writeText(keyPartB);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers that block clipboard
      const el = document.createElement("textarea");
      el.value = keyPartB;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // ─── Key Part B reveal panel ─────────────────────────────────────────────
  if (keyPartB) {
    return (
      <div className="max-w-lg mx-auto">
        <div
          className="border-2 rounded-xl overflow-hidden"
          style={{ borderColor: CORAL }}
        >
          {/* Warning header */}
          <div
            className="px-5 py-4 flex items-center gap-3"
            style={{ backgroundColor: CORAL }}
          >
            <AlertTriangle className="w-6 h-6 text-white flex-shrink-0" />
            <div>
              <p className="text-white font-bold text-sm">
                One-time key — will not be shown again
              </p>
              <p className="text-red-100 text-xs mt-0.5">
                Send Key Part B to the DPO immediately via a secure channel.
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4 bg-white">
            {keyVersion && (
              <p className="text-xs text-gray-500">
                Key Version: <span className="font-bold text-gray-700">v{keyVersion}</span>
                &nbsp;·&nbsp;Company: <span className="font-mono text-gray-700">{companyId}</span>
              </p>
            )}

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Key Part B</p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 px-3 py-2.5 text-sm font-mono rounded-lg border border-gray-300 bg-gray-50 break-all select-all"
                  style={{ color: NAVY }}
                >
                  {keyPartB}
                </code>
                <button
                  onClick={handleCopy}
                  title="Copy to clipboard"
                  className="flex-shrink-0 p-2 rounded-lg border transition"
                  style={{
                    borderColor: copied ? TEAL : "#D1D5DB",
                    backgroundColor: copied ? "#E0F7FA" : "#F9FAFB",
                    color: copied ? TEAL : "#6B7280",
                  }}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {keyPartB.length} characters · Click the code block to select all
              </p>
            </div>

            <div
              className="text-xs rounded-lg p-3 space-y-1"
              style={{ backgroundColor: "#FFF8E1", color: "#92400E" }}
            >
              <p className="font-semibold">Next steps:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Copy Key Part B using the button above.</li>
                <li>Transmit it to the DPO via encrypted email or in-person handoff.</li>
                <li>Instruct the DPO to store it securely (password manager / HSM).</li>
                <li>Close this window — the key will NOT be displayed again.</li>
              </ol>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={() => {
                  setKeyPartB(null);
                  setKeyVersion(null);
                  setDpoEmail("");
                }}
                className="text-sm font-medium underline"
                style={{ color: NAVY }}
              >
                Set up another company vault →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Setup / Rotate form ──────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ backgroundColor: NAVY }}
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">Split-Key Identity Vault</h2>
            <p className="text-blue-200 text-xs">Super Admin · Company Onboarding</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-200">
          {["init", "rotate"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className="flex-1 py-2.5 text-sm font-medium transition"
              style={{
                color: mode === m ? NAVY : "#6B7280",
                borderBottom: mode === m ? `2px solid ${NAVY}` : "2px solid transparent",
                backgroundColor: mode === m ? "#F8FAFF" : "transparent",
              }}
            >
              {m === "init" ? "Initialize Vault" : "Rotate Key"}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {/* Info banner */}
          <div
            className="flex items-start gap-2 p-3 rounded-lg border text-xs"
            style={{ backgroundColor: "#E0F7FA", borderColor: TEAL, color: "#00696F" }}
          >
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {mode === "init" ? (
              <p>
                Generates a 64-character AES key split into two 32-character halves.
                Part A is stored securely in Firestore. Part B must be delivered to
                the company DPO — it is shown only once and never stored.
              </p>
            ) : (
              <p>
                Generates a new key pair for this company. The previous Part A is
                replaced in Firestore. Part B is shown once for DPO delivery.
                <strong className="block mt-1 text-amber-700">
                  Warning: existing encrypted posts will require the old key. Only rotate
                  if the current key is compromised.
                </strong>
              </p>
            )}
          </div>

          {/* Company ID (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company ID
            </label>
            <input
              type="text"
              value={companyId}
              readOnly
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 font-mono text-gray-600 cursor-not-allowed"
            />
          </div>

          {/* DPO email (init only) */}
          {mode === "init" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                DPO Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={dpoEmail}
                onChange={(e) => setDpoEmail(e.target.value)}
                placeholder="dpo@company.com"
                disabled={submitting}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
                style={{ "--tw-ring-color": TEAL }}
              />
            </div>
          )}

          {/* Rotate confirmation */}
          {mode === "rotate" && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rotateConfirmed}
                onChange={(e) => setRotateConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4"
                style={{ accentColor: CORAL }}
              />
              <span className="text-sm text-gray-700">
                I understand that rotating the key will make previously encrypted
                anonymous posts un-decryptable with the new key pair. This action is
                irreversible.
              </span>
            </label>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={mode === "init" ? handleInitialize : handleRotate}
            disabled={
              submitting ||
              !companyId.trim() ||
              (mode === "init" && !dpoEmail.trim()) ||
              (mode === "rotate" && !rotateConfirmed)
            }
            className="w-full py-2.5 text-sm font-semibold text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: mode === "rotate" ? CORAL : NAVY }}
          >
            {submitting
              ? mode === "init"
                ? "Initializing..."
                : "Rotating..."
              : mode === "init"
              ? "Initialize Key Vault"
              : "Rotate Key Pair"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyVaultSetup;
