import { useAuth } from "../contexts/AuthContext";
import CompanyAdminLayout from "./CompanyAdminLayout";
import EmployeeLayout from "./EmployeeLayout";

/**
 * RoleBasedLayout Component
 * Wraps content in the appropriate layout based on user role
 * - Admins (company_admin, hr) see CompanyAdminLayout with blue theme and Dashboard tab
 * - Employees see EmployeeLayout with purple theme
 */
const RoleBasedLayout = ({ children }) => {
  const { userData } = useAuth();

  // Check if user is admin (company_admin or hr)
  const isAdmin = userData?.role === "company_admin" || userData?.role === "hr";

  if (isAdmin) {
    return <CompanyAdminLayout>{children}</CompanyAdminLayout>;
  }

  return <EmployeeLayout>{children}</EmployeeLayout>;
};

export default RoleBasedLayout;
