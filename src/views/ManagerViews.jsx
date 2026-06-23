import { useState, useEffect, useCallback, useRef } from "react";
import {
  dashboard as dashApi,
  flags as flagsApi,
  projectMgmt,
  setup,
  periods as periodsApi,
  projects as projectsApi,
  allocations as allocApi,
  resources as resourcesApi,
} from "../api/client";

// ── shared small helpers ──────────────────────────────────────────────────────
function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fn()); } catch (e) { setError(e.message); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}
const pct = (n) => (n == null ? "—" : `${(n * 100).toFixed(0)}%`);
const money = (n) => (n == null ? "—" : `₦${Number(n).toLocaleString()}`);

const HEALTH_COLORS = {
  "On track": "badge-success", "Minor issues": "badge-info",
  "At risk": "badge-warning", "Critical": "badge-danger",
};
function HealthBadge({ value, label }) {
  if (!value) return <span className="badge badge-neutral">{label ? `${label}: not set` : "—"}</span>;
  return <span className={`badge ${HEALTH_COLORS[value] || "badge-neutral"}`}>{label ? `${label}: ${value}` : value}</span>;
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 1. DIRECTOR KAD DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
export function KadDashboard({ selectedPeriod }) {
  const { data, loading } = useAsync(
    () => dashApi.kad(selectedPeriod || null),
    [selectedPeriod]
  );

  if (loading) return <div className="loading-center"><span className="spinner" /></div>;
  if (!data) return <div className="empty"><p className="empty-title">No dashboard data</p></div>;

  const { kad, totals, employees, projects } = data;

  return (
    <div>
      <h2 className="t-title mb-4">{kad?.kad_name} — live overview</h2>

      {/* Totals band */}
      <div className="tile-grid">
        <div className="tile"><div className="tile-value">{kad?.headcount ?? "—"}</div><div className="tile-label">People</div></div>
        <div className="tile"><div className="tile-value">{totals?.locked ?? 0}/{totals?.allocations ?? 0}</div><div className="tile-label">Targets locked</div></div>
        <div className="tile"><div className="tile-value">{pct(totals?.avg_achievement)}</div><div className="tile-label">Avg achievement</div></div>
        <div className="tile">
          <div className="tile-value" style={{ color: totals?.urgent_flags > 0 ? "var(--danger)" : "inherit" }}>
            {totals?.open_flags ?? 0}
          </div>
          <div className="tile-label">Open flags{totals?.urgent_flags > 0 ? ` (${totals.urgent_flags} urgent)` : ""}</div>
        </div>
      </div>

      {/* Per-project */}
      <h3 className="t-subtitle mt-4 mb-2">Projects</h3>
      {projects?.length === 0 && <div className="empty"><p className="empty-body">No projects in this KAD yet.</p></div>}
      {projects?.map(p => (
        <div key={p.id} className="card" style={{ marginBottom: 10 }}>
          <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: 8 }}>
            <div>
              <strong>{p.project_name}</strong>
              <span className="t-caption" style={{ marginLeft: 6 }}>{p.client_name}</span>
            </div>
            <span className="badge badge-neutral">{p.status}</span>
          </div>
          <div className="flex items-center gap-3 mt-2" style={{ flexWrap: "wrap" }}>
            <HealthBadge value={p.health_computed} label="computed" />
            <HealthBadge value={p.health_lead} label="lead" />
          </div>
          <div className="flex items-center gap-3 mt-2" style={{ flexWrap: "wrap" }}>
            <span className="t-caption">Contract: <strong>{money(p.contract_value)}</strong></span>
            <span className="t-caption">Collected: <strong>{money(p.revenue_collected)}</strong></span>
            <span className="t-caption">({pct(p.collection_pct)})</span>
          </div>
        </div>
      ))}

      {/* Per-employee */}
      <h3 className="t-subtitle mt-4 mb-2">People</h3>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Targets</th><th>Achievement</th><th>Submitted</th></tr></thead>
            <tbody>
              {employees?.map(e => (
                <tr key={e.id}>
                  <td><strong>{e.full_name}</strong></td>
                  <td><span className="t-caption">{e.designation}</span></td>
                  <td>{e.allocations}</td>
                  <td>{e.allocations > 0 ? pct(e.avg_achievement) : "—"}</td>
                  <td>{e.allocations > 0 ? `${e.submitted}/${e.allocations}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 2. MANAGE TAB — New allocation + New project
// ════════════════════════════════════════════════════════════════════════════
export function ManageView({ actor, selectedPeriod }) {
  const [showAlloc, setShowAlloc] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [msg, setMsg] = useState("");

  return (
    <div>
      <h2 className="t-title mb-4">Manage</h2>
      {msg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{msg}<button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setMsg("")}>Dismiss</button></div>}

      <div className="grid-2">
        <div className="card">
          <h3 className="t-subtitle">New allocation</h3>
          <p className="t-caption mt-1">Assign a new output to track for an employee — the metric and unit. A target is set afterwards.</p>
          <button className="btn btn-primary btn-sm mt-3" onClick={() => setShowAlloc(true)}>+ New allocation</button>
        </div>
        <div className="card">
          <h3 className="t-subtitle">New project</h3>
          <p className="t-caption mt-1">Create a project under a client. You can assign a Project Lead and manage it afterwards.</p>
          <button className="btn btn-primary btn-sm mt-3" onClick={() => setShowProject(true)}>+ New project</button>
        </div>
      </div>

      {showAlloc && <NewAllocationModal actor={actor} defaultPeriod={selectedPeriod}
        onClose={() => setShowAlloc(false)} onDone={() => { setShowAlloc(false); setMsg("Allocation created."); }} />}
      {showProject && <NewProjectModal actor={actor}
        onClose={() => setShowProject(false)} onDone={() => { setShowProject(false); setMsg("Project created."); }} />}
    </div>
  );
}

export function NewAllocationModal({ actor, defaultPeriod, onClose, onDone }) {
  const { data: people } = useAsync(() => allocApi.allocatablePeople(actor?.kad_id || null), []);
  const { data: projects } = useAsync(() => projectsApi.list(), []);
  const { data: periods } = useAsync(() => periodsApi.list(), []);
  const [form, setForm] = useState({ employee_id: "", project_id: "", period_id: defaultPeriod || "", output_metric: "", unit: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Role-matched output suggestions — a starting menu, not a constraint.
  // The manager can pick one or type their own ("or add a new one").
  const OUTPUTS_BY_TYPE = {
    Field: [
      ["Sites commissioned", "count"], ["Sites surveyed", "count"],
      ["Faults resolved", "count"], ["Preventive maintenance visits", "count"],
      ["Fibre laid", "km"], ["Uptime", "%"],
    ],
    Support: [
      ["Tickets closed", "count"], ["First-response SLA met", "%"],
      ["Reports delivered", "count"], ["Documentation updated", "count"],
    ],
    Management: [
      ["Projects delivered on time", "%"], ["Team utilisation", "%"],
      ["Client reviews completed", "count"], ["Revenue collected", "₦"],
    ],
  };
  const selectedPerson = people?.find(p => String(p.id) === String(form.employee_id));
  const suggestions = selectedPerson ? (OUTPUTS_BY_TYPE[selectedPerson.staff_type] || []) : [];

  async function save() {
    setErr("");
    if (!form.employee_id || !form.project_id || !form.period_id || !form.output_metric.trim()) {
      setErr("Employee, project, period and output metric are all required."); return;
    }
    setSaving(true);
    try {
      await allocApi.create({
        employee_id: Number(form.employee_id), project_id: Number(form.project_id),
        period_id: Number(form.period_id), output_metric: form.output_metric.trim(),
        unit: form.unit.trim() || null,
      });
      onDone?.();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title="New allocation" onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Create allocation"}</button>
      </>}>
      <div className="form-group"><label className="form-label">Employee <span>*</span></label>
        <select className="form-select" value={form.employee_id} onChange={e => f("employee_id", e.target.value)}>
          <option value="">Select…</option>
          {people?.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.employee_id})</option>)}
        </select>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Project <span>*</span></label>
          <select className="form-select" value={form.project_id} onChange={e => f("project_id", e.target.value)}>
            <option value="">Select…</option>
            {projects?.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Period <span>*</span></label>
          <select className="form-select" value={form.period_id} onChange={e => f("period_id", e.target.value)}>
            <option value="">Select…</option>
            {periods?.filter(p => p.status !== "Closed").map(p => <option key={p.id} value={p.id}>{p.period_label} · {p.status}</option>)}
          </select>
        </div>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Output metric <span>*</span></label>
          {suggestions.length > 0 && (
            <div className="flex gap-1 mb-2" style={{ flexWrap: "wrap" }}>
              {suggestions.map(([m, u]) => (
                <button key={m} type="button" className="btn btn-ghost btn-sm"
                  style={{ padding: "2px 8px", fontSize: "0.8em" }}
                  onClick={() => { f("output_metric", m); f("unit", u); }}>
                  + {m}
                </button>
              ))}
            </div>
          )}
          <input className="form-input" value={form.output_metric} onChange={e => f("output_metric", e.target.value)} placeholder="e.g. Sites commissioned" />
          {selectedPerson && suggestions.length > 0 && <p className="t-caption mt-1">Suggestions for {selectedPerson.staff_type} roles — or type your own.</p>}
        </div>
        <div className="form-group"><label className="form-label">Unit</label>
          <input className="form-input" value={form.unit} onChange={e => f("unit", e.target.value)} placeholder="e.g. count, km, %" />
        </div>
      </div>
      {err && <div className="alert alert-danger">{err}</div>}
    </Modal>
  );
}

export function NewProjectModal({ actor, onClose, onDone }) {
  const { data: clients } = useAsync(() => allocApi.myClients(actor?.kad_id || null), []);
  const { data: people } = useAsync(() => allocApi.allocatablePeople(actor?.kad_id || null), []);
  const [form, setForm] = useState({ project_name: "", client_id: "", status: "Prospecting", contract_value: "", project_lead_id: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const STATUSES = ["Prospecting", "Negotiation", "Awarded", "Active", "Closing", "On Hold", "Completed"];

  async function save() {
    setErr("");
    if (!form.project_name.trim() || !form.client_id) { setErr("Project name and client are required."); return; }
    setSaving(true);
    try {
      await projectsApi.create({
        project_name: form.project_name.trim(), client_id: Number(form.client_id),
        status: form.status, contract_value: form.contract_value ? Number(form.contract_value) : 0,
        project_lead_id: form.project_lead_id ? Number(form.project_lead_id) : null,
      });
      onDone?.();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title="New project" onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Create project"}</button>
      </>}>
      <div className="form-group"><label className="form-label">Project name <span>*</span></label>
        <input className="form-input" value={form.project_name} onChange={e => f("project_name", e.target.value)} placeholder="e.g. MTN Site Rollout Q3" />
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Client <span>*</span></label>
          <select className="form-select" value={form.client_id} onChange={e => f("client_id", e.target.value)}>
            <option value="">Select…</option>
            {clients?.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => f("status", e.target.value)}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Contract value (₦)</label>
          <input className="form-input" type="number" min="0" value={form.contract_value} onChange={e => f("contract_value", e.target.value)} placeholder="0" />
        </div>
        <div className="form-group"><label className="form-label">Project Lead</label>
          <select className="form-select" value={form.project_lead_id} onChange={e => f("project_lead_id", e.target.value)}>
            <option value="">None</option>
            {people?.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>
      {err && <div className="alert alert-danger">{err}</div>}
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 3. FLAG MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════
const SEV_CLS = { Urgent: "badge-danger", "Needs review": "badge-warning", Informational: "badge-info" };
const FLAG_STATUS_CLS = { Open: "badge-danger", Acknowledged: "badge-warning", Escalated: "badge-info", Resolved: "badge-success" };

export function FlagManagement({ actor, selectedPeriod }) {
  const { data: flags, loading, reload } = useAsync(
    () => selectedPeriod ? flagsApi.list(selectedPeriod) : Promise.resolve([]),
    [selectedPeriod]
  );
  const { data: people } = useAsync(() => allocApi.allocatablePeople(actor?.kad_id || null), []);
  const [managing, setManaging] = useState(null);

  const open = flags?.filter(f => f.status !== "Resolved") || [];
  const resolved = flags?.filter(f => f.status === "Resolved") || [];

  return (
    <div>
      <h2 className="t-title mb-4">Flags</h2>
      {!selectedPeriod && <div className="empty"><p className="empty-title">Select a period to see flags.</p></div>}
      {selectedPeriod && loading && <div className="loading-center"><span className="spinner" /></div>}
      {selectedPeriod && !loading && flags?.length === 0 && (
        <div className="empty"><p className="empty-title">No flags</p><p className="empty-body">Nothing flagged for this period. That's a good thing.</p></div>
      )}

      {open.length > 0 && <h3 className="t-subtitle mb-2">Needs attention ({open.length})</h3>}
      {open.map(f => <FlagCard key={f.id} flag={f} onManage={() => setManaging(f)} />)}

      {resolved.length > 0 && <h3 className="t-subtitle mt-4 mb-2" style={{ color: "var(--text-secondary)" }}>Resolved ({resolved.length})</h3>}
      {resolved.map(f => <FlagCard key={f.id} flag={f} onManage={() => setManaging(f)} dim />)}

      {managing && <FlagManageModal flag={managing} people={people}
        onClose={() => setManaging(null)} onDone={() => { setManaging(null); reload(); }} />}
    </div>
  );
}

function FlagCard({ flag, onManage, dim }) {
  return (
    <div className="card" style={{ marginBottom: 10, opacity: dim ? 0.6 : 1 }}>
      <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: 8 }}>
        <div>
          <strong>{flag.type}</strong>
          {flag.employee_name && <span className="t-caption" style={{ marginLeft: 6 }}>— {flag.employee_name}</span>}
          {flag.output_metric && <span className="t-caption" style={{ marginLeft: 4 }}>({flag.output_metric})</span>}
        </div>
        <div className="flex gap-2 items-center">
          <span className={`badge ${SEV_CLS[flag.severity] || "badge-neutral"}`}>{flag.severity}</span>
          <span className={`badge ${FLAG_STATUS_CLS[flag.status] || "badge-neutral"}`}>{flag.status}</span>
        </div>
      </div>
      {flag.recommended_action && <p className="t-caption mt-2">{flag.recommended_action}</p>}
      {flag.assigned_to_name && <p className="t-caption mt-1">Assigned to: <strong>{flag.assigned_to_name}</strong></p>}
      {flag.notes && <p className="t-caption mt-1" style={{ fontStyle: "italic" }}>"{flag.notes}"</p>}
      <button className="btn btn-secondary btn-sm mt-2" onClick={onManage}>Manage</button>
    </div>
  );
}

function FlagManageModal({ flag, people, onClose, onDone }) {
  const [notes, setNotes] = useState(flag.notes || "");
  const [assignee, setAssignee] = useState(flag.assigned_to_id || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function act(body) {
    setErr(""); setBusy(true);
    try { await flagsApi.manage(flag.id, body); onDone?.(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  async function saveNotesAndAssignee() {
    setErr(""); setBusy(true);
    try {
      if (notes !== (flag.notes || "")) await flagsApi.manage(flag.id, { action: "note", notes });
      if (String(assignee) !== String(flag.assigned_to_id || "")) await flagsApi.manage(flag.id, { action: "assign", assigned_to_id: Number(assignee) });
      onDone?.();
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <Modal title={`Manage flag — ${flag.type}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={saveNotesAndAssignee} disabled={busy}>Save notes & assignee</button>
      </>}>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        {flag.status === "Open" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act({ action: "acknowledge" })}>Acknowledge</button>}
        {flag.status !== "Resolved" && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act({ action: "resolve" })}>Mark resolved</button>}
        {flag.status !== "Resolved" && flag.status !== "Escalated" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act({ action: "escalate" })}>Escalate</button>}
        {flag.status === "Resolved" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act({ action: "reopen" })}>Reopen</button>}
      </div>
      <div className="form-group"><label className="form-label">Assign to</label>
        <select className="form-select" value={assignee} onChange={e => setAssignee(e.target.value)}>
          <option value="">Nobody</option>
          {people?.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>
      <div className="form-group"><label className="form-label">Notes</label>
        <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Working notes on this flag…" />
      </div>
      {err && <div className="alert alert-danger">{err}</div>}
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 4. PROJECT LEAD WORKSPACE
// ════════════════════════════════════════════════════════════════════════════
export function ProjectWorkspace({ actor }) {
  const { data: projects, loading, reload } = useAsync(() => projectsApi.list(), []);
  const [active, setActive] = useState(null);

  // Only show projects this person leads (or all, if director/admin — backend enforces writes)
  const mine = projects?.filter(p => p.project_lead_id === actor?.id) || [];
  const others = projects?.filter(p => p.project_lead_id !== actor?.id) || [];

  if (loading) return <div className="loading-center"><span className="spinner" /></div>;

  return (
    <div>
      <h2 className="t-title mb-4">Projects</h2>
      {projects?.length === 0 && <div className="empty"><p className="empty-title">No projects yet</p><p className="empty-body">Create one from the Manage tab.</p></div>}

      {mine.length > 0 && <h3 className="t-subtitle mb-2">Projects you lead</h3>}
      {mine.map(p => <ProjectCard key={p.id} project={p} onOpen={() => setActive(p)} isLead />)}

      {others.length > 0 && <h3 className="t-subtitle mt-4 mb-2" style={{ color: "var(--text-secondary)" }}>Other projects</h3>}
      {others.map(p => <ProjectCard key={p.id} project={p} onOpen={() => setActive(p)} />)}

      {active && <ProjectDetailModal project={active} actor={actor}
        onClose={() => setActive(null)} onChanged={() => { reload(); }} />}
    </div>
  );
}

function ProjectCard({ project, onOpen, isLead }) {
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: 8 }}>
        <div>
          <strong>{project.project_name}</strong>
          {isLead && <span className="badge badge-info" style={{ marginLeft: 8 }}>You lead</span>}
        </div>
        <span className="badge badge-neutral">{project.status}</span>
      </div>
      <div className="flex items-center gap-3 mt-2" style={{ flexWrap: "wrap" }}>
        <span className="t-caption">Contract: <strong>{money(project.contract_value)}</strong></span>
        <span className="t-caption">Collected: <strong>{money(project.revenue_collected)}</strong></span>
        <span className="t-caption">({pct(project.collection_pct)})</span>
      </div>
      <button className="btn btn-secondary btn-sm mt-2" onClick={onOpen}>Open</button>
    </div>
  );
}

