// The public report form (/r/:slug) and the check-my-case page (/c) are visited by
// people who must stay anonymous: no session restore, no third-party telemetry.
export const isPublicReportRoute = () => {
  const { pathname } = window.location;
  return pathname.startsWith("/r/") || pathname === "/c" || pathname.startsWith("/c/");
};
