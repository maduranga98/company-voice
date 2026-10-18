// `target` matches a data-tour attribute in CompanyAdminLayout (nav items use their route path).
// Steps without a target render as a centred card. `roles` limits a step to those roles.
// Copy lives in en.json under tour.steps.<id>.

const ADMIN = ["company_admin"];

export const TOUR_START_EVENT = "voxwel:start-tour";

export const TOUR_STEPS = [
  { id: "welcome" },
  { id: "dashboard", target: "/company/dashboard", roles: ADMIN },
  { id: "analytics", target: "/company/analytics", roles: ADMIN },
  { id: "cases", target: "/company/cases" },
  { id: "inbox", target: "/hr/inbox" },
  { id: "assigned", target: "/assigned-to-me" },
  { id: "conversations", target: "/hr/conversations" },
  { id: "members", target: "/company/members", roles: ADMIN },
  { id: "routing", target: "/company/routing-rules", roles: ADMIN },
  { id: "policies", target: "/company/policies" },
  { id: "qr", target: "/company/qr-code", roles: ADMIN },
  { id: "audit", target: "/company/audit-log" },
  { id: "notifications", target: "notifications" },
  { id: "language", target: "language" },
  { id: "help", target: "/help" },
];