function ProjectDetailModal({ project, actor, onClose, onChanged }) {
  const [tab, setTab] = useState("overview");
  const { data: slas, reload: reloadSlas } = useAsync(() => projectMgmt.listSlas(project.id), [project.id]);
  const { data: milestones, reload: reloadMs } = useAsync(() => projectMgmt.listMilestones(project.id), [project.id]);
  const [p, setP] = useState(project);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const STATUSES = ["Prospecting", "Negotiation", "Awarded", "Active", "Closing", "On Hold", "Completed"];
  const HEALTHS = ["On track", "Minor issues", "At risk", "Critical"];

  async function saveOverview() {
    setErr(""); setBusy(true);
    try {
      await projectMgmt.manage(project.id, {
        status: p.status, revenue_collected: Number(p.revenue_collected) || 0,
        health_lead: p.health_lead || null, health_note: p.health_note || null,
      });
      onChanged?.();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal title={project.project_name} onClose={onClose}>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {["overview", "slas", "milestones"].map(t => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "overview" ? "Overview" : t === "slas" ? "SLAs" : "Milestones"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-select" value={p.status} onChange={e => setP({ ...p, status: e.target.value })}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Revenue collected (₦)</label>
              <input className="form-input" type="number" min="0" value={p.revenue_collected} onChange={e => setP({ ...p, revenue_collected: e.target.value })} />
            </div>
          </div>
          <div className="form-group"><label className="form-label">Your health assessment</label>
            <select className="form-select" value={p.health_lead || ""} onChange={e => setP({ ...p, health_lead: e.target.value })}>
              <option value="">Not set</option>
              {HEALTHS.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Health note</label>
            <textarea className="form-textarea" value={p.health_note || ""} onChange={e => setP({ ...p, health_note: e.target.value })} placeholder="Why this assessment?" />
          </div>
          {err && <div className="alert alert-danger">{err}</div>}
          <button className="btn btn-primary" onClick={saveOverview} disabled={busy}>{busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Save changes"}</button>
        </div>
      )}

      {tab === "slas" && <SlaManager projectId={project.id} slas={slas} reload={reloadSlas} />}
      {tab === "milestones" && <MilestoneManager projectId={project.id} milestones={milestones} reload={reloadMs} />}
    </Modal>
  );
}

function SlaManager({ projectId, slas, reload }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", target_threshold: "0.9", due_date: "" });
  const [busy, setBusy] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function add() {
    setBusy(true);
    try {
      await projectMgmt.createSla(projectId, { name: form.name.trim(), target_threshold: Number(form.target_threshold), due_date: form.due_date || null });
      setForm({ name: "", target_threshold: "0.9", due_date: "" }); setAdding(false); reload();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  async function setStatus(id, status) { await projectMgmt.updateSla(id, { status }); reload(); }
  async function remove(id) { if (confirm("Delete this SLA? Linked allocations stay, just unlinked.")) { await projectMgmt.deleteSla(id); reload(); } }

  return (
    <div>
      {slas?.length === 0 && <p className="t-caption mb-2">No SLAs yet. Add one to track a delivery commitment.</p>}
      {slas?.map(s => (
        <div key={s.id} className="card" style={{ marginBottom: 8 }}>
          <div className="flex justify-between items-center">
            <strong>{s.name}</strong>
            <span className={`badge ${s.status === "Met" ? "badge-success" : s.status === "Breached" ? "badge-danger" : "badge-neutral"}`}>{s.status}</span>
          </div>
          <div className="flex items-center gap-3 mt-1" style={{ flexWrap: "wrap" }}>
            <span className="t-caption">Threshold: {pct(s.target_threshold)}</span>
            <span className="t-caption">Fulfilment: <strong>{pct(s.fulfilment_pct)}</strong></span>
            <span className="t-caption">({s.linked_allocations} linked)</span>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setStatus(s.id, "Met")}>Mark met</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setStatus(s.id, "Breached")}>Mark breached</button>
            <button className="btn btn-ghost btn-sm" onClick={() => remove(s.id)}>Delete</button>
          </div>
        </div>
      ))}
      {!adding ? (
        <button className="btn btn-secondary btn-sm mt-2" onClick={() => setAdding(true)}>+ Add SLA</button>
      ) : (
        <div className="card mt-2">
          <div className="form-group"><label className="form-label">SLA name</label>
            <input className="form-input" value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Site commissioning" />
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Threshold (0–1)</label>
              <input className="form-input" type="number" min="0" max="1" step="0.05" value={form.target_threshold} onChange={e => f("target_threshold", e.target.value)} />
            </div>
            <div className="form-group"><label className="form-label">Due date</label>
              <input className="form-input" type="date" value={form.due_date} onChange={e => f("due_date", e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={add} disabled={busy || !form.name.trim()}>Add</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MilestoneManager({ projectId, milestones, reload }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", due_date: "", value_amount: "" });
  const [busy, setBusy] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const STATUSES = ["Pending", "In progress", "Done", "Missed"];

  async function add() {
    setBusy(true);
    try {
      await projectMgmt.createMilestone(projectId, { name: form.name.trim(), due_date: form.due_date || null, value_amount: form.value_amount ? Number(form.value_amount) : 0 });
      setForm({ name: "", due_date: "", value_amount: "" }); setAdding(false); reload();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  async function setStatus(id, status) { await projectMgmt.updateMilestone(id, { status }); reload(); }
  async function remove(id) { if (confirm("Delete this milestone?")) { await projectMgmt.deleteMilestone(id); reload(); } }

  return (
    <div>
      {milestones?.length === 0 && <p className="t-caption mb-2">No milestones yet.</p>}
      {milestones?.map(m => (
        <div key={m.id} className="card" style={{ marginBottom: 8 }}>
          <div className="flex justify-between items-center">
            <strong>{m.name}</strong>
            <span className={`badge ${m.status === "Done" ? "badge-success" : m.status === "Missed" ? "badge-danger" : m.status === "In progress" ? "badge-info" : "badge-neutral"}`}>{m.status}</span>
          </div>
          <div className="flex items-center gap-3 mt-1" style={{ flexWrap: "wrap" }}>
            {m.due_date && <span className="t-caption">Due: {m.due_date}</span>}
            {m.value_amount > 0 && <span className="t-caption">Value: {money(m.value_amount)}</span>}
          </div>
          <div className="flex gap-2 mt-2" style={{ flexWrap: "wrap" }}>
            {STATUSES.map(s => <button key={s} className="btn btn-ghost btn-sm" onClick={() => setStatus(m.id, s)} disabled={m.status === s}>{s}</button>)}
            <button className="btn btn-ghost btn-sm" onClick={() => remove(m.id)}>Delete</button>
          </div>
        </div>
      ))}
      {!adding ? (
        <button className="btn btn-secondary btn-sm mt-2" onClick={() => setAdding(true)}>+ Add milestone</button>
      ) : (
        <div className="card mt-2">
          <div className="form-group"><label className="form-label">Milestone name</label>
            <input className="form-input" value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Phase 1 complete" />
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Due date</label>
              <input className="form-input" type="date" value={form.due_date} onChange={e => f("due_date", e.target.value)} />
            </div>
            <div className="form-group"><label className="form-label">Value (₦)</label>
              <input className="form-input" type="number" min="0" value={form.value_amount} onChange={e => f("value_amount", e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={add} disabled={busy || !form.name.trim()}>Add</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 5. SUBMISSION REVIEW  (inspect work + proof before sign-off; raise a query)
// ════════════════════════════════════════════════════════════════════════════
export function SubmissionReview({ alloc, canSignoff, onClose, onSignoff, onQueried }) {
  const { data: subs, loading, reload } = useAsync(() => allocApi.listSubmissions(alloc.id), [alloc.id]);
  const [proofUrls, setProofUrls] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [queryFor, setQueryFor] = useState(null);   // submission id being queried
  const [queryText, setQueryText] = useState("");
  const [proofView, setProofView] = useState(null); // { url, name } — open the zoomable viewer

  async function viewProof(sub) {
    try {
      let url = proofUrls[sub.id];
      if (!url) {
        url = await allocApi.fetchProof(alloc.id, sub.id);
        setProofUrls(p => ({ ...p, [sub.id]: url }));
      }
      setProofView({ url, name: sub.proof_description || `Proof — ${sub.date_of_activity}`,
                     isPdf: /\.pdf($|\?)/i.test(sub.proof_key || "") });
    } catch (e) { setErr(e.message); }
  }
  async function doSignoff() {
    setErr(""); setBusy(true);
    try { await allocApi.confirm(alloc.id); onSignoff?.(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  async function sendQuery(subId) {
    if (!queryText.trim()) { setErr("Describe what needs fixing."); return; }
    setErr(""); setBusy(true);
    try {
      await allocApi.querySubmission(alloc.id, subId, queryText.trim());
      setQueryFor(null); setQueryText("");
      onQueried?.();
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  async function clearQuery(subId) {
    setBusy(true);
    try { await allocApi.resolveSubmission(alloc.id, subId); reload(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const total = subs?.reduce((s, x) => s + (Number(x.actual_output) || 0), 0) ?? 0;
  const hasOpenQuery = subs?.some(s => s.query_note && !s.query_resolved_at);

  return (
    <Modal title={`Review — ${alloc.output_metric}${alloc.employee_name ? ` · ${alloc.employee_name}` : ""}`} onClose={onClose}
      footer={canSignoff ? <>
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Close</button>
        <button className="btn btn-primary" onClick={doSignoff} disabled={busy || hasOpenQuery}
          title={hasOpenQuery ? "Resolve the open query before confirming" : ""}>
          {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Confirm output"}
        </button>
      </> : <button className="btn btn-secondary" onClick={onClose}>Close</button>}>

      <div className="flex items-center gap-3 mb-3" style={{ flexWrap: "wrap" }}>
        <span className="t-caption">Target: <strong>{alloc.target_value}</strong></span>
        <span className="t-caption">Total submitted: <strong>{total}</strong></span>
        <span className="t-caption">Achievement: <strong>{pct(alloc.achievement_pct)}</strong></span>
      </div>
      {hasOpenQuery && canSignoff && (
        <div className="alert alert-warning mb-3">An open query is awaiting the employee's revision. You can confirm once it's resolved.</div>
      )}

      {loading && <div className="loading-center"><span className="spinner" /></div>}
      {!loading && subs?.length === 0 && <p className="t-caption">No submissions yet for this allocation.</p>}
      {subs?.map(s => {
        const open = s.query_note && !s.query_resolved_at;
        return (
          <div key={s.id} className="card" style={{ marginBottom: 8, borderLeft: open ? "3px solid var(--warning)" : undefined }}>
            <div className="flex justify-between items-center">
              <strong>{s.actual_output} {alloc.unit || ""}</strong>
              <span className="t-caption">{s.date_of_activity}</span>
            </div>
            {s.output_narrative && <p className="t-caption mt-1">{s.output_narrative}</p>}
            {s.blockers && <p className="t-caption mt-1" style={{ color: "var(--warning)" }}>Blockers: {s.blockers}</p>}

            {/* Existing query on this submission */}
            {s.query_note && (
              <div className="mt-2" style={{ padding: 8, background: "var(--surface-2, #f5f5f5)", borderRadius: 6 }}>
                <p className="t-caption" style={{ fontWeight: 600 }}>
                  {open ? "Queried" : "Query (resolved)"}{s.queried_by_name ? ` by ${s.queried_by_name}` : ""}
                </p>
                <p className="t-caption">"{s.query_note}"</p>
                {s.revised_at && <p className="t-caption" style={{ color: "var(--success)" }}>Revised by a later entry.</p>}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2" style={{ flexWrap: "wrap" }}>
              {s.submitted_by_name && <span className="t-caption">by {s.submitted_by_name}</span>}
              {s.proof_key && <button className="btn btn-ghost btn-sm" onClick={() => viewProof(s)}>View proof</button>}
              {canSignoff && !open && queryFor !== s.id && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setQueryFor(s.id); setQueryText(""); }}>Query this entry</button>
              )}
              {canSignoff && open && (
                <button className="btn btn-ghost btn-sm" onClick={() => clearQuery(s.id)} disabled={busy}>Mark resolved</button>
              )}
            </div>

            {/* Inline query composer for this submission */}
            {queryFor === s.id && (
              <div className="mt-2">
                <textarea className="form-textarea" value={queryText} onChange={e => setQueryText(e.target.value)}
                  placeholder="What's wrong with this entry? This goes to the employee to revise." />
                <div className="flex gap-2 mt-1">
                  <button className="btn btn-primary btn-sm" onClick={() => sendQuery(s.id)} disabled={busy || !queryText.trim()}>Send query</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setQueryFor(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {err && <div className="alert alert-danger mt-2">{err}</div>}
      {proofView && <ProofViewer proof={proofView} onClose={() => setProofView(null)} />}
    </Modal>
  );
}

// Full-resolution proof viewer with zoom + pan, rendered in-app (no new tab).
function ProofViewer({ proof, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  const zoomIn  = () => setZoom(z => Math.min(8, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)));
  const reset   = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  function onWheel(e) {
    e.preventDefault();
    setZoom(z => Math.min(8, Math.max(0.25, +(z - e.deltaY * 0.001).toFixed(2))));
  }
  function onDown(e) { dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; }
  function onMove(e) { if (dragRef.current) setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y }); }
  function onUp() { dragRef.current = null; }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 1000 }}>
      <div className="modal" style={{ maxWidth: "92vw", width: "92vw", height: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ fontSize: "0.95rem" }}>{proof.name}</h2>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={zoomOut} title="Zoom out">−</button>
            <span className="t-caption" style={{ minWidth: 44, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button className="btn btn-ghost btn-sm" onClick={zoomIn} title="Zoom in">+</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Reset</button>
            <a className="btn btn-ghost btn-sm" href={proof.url} target="_blank" rel="noreferrer">Open in tab</a>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>
        <div
          onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          style={{ flex: 1, overflow: "hidden", background: "var(--surface-2, #f0f0f0)",
                   display: "flex", alignItems: "center", justifyContent: "center",
                   cursor: zoom > 1 ? "grab" : "default", position: "relative" }}>
          {proof.isPdf ? (
            <iframe title="proof" src={proof.url} style={{ width: "100%", height: "100%", border: "none" }} />
          ) : (
            <img src={proof.url} alt={proof.name} draggable={false}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                       transformOrigin: "center center", transition: dragRef.current ? "none" : "transform 0.05s",
                       maxWidth: "100%", maxHeight: "100%", userSelect: "none" }} />
          )}
        </div>
        <div style={{ padding: "8px 12px" }}>
          <p className="t-caption">Scroll to zoom · drag to pan · or use the controls above.</p>
        </div>
      </div>
    </div>
  );
}
// 6. CROSS-KAD RESOURCE VISIBILITY  (capacity only; HRBP/Director/Exec/admin)
// ════════════════════════════════════════════════════════════════════════════
function ModeHeader({ mode, setMode, onExport }) {
  return (
    <div className="flex justify-between items-center mb-2" style={{ flexWrap: "wrap", gap: 8 }}>
      <div className="flex gap-2 items-center" style={{ flexWrap: "wrap" }}>
        <h2 className="t-title" style={{ marginRight: 8 }}>Resources</h2>
        <button className={`btn btn-sm ${mode === "loaded" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("loaded")}>Loaded</button>
        <button className={`btn btn-sm ${mode === "bench" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("bench")}>Idle bench</button>
      </div>
      {onExport && <button className="btn btn-secondary btn-sm" onClick={onExport}>Export CSV</button>}
    </div>
  );
}

function BenchCard({ r, tone }) {
  return (
    <div className="card" style={{ marginBottom: 8, borderLeft: `3px solid var(--${tone === "success" ? "success" : "warning"})` }}>
      <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: 8 }}>
        <div>
          <strong>{r.full_name}</strong>
          <span className="t-caption" style={{ marginLeft: 6 }}>{r.designation}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="badge badge-neutral">{r.kad_name}</span>
          <span className={`badge ${tone === "success" ? "badge-success" : "badge-warning"}`}>{r.bench_status}</span>
        </div>
      </div>
      {r.bench_status === "Work complete" && (
        <p className="t-caption mt-1">{r.alloc_count} allocation{r.alloc_count === 1 ? "" : "s"} this period, all signed off.</p>
      )}
    </div>
  );
}

export function ResourceVisibility({ selectedPeriod }) {
  const [mode, setMode] = useState("loaded"); // 'loaded' | 'bench'
  const { data: rows, loading } = useAsync(
    () => selectedPeriod
      ? (mode === "bench" ? resourcesApi.bench(selectedPeriod) : resourcesApi.list(selectedPeriod))
      : Promise.resolve([]),
    [selectedPeriod, mode]
  );
  const [kadFilter, setKadFilter] = useState("");
  const [showManagers, setShowManagers] = useState(false);
  const [sortBy, setSortBy] = useState("headroom"); // headroom = least committed first

  if (loading) return <div className="loading-center"><span className="spinner" /></div>;
  if (!rows) return <div className="empty"><p className="empty-title">No data</p></div>;

  // ── Bench (idle) mode ──
  if (mode === "bench") {
    const kadsB = [...new Set(rows.map(r => r.kad_name))].sort();
    let viewB = (kadFilter ? rows.filter(r => r.kad_name === kadFilter) : rows);
    // Managers (LM/Director/HRBP/Executive) aren't trackable "bench" resources —
    // hide them by default so the bench shows people you can actually assign.
    const managerCount = viewB.filter(r => !!r.is_manager).length;
    if (!showManagers) viewB = viewB.filter(r => !r.is_manager);
    const neverAssigned = viewB.filter(r => r.bench_status === "Never assigned");
    const workComplete  = viewB.filter(r => r.bench_status === "Work complete");
    return (
      <div>
        <ModeHeader mode={mode} setMode={setMode} />
        <p className="t-caption mb-3">People with no in-flight project work this period — your assignable bench.</p>
        <div className="flex items-center gap-2 mb-3" style={{ flexWrap: "wrap" }}>
          <select className="form-select" style={{ width: "auto" }} value={kadFilter} onChange={e => setKadFilter(e.target.value)}>
            <option value="">All KADs</option>
            {kadsB.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          {managerCount > 0 && (
            <label className="flex items-center gap-2 t-caption" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={showManagers} onChange={e => setShowManagers(e.target.checked)} />
              Show managers ({managerCount})
            </label>
          )}
        </div>
        {!selectedPeriod && <div className="empty"><p className="empty-title">Select a period</p></div>}
        {selectedPeriod && viewB.length === 0 && <div className="empty"><p className="empty-title">Nobody idle</p><p className="empty-body">Everyone assignable has active project work this period.</p></div>}

        {neverAssigned.length > 0 && <h3 className="t-subtitle mb-2">Never assigned ({neverAssigned.length})</h3>}
        {neverAssigned.map(r => <BenchCard key={r.employee_id} r={r} tone="warning" />)}

        {workComplete.length > 0 && <h3 className="t-subtitle mt-4 mb-2">Work complete — now free ({workComplete.length})</h3>}
        {workComplete.map(r => <BenchCard key={r.employee_id} r={r} tone="success" />)}
      </div>
    );
  }

  const kads = [...new Set(rows.map(r => r.kad_name))].sort();
  let view = kadFilter ? rows.filter(r => r.kad_name === kadFilter) : rows;
  view = [...view].sort((a, b) => {
    if (sortBy === "headroom") return (a.active_allocations - b.active_allocations) || (a.outstanding_pct - b.outstanding_pct);
    if (sortBy === "load") return (b.active_allocations - a.active_allocations);
    return a.full_name.localeCompare(b.full_name);
  });

  function exportCsv() {
    const headers = ["Name", "KAD", "Role", "Total allocations", "Active commitments", "Outstanding %"];
    const lines = [headers.join(",")];
    for (const r of view) {
      lines.push([
        `"${r.full_name}"`, `"${r.kad_name}"`, `"${r.designation}"`,
        r.total_allocations, r.active_allocations,
        r.outstanding_pct == null ? "" : Math.round(r.outstanding_pct * 100),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `resource-load-${selectedPeriod || "all"}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function loadBadge(r) {
    // simple capacity signal: 0 active = free, 1-2 = some, 3+ = heavy
    if (r.active_allocations === 0) return <span className="badge badge-success">Headroom</span>;
    if (r.active_allocations <= 2) return <span className="badge badge-info">Some load</span>;
    return <span className="badge badge-warning">Heavy</span>;
  }

  return (
    <div>
      <ModeHeader mode={mode} setMode={setMode} onExport={exportCsv} />
      <p className="t-caption mb-3">Capacity across the organisation for cross-KAD resource planning. Shows load only — not performance detail.</p>

      <div className="flex items-center gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        <select className="form-select" style={{ width: "auto" }} value={kadFilter} onChange={e => setKadFilter(e.target.value)}>
          <option value="">All KADs</option>
          {kads.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select className="form-select" style={{ width: "auto" }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="headroom">Most headroom first</option>
          <option value="load">Heaviest load first</option>
          <option value="name">Name</option>
        </select>
      </div>

      {!selectedPeriod && <div className="empty"><p className="empty-title">Select a period</p></div>}
      {selectedPeriod && view.length === 0 && <div className="empty"><p className="empty-body">No active resources in scope.</p></div>}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Name</th><th>KAD</th><th>Role</th>
              <th>Allocations</th><th>Active</th><th>Outstanding</th><th>Capacity</th>
            </tr></thead>
            <tbody>
              {view.map(r => (
                <tr key={`${r.employee_id}-${r.period_id}`}>
                  <td><strong>{r.full_name}</strong></td>
                  <td><span className="t-caption">{r.kad_name}</span></td>
                  <td><span className="t-caption">{r.designation}</span></td>
                  <td>{r.total_allocations}</td>
                  <td>{r.active_allocations}</td>
                  <td>{r.outstanding_pct == null ? "—" : `${Math.round(r.outstanding_pct * 100)}%`}</td>
                  <td>{loadBadge(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 7. ORG-WIDE EAGLE-EYE DASHBOARD  (admin + Executive)
// ════════════════════════════════════════════════════════════════════════════
export function OrgDashboard({ selectedPeriod }) {
  const { data, loading } = useAsync(
    () => dashApi.org(selectedPeriod || null),
    [selectedPeriod]
  );
  if (loading) return <div className="loading-center"><span className="spinner" /></div>;
  if (!data) return <div className="empty"><p className="empty-title">No data</p></div>;
  const { org, kads } = data;

  function exportCsv() {
    const headers = ["KAD", "Headcount", "Active projects", "Allocations", "Locked", "Avg achievement %", "Contract", "Collected", "Collection %", "Open flags"];
    const lines = [headers.join(",")];
    for (const k of kads) {
      lines.push([
        `"${k.kad_name}"`, k.headcount, k.active_projects, k.allocations, k.locked,
        k.avg_achievement == null ? "" : Math.round(k.avg_achievement * 100),
        k.contract_value, k.revenue_collected,
        k.collection_pct == null ? "" : Math.round(k.collection_pct * 100),
        k.open_flags,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `org-overview-${selectedPeriod || "all"}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2" style={{ flexWrap: "wrap", gap: 8 }}>
        <h2 className="t-title">Organisation overview — all KADs</h2>
        <button className="btn btn-secondary btn-sm" onClick={exportCsv}>Export CSV</button>
      </div>

      {/* Org totals */}
      <div className="tile-grid">
        <div className="tile"><div className="tile-value">{org.headcount}</div><div className="tile-label">People</div></div>
        <div className="tile"><div className="tile-value">{org.active_projects}</div><div className="tile-label">Active projects</div></div>
        <div className="tile"><div className="tile-value">{pct(org.avg_achievement)}</div><div className="tile-label">Avg achievement</div></div>
        <div className="tile"><div className="tile-value">{pct(org.collection_pct)}</div><div className="tile-label">Collection</div></div>
        <div className="tile">
          <div className="tile-value" style={{ color: org.urgent_flags > 0 ? "var(--danger)" : "inherit" }}>{org.open_flags}</div>
          <div className="tile-label">Open flags{org.urgent_flags > 0 ? ` (${org.urgent_flags} urgent)` : ""}</div>
        </div>
      </div>

      <p className="t-caption mt-2 mb-3">Revenue: {money(org.revenue_collected)} collected of {money(org.contract_value)} contracted.</p>

      {/* Per-KAD table */}
      <h3 className="t-subtitle mb-2">By KAD</h3>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>KAD</th><th>People</th><th>Projects</th><th>Targets</th>
              <th>Achievement</th><th>Collection</th><th>Flags</th>
            </tr></thead>
            <tbody>
              {kads.map(k => (
                <tr key={k.kad_id}>
                  <td><strong>{k.kad_name}</strong></td>
                  <td>{k.headcount}</td>
                  <td>{k.active_projects}</td>
                  <td>{k.locked}/{k.allocations}</td>
                  <td>{k.allocations > 0 ? pct(k.avg_achievement) : "—"}</td>
                  <td>{pct(k.collection_pct)}</td>
                  <td>
                    {k.open_flags > 0
                      ? <span className={`badge ${k.urgent_flags > 0 ? "badge-danger" : "badge-warning"}`}>{k.open_flags}</span>
                      : <span className="badge badge-success">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
