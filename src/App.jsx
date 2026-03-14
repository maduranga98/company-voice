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

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/qr-generator" element={<QRCodeGenerator />} />
            <Route path="/register" element={<Register />} />

            {/* Super Admin Routes */}
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

            {/* Unified Feed Routes (shared by all users - employees and admins) */}
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

            {/* My Posts - Private Dashboard (available to all users) */}
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

            {/* Assigned to Me - For tagged members */}
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

            {/* Moderation Routes (for admins and HR) */}
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
            {/* Redirect old harassment dashboard to unified moderation dashboard */}
            <Route
              path="/hr/harassment-dashboard"
              element={<Navigate to="/moderation" replace />}
            />

            {/* Post Management Routes (for all users) */}
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

            {/* Templates Route (for admins) */}
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

            {/* Help & Documentation Routes */}
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

            {/* Company Admin Routes with Layout */}
            <Route
              path="/company"
              element={
                <PrivateRoute>
                  <CompanyAdminLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/feed/creative" replace />} />
              <Route path="dashboard" element={<CompanyDashboard />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route
              path="/company/qr-code"
              element={
                <PrivateRoute>
                  <CompanyQRCode />
                </PrivateRoute>
              }
            />
            <Route
              path="/company/tag-management"
              element={
                <PrivateRoute>
                  <TagManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/company/member-management"
              element={
                <PrivateRoute>
                  <MemberManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/company/departments"
              element={
                <PrivateRoute>
                  <DepartmentManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/departments/:id"
              element={
                <PrivateRoute>
                  <DepartmentDetails />
                </PrivateRoute>
              }
            />

            <Route
              path="/company/members"
              element={
                <PrivateRoute>
                  <MemberManagementWithDepartments />
                </PrivateRoute>
              }
            />
            <Route
              path="/company/analytics"
              element={
                <PrivateRoute>
                  <CompanyAnalytics />
                </PrivateRoute>
              }
            />
            <Route
              path="/company/audit-log"
              element={
                <PrivateRoute>
                  <AuditLog />
                </PrivateRoute>
              }
            />
            <Route
              path="/company/billing"
              element={
                <PrivateRoute>
                  <CompanyBilling />
                </PrivateRoute>
              }
            />
            <Route
              path="/company/legal-requests"
              element={
                <PrivateRoute>
                  <LegalRequestsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/company/audit-export"
              element={
                <PrivateRoute>
                  <AuditExportPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/company/policies"
              element={
                <PrivateRoute>
                  <PolicyManagement />
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

            {/* Vendor Risk Routes */}
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
            <Route
              path="/hr/vendor-risk"
              element={
                <PrivateRoute>
                  <VendorRiskDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/hr/conversations"
              element={
                <PrivateRoute>
                  <HRConversations />
                </PrivateRoute>
              }
            />

            {/* Employee Messages Routes */}
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

            {/* Employee Routes with Layout */}
            <Route
              path="/employee"
              element={
                <PrivateRoute>
                  <EmployeeLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/feed/creative" replace />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* General Routes */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />

            {/* Default route based on role */}
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
