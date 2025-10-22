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
// import CompanyQRGenerator from "./pages/admin/CompanyQRGenerator";
import CompanyDashboard from "./pages/company/CompanyDashboard";
import CompanyQRCode from "./pages/company/CompanyQRCode";
import PrivateRoute from "./components/PrivateRoute";
import Register from "./pages/Register";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";

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
            {/* <Route
              path="/admin/qr-generator"
              element={
                <PrivateRoute>
                  <CompanyQRGenerator />
                </PrivateRoute>
              }
            /> */}

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

            {/* General Routes */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/employee/dashboard"
              element={
                <PrivateRoute>
                  <EmployeeDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/employee/creative-wall"
              element={
                <PrivateRoute>
                  <CreativeWall />
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
