import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import LoginScreen     from "./views/LoginScreen";
import FirstLoginSetup from "./views/FirstLoginSetup";
import AdminDashboard  from "./views/AdminDashboard";
import StaffDashboard  from "./views/StaffDashboard";

function RequireAuth({ children }) {
  const { actor } = useAuth();
  const location  = useLocation();
  if (!actor) return <Navigate to="/login" state={{ from: location }} replace />;
  if (actor.must_change_password) return <Navigate to="/setup-account" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { actor, isAdmin } = useAuth();
  if (!actor) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to="/my" replace />;
  return children;
}

function AppRoutes() {
  const { actor, isAdmin } = useAuth();
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"         element={<LoginScreen />} />
      <Route path="/setup-account" element={<FirstLoginSetup />} />

      {/* Admin routes */}
      <Route path="/admin"     element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
      <Route path="/admin/:tab" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />

      {/* Staff routes */}
      <Route path="/my"    element={<RequireAuth><StaffDashboard /></RequireAuth>} />
      <Route path="/team"  element={<RequireAuth><StaffDashboard /></RequireAuth>} />
      <Route path="/flags" element={<RequireAuth><StaffDashboard /></RequireAuth>} />
      <Route path="/kad"   element={<RequireAuth><StaffDashboard /></RequireAuth>} />
      <Route path="/manage" element={<RequireAuth><StaffDashboard /></RequireAuth>} />
      <Route path="/projects" element={<RequireAuth><StaffDashboard /></RequireAuth>} />
      <Route path="/resources" element={<RequireAuth><StaffDashboard /></RequireAuth>} />
      <Route path="/org" element={<RequireAuth><StaffDashboard /></RequireAuth>} />

      {/* Root redirect based on role */}
      <Route path="/" element={
        !actor
          ? <Navigate to="/login" replace />
          : actor.must_change_password
          ? <Navigate to="/setup-account" replace />
          : isAdmin()
          ? <Navigate to="/admin/kads" replace />
          : <Navigate to="/my" replace />
      }/>

      {/* Catch-all */}
      <Route path="*" element={
        !actor ? <Navigate to="/login" replace /> :
        isAdmin() ? <Navigate to="/admin/kads" replace /> :
        <Navigate to="/my" replace />
      }/>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
