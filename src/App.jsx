import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import LoginScreen     from "./views/LoginScreen";
import FirstLoginSetup from "./views/FirstLoginSetup";
import AdminDashboard  from "./views/AdminDashboard";
import NewApp          from "./app/index";

/*
 * REBUILD BRANCH App.jsx
 * ----------------------
 * This version routes operational (non-admin) users to the rebuilt app in
 * src/app (the Do / Track / Report / More tab set). Admin and login are
 * unchanged. This file only exists on the `rebuild` branch — production `main`
 * keeps its own App.jsx pointed at StaffDashboard. When the rebuild is proven,
 * this becomes main's App.jsx (the cutover).
 */

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
  if (!isAdmin()) return <Navigate to="/app/do" replace />;
  return children;
}

function AppRoutes() {
  const { actor, isAdmin } = useAuth();
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"         element={<LoginScreen />} />
      <Route path="/setup-account" element={<FirstLoginSetup />} />

      {/* Admin — unchanged, still the separate console */}
      <Route path="/admin"      element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
      <Route path="/admin/:tab" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />

      {/* New operational app — the rebuilt tab set */}
      <Route path="/app/:tab" element={<RequireAuth><NewApp /></RequireAuth>} />
      <Route path="/app"      element={<RequireAuth><NewApp /></RequireAuth>} />

      {/* Old staff routes → redirect into the new app so bookmarks still work */}
      <Route path="/my"            element={<Navigate to="/app/do" replace />} />
      <Route path="/register"      element={<Navigate to="/app/do" replace />} />
      <Route path="/consolidation" element={<Navigate to="/app/report" replace />} />
      <Route path="/kad"           element={<Navigate to="/app/track" replace />} />
      <Route path="/projects"      element={<Navigate to="/app/more" replace />} />
      <Route path="/org"           element={<Navigate to="/app/report" replace />} />
      <Route path="/team"          element={<Navigate to="/app/do" replace />} />
      <Route path="/flags"         element={<Navigate to="/app/track" replace />} />
      <Route path="/manage"        element={<Navigate to="/app/do" replace />} />
      <Route path="/resources"     element={<Navigate to="/app/track" replace />} />

      {/* Root redirect based on role */}
      <Route path="/" element={
        !actor
          ? <Navigate to="/login" replace />
          : actor.must_change_password
          ? <Navigate to="/setup-account" replace />
          : isAdmin()
          ? <Navigate to="/admin/kads" replace />
          : <Navigate to="/app/do" replace />
      }/>

      {/* Catch-all */}
      <Route path="*" element={
        !actor ? <Navigate to="/login" replace /> :
        isAdmin() ? <Navigate to="/admin/kads" replace /> :
        <Navigate to="/app/do" replace />
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
