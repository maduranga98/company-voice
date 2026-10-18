import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import HelpPanel from "../components/help/HelpPanel";
import { useAuth } from "../contexts/AuthContext";
import useGuidanceContent from "../hooks/useGuidanceContent";
import { TOUR_START_EVENT } from "../components/tour/tourSteps";
import {
  ArrowRight, BarChart3, BookOpen, Building2, CircleDot, ClipboardCheck, ClipboardList, Clock,
  Compass, CreditCard, Flag, Inbox, LayoutGrid, MessagesSquare, PlayCircle, QrCode, Route,
  Scale, ShieldAlert, UserCircle, Users,
} from "lucide-react";

const TONES = {
  teal: "bg-teal-100 text-teal-700",
  blue: "bg-blue-100 text-blue-700",
  indigo: "bg-indigo-100 text-indigo-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  gray: "bg-gray-100 text-gray-600",
};

const HelpCenter = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
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
    ASSIGNED_TO_ME_GUIDANCE,
  } = useGuidanceContent();

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItemId, setExpandedItemId] = useState(null);

  const userRole = userData?.role;

  const isCompanyAdmin = userRole === "company_admin" || userRole === "super_admin";
  // The tour runs inside the staff layout, which super admins do not use.
  const isCompanyStaff = userRole === "company_admin" || userRole === "hr";

  // ── renderContent (kept exactly from original) ──────────────────────────
  const renderContent = (contentId) => {
    const getVisibleRoles = () => {
      const roleHierarchy = {
        super_admin: ["super_admin", "company_admin", "hr"],
        company_admin: ["company_admin", "hr"],
        hr: ["hr"],
      };
      return roleHierarchy[userRole] || [];
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
                          <div key={idx} className="bg-background-white rounded-lg p-2 border border-blue-100 flex items-start gap-2">
                            <span className="text-blue-500 text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                            <div>
                              <div className="text-xs font-semibold text-gray-800">{feature.name}</div>
                              <div className="text-xs text-gray-500">{feature.description}</div>
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
                  <p className="text-xs text-gray-400">
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
                    <li key={i} className="text-xs text-gray-500 flex items-start gap-1">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
                  <div className="text-xs text-gray-400">
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

  const guideContent = (key) => (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">{t(`help.guide.${key}.intro`)}</p>
      <ul className="space-y-1.5">
        {t(`help.guide.${key}.points`, { returnObjects: true }).map((point, idx) => (
          <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-gray-700">
            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-brand-500" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      {i18n.exists(`help.guide.${key}.tip`) && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
          <strong>{t("help.guide.tipLabel")}:</strong> {t(`help.guide.${key}.tip`)}
        </p>
      )}
      {i18n.exists(`help.guide.${key}.link`) && (
        <button
          type="button"
          onClick={() => navigate(t(`help.guide.${key}.link`))}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          {t(`help.guide.${key}.linkLabel`)}
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );

  // `guide` items read help.guide.<id>; `contentId` items reuse the richer role/status renderers above.
  const allSections = useMemo(() => {
    const guide = (id, icon, tone) => ({
      id,
      icon,
      tone,
      title: t(`help.guide.${id}.title`),
      sub: t(`help.guide.${id}.sub`),
      guide: id,
      searchText: t(`help.guide.${id}.intro`),
    });
    const content = (id, contentId, icon, tone, title, sub) => ({ id, contentId, icon, tone, title, sub });
    const when = (cond, items) => (cond ? items : []);

    return [
      {
        id: "start",
        label: t("help.guide.sections.start"),
        items: [
          guide("overview", Compass, "teal"),
          content("roles", "role-definitions", Users, "blue", t("help.topics.rolesPermissions"), t("help.topics.rolesPermissionsSub")),
          guide("navigation", LayoutGrid, "gray"),
          ...when(isCompanyAdmin, [guide("reportLink", QrCode, "teal")]),
        ],
      },
      {
        id: "cases",
        label: t("help.guide.sections.cases"),
        items: [
          guide("caseQueue", LayoutGrid, "blue"),
          guide("hrInbox", Inbox, "amber"),
          guide("conversations", MessagesSquare, "teal"),
          content("assigned", "assigned-to-me", ClipboardCheck, "indigo", t("help.topics.assignedToMe"), t("help.topics.assignedToMeSub")),
          guide("deadlines", Clock, "rose"),
          content("post-status", "post-status", CircleDot, "amber", t("help.topics.postStatus"), t("help.topics.postStatusSub")),
          content("priority", "priority", Flag, "rose", t("help.topics.priorityLevels"), t("help.guide.priorityLevelsSub")),
          ...when(isCompanyAdmin, [guide("routing", Route, "indigo")]),
          guide("vendorRisk", ShieldAlert, "gray"),
        ],
      },
      ...when(isCompanyAdmin, [
        {
          id: "people",
          label: t("help.guide.sections.people"),
          items: [
            guide("members", Users, "blue"),
            content("departments", "departments", Building2, "teal", t("help.topics.departmentManagement"), t("help.topics.departmentManagementSub")),
            content("analytics", "analytics", BarChart3, "indigo", t("help.topics.analyticsReporting"), t("help.topics.analyticsReportingSub")),
          ],
        },
      ]),
      {
        id: "compliance",
        label: t("help.guide.sections.compliance"),
        items: [
          guide("policies", BookOpen, "amber"),
          guide("audit", ClipboardList, "gray"),
          ...when(isCompanyAdmin, [guide("legal", Scale, "indigo"), guide("billing", CreditCard, "teal")]),
        ],
      },
      {
        id: "account",
        label: t("help.guide.sections.account"),
        items: [guide("profile", UserCircle, "gray")],
      },
    ];
  }, [t, isCompanyAdmin]);

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
            item.sub.toLowerCase().includes(q) ||
            item.searchText?.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [allSections, searchQuery]);

  const toggleItem = (itemId) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24">
      {/* Search bar */}
      <div className="bg-background-white rounded-xl border border-gray-200 px-4 py-3 flex gap-2 mt-4 mb-4">
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

      {isCompanyStaff && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
            <PlayCircle size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{t("help.guide.tourCard.title")}</p>
            <p className="text-xs text-gray-600">{t("help.guide.tourCard.body")}</p>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(TOUR_START_EVENT))}
            className="flex-shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
          >
            {t("help.guide.tourCard.cta")}
          </button>
        </div>
      )}

      {/* Section groups */}
      {filteredSections.map((section) => (
        <div key={section.id} className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
            {section.label}
          </p>
          <div className="bg-background-white rounded-xl shadow-sm overflow-hidden">
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
                    <div className={`w-7 h-7 ${TONES[item.tone]} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <item.icon size={16} strokeWidth={2} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{item.sub}</div>
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
                      {item.guide ? guideContent(item.guide) : renderContent(item.contentId)}
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
