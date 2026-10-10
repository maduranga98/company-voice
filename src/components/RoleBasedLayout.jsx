import { useAuth } from "../contexts/AuthContext";
import CompanyAdminLayout from "./CompanyAdminLayout";

/**
 * RoleBasedLayout Component
 * Wraps shared pages in the staff layout.
 * - company_admin, hr -> CompanyAdminLayout (desktop-first sidebar)
 * - super_admin -> page without a shell, like the /admin/* pages
 */
const RoleBasedLayout = ({ children }) => {
  const { userData } = useAuth();

  const isCompanyStaff = userData?.role === "company_admin" || userData?.role === "hr";

  if (isCompanyStaff) {
    return <CompanyAdminLayout>{children}</CompanyAdminLayout>;
  }

  return children;
};

export default RoleBasedLayout;
