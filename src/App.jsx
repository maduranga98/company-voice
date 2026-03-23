import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import QRCodeGenerator from "./pages/QRCodeGenerator";
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
import DraftsPage from "./pages/DraftsPage";
import ArchivedPosts from "./pages/ArchivedPosts";
import ScheduledPostsPage from "./pages/ScheduledPostsPage";
import RoleDefinitions from "./pages/RoleDefinitions";
import HelpCenter from "./pages/HelpCenter";
import EmployeeMessages from "./pages/EmployeeMessages";
import EmployeeMessageThread from "./pages/EmployeeMessageThread";

import PrivateRoute from "./components/PrivateRoute";
import { useAuth } from "./contexts/AuthContext";
import Register from "./pages/Register";
import EmployeeLayout from "./components/EmployeeLayout";
import CompanyAdminLayout from "./components/CompanyAdminLayout";
import RoleBasedLayout from "./components/RoleBasedLayout";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import ScrollToTop from "./components/ScrollToTop";

// New Unified Feed Pages
import CreativeFeed from "./pages/feed/CreativeFeed";
import ProblemsFeed from "./pages/feed/ProblemsFeed";
import DiscussionsFeed from "./pages/feed/DiscussionsFeed";
import MyPosts from "./pages/MyPosts";
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

const CompanyDashboardGuard = () => {
  const { userData } = useAuth();
  if (userData?.role === "hr") {
    return <Navigate to="/hr/inbox" replace />;
  }
  return <CompanyDashboard />;
};

const AuditExportGuard = () => {
  const { userData } = useAuth();
  if (userData?.role === "hr") {
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
            <Route path="/qr-generator" element={<QRCodeGenerator />} />
            <Route path="/register" element={<Register />} />

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

            {/* ── SHARED FEED ROUTES (role-based layout auto-selects) ── */}
            <Route
              path="/feed/creative"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <CreativeFeed />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/feed/problems"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <ProblemsFeed />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/feed/discussions"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <DiscussionsFeed />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />

            {/* ── SHARED ROUTES (role-based layout) ── */}
            <Route
              path="/my-posts"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <MyPosts />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/assigned-to-me"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <AssignedToMe />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/moderation"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <ModerationDashboard />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/moderation/report/:reportId"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <ReportDetailView />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/hr/harassment-dashboard"
              element={<Navigate to="/moderation" replace />}
            />
            <Route
              path="/drafts"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <DraftsPage />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/archived"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <ArchivedPosts />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/scheduled"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <ScheduledPostsPage />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <TemplatesPage />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/help"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <HelpCenter />
                  </RoleBasedLayout>
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
                  <RoleBasedLayout>
                    <Notifications />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/policies"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <PolicyLibrary />
                  </RoleBasedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/vendor-risk"
              element={
                <PrivateRoute>
                  <RoleBasedLayout>
                    <VendorRiskReport />
                  </RoleBasedLayout>
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

            {/* ── EMPLOYEE MESSAGE ROUTES ── */}
            <Route
              path="/messages"
              element={
                <PrivateRoute>
                  <EmployeeLayout>
                    <EmployeeMessages />
                  </EmployeeLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/messages/:postId"
              element={
                <PrivateRoute>
                  <EmployeeLayout>
                    <EmployeeMessageThread />
                  </EmployeeLayout>
                </PrivateRoute>
              }
            />

            {/* ── EMPLOYEE PROFILE ROUTES ── */}
            <Route
              path="/employee/profile"
              element={
                <PrivateRoute>
                  <EmployeeLayout>
                    <Profile />
                  </EmployeeLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/employee/notifications"
              element={
                <PrivateRoute>
                  <EmployeeLayout>
                    <Notifications />
                  </EmployeeLayout>
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
              element={<Navigate to="/feed/creative" replace />}
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
