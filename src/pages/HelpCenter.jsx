import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import HelpPanel from "../components/help/HelpPanel";
import { useAuth } from "../contexts/AuthContext";
import useGuidanceContent from "../hooks/useGuidanceContent";

const HelpCenter = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const {
    ROLE_DEFINITIONS,
    POST_STATUS_GUIDANCE,
    PRIORITY_GUIDANCE,
    TAG_SYSTEM_GUIDANCE,
    DEPARTMENT_GUIDANCE,
    MEMBER_MANAGEMENT_GUIDANCE,
    TEMPLATE_GUIDANCE,
    ANALYTICS_GUIDANCE,
    MODERATION_GUIDANCE,
    POST_CREATION_GUIDANCE,
    QR_CODE_GUIDANCE,
    ASSIGNED_TO_ME_GUIDANCE,
  } = useGuidanceContent();

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItemId, setExpandedItemId] = useState(null);

  const userRole = userData?.role || "employee";

  const isAdminRole = ["super_admin", "company_admin", "hr"].includes(userRole);

  // ── renderContent (kept exactly from original) ──────────────────────────
  const renderContent = (contentId) => {
    const getVisibleRoles = () => {
      const roleHierarchy = {
        super_admin: ["super_admin", "company_admin", "hr", "employee"],
        company_admin: ["company_admin", "hr", "employee"],
        hr: ["hr", "employee"],
        employee: ["employee"],
      };
      return roleHierarchy[userRole] || ["employee"];
    };

    switch (contentId) {
      case "role-definitions": {
        const visibleRoles = getVisibleRoles();
        const filteredRoles = Object.entries(ROLE_DEFINITIONS).filter(([roleKey]) =>
          visibleRoles.includes(roleKey)
        );
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{t("help.roles.description")}</p>
            {filteredRoles.map(([roleKey, role]) => (
              <div key={roleKey} className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{role.icon}</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">{role.name}</h4>
                    <p className="text-xs text-gray-600">{role.description}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h5 className="text-xs font-semibold text-gray-700 mb-1.5">Key Responsibilities:</h5>
                    <ul className="space-y-1">
                      {role.responsibilities.map((resp, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">•</span>
                          <span>{resp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {role.features && role.features.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-gray-700 mb-1.5">Available Features:</h5>
                      <div className="grid grid-cols-1 gap-1.5">
                        {role.features.map((feature, idx) => (
                          <div key={idx} className="bg-white rounded-lg p-2 border border-blue-100 flex items-start gap-2">
                            <span className="text-blue-500 text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                            <div>
                              <div className="text-xs font-semibold text-gray-800">{feature.name}</div>
                              <div className="text-[11px] text-gray-500">{feature.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={() => navigate("/help/roles")}
              className="w-full py-2.5 border-2 border-blue-300 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-50 hover:border-blue-400 active:bg-blue-100 transition-colors"
            >
              {t("help.roles.viewFullMatrix")}
            </button>
          </div>
        );
      }

      case "post-status":
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{POST_STATUS_GUIDANCE.description}</p>
            <div className="space-y-3">
              {Object.entries(POST_STATUS_GUIDANCE.statuses).map(([key, status]) => (
                <div key={key} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{status.icon}</span>
                    <h4 className="text-sm font-semibold text-gray-800">{status.label}</h4>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{status.description}</p>
                  <p className="text-[11px] text-gray-400">
                    <strong>{t("help.common.whenToUse")}:</strong> {status.whenToUse}
                  </p>
                </div>
              ))}
            </div>
            <HelpPanel title={t("guidance.ui.bestPractices")} variant="info" defaultExpanded={false}>
              <ul className="space-y-2">
                {POST_STATUS_GUIDANCE.bestPractices.map((practice, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="text-blue-500 mt-0.5">✓</span>
                    <span>{practice}</span>
                  </li>
                ))}
              </ul>
            </HelpPanel>
          </div>
        );

      case "priority":
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{PRIORITY_GUIDANCE.description}</p>
            {Object.entries(PRIORITY_GUIDANCE.levels).map(([key, level]) => (
              <div key={key} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{level.icon}</span>
                  <h4 className="text-sm font-semibold text-gray-800">{level.label}</h4>
                </div>
                <p className="text-xs text-gray-600 mb-2">{level.description}</p>
                <ul className="space-y-1">
                  {level.criteria.map((c, i) => (
                    <li key={i} className="text-[11px] text-gray-500 flex items-start gap-1">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );

      case "post-creation":
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{POST_CREATION_GUIDANCE.description}</p>
            {Object.entries(POST_CREATION_GUIDANCE.postTypes).map(([key, type]) => (
              <div key={key} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{type.icon}</span>
                  <h4 className="text-sm font-semibold text-gray-800">{type.label}</h4>
                </div>
                <p className="text-xs text-gray-600 mb-1">{type.description}</p>
                <p className="text-[11px] text-gray-400 mb-2">
                  <strong>{t("help.common.whenToUse")}:</strong> {type.whenToUse}
                </p>
                <ul className="space-y-1">
                  {type.tips.map((tip, i) => (
                    <li key={i} className="text-[11px] text-gray-500 flex items-start gap-1">
                      <span className="text-blue-400">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">{t("guidance.ui.privacySettings")}</h4>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(POST_CREATION_GUIDANCE.privacySettings).map(([key, privacy]) => (
                  <div key={key} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-start gap-2">
                    <span className="text-lg">{privacy.icon}</span>
                    <div>
                      <div className="text-xs font-semibold text-gray-800">{privacy.label}</div>
                      <div className="text-[11px] text-gray-500">{privacy.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "assigned-to-me":
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{ASSIGNED_TO_ME_GUIDANCE.description}</p>
            <HelpPanel title={t("guidance.ui.howItWorks")} variant="info" defaultExpanded={true}>
              <ul className="space-y-2">
                {ASSIGNED_TO_ME_GUIDANCE.howItWorks.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </HelpPanel>
            <div className="space-y-2">
              {ASSIGNED_TO_ME_GUIDANCE.whatToExpect.map((item, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">→</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "member-management":
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{MEMBER_MANAGEMENT_GUIDANCE.description}</p>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(MEMBER_MANAGEMENT_GUIDANCE.memberStatuses).map(([key, status]) => (
                <div key={key} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-2xl">{status.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{status.label}</div>
                    <div className="text-xs text-gray-500">{status.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "templates":
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{TEMPLATE_GUIDANCE.description}</p>
            <HelpPanel title={t("guidance.ui.howToCreate")} variant="info" defaultExpanded={true}>
              <ol className="space-y-2">
                {TEMPLATE_GUIDANCE.howToCreate.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="font-semibold text-blue-500 flex-shrink-0">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </HelpPanel>
          </div>
        );

      case "analytics":
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{ANALYTICS_GUIDANCE.description}</p>
            <div className="space-y-3">
              {Object.entries(ANALYTICS_GUIDANCE.keyMetrics).map(([key, metric]) => (
                <div key={key} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="text-sm font-semibold text-gray-800 mb-1">{metric.label}</div>
                  <div className="text-xs text-gray-600 mb-1">{metric.description}</div>
                  <div className="text-[11px] text-gray-400">
                    <strong>{t("help.common.useCase")}:</strong> {metric.useCase}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "moderation":
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{MODERATION_GUIDANCE.description}</p>
            <div className="space-y-2">
              {Object.entries(MODERATION_GUIDANCE.reportStatuses).map(([key, status]) => (
                <div key={key} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-xl">{status.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{status.label}</div>
                    <div className="text-xs text-gray-500">{status.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "qr-code":
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{QR_CODE_GUIDANCE.description}</p>
            <HelpPanel title={t("guidance.ui.howItWorks")} variant="info" defaultExpanded={true}>
              <ol className="space-y-2">
                {QR_CODE_GUIDANCE.howItWorks.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="font-semibold text-blue-500 flex-shrink-0">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </HelpPanel>
          </div>
        );

      case "departments":
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{DEPARTMENT_GUIDANCE.description}</p>
            <HelpPanel title={t("guidance.ui.howToCreateDepts")} variant="info" defaultExpanded={true}>
              <ol className="space-y-2">
                {DEPARTMENT_GUIDANCE.howToCreate.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="font-semibold text-blue-500 flex-shrink-0">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </HelpPanel>
          </div>
        );

      case "tags":
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">{TAG_SYSTEM_GUIDANCE.description}</p>
            <div className="space-y-2">
              {Object.entries(TAG_SYSTEM_GUIDANCE.tags).map(([key, tag]) => (
                <div key={key} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{tag.icon}</span>
                    <div className="text-sm font-semibold text-gray-800">{tag.label}</div>
                  </div>
                  <div className="text-xs text-gray-600">{tag.description}</div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <p className="text-sm text-gray-500 py-4">{t("guidance.ui.selectTopic")}</p>
        );
    }
  };
  // ── end renderContent ───────────────────────────────────────────────────

  // Section definitions for mobile layout
  const allSections = useMemo(
    () => [
      {
        id: "getting-started",
        label: t("help.sections.gettingStarted", "Getting started"),
        items: [
          {
            id: "roles",
            title: t("help.topics.rolesPermissions", "Roles & permissions"),
            sub: t("help.topics.rolesPermissionsSub", "Who can do what"),
            contentId: "role-definitions",
            iconBg: "bg-blue-100",
            iconStroke: "#2563eb",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            ),
          },
          ...(isAdminRole
            ? [{
                id: "role-features",
                title: t("help.topics.roleFeatures", "Role-based features"),
                sub: t("help.topics.roleFeaturesSub", "What your role can access"),
                contentId: "role-definitions",
                iconBg: "bg-purple-100",
                iconStroke: "#7c3aed",
                icon: (stroke) => (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                ),
              }]
            : []),
          {
            id: "anonymity",
            title: t("help.topics.anonymityPrivacy", "Anonymity & privacy"),
            sub: t("help.topics.anonymityPrivacySub", "How we protect your identity"),
            contentId: "post-creation",
            iconBg: "bg-green-100",
            iconStroke: "#16a34a",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            ),
          },
          {
            id: "navigate",
            title: t("help.topics.navigation", "How to navigate"),
            sub: t("help.topics.navigationSub", "Getting around the app"),
            contentId: "role-definitions",
            iconBg: "bg-gray-100",
            iconStroke: "#6b7280",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            ),
          },
        ],
      },
      {
        id: "walls",
        label: t("help.sections.theWalls", "The 3 walls"),
        items: [
          {
            id: "creative-wall",
            title: t("help.topics.creativeWall", "Creative Wall"),
            sub: t("help.topics.creativeWallSub", "Share ideas and innovations"),
            contentId: "post-creation",
            iconBg: "bg-purple-100",
            iconStroke: "#7c3aed",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            ),
          },
          {
            id: "problems-wall",
            title: t("help.topics.problemsWall", "Problems Wall"),
            sub: t("help.topics.problemsWallSub", "Report workplace issues"),
            contentId: isAdminRole ? "post-status" : "post-creation",
            iconBg: "bg-red-100",
            iconStroke: "#dc2626",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ),
          },
          {
            id: "discussions-wall",
            title: t("help.topics.discussionsWall", "Discussions Wall"),
            sub: t("help.topics.discussionsWallSub", "Collaborate with your team"),
            contentId: "post-creation",
            iconBg: "bg-blue-100",
            iconStroke: "#2563eb",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            ),
          },
        ],
      },
      {
        id: "posting",
        label: t("help.sections.postingPrivacy", "Posting & privacy"),
        items: [
          {
            id: "create-post",
            title: t("help.topics.creatingPosts", "How to create a post"),
            sub: t("help.topics.creatingPostsSub", "Step-by-step guide"),
            contentId: "post-creation",
            iconBg: "bg-teal-100",
            iconStroke: "#0d9488",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            ),
          },
          {
            id: "anonymous-posting",
            title: t("help.topics.anonymousPosting", "Anonymous posting"),
            sub: t("help.topics.anonymousPostingSub", "Post without revealing identity"),
            contentId: "post-creation",
            iconBg: "bg-green-100",
            iconStroke: "#16a34a",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ),
          },
          ...(isAdminRole
            ? [{
                id: "post-status",
                title: t("help.topics.postStatus", "Post status explained"),
                sub: t("help.topics.postStatusSub", "Track resolution progress"),
                contentId: "post-status",
                iconBg: "bg-amber-100",
                iconStroke: "#d97706",
                icon: (stroke) => (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ),
              }]
            : []),
        ],
      },
      {
        id: "compliance",
        label: t("help.sections.messagesCompliance", "Messages & compliance"),
        items: [
          {
            id: "hr-messages",
            title: t("help.topics.hrMessages", "Private HR messages"),
            sub: t("help.topics.hrMessagesSub", "Secure anonymous conversations"),
            contentId: "assigned-to-me",
            iconBg: "bg-teal-100",
            iconStroke: "#0d9488",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            ),
          },
          {
            id: "policy-lib",
            title: t("help.topics.policyLibrary", "Policy Library"),
            sub: t("help.topics.policyLibrarySub", "Company guidelines"),
            contentId: "assigned-to-me",
            iconBg: "bg-yellow-100",
            iconStroke: "#ca8a04",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
          },
          {
            id: "training",
            title: t("help.topics.trainingModules", "Training modules"),
            sub: t("help.topics.trainingModulesSub", "Learning resources"),
            contentId: isAdminRole ? "templates" : "assigned-to-me",
            iconBg: "bg-purple-100",
            iconStroke: "#7c3aed",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            ),
          },
        ],
      },
      {
        id: "account",
        label: t("help.sections.account", "Account"),
        items: [
          {
            id: "profile-settings",
            title: t("help.topics.profileSettings", "Profile settings"),
            sub: t("help.topics.profileSettingsSub", "Edit your account info"),
            contentId: "role-definitions",
            iconBg: "bg-gray-100",
            iconStroke: "#6b7280",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            ),
          },
          {
            id: "language-prefs",
            title: t("help.topics.languagePrefs", "Language & preferences"),
            sub: t("help.topics.languagePrefsSub", "Customize your experience"),
            contentId: "role-definitions",
            iconBg: "bg-blue-100",
            iconStroke: "#2563eb",
            icon: (stroke) => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
            ),
          },
          ...(isAdminRole
            ? [{
                id: "assigned-to-me",
                title: t("help.topics.assignedToMe", "Assigned to Me"),
                sub: t("help.topics.assignedToMeSub", "Managing assigned tasks"),
                contentId: "assigned-to-me",
                iconBg: "bg-indigo-100",
                iconStroke: "#4f46e5",
                icon: (stroke) => (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                ),
              }]
            : []),
        ],
      },
      ...(isAdminRole
        ? [{
            id: "admin",
            label: t("help.sections.adminFeatures", "Admin features"),
            items: [
              {
                id: "members",
                title: t("help.topics.memberManagement", "Member management"),
                sub: t("help.topics.memberManagementSub", "Manage users and roles"),
                contentId: "member-management",
                iconBg: "bg-blue-100",
                iconStroke: "#2563eb",
                icon: (stroke) => (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                  </svg>
                ),
              },
              {
                id: "departments",
                title: t("help.topics.departmentManagement", "Departments"),
                sub: t("help.topics.departmentManagementSub", "Organize your company"),
                contentId: "departments",
                iconBg: "bg-teal-100",
                iconStroke: "#0d9488",
                icon: (stroke) => (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                ),
              },
              {
                id: "analytics",
                title: t("help.topics.analyticsReporting", "Analytics"),
                sub: t("help.topics.analyticsReportingSub", "Usage reports and metrics"),
                contentId: "analytics",
                iconBg: "bg-indigo-100",
                iconStroke: "#4f46e5",
                icon: (stroke) => (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                ),
              },
            ],
          }]
        : []),
    ],
    [t, userRole, isAdminRole]
  );

  // Filter by search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return allSections;
    const q = searchQuery.toLowerCase();
    return allSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.sub.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [allSections, searchQuery]);

  const toggleItem = (itemId) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  };

  return (
    <div className="max-w-lg mx-auto px-4 pb-24">
      {/* Search bar */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex gap-2 mt-4 mb-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="flex-shrink-0 mt-0.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder={t("help.center.searchPlaceholder", "Search help topics...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 text-sm outline-none border-none bg-transparent text-gray-700 placeholder-gray-400"
        />
      </div>

      {/* Section groups */}
      {filteredSections.map((section) => (
        <div key={section.id} className="mb-6">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
            {section.label}
          </p>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {section.items.map((item, i) => {
              const isExpanded = expandedItemId === item.id;
              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-blue-50 active:bg-blue-100 transition-colors border-l-4 border-transparent hover:border-blue-500 hover:shadow-sm"
                    style={{
                      borderBottom:
                        !isExpanded && i < section.items.length - 1
                          ? "1px solid #f9fafb"
                          : "none",
                    }}
                  >
                    <div className={`w-7 h-7 ${item.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      {item.icon(item.iconStroke)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-[11px] font-semibold text-gray-900">{item.title}</div>
                      <div className="text-[9px] text-gray-400 mt-0.5">{item.sub}</div>
                    </div>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
                      className={`flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div
                      className="px-4 pb-4 pt-2 bg-gray-50"
                      style={{ borderTop: "1px solid #f1f5f9", borderBottom: i < section.items.length - 1 ? "1px solid #f1f5f9" : "none" }}
                    >
                      {renderContent(item.contentId)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {filteredSections.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">
            {t("help.center.noResults", "No help topics match your search.")}
          </p>
        </div>
      )}
    </div>
  );
};

export default HelpCenter;
