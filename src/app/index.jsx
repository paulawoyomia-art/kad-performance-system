import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AppShell, { Icons } from "../components/AppShell";
import { useAuth } from "../auth/AuthContext";
import { periods as periodsApi } from "../api/client";
import DoTab from "./tabs/DoTab";
// Track / Report / More arrive in later slices — stubbed below until then.

/**
 * New operational app — the first-principles tab set.
 *   Do     — what needs me now (built)
 *   Track  — browse allocations at any scope (slice 2)
 *   Report — rollups (slice 3)
 *   More   — reference, role-gated (slice 4)
 *
 * This file is the cutover target: when the rebuild is proven, App.jsx points
 * its operational routes here instead of at StaffDashboard. Until then it lives
 * alongside the old app and is not wired into any route.
 */
export default function NewApp() {
  const { actor, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [periods, setPeriods] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  useEffect(() => { periodsApi.list().then(setPeriods).catch(() => setPeriods([])); }, []);
  useEffect(() => {
    if (periods && periods.length > 0 && !selectedPeriod) {
      const pick = periods.find(p => p.status === "Open")
        || periods.find(p => p.status !== "Closed") || periods[0];
      if (pick) setSelectedPeriod(String(pick.id));
    }
  }, [periods, selectedPeriod]);

  // Capability-driven tab visibility.
  const isDir = hasRole("KAD Director");
  const isHRBP = hasRole("HRBP");
  const isLM = hasRole("Line Manager");
  const isExec = hasRole("Executive");
  const canReport = isHRBP || isDir || isExec;
  const canMore = isHRBP || isDir;

  const TABS = ["do", "track", "report", "more"];
  const pathTab = location.pathname.replace(/^\/(app\/)?/, "") || "do";
  const tab = TABS.includes(pathTab) ? pathTab : "do";
  const setTab = (t) => navigate(`/app/${t}`);

  const periodObj = (periods || []).find(p => String(p.id) === String(selectedPeriod));
  const periodOpen = periodObj?.status === "Open";

  const navItems = [
    { key: "do", label: "Do", mobileLabel: "Do", icon: Icons.allocations, active: tab === "do", onClick: () => setTab("do") },
    { key: "track", label: "Track", mobileLabel: "Track", icon: Icons.team, active: tab === "track", onClick: () => setTab("track") },
    ...(canReport ? [{ key: "report", label: "Report", mobileLabel: "Report", icon: Icons.periods, active: tab === "report", onClick: () => setTab("report") }] : []),
    ...(canMore ? [{ key: "more", label: "More", mobileLabel: "More", icon: Icons.home, active: tab === "more", onClick: () => setTab("more") }] : []),
  ];

  const titleMap = { do: "What needs you", track: "Track", report: "Report", more: "More" };

  return (
    <AppShell title={titleMap[tab] || "What needs you"} navItems={navItems}>
      {periods && periods.length > 0 && (
        <div className="flex items-center gap-2 mb-4" style={{ flexWrap: "wrap" }}>
          <span className="t-caption">Period:</span>
          <select className="form-select" style={{ width: "auto", minWidth: 160 }}
            value={selectedPeriod || ""} onChange={e => setSelectedPeriod(e.target.value)}>
            {periods.map(p => <option key={p.id} value={p.id}>{p.period_label} · {p.status}</option>)}
          </select>
        </div>
      )}

      {(!periods || periods.length === 0) && (
        <div className="empty">
          <p className="empty-title">No active period yet</p>
          <p className="empty-body">Your administrator will open a performance period once targets are set.</p>
        </div>
      )}

      {periods && periods.length > 0 && (
        <>
          {tab === "do" && <DoTab actor={actor} periodId={selectedPeriod} periodOpen={periodOpen} onSubmit={() => {}} />}
          {tab === "track" && <Stub name="Track" />}
          {tab === "report" && <Stub name="Report" />}
          {tab === "more" && <Stub name="More" />}
        </>
      )}
    </AppShell>
  );
}

function Stub({ name }) {
  return (
    <div className="empty">
      <p className="empty-title">{name}</p>
      <p className="empty-body">This tab arrives in the next build slice.</p>
    </div>
  );
}
