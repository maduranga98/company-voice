// `target` matches a data-tour attribute in CompanyAdminLayout (nav items use their route path).
// Steps without a target render as a centred card. `roles` limits a step to those roles.
// `route` sends the user to that page before the step shows (the tour waits for the target to render).
// Copy lives in en.json under tour.steps.<id>.

const ADMIN = ["company_admin"];
const POLICIES = "/company/policies";

export const TOUR_START_EVENT = "voxwel:start-tour";

export const TOUR_STEPS = [
  { id: "welcome" },
  // Start with policies: publish them, then share the link so employees can acknowledge.
  { id: "policiesNav", target: "/company/policies" },
  { id: "policyNew", target: "policy-new", route: POLICIES },
  { id: "policyPublish", target: "policy-publish", route: POLICIES },
  { id: "policyLink", target: "policy-link", route: POLICIES },
  { id: "policySelect", target: "policy-select", route: POLICIES },
  { id: "policyStats", target: "policy-stats", route: POLICIES },
  { id: "dashboard", target: "/company/dashboard", roles: ADMIN },
  { id: "analytics", target: "/company/analytics", roles: ADMIN },
  { id: "cases", target: "/company/cases" },
  { id: "inbox", target: "/hr/inbox" },
  { id: "assigned", target: "/assigned-to-me" },
  { id: "conversations", target: "/hr/conversations" },
  { id: "members", target: "/company/members", roles: ADMIN },
  { id: "routing", target: "/company/routing-rules", roles: ADMIN },
  { id: "qr", target: "/company/qr-code", roles: ADMIN },
  { id: "audit", target: "/company/audit-log" },
  { id: "notifications", target: "notifications" },
  { id: "language", target: "language" },
  { id: "help", target: "/help" },
];
