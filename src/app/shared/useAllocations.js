import { useState, useEffect, useCallback } from "react";
import { allocations as allocApi } from "../../api/client";

/**
 * useAllocations — one data hook the whole new app shares.
 *
 * scope:
 *   "mine" → only the current user's own allocations
 *   "team" → everything the backend scopes to this manager (their KAD/reports)
 *
 * The backend already enforces visibility, so "team" just omits the employee
 * filter and trusts the scoped response.
 */
export function useAllocations(periodId, scope = "team", employeeId = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!periodId) { setData([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const rows = scope === "mine"
        ? await allocApi.list(periodId, employeeId)
        : await allocApi.list(periodId);
      setData(rows);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [periodId, scope, employeeId]);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}
