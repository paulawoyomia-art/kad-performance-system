import { useState, useEffect } from "react";
import { kad as kadApi, canvas as canvasApi, org as orgApi } from "../api/client";
import { KadDashboard, ProjectWorkspace, ResourceVisibility, NewProjectModal,
         FlagManagement } from "./ManagerViews";

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
  const [newProject, setNewProject] = useState(false);

  // The API decides what this person may see; we ask once so the lens buttons
  // can't offer something the server would refuse.
  useEffect(() => {
    kadApi.people().then(r => setScope(r.scope)).catch(() => setScope("none"));
  }, []);

  const wide = scope === "kad" || scope === "org";
  const lenses = [
    ["people", "People"],
    // Flags had no home at all: the engine has been raising them on a cron with
    // nowhere to show them, and the acknowledge/assign/resolve actions were
    // built and unreachable. The API already scopes them per role.
    ["flags", "Flags"],
    // Utilisation sits next to People because both answer "who do I have and
    // what are they carrying". It was previously a collapsed section at the
    // bottom of the overview — which is a poor home for the one genuinely
    // cross-KAD view in the app.
    ...(wide ? [["utilisation", "Utilisation"], ["overview", "Overview"],
                ["projects", "Projects"], ["clients", "Clients"]] : []),
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
      {lens === "flags"       && <FlagManagement actor={actor} selectedPeriod={selectedPeriod} />}
      {lens === "utilisation" && <ResourceVisibility selectedPeriod={selectedPeriod} />}
      {lens === "overview" && <KadDashboard actor={actor} selectedPeriod={selectedPeriod} onAnyAction={onAnyAction} />}
      {lens === "projects" && <ProjectWorkspace actor={actor}
        onNewProject={() => setNewProject(true)} />}
      {lens === "clients"  && <ClientsLens />}

      {newProject && (
        <NewProjectModal actor={actor}
          onClose={() => setNewProject(false)}
          onDone={() => setNewProject(false)} />
      )}
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
  const [team, setTeam] = useState(null);   // today's blockers, from the canvas
  const [drill, setDrill] = useState(null); // a direct report's KAD, opened on demand

  useEffect(() => { kadApi.people().then(setData).catch(e => setErr(e.message)); }, []);
  useEffect(() => { canvasApi.team().then(setTeam).catch(() => setTeam(null)); }, []);

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
      {/* Today's blockers first — the one thing here you can act on the same day. */}
      {team && (team.blockers || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p className="t-label mb-2">Blocked today</p>
          {team.blockers.map(b => (
            <div key={b.id} className="alert alert-warning" style={{ marginBottom: 6 }}>
              <strong>{b.full_name}:</strong> {b.body}
            </div>
          ))}
        </div>
      )}

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
              <th>Name</th><th>Role</th><th>Status</th><th>Allocations</th><th></th>
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
                    <td>
                      {/* Their KAD isn't shown inline — four directors' worth of
                          activity would bury the list. One click, on demand. */}
                      {p.is_direct_report === 1 && p.kad_id && (
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => setDrill({ id: p.kad_id, name: p.kad_name, who: p.full_name })}>
                          View {p.kad_name}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drill && <KadDrill kad={drill} onClose={() => setDrill(null)} />}

      <p className="t-caption mt-2">
        Everyone in your scope, whether or not they've ever opened the app — the register
        can't show you these people, because it only lists allocations. Blockers raised
        today appear above; the fuller day-by-day view is in My day → Your team.
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
        Contract and collected are converted to USD, so clients billing in different
        currencies can be compared directly. Clients themselves are set up by an
        administrator — ask them to add or change one.
      </p>
    </div>
  );
}

/**
 * One direct report's KAD, opened on demand.
 *
 * An executive has four directors; showing every one of their KADs inline would
 * bury the very list this lens exists for. So it's a click, and it opens the two
 * things worth seeing: who is in that KAD, and what they're working on.
 */
function KadDrill({ kad, onClose }) {
  const [people, setPeople] = useState(null);
  const [activity, setActivity] = useState(null);
  const [view, setView] = useState("activity");

  useEffect(() => {
    kadApi.people(kad.id).then(r => setPeople(r.people || [])).catch(() => setPeople([]));
    orgApi.activity(null, kad.id).then(r => setActivity(r.rows || [])).catch(() => setActivity([]));
  }, [kad.id]);

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ marginBottom: 2 }}>{kad.name}</h2>
            <p className="t-caption" style={{ margin: 0 }}>Run by {kad.who}</p>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
            <button className={`btn btn-sm ${view === "activity" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setView("activity")}>Activity</button>
            <button className={`btn btn-sm ${view === "people" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setView("people")}>People</button>
          </div>

          {view === "activity" && (
            !activity ? <div className="loading-center"><span className="spinner" /></div>
            : activity.length === 0 ? <p className="t-caption">No work allocated in this KAD yet.</p>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Person</th><th>Work</th><th>Target</th><th>Actual</th><th>Stage</th></tr></thead>
                  <tbody>
                    {activity.map(r => (
                      <tr key={r.id}>
                        <td>{r.employee_name}</td>
                        <td>{r.output_metric}
                          {r.project_name && <span className="t-caption" style={{ display: "block" }}>{r.project_name}</span>}</td>
                        <td className="t-mono">{r.target_value ?? "—"}</td>
                        <td className="t-mono">{r.target_locked ? (r.actual ?? 0) : "—"}</td>
                        <td><span className="badge badge-neutral">{r.work_status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {view === "people" && (
            !people ? <div className="loading-center"><span className="spinner" /></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Allocations</th></tr></thead>
                  <tbody>
                    {people.map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.full_name}</strong></td>
                        <td className="t-caption">{p.designation || "—"}</td>
                        <td>
                          {!p.has_logged_in
                            ? <span className="badge badge-danger">Not signed in</span>
                            : p.targets_waiting > 0
                              ? <span className="badge badge-warning">Target waiting</span>
                              : <span className="badge badge-success">Active</span>}
                        </td>
                        <td className="t-mono">{p.allocations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
