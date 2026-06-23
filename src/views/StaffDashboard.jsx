import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AppShell, { Icons } from "../components/AppShell";
import { useAuth } from "../auth/AuthContext";
import { allocations as allocApi, periods as periodsApi, setup, flags as flagsApi } from "../api/client";
import { KadDashboard, ManageView, FlagManagement, ProjectWorkspace, SubmissionReview,
         NewAllocationModal, NewProjectModal } from "./ManagerViews";

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
  const [reviewing, setReviewing] = useState(false);

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
          {alloc.employee_name && !isOwner && (
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{alloc.employee_name}</div>
          )}
          <span style={{ fontWeight: 600, color: alloc.employee_name && !isOwner ? "var(--text-secondary)" : "inherit" }}>
            {alloc.output_metric}
          </span>
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
          <SetTargetButton allocId={alloc.id}
            who={alloc.employee_name} metric={alloc.output_metric} unit={alloc.unit}
            onDone={() => { onAction?.(); }} />
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
        {!!alloc.hrbp_confirmation && !alloc.director_approval && isDir && (
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
        {/* Review work — managers can inspect submissions + proof anytime once locked */}
        {locked && !isOwner && (isLM || isHRBP || isDir) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setReviewing(true)}>
            Review work
          </button>
        )}
        {/* Sign-off — now goes through the review screen (inspect before signing) */}
        {locked && !alloc.signoff_performed && isLM && (
          <button className="btn btn-secondary btn-sm" onClick={() => setReviewing(true)}>
            Review &amp; sign off
          </button>
        )}
        {!!alloc.signoff_performed && !alloc.director_signoff_confirmation && isDir && (
          <button className="btn btn-secondary btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.confirmSignoffDirector(alloc.id), "Confirm SO")}>
            Confirm sign-off
          </button>
        )}
        {!!alloc.signoff_performed && !alloc.hrbp_signoff_confirmation && isHRBP && (
          <button className="btn btn-secondary btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.confirmSignoffHRBP(alloc.id), "Confirm SO")}>
            Confirm sign-off
          </button>
        )}
      </div>
      {actionErr && <p className="form-error" style={{ marginTop: 8 }}>{actionErr}</p>}
      {reviewing && (
        <SubmissionReview alloc={alloc} canSignoff={isLM && !alloc.signoff_performed}
          onClose={() => setReviewing(false)}
          onSignoff={() => { setReviewing(false); onAction?.(); }}
          onQueried={() => { setReviewing(false); onAction?.(); }} />
      )}
    </div>
  );
}

function SetTargetButton({ allocId, who, metric, unit, onDone }) {
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
    <form onSubmit={save} style={{ width: "100%" }}>
      {who && (
        <p className="t-caption" style={{ marginBottom: 6 }}>
          Setting target for <strong>{who}</strong> — {metric}{unit ? ` (${unit})` : ""}
        </p>
      )}
      <div className="flex gap-2 items-center">
        <input className="form-input" type="number" min="0" step="any" value={val}
          onChange={e => setVal(e.target.value)} placeholder={`Target${unit ? ` in ${unit}` : ""}`}
          style={{ width: 140 }} autoFocus />
        <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !val}>
          {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Save"}
        </button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setOpen(false); setErr(""); }}>✕</button>
      </div>
      {err && <span className="form-error" style={{ display: "block", marginTop: 6 }}>{err}</span>}
    </form>
  );
}

