import { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { XCircle, AlertTriangle, ShieldAlert, CheckCircle, Lock, Eye, ClipboardList } from "lucide-react";
import { getKeyPartA, combineAndDecrypt } from "../services/keyVaultService";
import { logDisclosure } from "../services/disclosureAuditService";

// Brand colors
const NAVY = "#2D3E50";
const TEAL = "#00BCD4";
const CORAL = "#FF6B6B";

const STEPS = {
  CONFIRM: 0,
  KEY_INPUT: 1,
  RESULT: 2,
  SUCCESS: 3,
};

/**
 * DisclosureModal — four-step wizard for super_admin to decrypt an anonymous
 * reporter's identity under a valid legal order, using the split-key vault.
 *
 * Props:
 *   isOpen       - boolean
 *   onClose      - () => void
 *   request      - legalRequest document (with .id, .reportId, .legalJustification,
 *                  .companyId, .requestedBy, .courtOrderUrl)
 *   currentUser  - userData from AuthContext ({ id, displayName, role, companyId })
 */
const DisclosureModal = ({ isOpen, onClose, request, currentUser }) => {
  const [step, setStep] = useState(STEPS.CONFIRM);
  const [legalBasisConfirmed, setLegalBasisConfirmed] = useState(false);
  const [keyPartB, setKeyPartB] = useState("");
  const [decrypting, setDecrypting] = useState(false);
  const [disclosedIdentity, setDisclosedIdentity] = useState(null); // { displayName, email }
  const [auditId, setAuditId] = useState(null);
  const [error, setError] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("secure_portal");

  if (!isOpen || !request) return null;

  const resetAndClose = () => {
    setStep(STEPS.CONFIRM);
    setLegalBasisConfirmed(false);
    setKeyPartB("");
    setDecrypting(false);
    setDisclosedIdentity(null);
    setAuditId(null);
    setError("");
    setDeliveryMethod("secure_portal");
    onClose();
  };

  const handleDecrypt = async () => {
    if (!keyPartB.trim()) {
      setError("Please paste Key Part B from the DPO.");
      return;
    }
    if (keyPartB.trim().length !== 32) {
      setError("Key Part B must be exactly 32 hexadecimal characters.");
      return;
    }

    setDecrypting(true);
    setError("");

    try {
      // 1. Fetch the post to get the encryptedAuthorId
      const postRef = doc(db, "posts", request.reportId);
      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        setError("Post not found. Verify the Report ID on the legal request.");
        setDecrypting(false);
        return;
      }

      const postData = postSnap.data();

      if (!postData.isAnonymous || !postData.authorId) {
        setError("This post is not anonymous or has no encrypted author ID.");
        setDecrypting(false);
        return;
      }

      // 2. Fetch Key Part A from the vault
      const vaultData = await getKeyPartA(request.companyId);

      if (!vaultData) {
        setError("No key vault found for this company. Initialize it via the Key Vault Setup page.");
        setDecrypting(false);
        return;
      }

      // 3. Combine keys and decrypt
      const userId = combineAndDecrypt(
        postData.authorId,
        vaultData.keyPartA,
        keyPartB.trim()
      );

      if (!userId) {
        setError(
          "Decryption failed. Verify that Key Part B is correct and that the post was encrypted with this company's vault key."
        );
        setDecrypting(false);
        return;
      }

      // 4. Look up the user by decrypted ID — show displayName + email ONLY
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("User account no longer exists. Audit log will still be recorded.");
      }

      const userData = userSnap.exists() ? userSnap.data() : {};
      const identity = {
        displayName: userData.displayName || userData.username || "(unknown)",
        email: userData.email || "(no email on record)",
      };

      setDisclosedIdentity(identity);

      // 5. Log the disclosure — immutable audit record
      const result = await logDisclosure(
        request.id,
        request.reportId,
        request.companyId,
        currentUser.displayName || currentUser.username,
        currentUser.id || currentUser.uid,
        vaultData.dpoEmail,
        request.legalJustification,
        deliveryMethod
      );

      setAuditId(result.auditId);
      setStep(STEPS.RESULT);
    } catch (err) {
      console.error("Disclosure error:", err);
      setError(`Disclosure failed: ${err.message}`);
    } finally {
      setDecrypting(false);
    }
  };

  const handleConfirmAndProceed = () => {
    setStep(STEPS.RESULT);
  };

  // ─── Step 0: Confirm Legal Basis ───────────────────────────────────────────
  const renderStepConfirm = () => (
    <div className="space-y-5">
      {/* Permanent warning banner */}
      <div
        className="flex items-start gap-3 p-4 rounded-lg border"
        style={{ backgroundColor: "#FFF1F0", borderColor: CORAL }}
      >
        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: CORAL }} />
        <div>
          <p className="font-semibold text-sm" style={{ color: "#991B1B" }}>
            This action is permanent and fully audited.
          </p>
          <p className="text-xs mt-1 text-red-700">
            Once the identity is decrypted, an immutable audit record is created and
            cannot be removed. Proceed only if you have verified the legal basis.
          </p>
        </div>
      </div>

      {/* Request details */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3 text-sm">
        <h4 className="font-semibold text-gray-900">Request Details</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">Request ID</p>
            <p className="font-mono text-xs text-gray-800 break-all">{request.id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Report / Post ID</p>
            <p className="font-mono text-xs text-gray-800 break-all">{request.reportId}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Submitted By</p>
            <p className="font-medium text-gray-800">{request.requestedBy}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Company ID</p>
            <p className="font-mono text-xs text-gray-800">{request.companyId}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Legal Justification</p>
          <p className="text-xs text-gray-700 bg-white border border-gray-200 rounded p-2 max-h-28 overflow-y-auto">
            {request.legalJustification}
          </p>
        </div>
        {request.courtOrderUrl && (
          <button
            onClick={() => window.open(request.courtOrderUrl, "_blank")}
            className="text-xs font-medium underline"
            style={{ color: TEAL }}
          >
            View Court Order Document →
          </button>
        )}
      </div>

      {/* Delivery method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Delivery Method
        </label>
        <select
          value={deliveryMethod}
          onChange={(e) => setDeliveryMethod(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
          style={{ "--tw-ring-color": TEAL }}
        >
          <option value="secure_portal">Secure Portal</option>
          <option value="encrypted_email">Encrypted Email</option>
          <option value="physical_delivery">Physical Delivery</option>
          <option value="electronic_system">Court Electronic System</option>
        </select>
      </div>

      {/* Legal basis checkbox */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={legalBasisConfirmed}
          onChange={(e) => setLegalBasisConfirmed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded"
          style={{ accentColor: NAVY }}
        />
        <span className="text-sm text-gray-700">
          I confirm that a valid court order or legal mandate exists for this disclosure,
          that the legal basis has been independently verified, and I understand this
          action is irreversible and logged.
        </span>
      </label>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
        <button
          onClick={resetAndClose}
          className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={() => setStep(STEPS.KEY_INPUT)}
          disabled={!legalBasisConfirmed}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: NAVY }}
        >
          Continue →
        </button>
      </div>
    </div>
  );

  // ─── Step 1: Key Part B Input ───────────────────────────────────────────────
  const renderStepKeyInput = () => (
    <div className="space-y-5">
      <div
        className="flex items-start gap-3 p-4 rounded-lg border"
        style={{ backgroundColor: "#FFFBEB", borderColor: "#F59E0B" }}
      >
        <Lock className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">Two-key authorization required</p>
          <p className="text-xs">
            Key Part A has been retrieved from the secure vault. You must obtain
            Key Part B from the company's DPO ({request.companyId}) and paste it below.
            Neither part alone can decrypt the identity.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Key Part B{" "}
          <span className="text-xs font-normal text-gray-500">(32 hex characters, from DPO)</span>
        </label>
        <input
          type="text"
          value={keyPartB}
          onChange={(e) => setKeyPartB(e.target.value.trim())}
          placeholder="e.g. a3f7c1d9e2b4..."
          maxLength={32}
          className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ "--tw-ring-color": TEAL }}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-gray-500 mt-1">
          {keyPartB.length} / 32 characters
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between gap-3 pt-2 border-t border-gray-200">
        <button
          onClick={() => { setStep(STEPS.CONFIRM); setError(""); }}
          className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
        >
          ← Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={resetAndClose}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDecrypt}
            disabled={decrypting || keyPartB.trim().length !== 32}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: CORAL }}
          >
            <Eye className="w-4 h-4" />
            {decrypting ? "Decrypting..." : "Decrypt Identity"}
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Step 2: Show Result ────────────────────────────────────────────────────
  const renderStepResult = () => (
    <div className="space-y-5">
      <div
        className="flex items-start gap-3 p-4 rounded-lg border"
        style={{ backgroundColor: "#FFF1F0", borderColor: CORAL }}
      >
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: CORAL }} />
        <p className="text-sm font-semibold" style={{ color: "#991B1B" }}>
          Sensitive information — handle with care. This data is subject to legal
          confidentiality obligations.
        </p>
      </div>

      {/* Disclosed identity */}
      <div
        className="border-2 rounded-lg p-5"
        style={{ borderColor: NAVY }}
      >
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: NAVY }}>
          <CheckCircle className="w-4 h-4" style={{ color: TEAL }} />
          Disclosed Reporter Identity
        </h4>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500">Display Name</p>
            <p className="text-base font-semibold text-gray-900">
              {disclosedIdentity?.displayName}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Email Address</p>
            <p className="text-base font-semibold text-gray-900">
              {disclosedIdentity?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Audit reference */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <ClipboardList className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-green-900 mb-1">
              Audit record created
            </p>
            <p className="text-xs text-green-700">
              Audit ID:{" "}
              <span className="font-mono font-bold">{auditId}</span>
            </p>
            <p className="text-xs text-green-700 mt-1">
              This disclosure has been permanently logged. The record is immutable
              and includes the legal basis, delivery method, and the identities of
              both authorizing parties.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-200">
        <button
          onClick={resetAndClose}
          className="px-5 py-2 text-sm font-medium text-white rounded-lg transition"
          style={{ backgroundColor: NAVY }}
        >
          Done
        </button>
      </div>
    </div>
  );

  // ─── Step labels ────────────────────────────────────────────────────────────
  const stepLabels = [
    "Confirm Legal Basis",
    "Provide Key Part B",
    "Identity Disclosed",
  ];

  const currentStepIndex = Math.min(step, 2);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: NAVY }}
            >
              <Lock className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              Approve &amp; Disclose Identity
            </h2>
          </div>
          {step !== STEPS.RESULT && (
            <button
              onClick={resetAndClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <XCircle className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {stepLabels.map((label, idx) => (
              <div key={label} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor:
                        idx < currentStepIndex
                          ? TEAL
                          : idx === currentStepIndex
                          ? NAVY
                          : "#E5E7EB",
                      color: idx <= currentStepIndex ? "#fff" : "#9CA3AF",
                    }}
                  >
                    {idx < currentStepIndex ? "✓" : idx + 1}
                  </div>
                  <span
                    className="text-xs font-medium hidden sm:block"
                    style={{
                      color:
                        idx === currentStepIndex ? NAVY : idx < currentStepIndex ? TEAL : "#9CA3AF",
                    }}
                  >
                    {label}
                  </span>
                </div>
                {idx < stepLabels.length - 1 && (
                  <div
                    className="h-px flex-1 min-w-4"
                    style={{ backgroundColor: idx < currentStepIndex ? TEAL : "#E5E7EB" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 pb-6 pt-4">
          {step === STEPS.CONFIRM && renderStepConfirm()}
          {step === STEPS.KEY_INPUT && renderStepKeyInput()}
          {step === STEPS.RESULT && renderStepResult()}
        </div>
      </div>
    </div>
  );
};

export default DisclosureModal;
