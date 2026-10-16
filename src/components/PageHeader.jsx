/**
 * Shared page chrome for every page rendered inside CompanyAdminLayout.
 * The layout already supplies the max-width and page padding, so pages must
 * not add their own `min-h-screen`, `max-w-*` or outer padding.
 */

export const PageContainer = ({ children, className = "" }) => (
  <div className={`space-y-6 lg:space-y-8 ${className}`}>{children}</div>
);

export const PageLoading = ({ label }) => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center">
    <div
      className="h-9 w-9 animate-spin rounded-full border-2 border-gray-200"
      style={{ borderTopColor: "#1ABC9C" }}
    />
    {label && <p className="mt-3 text-xs text-gray-400">{label}</p>}
  </div>
);

const PageHeader = ({ icon: Icon, title, subtitle, badge, actions }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 lg:gap-4">
    <div className="flex min-w-0 items-center gap-3 lg:gap-4">
      {Icon && (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#2D3E50] shadow-sm lg:h-12 lg:w-12">
          <Icon size={20} className="text-white" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-[#2D3E50] lg:text-2xl">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 lg:gap-3">{actions}</div>}
  </div>
);

export default PageHeader;
