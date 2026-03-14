import { useAuth } from "../contexts/AuthContext";
import EmployeeLayout from "./EmployeeLayout";
import CompanyAdminLayout from "./CompanyAdminLayout";

/**
 * RoleBasedLayout Component
 * Simply delegates to the correct layout based on user role.
 * - Admins (company_admin, hr) -> CompanyAdminLayout (desktop-first sidebar)
 * - Employees -> EmployeeLayout (mobile-first bottom nav)
 */
const RoleBasedLayout = ({ children }) => {
  const { userData } = useAuth();

  const isAdmin = userData?.role === "company_admin" || userData?.role === "hr";

  if (isAdmin) {
    return <CompanyAdminLayout>{children}</CompanyAdminLayout>;
  }

  return <EmployeeLayout>{children}</EmployeeLayout>;
};

export default RoleBasedLayout;
