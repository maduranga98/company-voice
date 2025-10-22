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
import CompanyDashboard from "./pages/company/CompanyDashboard";
import CompanyQRCode from "./pages/company/CompanyQRCode";
import PrivateRoute from "./components/PrivateRoute";
import Register from "./pages/Register";
import EmployeeLayout from "./components/EmployeeLayout";
import CreativeWall from "./pages/employee/CreativeWall";
import Complaints from "./pages/employee/Complaints";
import Discussions from "./pages/employee/Discussions";

function App() {
  return (
    <AuthProvider>
      <Router>
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

            {/* Company Admin Routes */}
            <Route
              path="/company/dashboard"
              element={
                <PrivateRoute>
                  <CompanyDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/company/qr-code"
              element={
                <PrivateRoute>
                  <CompanyQRCode />
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
              <Route index element={<Navigate to="creative-wall" replace />} />
              <Route path="creative-wall" element={<CreativeWall />} />
              <Route path="complaints" element={<Complaints />} />
              <Route path="discussions" element={<Discussions />} />
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

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
