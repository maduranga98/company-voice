import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CompanyManagement from "./pages/admin/CompanyManagement";
import BillingDashboard from "./pages/admin/BillingDashboard";
import DeletedPosts from "./pages/admin/DeletedPosts";
import CompanyDashboard from "./pages/company/CompanyDashboard";
import CompanyAnalytics from "./pages/company/CompanyAnalytics";
import CompanyBilling from "./pages/company/CompanyBilling";
import CompanyQRCode from "./pages/company/CompanyQRCode";
import TagManagement from "./pages/company/TagManagement";
import MemberManagement from "./pages/company/MemberManagement";
import DepartmentManagement from "./pages/company/DepartmentManagement";
import DepartmentDetails from "./pages/company/DepartmentDetails";
import MemberManagementWithDepartments from "./pages/company/MemberManagementWithDepartments";
import AuditLog from "./pages/admin/AuditLog";
import AuditExportPage from "./pages/company/AuditExportPage";
import TemplatesPage from "./pages/TemplatesPage";
import RoleDefinitions from "./pages/RoleDefinitions";
import HelpCenter from "./pages/HelpCenter";

import PrivateRoute from "./components/PrivateRoute";
import { useAuth } from "./contexts/AuthContext";
import CompanyAdminLayout from "./components/CompanyAdminLayout";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import ScrollToTop from "./components/ScrollToTop";

import AssignedToMe from "./pages/AssignedToMe";

// Moderation Pages
import ModerationDashboard from "./pages/ModerationDashboard";
import ReportDetailView from "./pages/ReportDetailView";

// Legal Pages
import SuperAdminLegalRequests from "./pages/admin/SuperAdminLegalRequests";
import KeyVaultManagement from "./pages/admin/KeyVaultManagement";
import LegalRequestsPage from "./pages/company/LegalRequestsPage";
import PolicyManagement from "./pages/company/PolicyManagement";
import PolicyLibrary from "./pages/PolicyLibrary";

// Vendor Risk Pages
import VendorRiskReport from "./pages/VendorRiskReport";
import VendorRiskDashboard from "./pages/hr/VendorRiskDashboard";

// HR Pages
import HRConversations from "./pages/hr/HRConversations";
import HRInbox from "./pages/hr/HRInbox";

// Public (no-login) report form
import ReportPage from "./pages/public/ReportPage";

const CompanyDashboardGuard = () => {
  const { userData } = useAuth();
  if (!userData) return null;
  if (userData.role === "hr") {
    return <Navigate to="/hr/inbox" replace />;
  }
  return <CompanyDashboard />;
};

const AuditExportGuard = () => {
  const { userData } = useAuth();
  if (!userData) return null;
  if (userData.role === "hr") {
    return <Navigate to="/hr/inbox" replace />;
  }
  return <AuditExportPage />;
};

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* ── PUBLIC ROUTES ── */}
            <Route path="/login" element={<Login />} />
            <Route path="/r/:slug" element={<ReportPage />} />

            {/* ── SUPER ADMIN ROUTES ── */}
            <Route
              path="/admin/companies"
              element={
                <PrivateRoute>
                  <CompanyManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/billing"
              element={
                <PrivateRoute>
                  <BillingDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/legal-requests"
              element={
                <PrivateRoute>
                  <SuperAdminLegalRequests />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/key-vault"
              element={
                <PrivateRoute>
                  <KeyVaultManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/deleted-posts"
              element={
                <PrivateRoute>
                  <DeletedPosts />
                </PrivateRoute>
              }
            />

            {/* ── SHARED STAFF ROUTES (staff layout) ── */}
            <Route
              path="/assigned-to-me"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <AssignedToMe />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/moderation"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <ModerationDashboard />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/moderation/report/:reportId"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <ReportDetailView />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/hr/harassment-dashboard"
              element={<Navigate to="/moderation" replace />}
            />
            <Route
              path="/templates"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <TemplatesPage />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/help"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <HelpCenter />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/help/roles"
              element={
                <PrivateRoute>
                  <RoleDefinitions />
                </PrivateRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <Notifications />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/policies"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <PolicyLibrary />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/vendor-risk"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <VendorRiskReport />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />

            {/* ── COMPANY ADMIN ROUTES (with admin sidebar layout) ── */}
            <Route
              path="/company/dashboard"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <CompanyDashboardGuard />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/notifications"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <Notifications />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/profile"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <Profile />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/qr-code"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <CompanyQRCode />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/tag-management"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <TagManagement />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/member-management"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <MemberManagement />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/departments"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <DepartmentManagement />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/departments/:id"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <DepartmentDetails />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/members"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <MemberManagementWithDepartments />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/analytics"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <CompanyAnalytics />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/audit-log"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <AuditLog />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/billing"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <CompanyBilling />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/legal-requests"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <LegalRequestsPage />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/audit-export"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <AuditExportGuard />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company/policies"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <PolicyManagement />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />

            {/* ── HR ROUTES (with admin sidebar layout) ── */}
            <Route
              path="/hr/inbox"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <HRInbox />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/hr/vendor-risk"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <VendorRiskDashboard />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/hr/conversations"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout>
                    <HRConversations />
                  </CompanyAdminLayout>
                </PrivateRoute>
              }
            />

            {/* ── GENERAL ROUTES ── */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />

            {/* Default route */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
