// The public report form (/r/:slug), the check-my-case page (/c) and the policy
// acknowledgement link (/p/:slug) are visited by people who have no account: no
// session restore, no third-party telemetry. The first two must also stay anonymous.
export const isPublicReportRoute = () => {
  const { pathname } = window.location;
  return (
    pathname.startsWith("/r/") ||
    pathname.startsWith("/p/") ||
    pathname === "/c" ||
    pathname.startsWith("/c/")
  );
};