// ── My Allocations view ───────────────────────────────────────────────────────
function MyAllocations({ actor, periods, selectedPeriod, setSelectedPeriod, onAnyAction }) {
  const { data: allocs, loading, reload } = useAsync(
    () => selectedPeriod ? allocApi.list(selectedPeriod, actor.id) : Promise.resolve([]),
    [selectedPeriod, actor.id]
  );
  const [submitting, setSubmitting] = useState(null);
  const refresh = () => { reload(); onAnyAction?.(); };

  return (
    <div>
      <h2 className="t-title mb-4">My work this period</h2>
      {!selectedPeriod && <div className="empty"><p className="empty-title">Select a period</p><p className="empty-body">Choose a period above to see your work.</p></div>}
      {selectedPeriod && loading && <div className="loading-center"><span className="spinner" /></div>}
      {selectedPeriod && !loading && allocs?.length === 0 && <div className="empty"><p className="empty-title">Nothing assigned yet</p><p className="empty-body">You don't have any work targets for this period yet. Your manager or HR team will set these up.</p></div>}
      {allocs?.map(a => (
        <AllocRow key={a.id} alloc={a} actor={actor} roles={actor.roles} onAction={refresh}
          onSubmit={setSubmitting} />
      ))}
      {submitting && <SubmitModal alloc={submitting} onClose={() => setSubmitting(null)} onDone={refresh} />}
    </div>
  );
}

// ── Team Allocations view (managers / directors / HRBP) ───────────────────────
function TeamAllocations({ actor, periods, selectedPeriod, setSelectedPeriod, onAnyAction }) {
  const { data: allocs, loading, reload } = useAsync(
    () => selectedPeriod ? allocApi.list(selectedPeriod) : Promise.resolve([]),
    [selectedPeriod]
  );
  const [quickAlloc, setQuickAlloc] = useState(false);
  const [quickProject, setQuickProject] = useState(false);
  const refresh = () => { reload(); onAnyAction?.(); };

  const scoped = allocs?.filter(a =>
    actor.roles?.some(r =>
      r.scope_employee_id === a.employee_id || r.scope_employee_id == null
    )
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: "wrap", gap: 8 }}>
        <h2 className="t-title">My team this period</h2>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setQuickAlloc(true)}>+ Allocation</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setQuickProject(true)}>+ Project</button>
        </div>
      </div>
      {!selectedPeriod && <div className="empty"><p className="empty-title">Select a period</p></div>}
      {selectedPeriod && loading && <div className="loading-center"><span className="spinner" /></div>}
      {selectedPeriod && !loading && scoped?.length === 0 && <div className="empty"><p className="empty-title">No one in your scope</p><p className="empty-body">There's no team work for you to act on in this period.</p></div>}
      {scoped?.map(a => (
        <AllocRow key={a.id} alloc={a} actor={actor} roles={actor.roles} onAction={refresh} onSubmit={null} />
      ))}
      {quickAlloc && <NewAllocationModal actor={actor} defaultPeriod={selectedPeriod}
        onClose={() => setQuickAlloc(false)} onDone={() => { setQuickAlloc(false); refresh(); }} />}
      {quickProject && <NewProjectModal actor={actor}
        onClose={() => setQuickProject(false)} onDone={() => setQuickProject(false)} />}
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

// ── Action inbox: computes "what's waiting on you right now" ───────────────────
function ActionInbox({ allocations, actor, roles, onGoTo }) {
  if (!allocations) return null;

  const items = [];
  for (const a of allocations) {
    const isOwner = a.employee_id === actor?.id;
    const scoped  = (name) => roles?.some(r => r.role_name === name &&
      (r.scope_employee_id === a.employee_id || r.scope_employee_id == null));
    const isLM   = scoped("Line Manager");
    const isHRBP = scoped("HRBP");
    const isDir  = scoped("KAD Director");
    const name   = a.employee_name || a.output_metric;

    // Owner: acknowledge my target
    if (isOwner && a.target_set_by_id && !a.employee_acknowledged)
      items.push({ key: `ack-${a.id}`, urgent: true, action: "Acknowledge your target",
        context: `${a.output_metric} — review and accept the number set for you`, goto: "my" });
    // Owner: submit work (locked, ready)
    if (isOwner && a.target_locked === 1)
      items.push({ key: `sub-${a.id}`, urgent: false, action: "Submit your work",
        context: `${a.output_metric} — log progress against your target of ${a.target_value}`, goto: "my" });
    // LM/Dir: set a target
    if (!a.target_set_by_id && (isLM || isDir) && !isOwner)
      items.push({ key: `set-${a.id}`, urgent: true, action: `Set a target for ${name}`,
        context: `${a.output_metric} — no target set yet`, goto: "team" });
    // HRBP: confirm a target (after employee ack)
    if (a.target_set_by_id && a.employee_acknowledged && !a.hrbp_confirmation && isHRBP)
      items.push({ key: `conf-${a.id}`, urgent: true, action: `Confirm ${name}'s target`,
        context: `${a.output_metric} — employee has acknowledged, awaiting your confirmation`, goto: "team" });
    // Dir: approve a target
    if (a.hrbp_confirmation && !a.director_approval && isDir)
      items.push({ key: `appr-${a.id}`, urgent: true, action: `Approve ${name}'s target`,
        context: `${a.output_metric} — HRBP confirmed, awaiting your final approval`, goto: "team" });
    // LM: perform sign-off
    if (a.target_locked === 1 && !a.signoff_performed && isLM && !isOwner)
      items.push({ key: `so-${a.id}`, urgent: false, action: `Sign off ${name}'s output`,
        context: `${a.output_metric} — period work complete, perform sign-off`, goto: "team" });
    // Dir: confirm sign-off
    if (a.signoff_performed && !a.director_signoff_confirmation && isDir)
      items.push({ key: `sod-${a.id}`, urgent: false, action: `Confirm sign-off for ${name}`,
        context: `${a.output_metric} — sign-off performed, awaiting your confirmation`, goto: "team" });
    // HRBP: confirm sign-off
    if (a.signoff_performed && !a.hrbp_signoff_confirmation && isHRBP)
      items.push({ key: `soh-${a.id}`, urgent: false, action: `Confirm sign-off for ${name}`,
        context: `${a.output_metric} — sign-off performed, awaiting your confirmation`, goto: "team" });
  }

  // urgent first
  items.sort((x, y) => (y.urgent ? 1 : 0) - (x.urgent ? 1 : 0));

  return (
    <div className="inbox">
      <div className="inbox-header">
        <span className="inbox-title">Waiting on you</span>
        {items.length > 0 && <span className="inbox-count">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <div className="inbox-empty">
          <svg className="inbox-empty-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
          </svg>
          <p style={{ fontWeight: 600 }}>You're all caught up</p>
          <p className="t-caption" style={{ marginTop: 2 }}>Nothing needs your attention right now.</p>
        </div>
      ) : (
        items.map(it => (
          <button key={it.key} className="inbox-item" onClick={() => onGoTo?.(it.goto)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
            <span className={`inbox-item-dot ${it.urgent ? "urgent" : ""}`} />
            <span className="inbox-item-body">
              <span className="inbox-item-action">{it.action}</span>
              <span className="inbox-item-context">{it.context}</span>
            </span>
            <span style={{ color: "var(--text-muted)" }}>›</span>
          </button>
        ))
      )}
    </div>
  );
}

// ── StaffDashboard ────────────────────────────────────────────────────────────
export default function StaffDashboard() {
  const { actor, canSetTargets, canConfirm, canApprove, canSignoff, canConfirmSO, hasRole } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { data: periods } = useAsync(() => periodsApi.list());
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  const isDirector  = hasRole("KAD Director");
  const isHRBP      = hasRole("HRBP");
  const isLineMgr   = hasRole("Line Manager");
  const isOperational = isDirector || isHRBP || isLineMgr || actor?.is_hr_manager;

  const ALL_TABS = ["my","team","flags","kad","manage","projects"];
  const pathTab = location.pathname.replace(/^\//, "") || "my";
  const tab = ALL_TABS.includes(pathTab) ? pathTab : "my";
  const setTab = (t) => navigate(`/${t}`);

  // Auto-select the first Open period (fallback to most recent non-closed)
  useEffect(() => {
    if (periods && !selectedPeriod) {
      const open = periods.find(p => p.status === "Open")
                || periods.find(p => p.status !== "Closed");
      if (open) setSelectedPeriod(String(open.id));
    }
  }, [periods, selectedPeriod]);

  const roles = actor?.roles || [];
  const hasRoleActions = canSetTargets() || canConfirm() || canApprove() || canSignoff() || canConfirmSO();

  // Allocations for the inbox — pull both "mine" and (if a manager) my whole team's
  const { data: inboxAllocs, reload: reloadInbox } = useAsync(
    () => selectedPeriod ? allocApi.list(selectedPeriod) : Promise.resolve([]),
    [selectedPeriod]
  );

  // Build nav as structured items for AppShell (desktop sidebar + mobile bottom bar)
  const navItems = [
    { key: "my", label: "My work", mobileLabel: "My work", icon: Icons.allocations,
      active: tab === "my", onClick: () => setTab("my") },
    ...(hasRoleActions ? [
      { key: "team", label: "My team", mobileLabel: "Team", icon: Icons.team,
        active: tab === "team", onClick: () => setTab("team") },
    ] : []),
    ...(isDirector ? [
      { key: "kad", label: "KAD", mobileLabel: "KAD", icon: Icons.home,
        active: tab === "kad", onClick: () => setTab("kad") },
    ] : []),
    ...(isOperational ? [
      { key: "projects", label: "Projects", mobileLabel: "Projects", icon: Icons.allocations,
        active: tab === "projects", onClick: () => setTab("projects") },
    ] : []),
    ...(hasRoleActions ? [
      { key: "flags", label: "Flags", mobileLabel: "Flags", icon: Icons.flags,
        active: tab === "flags", onClick: () => setTab("flags") },
    ] : []),
    ...(isOperational ? [
      { key: "manage", label: "Manage", mobileLabel: "Manage", icon: Icons.setup,
        active: tab === "manage", onClick: () => setTab("manage") },
    ] : []),
  ];

  const titleMap = { my: "My work", team: "My team", flags: "Flags",
                     kad: "KAD overview", manage: "Manage", projects: "Projects" };

  return (
    <AppShell title={titleMap[tab] || "My work"} navItems={navItems}>
      {/* Period selector — always visible, plain language */}
      {periods && periods.length > 0 && (
        <div className="flex items-center gap-2 mb-4" style={{ flexWrap: "wrap" }}>
          <span className="t-caption">Period:</span>
          <select className="form-select" style={{ width: "auto", minWidth: 160 }}
            value={selectedPeriod || ""} onChange={e => setSelectedPeriod(e.target.value)}>
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.period_label} · {p.status}</option>
            ))}
          </select>
        </div>
      )}

      {/* Action inbox — only on the home tab */}
      {tab === "my" && selectedPeriod && (
        <ActionInbox allocations={inboxAllocs} actor={actor} roles={roles}
          onGoTo={(t) => setTab(t)} />
      )}

      {/* No period at all — guided empty state */}
      {(!periods || periods.length === 0) && (
        <div className="empty">
          <p className="empty-title">No active period yet</p>
          <p className="empty-body">Your administrator will open a performance period once targets are set. Check back soon.</p>
        </div>
      )}

      {periods && periods.length > 0 && (
        <>
          {tab === "my"    && <MyAllocations actor={actor} periods={periods} selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} onAnyAction={reloadInbox} />}
          {tab === "team"  && <TeamAllocations actor={actor} periods={periods} selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} onAnyAction={reloadInbox} />}
          {tab === "flags" && <FlagManagement actor={actor} selectedPeriod={selectedPeriod} />}
          {tab === "kad"   && <KadDashboard selectedPeriod={selectedPeriod} />}
          {tab === "manage" && <ManageView actor={actor} selectedPeriod={selectedPeriod} />}
          {tab === "projects" && <ProjectWorkspace actor={actor} />}
        </>
      )}
    </AppShell>
  );
}
