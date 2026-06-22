import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AppShell, { Icons } from "../components/AppShell";
import { useAuth } from "../auth/AuthContext";
import { allocations as allocApi, periods as periodsApi, setup, flags as flagsApi } from "../api/client";

// ── helpers ──────────────────────────────────────────────────────────────────
function useAsync(fn, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fn()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

function pct(n) { return n == null ? "—" : `${(n * 100).toFixed(0)}%`; }
function currency(n) { return n == null ? "—" : `₦${Number(n).toLocaleString()}`; }

function AchievementBar({ pct: p }) {
  if (p == null) return <span className="t-caption">No submissions yet</span>;
  const cls = p >= 1 ? "good" : p >= 0.5 ? "" : p >= 0.2 ? "warning" : "danger";
  return (
    <div className="flex items-center gap-2">
      <div className="progress-bar" style={{ width: 80, flexShrink: 0 }}>
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(100, p * 100)}%` }} />
      </div>
      <span className="t-mono t-caption">{pct(p)}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Confirmed: "badge-success", Queried: "badge-warning", Pending: "badge-neutral",
    Active: "badge-success", Drafting: "badge-info", Closed: "badge-neutral", Open: "badge-success",
  };
  return <span className={`badge ${map[status] || "badge-neutral"}`}>{status}</span>;
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

// ── Submission form ───────────────────────────────────────────────────────────
function SubmitModal({ alloc, onClose, onDone }) {
  const [form, setForm] = useState({ date_of_activity: "", actual_output: "", input: "", process: "", output_narrative: "", blockers: "", proof_description: "" });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  function f(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!file) { setErr("Proof attachment is required"); return; }
    setErr(""); setSaving(true);
    try {
      const fd = new FormData();
      fd.append("proof",            file);
      fd.append("date_of_activity", form.date_of_activity);
      fd.append("actual_output",    form.actual_output);
      fd.append("input",            form.input);
      fd.append("process",          form.process);
      fd.append("output_narrative", form.output_narrative);
      fd.append("proof_description", form.proof_description);
      if (form.blockers) fd.append("blockers", form.blockers);
      await allocApi.submit(alloc.id, fd);
      onDone?.(); onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={`Submit output — ${alloc.output_metric}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Submit"}
        </button>
      </>}>
      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        Target: <strong>{alloc.target_value} {alloc.unit || "units"}</strong> · Current: <strong>{alloc.actual_output_rollup} {alloc.unit || "units"}</strong>
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Date of activity <span>*</span></label>
          <input className="form-input" type="date" value={form.date_of_activity} onChange={e => f("date_of_activity", e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">Actual output <span>*</span></label>
          <input className="form-input" type="number" min="0" step="any" value={form.actual_output} onChange={e => f("actual_output", e.target.value)} placeholder={`in ${alloc.unit || "units"}`} required />
        </div>
      </div>
      <div className="form-group"><label className="form-label">Input used <span>*</span></label><input className="form-input" value={form.input} onChange={e => f("input", e.target.value)} placeholder="Resources, equipment, materials…" required /></div>
      <div className="form-group"><label className="form-label">Process / method <span>*</span></label><input className="form-input" value={form.process} onChange={e => f("process", e.target.value)} required /></div>
      <div className="form-group"><label className="form-label">Output narrative <span>*</span></label><textarea className="form-textarea" value={form.output_narrative} onChange={e => f("output_narrative", e.target.value)} placeholder="Describe what was achieved…" required /></div>
      <div className="form-group"><label className="form-label">Blockers (optional)</label><input className="form-input" value={form.blockers} onChange={e => f("blockers", e.target.value)} placeholder="Any issues or delays?" /></div>
      <div className="form-group">
        <label className="form-label">Proof attachment <span>*</span></label>
        <label>
          <div className={`upload-zone ${file ? "drag-over" : ""}`} style={{ padding: "16px" }}>
            {file
              ? <><svg className="upload-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg><span className="upload-text"><strong>{file.name}</strong></span></>
              : <><svg className="upload-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg><span className="upload-text"><strong>Choose file</strong> or drag here</span></>
            }
            <input type="file" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} accept="image/*,.pdf" />
          </div>
        </label>
      </div>
      <div className="form-group"><label className="form-label">Proof description <span>*</span></label><input className="form-input" value={form.proof_description} onChange={e => f("proof_description", e.target.value)} placeholder="Brief description of the attached proof" required /></div>
      {err && <div className="alert alert-danger">{err}</div>}
    </Modal>
  );
}

