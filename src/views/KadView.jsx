import { useState, useEffect } from "react";
import { kad as kadApi } from "../api/client";
import { KadDashboard, ProjectWorkspace } from "./ManagerViews";

/**
 * My KAD — one place for the things a KAD is made of, in four lenses.
 *
 * Before this, a KAD's data was spread across a dashboard, a projects tab and
 * the register, with no view of people or clients at all. That last gap was the
 * real problem: the register lists ALLOCATIONS, so anyone who has never been
 * given one — including everybody who has never logged in — simply didn't
 * appear anywhere. More than half the company was invisible to its own managers.
 *
 * People is therefore the lens that matters most, and it leads with whoever
 * needs chasing rather than burying them in an alphabetical list.
 */
export default function KadView({ actor, selectedPeriod, onAnyAction }) {
  const [lens, setLens] = useState("people");
  const [scope, setScope] = useState(null);

  // The API decides what this person may see; we ask once so the lens buttons
  // can't offer something the server would refuse.
  useEffect(() => {
    kadApi.people().then(r => setScope(r.scope)).catch(() => setScope("none"));
  }, []);

  const wide = scope === "kad" || scope === "org";
  const lenses = [
    ["people", "People"],
    ...(wide ? [["overview", "Overview"], ["projects", "Projects"], ["clients", "Clients"]] : []),
  ];

  return (
    <div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        {lenses.map(([key, label]) => (
          <button key={key}
            className={`btn btn-sm ${lens === key ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setLens(key)}>{label}</button>
        ))}
      </div>

      {lens === "people"   && <PeopleLens />}
      {lens === "overview" && <KadDashboard actor={actor} selectedPeriod={selectedPeriod} onAnyAction={onAnyAction} />}
      {lens === "projects" && <ProjectWorkspace actor={actor} />}
      {lens === "clients"  && <ClientsLens />}
    </div>
  );
}

/* ── People ────────────────────────────────────────────────────────────────── */

const daysSince = (ts) => {
  if (!ts) return null;
  const then = new Date(ts.replace(" ", "T") + (ts.includes("Z") ? "" : "Z"));
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / 86400000));
};

function PeopleLens() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => { kadApi.people().then(setData).catch(e => setErr(e.message)); }, []);

  if (err) return <div className="alert alert-danger">{err}</div>;
  if (!data) return <div className="loading-center"><span className="spinner" /></div>;

  const people = data.people || [];
  if (data.scope === "none" || people.length === 0)
    return <div className="empty"><p className="empty-title">Nobody in scope</p>
      <p className="empty-body">You'll see people here once you manage someone.</p></div>;

  const notSignedIn = people.filter(p => !p.has_logged_in);
  const waiting = people.filter(p => p.has_logged_in && p.targets_waiting > 0);
  const active = people.filter(p => p.has_logged_in && p.targets_waiting === 0);

  const shown = filter === "not-signed-in" ? notSignedIn
              : filter === "waiting" ? waiting
              : people;

  return (
    <div>
      <div style={{ display: "grid", gap: 10, marginBottom: 14,
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Stat label="Not signed in" value={notSignedIn.length} tone="danger" />
        <Stat label="Target waiting" value={waiting.length} tone="warning" />
        <Stat label="Active" value={active.length} />
      </div>

      <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        <button className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilter("all")}>All {people.length}</button>
        <button className={`btn btn-sm ${filter === "not-signed-in" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilter("not-signed-in")}>Not signed in</button>
        <button className={`btn btn-sm ${filter === "waiting" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilter("waiting")}>Target waiting</button>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}
          onClick={() => exportCsv(shown)}>Export list</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Name</th><th>Role</th><th>Status</th><th>Allocations</th>
            </tr></thead>
            <tbody>
              {shown.map(p => {
                const days = daysSince(p.waiting_since);
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.full_name}</strong>
                      <span className="t-caption" style={{ display: "block" }}>{p.employee_id}</span>
                    </td>
                    <td className="t-caption">{p.designation || "—"}</td>
                    <td>
                      {!p.has_logged_in
                        ? <span className="badge badge-danger">Not signed in</span>
                        : p.targets_waiting > 0
                          ? <span className="badge badge-warning">
                              Target waiting{days != null ? ` · ${days}d` : ""}
                            </span>
                          : <span className="badge badge-success">Active</span>}
                    </td>
                    <td className="t-mono">{p.allocations}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="t-caption mt-2">
        Everyone in your scope, whether or not they've ever opened the app — the register
        can't show you these people, because it only lists allocations.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const bg = tone === "danger" ? "var(--bg-danger, var(--surface))"
           : tone === "warning" ? "var(--bg-warning, var(--surface))" : "var(--surface)";
  const fg = tone === "danger" ? "var(--text-danger, inherit)"
           : tone === "warning" ? "var(--text-warning, inherit)" : "inherit";
  return (
    <div style={{ background: bg, borderRadius: "var(--radius)", padding: "10px 12px" }}>
      <div className="t-caption" style={{ color: fg }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: fg }}>{value}</div>
    </div>
  );
}

// A chase list is only useful if you can take it out of the app and work it.
function exportCsv(rows) {
  const head = ["employee_id", "full_name", "designation", "status", "allocations"];
  const status = (p) => !p.has_logged_in ? "Not signed in"
                      : p.targets_waiting > 0 ? "Target waiting" : "Active";
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [head.join(","), ...rows.map(p => [
    p.employee_id, p.full_name, p.designation, status(p), p.allocations
  ].map(esc).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = "people.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ── Clients ───────────────────────────────────────────────────────────────── */

const usd = (n) => n == null ? "—"
  : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function ClientsLens() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { kadApi.clients().then(setData).catch(e => setErr(e.message)); }, []);

  if (err) return <div className="alert alert-danger">{err}</div>;
  if (!data) return <div className="loading-center"><span className="spinner" /></div>;

  const clients = data.clients || [];
  if (clients.length === 0)
    return <div className="empty"><p className="empty-title">No clients yet</p>
      <p className="empty-body">Clients are set up by an administrator.</p></div>;

  return (
    <div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Client</th><th>Projects</th><th>People</th>
              <th>Contract</th><th>Collected</th>
            </tr></thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.client_name}</strong>
                    {c.status !== "Active" && <span className="t-caption"> · {c.status}</span>}
                  </td>
                  <td className="t-mono">
                    {c.active_projects}
                    {c.projects !== c.active_projects && (
                      <span className="t-caption"> of {c.projects}</span>
                    )}
                  </td>
                  <td className="t-mono">{c.people}</td>
                  <td className="t-mono">{usd(c.contract_usd)}</td>
                  <td className="t-mono">{usd(c.collected_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="t-caption mt-2">
        Converted to USD so clients billing in different currencies can be compared.
      </p>
    </div>
  );
}
