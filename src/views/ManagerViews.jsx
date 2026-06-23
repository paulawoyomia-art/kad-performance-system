import { useState, useEffect, useCallback } from "react";
import {
  dashboard as dashApi,
  flags as flagsApi,
  projectMgmt,
  setup,
  periods as periodsApi,
  projects as projectsApi,
  allocations as allocApi,
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
  const { data: people } = useAsync(() => setup.listPeople(actor?.kad_id || null), []);
  const { data: projects } = useAsync(() => projectsApi.list(), []);
  const { data: periods } = useAsync(() => periodsApi.list(), []);
  const [form, setForm] = useState({ employee_id: "", project_id: "", period_id: defaultPeriod || "", output_metric: "", unit: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

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
          <input className="form-input" value={form.output_metric} onChange={e => f("output_metric", e.target.value)} placeholder="e.g. Sites commissioned" />
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
  const { data: clients } = useAsync(() => setup.listClients(actor?.kad_id || null), []);
  const { data: people } = useAsync(() => setup.listPeople(actor?.kad_id || null), []);
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
      await setup.createProject({
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
  const { data: people } = useAsync(() => setup.listPeople(actor?.kad_id || null), []);
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
  const { data: subs, loading } = useAsync(() => allocApi.listSubmissions(alloc.id), [alloc.id]);
  const [proofUrls, setProofUrls] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [queryMode, setQueryMode] = useState(false);
  const [queryText, setQueryText] = useState("");

  async function viewProof(sub) {
    if (proofUrls[sub.id]) { window.open(proofUrls[sub.id], "_blank"); return; }
    try {
      const url = await allocApi.fetchProof(alloc.id, sub.id);
      setProofUrls(p => ({ ...p, [sub.id]: url }));
      window.open(url, "_blank");
    } catch (e) { setErr(e.message); }
  }
  async function doSignoff() {
    setErr(""); setBusy(true);
    try { await allocApi.performSignoff(alloc.id); onSignoff?.(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  async function doQuery() {
    if (!queryText.trim()) { setErr("Please describe the issue."); return; }
    setErr(""); setBusy(true);
    try { await allocApi.raiseQuery(alloc.id, queryText.trim()); onQueried?.(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  const total = subs?.reduce((s, x) => s + (Number(x.actual_output) || 0), 0) ?? 0;

  return (
    <Modal title={`Review — ${alloc.output_metric}${alloc.employee_name ? ` · ${alloc.employee_name}` : ""}`} onClose={onClose}
      footer={canSignoff ? <>
        <button className="btn btn-secondary" onClick={() => setQueryMode(q => !q)} disabled={busy}>
          {queryMode ? "Cancel query" : "Raise a query"}
        </button>
        {!queryMode && <button className="btn btn-primary" onClick={doSignoff} disabled={busy}>
          {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Sign off"}
        </button>}
        {queryMode && <button className="btn btn-primary" onClick={doQuery} disabled={busy}>Send query</button>}
      </> : <button className="btn btn-secondary" onClick={onClose}>Close</button>}>

      <div className="flex items-center gap-3 mb-3" style={{ flexWrap: "wrap" }}>
        <span className="t-caption">Target: <strong>{alloc.target_value}</strong></span>
        <span className="t-caption">Total submitted: <strong>{total}</strong></span>
        <span className="t-caption">Achievement: <strong>{pct(alloc.achievement_pct)}</strong></span>
      </div>

      {queryMode && (
        <div className="form-group">
          <label className="form-label">What needs fixing?</label>
          <textarea className="form-textarea" value={queryText} onChange={e => setQueryText(e.target.value)}
            placeholder="Describe what's wrong or missing — this goes back to the employee." />
        </div>
      )}

      {loading && <div className="loading-center"><span className="spinner" /></div>}
      {!loading && subs?.length === 0 && <p className="t-caption">No submissions yet for this allocation.</p>}
      {subs?.map(s => (
        <div key={s.id} className="card" style={{ marginBottom: 8 }}>
          <div className="flex justify-between items-center">
            <strong>{s.actual_output} {alloc.unit || ""}</strong>
            <span className="t-caption">{s.date_of_activity}</span>
          </div>
          {s.output_narrative && <p className="t-caption mt-1">{s.output_narrative}</p>}
          {s.blockers && <p className="t-caption mt-1" style={{ color: "var(--warning)" }}>Blockers: {s.blockers}</p>}
          <div className="flex items-center gap-2 mt-2" style={{ flexWrap: "wrap" }}>
            {s.submitted_by_name && <span className="t-caption">by {s.submitted_by_name}</span>}
            {s.proof_key && <button className="btn btn-ghost btn-sm" onClick={() => viewProof(s)}>View proof</button>}
          </div>
          {s.proof_description && <p className="t-caption mt-1" style={{ fontStyle: "italic" }}>{s.proof_description}</p>}
        </div>
      ))}
      {err && <div className="alert alert-danger mt-2">{err}</div>}
    </Modal>
  );
}