// ── Allocation row / card ─────────────────────────────────────────────────────
function AllocRow({ alloc, actor, roles, onAction, onSubmit }) {
  const [actionErr, setActionErr] = useState("");
  const [busy, setBusy]           = useState(false);

  const isOwner   = alloc.employee_id === actor?.id;
  const isLM      = roles?.some(r => r.role_name === "Line Manager" &&
    (r.scope_employee_id === alloc.employee_id || r.scope_employee_id == null));
  const isHRBP    = roles?.some(r => r.role_name === "HRBP" &&
    (r.scope_employee_id === alloc.employee_id || r.scope_employee_id == null));
  const isDir     = roles?.some(r => r.role_name === "KAD Director" &&
    (r.scope_employee_id === alloc.employee_id || r.scope_employee_id == null));

  async function act(fn, label) {
    setActionErr(""); setBusy(true);
    try { await fn(); onAction?.(); }
    catch (e) { setActionErr(e.message || label + " failed"); }
    finally { setBusy(false); }
  }

  const locked = alloc.target_locked === 1;

  // Self-approval flag indicators
  const selfApprTarget = alloc.self_approval_target === 1;
  const selfApprSO     = alloc.self_approval_signoff === 1;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
        <div>
          <span style={{ fontWeight: 600 }}>{alloc.output_metric}</span>
          {alloc.unit && <span className="t-caption" style={{ marginLeft: 6 }}>({alloc.unit})</span>}
        </div>
        <div className="flex gap-2 items-center">
          {selfApprTarget && <span className="badge badge-warning">Self-approval</span>}
          <StatusBadge status={alloc.signoff_status || "Pending"} />
        </div>
      </div>

      {/* Target chain status — four steps */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span className={`badge ${alloc.target_set_by_id ? "badge-success" : "badge-neutral"}`}>① Set</span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
        <span className={`badge ${alloc.employee_acknowledged ? "badge-success" : alloc.target_set_by_id ? "badge-warning" : "badge-neutral"}`}>
          ② Employee acknowledged
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
        <span className={`badge ${alloc.hrbp_confirmation ? "badge-success" : "badge-neutral"}`}>③ HRBP confirmed</span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
        <span className={`badge ${alloc.director_approval ? "badge-success" : "badge-neutral"}`}>④ Director approved</span>
        {locked && <span className="badge badge-success" style={{ marginLeft: 4 }}>🔒 Locked</span>}
      </div>

      {locked && (
        <div style={{ marginBottom: 10 }}>
          <div className="flex items-center gap-3">
            <span className="t-caption">Target: <strong>{alloc.target_value}</strong></span>
            <span className="t-caption">Actual: <strong>{alloc.actual_output_rollup}</strong></span>
            <AchievementBar pct={alloc.achievement_pct} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
        {/* ① Set target */}
        {!alloc.target_set_by_id && (isLM || isDir) && (
          <SetTargetButton allocId={alloc.id} onDone={() => { onAction?.(); }} />
        )}
        {/* ② Employee acknowledge — only the owner, only after target is set */}
        {alloc.target_set_by_id && !alloc.employee_acknowledged && isOwner && (
          <button className="btn btn-primary btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.acknowledgeTarget(alloc.id), "Acknowledge")}>
            Acknowledge target
          </button>
        )}
        {/* Nudge for managers: waiting on employee */}
        {alloc.target_set_by_id && !alloc.employee_acknowledged && !isOwner && (isLM || isHRBP || isDir) && (
          <span className="badge badge-warning" style={{ alignSelf: "center" }}>
            Awaiting employee acknowledgement
          </span>
        )}
        {/* ③ HRBP confirm — only after employee has acknowledged */}
        {alloc.target_set_by_id && alloc.employee_acknowledged && !alloc.hrbp_confirmation && isHRBP && (
          <button className="btn btn-secondary btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.confirmTarget(alloc.id), "Confirm")}>
            Confirm target
          </button>
        )}
        {/* ④ Director approve */}
        {alloc.hrbp_confirmation && !alloc.director_approval && isDir && (
          <button className="btn btn-secondary btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.approveTarget(alloc.id), "Approve")}>
            Approve target
          </button>
        )}
        {/* Submission */}
        {locked && isOwner && (
          <button className="btn btn-primary btn-sm" onClick={() => onSubmit?.(alloc)}>
            + Submit output
          </button>
        )}
        {/* Sign-off */}
        {locked && !alloc.signoff_performed && isLM && (
          <button className="btn btn-secondary btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.performSignoff(alloc.id), "Sign off")}>
            Perform sign-off
          </button>
        )}
        {alloc.signoff_performed && !alloc.director_signoff_confirmation && isDir && (
          <button className="btn btn-secondary btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.confirmSignoffDirector(alloc.id), "Confirm SO")}>
            Confirm sign-off
          </button>
        )}
        {alloc.signoff_performed && !alloc.hrbp_signoff_confirmation && isHRBP && (
          <button className="btn btn-secondary btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.confirmSignoffHRBP(alloc.id), "Confirm SO")}>
            Confirm sign-off
          </button>
        )}
      </div>
      {actionErr && <p className="form-error" style={{ marginTop: 8 }}>{actionErr}</p>}
    </div>
  );
}

function SetTargetButton({ allocId, onDone }) {
  const [open, setOpen]   = useState(false);
  const [val, setVal]     = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");
  async function save(e) {
    e.preventDefault(); if (!val) return;
    setErr(""); setSaving(true);
    try { await allocApi.setTarget(allocId, Number(val)); setOpen(false); setVal(""); onDone?.(); }
    catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }
  if (!open) return <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>Set target</button>;
  return (
    <form onSubmit={save} className="flex gap-2 items-center">
      <input className="form-input" type="number" min="0" step="any" value={val} onChange={e => setVal(e.target.value)} placeholder="Target value" style={{ width: 120 }} autoFocus />
      <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !val}>
        {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Save"}
      </button>
      <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setOpen(false); setErr(""); }}>✕</button>
      {err && <span className="form-error">{err}</span>}
    </form>
  );
}

