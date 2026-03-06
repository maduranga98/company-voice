import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import SuperAdminNav from "../../components/SuperAdminNav";
import {
  initializeCompanyKeyVault,
  getAllKeyVaultStatuses,
  rotateKey,
} from "../../services/keyVaultService";

const KeyVaultManagement = () => {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState([]);
  const [vaultStatuses, setVaultStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // Initialize modal state
  const [showInitModal, setShowInitModal] = useState(false);
  const [initCompany, setInitCompany] = useState(null);
  const [dpoEmail, setDpoEmail] = useState("");
  const [initError, setInitError] = useState("");
  const [initSubmitting, setInitSubmitting] = useState(false);
  const [initKeyPartB, setInitKeyPartB] = useState(null);
  const [initCopied, setInitCopied] = useState(false);
  const [initConfirmed, setInitConfirmed] = useState(false);

  // Rotate modal state
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [rotateCompany, setRotateCompany] = useState(null);
  const [rotateError, setRotateError] = useState("");
  const [rotateSubmitting, setRotateSubmitting] = useState(false);
  const [rotateKeyPartB, setRotateKeyPartB] = useState(null);
  const [rotateCopied, setRotateCopied] = useState(false);
  const [rotateConfirmedDone, setRotateConfirmedDone] = useState(false);
  const [rotateAgreed, setRotateAgreed] = useState(false);

  useEffect(() => {
    if (userData?.role !== "super_admin") {
      navigate("/dashboard");
    }
  }, [userData, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setPageError("");
    try {
      const companiesSnap = await getDocs(collection(db, "companies"));
      const companiesData = companiesSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setCompanies(companiesData);

      const statuses = await getAllKeyVaultStatuses();
      const statusMap = {};
      statuses.forEach((s) => {
        statusMap[s.companyId] = s;
      });
      setVaultStatuses(statusMap);
    } catch (err) {
      console.error("Error fetching data:", err);
      setPageError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const refreshVaultStatuses = async () => {
    try {
      const statuses = await getAllKeyVaultStatuses();
      const statusMap = {};
      statuses.forEach((s) => {
        statusMap[s.companyId] = s;
      });
      setVaultStatuses(statusMap);
    } catch (err) {
      console.error("Error refreshing vault statuses:", err);
    }
  };

  // Stats
  const initializedCount = Object.keys(vaultStatuses).length;
  const uninitializedCount = Math.max(0, companies.length - initializedCount);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const rotatedThisMonth = Object.values(vaultStatuses).filter((s) => {
    if (!s.rotatedAt) return false;
    const d = s.rotatedAt.toDate ? s.rotatedAt.toDate() : new Date(s.rotatedAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  // ── Initialize Modal handlers ──────────────────────────────────────────────

  const openInitModal = (company) => {
    setInitCompany(company);
    setDpoEmail("");
    setInitError("");
    setInitKeyPartB(null);
    setInitCopied(false);
    setInitConfirmed(false);
    setShowInitModal(true);
  };

  const closeInitModal = () => {
    setShowInitModal(false);
    setInitCompany(null);
    setInitKeyPartB(null);
    setInitCopied(false);
    setInitConfirmed(false);
    setInitError("");
  };

  const handleInitialize = async () => {
    if (!initCompany || !dpoEmail.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dpoEmail.trim())) {
      setInitError("Please enter a valid email address.");
      return;
    }

    setInitSubmitting(true);
    setInitError("");
    try {
      const partB = await initializeCompanyKeyVault(
        initCompany.id,
        dpoEmail.trim(),
        userData?.uid || userData?.id
      );
      setInitKeyPartB(partB);
      await refreshVaultStatuses();
    } catch (err) {
      console.error("Error initializing vault:", err);
      setInitError(err.message || "Failed to initialize key vault.");
    } finally {
      setInitSubmitting(false);
    }
  };

  const handleInitDone = () => {
    closeInitModal();
  };

  // ── Rotate Modal handlers ──────────────────────────────────────────────────

  const openRotateModal = (company) => {
    setRotateCompany(company);
    setRotateError("");
    setRotateKeyPartB(null);
    setRotateCopied(false);
    setRotateConfirmedDone(false);
    setRotateAgreed(false);
    setShowRotateModal(true);
  };

  const closeRotateModal = () => {
    setShowRotateModal(false);
    setRotateCompany(null);
    setRotateKeyPartB(null);
    setRotateCopied(false);
    setRotateConfirmedDone(false);
    setRotateAgreed(false);
    setRotateError("");
  };

  const handleRotate = async () => {
    if (!rotateCompany) return;

    setRotateSubmitting(true);
    setRotateError("");
    try {
      const partB = await rotateKey(
        rotateCompany.id,
        userData?.uid || userData?.id
      );
      setRotateKeyPartB(partB);
      await refreshVaultStatuses();
    } catch (err) {
      console.error("Error rotating key:", err);
      setRotateError(err.message || "Failed to rotate key.");
    } finally {
      setRotateSubmitting(false);
    }
  };

  const handleRotateDone = () => {
    closeRotateModal();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getCompanyDisplayName = (company) =>
    company.companyName || company.name || company.id;

  // ── Key Part B display (shared by both modals) ─────────────────────────────

  const renderKeyPartBSection = ({ keyPartB, copied, onCopy, confirmed, onConfirm, dpoEmailDisplay }) => (
    <div className="mt-2">
      <p className="text-sm font-medium text-gray-700 mb-2">Key Part B</p>
      <div className="p-4 bg-gray-900 rounded-lg mb-3">
        <p className="font-mono text-green-400 text-sm break-all select-all">{keyPartB}</p>
      </div>
      <button
        onClick={onCopy}
        className="mb-4 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
      >
        {copied ? "Copied!" : "Copy to Clipboard"}
      </button>
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
        <p className="text-red-800 text-sm font-medium">
          ⚠ This is the only time Key Part B will be displayed. Copy it now and
          send to the DPO at{" "}
          <span className="font-bold">{dpoEmailDisplay}</span>. It cannot be
          recovered.
        </p>
      </div>
      <label className="flex items-start space-x-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm text-gray-700">
          I have copied Key Part B and will send it to the DPO
        </span>
      </label>
    </div>
  );

  // ── Initialize Modal ───────────────────────────────────────────────────────

  const renderInitModal = () => {
    if (!showInitModal || !initCompany) return null;

    const vaultStatus = vaultStatuses[initCompany.id];
    const dpoEmailDisplay = initKeyPartB
      ? vaultStatus?.dpoEmail || dpoEmail
      : dpoEmail;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Initialize Key Vault for {getCompanyDisplayName(initCompany)}
              </h2>
              <button
                onClick={closeInitModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!initKeyPartB ? (
              <>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-amber-800">
                      This action generates the encryption key pair. Key Part B will
                      be shown <strong>ONCE</strong> and must be sent to the
                      company's DPO immediately.
                    </p>
                  </div>
                </div>

                {initError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                    <p className="text-red-800 text-sm">{initError}</p>
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    DPO Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={dpoEmail}
                    onChange={(e) => setDpoEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="dpo@company.com"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={closeInitModal}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInitialize}
                    disabled={initSubmitting || !dpoEmail.trim()}
                    className="px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "#00BCD4" }}
                  >
                    {initSubmitting ? "Generating..." : "Generate Key Pair"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {renderKeyPartBSection({
                  keyPartB: initKeyPartB,
                  copied: initCopied,
                  onCopy: () => {
                    navigator.clipboard.writeText(initKeyPartB);
                    setInitCopied(true);
                  },
                  confirmed: initConfirmed,
                  onConfirm: setInitConfirmed,
                  dpoEmailDisplay,
                })}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleInitDone}
                    disabled={!initConfirmed}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Rotate Key Modal ───────────────────────────────────────────────────────

  const renderRotateModal = () => {
    if (!showRotateModal || !rotateCompany) return null;

    const vaultStatus = vaultStatuses[rotateCompany.id];
    const dpoEmailDisplay = vaultStatus?.dpoEmail || "";

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Rotate Encryption Key for {getCompanyDisplayName(rotateCompany)}
              </h2>
              <button
                onClick={closeRotateModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!rotateKeyPartB ? (
              <>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-amber-800">
                      This generates a new key pair. The old Key Part B will stop
                      working. Notify the DPO immediately with the new Key Part B.
                    </p>
                  </div>
                </div>

                {rotateError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                    <p className="text-red-800 text-sm">{rotateError}</p>
                  </div>
                )}

                <label className="flex items-start space-x-3 cursor-pointer mb-6">
                  <input
                    type="checkbox"
                    checked={rotateAgreed}
                    onChange={(e) => setRotateAgreed(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700">
                    I understand this will invalidate the existing Key Part B
                  </span>
                </label>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={closeRotateModal}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRotate}
                    disabled={rotateSubmitting || !rotateAgreed}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    {rotateSubmitting ? "Rotating..." : "Rotate Key"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {renderKeyPartBSection({
                  keyPartB: rotateKeyPartB,
                  copied: rotateCopied,
                  onCopy: () => {
                    navigator.clipboard.writeText(rotateKeyPartB);
                    setRotateCopied(true);
                  },
                  confirmed: rotateConfirmedDone,
                  onConfirm: setRotateConfirmedDone,
                  dpoEmailDisplay,
                })}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleRotateDone}
                    disabled={!rotateConfirmedDone}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 space-y-3 sm:space-y-0">
            <div className="flex flex-col space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Super Admin Panel
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-gray-700 truncate max-w-[150px] sm:max-w-none">
                {userData?.displayName || userData?.username}
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded whitespace-nowrap">
                SUPER ADMIN
              </span>
              <button
                onClick={handleLogout}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
        <SuperAdminNav />
      </header>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <svg
              className="w-8 h-8 text-teal-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <h1 className="text-3xl font-bold text-gray-900">
              Identity Key Vault
            </h1>
          </div>
          <p className="text-gray-600">
            Manage encryption keys for anonymous reporter identity protection.
            Each company requires a split-key pair before legal disclosure is
            possible.
          </p>
        </div>

        {/* Page Error */}
        {pageError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{pageError}</p>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-600 font-medium">
              Total Companies with Vault Initialized
            </p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {initializedCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Companies with an active key vault
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-600 font-medium">
              Total Companies without Vault
            </p>
            <p className="text-3xl font-bold text-red-600 mt-1">
              {uninitializedCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Companies not yet set up
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-600 font-medium">
              Keys Rotated This Month
            </p>
            <p className="text-3xl font-bold text-amber-600 mt-1">
              {rotatedThisMonth}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {now.toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Companies Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Company Key Vault Status
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="text-gray-600 mt-2">Loading companies...</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No companies found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Industry
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vault Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      DPO Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Key Version
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Initialized Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {companies.map((company) => {
                    const vault = vaultStatuses[company.id];
                    const isInitialized = !!vault;
                    const createdDate = vault?.createdAt?.toDate
                      ? vault.createdAt.toDate()
                      : vault?.createdAt
                      ? new Date(vault.createdAt)
                      : null;

                    return (
                      <tr key={company.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {getCompanyDisplayName(company)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {company.industry || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isInitialized ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                              Initialized
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                              Not Set Up
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {vault?.dpoEmail || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {vault?.keyVersion ? `v${vault.keyVersion}` : "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {createdDate
                              ? createdDate.toLocaleDateString()
                              : "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {!isInitialized ? (
                              <button
                                onClick={() => openInitModal(company)}
                                className="px-3 py-1.5 text-white text-sm font-medium rounded hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: "#00BCD4" }}
                              >
                                Initialize Vault
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => openRotateModal(company)}
                                  className="px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded hover:bg-amber-600 transition-colors"
                                >
                                  Rotate Key
                                </button>
                                <button
                                  onClick={() =>
                                    alert(
                                      `Vault Status for ${getCompanyDisplayName(company)}\n\n` +
                                        `DPO Email: ${vault.dpoEmail}\n` +
                                        `Key Version: v${vault.keyVersion}\n` +
                                        `Status: ${vault.status}\n` +
                                        `Initialized: ${createdDate ? createdDate.toLocaleString() : "—"}\n` +
                                        (vault.rotatedAt
                                          ? `Last Rotated: ${
                                              vault.rotatedAt.toDate
                                                ? vault.rotatedAt
                                                    .toDate()
                                                    .toLocaleString()
                                                : new Date(
                                                    vault.rotatedAt
                                                  ).toLocaleString()
                                            }`
                                          : "")
                                    )
                                  }
                                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors"
                                >
                                  View Status
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {renderInitModal()}
      {renderRotateModal()}
    </div>
  );
};

export default KeyVaultManagement;
