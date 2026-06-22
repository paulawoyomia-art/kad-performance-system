import { createContext, useContext, useState, useCallback } from "react";
import { auth as authApi, getToken, setToken, clearToken } from "../api/client";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

/**
 * actor shape returned by login / restored from sessionStorage:
 * {
 *   token, is_admin, must_change_password,
 *   id, full_name, email, employee_id,      // employee fields
 *   // role assignments are fetched separately and stored in actor.roles
 *   roles: [{ role_name, scope_employee_id }]  // populated after login
 * }
 */
export function AuthProvider({ children }) {
  const [actor, setActor] = useState(() => {
    // Restore session if token is still in sessionStorage
    const t = getToken();
    if (!t) return null;
    try {
      const raw = sessionStorage.getItem("kps_actor");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const saveActor = useCallback((a) => {
    setActor(a);
    if (a) sessionStorage.setItem("kps_actor", JSON.stringify(a));
    else    sessionStorage.removeItem("kps_actor");
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    const a = {
      token:               res.token,
      is_admin:            res.is_admin,
      must_change_password: res.must_change_password,
      ...res.account,
      roles: [],
    };
    saveActor(a);
    return a;
  }, [saveActor]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    clearToken();
    saveActor(null);
  }, [saveActor]);

  // Called after first-login setup — updates the actor with the new token and
  // clears the must_change_password flag so routing sends them to their dashboard.
  const completeSetup = useCallback((newToken) => {
    setToken(newToken);
    const updated = { ...actor, token: newToken, must_change_password: false };
    saveActor(updated);
  }, [actor, saveActor]);

  // Role helpers — used by views to decide which action buttons to show.
  // The server is the authority; these are just UI hints derived from the
  // role_assignments the server returned for this actor.
  const hasRole       = (name)       => actor?.roles?.some(r => r.role_name === name) ?? false;
  const isAdmin       = ()           => actor?.is_admin === true;
  const isManagement  = ()           => actor?.staff_type === "Management";
  const canSetTargets = ()           => hasRole("Line Manager") || hasRole("KAD Director");
  const canConfirm    = ()           => hasRole("HRBP");
  const canApprove    = ()           => hasRole("KAD Director");
  const canSignoff    = ()           => hasRole("Line Manager");
  const canConfirmSO  = ()           => hasRole("KAD Director") || hasRole("HRBP");

  return (
    <AuthCtx.Provider value={{
      actor, login, logout, completeSetup,
      isAdmin, isManagement,
      canSetTargets, canConfirm, canApprove,
      canSignoff, canConfirmSO,
      hasRole,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}
