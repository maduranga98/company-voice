// The public report form (/r/:slug) is visited by people who must stay anonymous:
// no session restore, no third-party telemetry.
export const isPublicReportRoute = () => window.location.pathname.startsWith("/r/");
