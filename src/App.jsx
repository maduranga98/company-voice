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

import PrivateRoute from "./components/PrivateRoute";
import Register from "./pages/Register";
import EmployeeLayout from "./components/EmployeeLayout";
import CompanyAdminLayout from "./components/CompanyAdminLayout";
import RoleBasedLayout from "./components/RoleBasedLayout";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";

// New Unified Feed Pages
import CreativeFeed from "./pages/feed/CreativeFeed";
import ProblemsFeed from "./pages/feed/ProblemsFeed";
import DiscussionsFeed from "./pages/feed/DiscussionsFeed";
import MyPosts from "./pages/MyPosts";
import AssignedToMe from "./pages/AssignedToMe";

// Moderation Pages
import ModerationDashboard from "./pages/ModerationDashboard";
import ReportDetailView from "./pages/ReportDetailView";

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