// ── My Allocations view ───────────────────────────────────────────────────────
function MyAllocations({ actor, periods, selectedPeriod, setSelectedPeriod }) {
  const { data: allocs, loading, reload } = useAsync(
    () => selectedPeriod ? allocApi.list(selectedPeriod, actor.id) : Promise.resolve([]),
    [selectedPeriod, actor.id]
  );
  const [submitting, setSubmitting] = useState(null); // alloc to submit against

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">My allocations</h2>
        <select className="form-select" style={{ width: 200 }} value={selectedPeriod || ""} onChange={e => setSelectedPeriod(e.target.value || null)}>
          <option value="">Select period…</option>
          {periods?.filter(p => p.status !== "Closed").map(p => (
            <option key={p.id} value={p.id}>{p.period_label} ({p.status})</option>
          ))}
        </select>
      </div>

      {!selectedPeriod && <div className="empty"><p className="empty-title">Select a period</p><p className="empty-body">Choose an open period above to see your allocations.</p></div>}
      {selectedPeriod && loading && <div className="loading-center"><span className="spinner" /></div>}
      {selectedPeriod && !loading && allocs?.length === 0 && <div className="empty"><p className="empty-title">No allocations yet</p><p className="empty-body">Your allocations for this period haven't been set up yet. Contact your HR team.</p></div>}
      {allocs?.map(a => (
        <AllocRow key={a.id} alloc={a} actor={actor} roles={actor.roles} onAction={reload}
          onSubmit={setSubmitting} />
      ))}
      {submitting && <SubmitModal alloc={submitting} onClose={() => setSubmitting(null)} onDone={reload} />}
    </div>
  );
}

// ── Team Allocations view (managers / directors / HRBP) ───────────────────────
function TeamAllocations({ actor, periods, selectedPeriod, setSelectedPeriod }) {
  const { data: allocs, loading, reload } = useAsync(
    () => selectedPeriod ? allocApi.list(selectedPeriod) : Promise.resolve([]),
    [selectedPeriod]
  );

  // Filter to only show allocations the actor has a role-assignment for
  const scoped = allocs?.filter(a =>
    actor.roles?.some(r =>
      r.scope_employee_id === a.employee_id || r.scope_employee_id == null
    )
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">Team allocations</h2>
        <select className="form-select" style={{ width: 200 }} value={selectedPeriod || ""} onChange={e => setSelectedPeriod(e.target.value || null)}>
          <option value="">Select period…</option>
          {periods?.map(p => <option key={p.id} value={p.id}>{p.period_label} ({p.status})</option>)}
        </select>
      </div>
      {!selectedPeriod && <div className="empty"><p className="empty-title">Select a period</p></div>}
      {selectedPeriod && loading && <div className="loading-center"><span className="spinner" /></div>}
      {selectedPeriod && !loading && scoped?.length === 0 && <div className="empty"><p className="empty-title">No team allocations</p><p className="empty-body">No allocations found in your scope for this period.</p></div>}
      {scoped?.map(a => (
        <AllocRow key={a.id} alloc={a} actor={actor} roles={actor.roles} onAction={reload} onSubmit={null} />
      ))}
    </div>
  );
}

