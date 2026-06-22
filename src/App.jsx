import { AuthProvider, useAuth } from "./auth/AuthContext";
import LoginScreen     from "./views/LoginScreen";
import FirstLoginSetup from "./views/FirstLoginSetup";
import AdminDashboard  from "./views/AdminDashboard";
import StaffDashboard  from "./views/StaffDashboard";

function Router() {
  const { actor } = useAuth();

  // Not logged in → login screen
  if (!actor) return <LoginScreen />;

  // Logged in but password not yet changed → first-login setup
  if (actor.must_change_password) return <FirstLoginSetup />;

  // Admin → setup console + cycle control
  if (actor.is_admin) return <AdminDashboard />;

  // Employee (any role) → staff dashboard with role-aware sections
  return <StaffDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
