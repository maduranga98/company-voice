// Shared vocabulary + matching logic for routing rules (auto-assignment of new
// cases). Used by the Routing Rules admin page, the Case Queue preview, and by
// vendorRiskService.js when a vendor report is submitted.
//
// IMPORTANT: this matching logic is duplicated — once here (ESM, for the client
// bundle) and once in functions/utils/routingRules.js (CommonJS, for the two
// server-side case-creation callables). There is no shared build between src/
// and functions/, so a change to the matching rules must be made in both files
// identically. Keep matchRule's body the same in both.

import { CaseType } from "./caseTypes";

// Must match functions/config/publicReports.js CATEGORIES, plus the one
// server-generated category used by the policy-acknowledgement concern flow.
export const ROUTING_CATEGORIES = [
  "harassment",
  "discrimination",
  "safety",
  "fraud_ethics",
  "management",
  "workplace_conditions",
  "pay_benefits",
  "policy_concern",
  "other",
];

// Must match src/pages/hr/VendorRiskDashboard.jsx CATEGORY_LABEL keys.
export const VENDOR_CATEGORIES = ["labor", "data_privacy", "safety", "fraud", "compliance", "other"];
export const VENDOR_SEVERITIES = ["low", "medium", "high"];

export const RoutingCaseTypes = [CaseType.POST, CaseType.VENDOR];

export const INVOLVES_HR_OPTIONS = ["any", "yes", "no"];

export const emptyConditions = () => ({
  postTypes: [],
  categories: [],
  involvesHR: "any",
  vendorCategories: [],
  vendorSeverities: [],
});

export const emptyRule = (companyId, order = 0) => ({
  companyId,
  name: "",
  enabled: true,
  order,
  appliesTo: [CaseType.POST],
  conditions: emptyConditions(),
  action: { type: "user", id: "", name: "" },
});

// True when every condition set on the rule matches the case. An empty/omitted
// condition field is a wildcard. Returns false for a case type the rule doesn't
// apply to at all.
export const matchRule = (rule, caseType, caseData) => {
  if (!rule.enabled) return false;
  if (!Array.isArray(rule.appliesTo) || !rule.appliesTo.includes(caseType)) return false;
  const c = rule.conditions || {};

  if (caseType === CaseType.POST) {
    if (Array.isArray(c.postTypes) && c.postTypes.length > 0 && !c.postTypes.includes(caseData.type)) {
      return false;
    }
    if (Array.isArray(c.categories) && c.categories.length > 0 && !c.categories.includes(caseData.category)) {
      return false;
    }
    if (c.involvesHR === "yes" && caseData.involvesHR !== true) return false;
    if (c.involvesHR === "no" && caseData.involvesHR !== false) return false;
    return true;
  }

  if (caseType === CaseType.VENDOR) {
    if (
      Array.isArray(c.vendorCategories) &&
      c.vendorCategories.length > 0 &&
      !c.vendorCategories.includes(caseData.riskCategory)
    ) {
      return false;
    }
    if (
      Array.isArray(c.vendorSeverities) &&
      c.vendorSeverities.length > 0 &&
      !c.vendorSeverities.includes(caseData.severity)
    ) {
      return false;
    }
    return true;
  }

  return false;
};

// First enabled rule (in `order` order) that matches, or null. `rules` should
// already be the company's rules; callers load + sort via routingRulesService.
export const findMatchingRule = (rules, caseType, caseData) => {
  const sorted = [...rules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const rule of sorted) {
    if (matchRule(rule, caseType, caseData)) return rule;
  }
  return null;
};