// ── Flags view ────────────────────────────────────────────────────────────────
function FlagsView({ periods, selectedPeriod }) {
  const { data: flagData, loading } = useAsync(
    () => selectedPeriod ? flagsApi.list(selectedPeriod) : Promise.resolve([]),
    [selectedPeriod]
  );
  const sevCls = { Urgent: "badge-danger", "Needs review": "badge-warning", Informational: "badge-info" };
  return (
    <div>
      <h2 className="t-title" style={{ marginBottom: 16 }}>Flags</h2>
      {!selectedPeriod && <div className="empty"><p className="empty-title">Select a period above to see flags.</p></div>}
      {selectedPeriod && loading && <div className="loading-center"><span className="spinner" /></div>}
      {selectedPeriod && !loading && flagData?.length === 0 && <div className="empty"><p className="empty-title">No flags</p><p className="empty-body">No issues flagged for this period.</p></div>}
      {flagData?.map(f => (
        <div key={f.id} className="card" style={{ marginBottom: 10 }}>
          <div className="flex justify-between items-center">
            <span style={{ fontWeight: 600 }}>{f.type}</span>
            <span className={`badge ${sevCls[f.severity] || "badge-neutral"}`}>{f.severity}</span>
          </div>
          {f.recommended_action && <p className="t-caption" style={{ marginTop: 6 }}>{f.recommended_action}</p>}
        </div>
      ))}
    </div>
  );
}

// ── StaffDashboard ────────────────────────────────────────────────────────────
export default function StaffDashboard() {
  const { actor, canSetTargets, canConfirm, canApprove, canSignoff, canConfirmSO } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { data: periods } = useAsync(() => periodsApi.list());
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  // Derive tab from current URL path
  const pathTab = location.pathname.replace(/^\//, "") || "my";
  const tab = ["my","team","flags"].includes(pathTab) ? pathTab : "my";
  const setTab = (t) => navigate(`/${t}`);

  // Auto-select the first Open period
  useEffect(() => {
    if (periods && !selectedPeriod) {
      const open = periods.find(p => p.status === "Open");
      if (open) setSelectedPeriod(String(open.id));
    }
  }, [periods, selectedPeriod]);

  const hasRoleActions = canSetTargets() || canConfirm() || canApprove() || canSignoff() || canConfirmSO();
  const tabs = [
    ...(hasRoleActions ? [{ id: "team", label: "Team" }] : []),
    ...(hasRoleActions ? [{ id: "flags", label: "Flags" }] : []),
  ];

  const nav = (
    <>
      <p className="nav-section-label">Work</p>
      {tabs.map(t => (
        <button key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
          {t.id === "my" ? Icons.allocations : t.id === "team" ? Icons.team : Icons.flags}
          {t.label}
        </button>
      ))}
      {periods && (
        <>
          <p className="nav-section-label" style={{ marginTop: 12 }}>Period</p>
          {periods.filter(p => p.status !== "Closed").map(p => (
            <button key={p.id}
              className={`nav-item ${selectedPeriod === String(p.id) ? "active" : ""}`}
              onClick={() => setSelectedPeriod(String(p.id))}>
              {Icons.periods}
              {p.period_label}
            </button>
          ))}
        </>
      )}
    </>
  );

  const tabLabel = tabs.find(t => t.id === tab)?.label || "";

  return (
    <AppShell title={tabLabel} nav={nav}>
      {tab === "my"    && <MyAllocations actor={actor} periods={periods} selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} />}
      {tab === "team"  && <TeamAllocations actor={actor} periods={periods} selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} />}
      {tab === "flags" && <FlagsView periods={periods} selectedPeriod={selectedPeriod} />}
    </AppShell>
  );
}
