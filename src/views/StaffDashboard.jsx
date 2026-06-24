import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AppShell, { Icons } from "../components/AppShell";
import { useAuth } from "../auth/AuthContext";
import { allocations as allocApi, periods as periodsApi, setup, flags as flagsApi } from "../api/client";
import { KadDashboard, ManageView, FlagManagement, ProjectWorkspace, SubmissionReview,
         NewAllocationModal, NewProjectModal, ResourceVisibility, OrgDashboard } from "./ManagerViews";

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

// Richer, employee-facing status from v_allocations.work_status
function WorkStatusBadge({ status, fallback }) {
  const s = status || fallback || "Pending";
  const map = {
    "Queried": "badge-warning",
    "Confirmed": "badge-success",
    "Signed off": "badge-success",
    "Under review": "badge-info",
    "Awaiting submission": "badge-neutral",
    "Target not locked": "badge-neutral",
    "Pending": "badge-neutral",
  };
  const label = { "Target not locked": "Not locked" }[s] || s;
  return <span className={`badge ${map[s] || "badge-neutral"}`}>{label}</span>;
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

  const acknowledged = alloc.employee_acknowledged === 1;
  const locked = alloc.target_locked === 1;                 // set + acknowledged
  const hrbpConfirmed = alloc.hrbp_signoff_confirmation === 1;
  const kadSealed = alloc.director_signoff_confirmation === 1;
  const hasTarget = !!alloc.target_set_by_id;

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
          <WorkStatusBadge status={alloc.work_status} fallback={alloc.signoff_status} />
        </div>
      </div>

      {/* Two-layer status: Target → Acknowledged → HRBP confirmed → KAD signed off */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span className={`badge ${hasTarget ? "badge-success" : "badge-neutral"}`}>{hasTarget ? "✓ Target set" : "Needs target"}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
        <span className={`badge ${acknowledged ? "badge-success" : "badge-neutral"}`}>{acknowledged ? "✓ Acknowledged" : "Awaiting ack"}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
        <span className={`badge ${hrbpConfirmed ? "badge-success" : "badge-neutral"}`}>{hrbpConfirmed ? "✓ HRBP confirmed" : "HRBP confirm"}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
        <span className={`badge ${kadSealed ? "badge-success" : "badge-neutral"}`}>{kadSealed ? "✓ KAD signed off" : "KAD sign-off"}</span>
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

      {/* Owner: queried-work banner with a way to read the note + resubmit */}
      {isOwner && alloc.open_query_count > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 10 }}>
          A manager asked you to revise this work.{" "}
          <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }} onClick={() => setReviewing(true)}>
            Read the note
          </button>
          {" "}then use <strong>Submit output</strong> to send a corrected entry.
        </div>
      )}

      {/* Actions — TWO-LAYER MODEL */}
      <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
        {/* HRBP / KAD allocate: set a target. */}
        {!hasTarget && (isHRBP || isDir) && (
          <SetTargetButton allocId={alloc.id}
            who={alloc.employee_name} metric={alloc.output_metric} unit={alloc.unit}
            onDone={() => { onAction?.(); }} />
        )}

        {/* Employee acknowledges their target (unlocks submission). */}
        {hasTarget && !acknowledged && isOwner && (
          <button className="btn btn-primary btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.acknowledge(alloc.id), "Acknowledge")}>
            Acknowledge target
          </button>
        )}
        {/* Manager nudge: waiting on the employee to acknowledge. */}
        {hasTarget && !acknowledged && !isOwner && (isHRBP || isDir) && (
          <span className="badge badge-warning" style={{ alignSelf: "center" }}>Awaiting employee acknowledgement</span>
        )}

        {/* Employee submits output (proof + IPO), as many times as needed. */}
        {locked && isOwner && !kadSealed && (
          <button className="btn btn-primary btn-sm" onClick={() => onSubmit?.(alloc)}>
            + Submit output
          </button>
        )}

        {/* HRBP / KAD review submissions + proof, query if wrong. */}
        {locked && !isOwner && (isHRBP || isDir) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setReviewing(true)}>
            Review work
          </button>
        )}

        {/* Layer 1 — HRBP confirms the row. */}
        {locked && !hrbpConfirmed && (isHRBP || isDir) && (
          <button className="btn btn-secondary btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.confirm(alloc.id), "Confirm")}>
            Confirm output
          </button>
        )}
        {/* Reopen an HRBP-confirmed row. KAD sign-off is a separate KAD-level action (on the KAD dashboard). */}
        {hrbpConfirmed && !kadSealed && (isHRBP || isDir) && (
          <button className="btn btn-ghost btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.unconfirm(alloc.id), "Reopen")}>
            Reopen
          </button>
        )}
      </div>
      {actionErr && <p className="form-error" style={{ marginTop: 8 }}>{actionErr}</p>}
      {reviewing && (
        <SubmissionReview alloc={alloc} canSignoff={(isHRBP || isDir) && !hrbpConfirmed}
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
  const [groupMode, setGroupMode] = useState("stage"); // 'stage' | 'person'
  const refresh = () => { reload(); onAnyAction?.(); };

  // Backend already scopes this read to the manager's KAD/reports (Layer 1),
  // so we trust it directly rather than re-filtering client-side.
  const rows = allocs || [];

  // Two-layer model: needs target → awaiting acknowledgement → in progress
  // (acked, submitting) → HRBP confirmed (awaiting KAD sign-off).
  const stageOf = (a) => {
    if (a.target_value == null || a.target_set_by_id == null) return "needs_target";
    if (a.employee_acknowledged !== 1) return "awaiting_ack";
    if (a.hrbp_signoff_confirmation === 1) return "confirmed";
    return "in_progress";
  };
  const STAGES = [
    { key: "needs_target", title: "Needs a target", hint: "Set the number these are measured against. HRBP + KAD set targets here." },
    { key: "awaiting_ack", title: "Awaiting acknowledgement", hint: "Target set — waiting on the employee to acknowledge before they can submit." },
    { key: "in_progress",  title: "In progress", hint: "Acknowledged. The employee submits outputs; confirm each when verified." },
    { key: "confirmed",    title: "HRBP confirmed", hint: "Verified by HRBP. Awaiting the KAD Director's sign-off to enter consolidation." },
  ];
  const grouped = {};
  for (const a of rows) { const s = stageOf(a); (grouped[s] ||= []).push(a); }

  const needsTargetCount = (grouped.needs_target || []).length;

  return (
    <div>
      <div className="flex justify-between items-center mb-3" style={{ flexWrap: "wrap", gap: 8 }}>
        <h2 className="t-title">Register — this period</h2>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setQuickAlloc(true)}>+ Allocation</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setQuickProject(true)}>+ Project</button>
        </div>
      </div>

      {!selectedPeriod && <div className="empty"><p className="empty-title">Select a period</p></div>}
      {selectedPeriod && loading && <div className="loading-center"><span className="spinner" /></div>}
      {selectedPeriod && !loading && rows.length === 0 && (
        <div className="empty"><p className="empty-title">No one in your KAD</p>
          <p className="empty-body">No allocations for your KAD in this period yet. Use <strong>+ Allocation</strong> to add one, or import them in Admin.</p></div>
      )}

      {selectedPeriod && !loading && rows.length > 0 && (
        <>
          {/* Headline: how many still need targets — the manager's first job */}
          {needsTargetCount > 0 && (
            <div className="alert alert-warning mb-3">
              <strong>{needsTargetCount}</strong> allocation{needsTargetCount === 1 ? "" : "s"} still need a target before this period can be locked and opened.
            </div>
          )}
          <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
            <button className={`btn btn-sm ${groupMode === "stage" ? "btn-primary" : "btn-secondary"}`} onClick={() => setGroupMode("stage")}>By stage</button>
            <button className={`btn btn-sm ${groupMode === "person" ? "btn-primary" : "btn-secondary"}`} onClick={() => setGroupMode("person")}>By person</button>
          </div>

          {groupMode === "stage" ? STAGES.map(st => {
            const list = grouped[st.key] || [];
            if (list.length === 0) return null;
            return (
              <div key={st.key} className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="t-subtitle">{st.title}</h3>
                  <span className="badge badge-neutral">{list.length}</span>
                </div>
                <p className="t-caption mb-2">{st.hint}</p>
                {list.map(a => <AllocRow key={a.id} alloc={a} actor={actor} roles={actor.roles} onAction={refresh} onSubmit={null} />)}
              </div>
            );
          }) : (
            // By person
            Object.entries(rows.reduce((acc, a) => { (acc[a.employee_name] ||= []).push(a); return acc; }, {}))
              .sort((x, y) => x[0].localeCompare(y[0]))
              .map(([name, list]) => (
                <div key={name} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="t-subtitle">{name}</h3>
                    <span className="badge badge-neutral">{list.length}</span>
                    {list.some(a => stageOf(a) === "needs_target") && <span className="badge badge-warning">needs target</span>}
                  </div>
                  {list.map(a => <AllocRow key={a.id} alloc={a} actor={actor} roles={actor.roles} onAction={refresh} onSubmit={null} />)}
                </div>
              ))
          )}
        </>
      )}

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
  let kadAwaitingSignoff = 0;   // KAD-level: rows HRBP-confirmed but not yet sealed
  for (const a of allocations) {
    const isOwner = a.employee_id === actor?.id;
    const scoped  = (name) => roles?.some(r => r.role_name === name &&
      (r.scope_employee_id === a.employee_id || r.scope_employee_id == null));
    const isHRBP = scoped("HRBP");
    const isDir  = scoped("KAD Director");
    const name   = a.employee_name || a.output_metric;
    const hasTarget = !!a.target_set_by_id;
    const acked = a.employee_acknowledged === 1;
    const locked = a.target_locked === 1;
    const hrbpConfirmed = a.hrbp_signoff_confirmation === 1;
    const kadSealed = a.director_signoff_confirmation === 1;

    // Owner: a submission was queried — revise it (highest priority for the employee)
    if (isOwner && a.open_query_count > 0)
      items.push({ key: `qry-${a.id}`, urgent: true, action: "Your work was queried",
        context: `${a.output_metric} — a manager asked you to revise. Open it, read the note, and resubmit.`, goto: "my" });
    // Owner: acknowledge the target before you can submit
    if (isOwner && hasTarget && !acked)
      items.push({ key: `ack-${a.id}`, urgent: true, action: "Acknowledge your target",
        context: `${a.output_metric} — target of ${a.target_value}. Acknowledge it to start logging work.`, goto: "my" });
    // Owner: submit work (acknowledged, ready)
    if (isOwner && locked && !(a.open_query_count > 0) && !kadSealed)
      items.push({ key: `sub-${a.id}`, urgent: false, action: "Submit your work",
        context: `${a.output_metric} — log progress against your target of ${a.target_value}`, goto: "my" });
    // HRBP/Dir: set a target (allocate the work)
    if (!hasTarget && (isDir || isHRBP) && !isOwner)
      items.push({ key: `set-${a.id}`, urgent: true, action: `Set a target for ${name}`,
        context: `${a.output_metric} — no target set yet`, goto: "register" });
    // HRBP/Dir: confirm the output (layer 1)
    if (locked && !hrbpConfirmed && (isHRBP || isDir) && !isOwner)
      items.push({ key: `conf-${a.id}`, urgent: false, action: `Confirm ${name}'s output`,
        context: `${a.output_metric} — verify the submitted output and confirm`, goto: "register" });
    // Tally rows ready for the KAD-level sign-off
    if (isDir && hrbpConfirmed && !kadSealed) kadAwaitingSignoff++;
  }
  // KAD Director: one roll-up item to sign off the whole KAD
  if (kadAwaitingSignoff > 0)
    items.push({ key: "kad-signoff", urgent: false, action: "Sign off the KAD",
      context: `${kadAwaitingSignoff} HRBP-confirmed row(s) are ready for your sign-off`, goto: "kad" });

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
  const isExec      = hasRole("Executive");

  // Role-minimal model (Line Manager + Project Lead deferred):
  //   Employee      → My work
  //   HRBP          → My work + Register
  //   KAD Director  → My work + Register + KAD dashboard + Projects
  //   Executive/CEO → Organisation
  const canRegister = isHRBP || isDirector;   // allocate/target/confirm
  const canKadDash  = isDirector;             // detailed KAD review + sign-off
  const canProjects = isDirector;             // projects + clients
  const canOrg      = isExec;                 // cross-KAD consolidation

  const ALL_TABS = ["my","register","kad","projects","org"];
  const pathTab = location.pathname.replace(/^\//, "") || "my";
  // accept legacy paths so old bookmarks still land somewhere sensible
  const legacy = { team: "register", manage: "register", flags: "kad", resources: "kad" };
  const tab = ALL_TABS.includes(pathTab) ? pathTab : (legacy[pathTab] || "my");
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

  // Allocations for the inbox — pull both "mine" and (if a manager) my whole team's
  const { data: inboxAllocs, reload: reloadInbox } = useAsync(
    () => selectedPeriod ? allocApi.list(selectedPeriod) : Promise.resolve([]),
    [selectedPeriod]
  );

  // Build nav as structured items for AppShell (desktop sidebar + mobile bottom bar)
  const navItems = [
    { key: "my", label: "My work", mobileLabel: "My work", icon: Icons.allocations,
      active: tab === "my", onClick: () => setTab("my") },
    ...(canRegister ? [
      { key: "register", label: "Register", mobileLabel: "Register", icon: Icons.team,
        active: tab === "register", onClick: () => setTab("register") },
    ] : []),
    ...(canKadDash ? [
      { key: "kad", label: "KAD dashboard", mobileLabel: "KAD", icon: Icons.home,
        active: tab === "kad", onClick: () => setTab("kad") },
    ] : []),
    ...(canProjects ? [
      { key: "projects", label: "Projects", mobileLabel: "Projects", icon: Icons.allocations,
        active: tab === "projects", onClick: () => setTab("projects") },
    ] : []),
    ...(canOrg ? [
      { key: "org", label: "Organisation", mobileLabel: "Org", icon: Icons.home,
        active: tab === "org", onClick: () => setTab("org") },
    ] : []),
  ];

  const titleMap = { my: "My work", register: "Register",
                     kad: "KAD dashboard", projects: "Projects",
                     org: "Organisation overview" };

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
          {tab === "my"       && <MyAllocations actor={actor} periods={periods} selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} onAnyAction={reloadInbox} />}
          {tab === "register" && <TeamAllocations actor={actor} periods={periods} selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} onAnyAction={reloadInbox} />}
          {tab === "kad"      && <KadDashboard actor={actor} selectedPeriod={selectedPeriod} onAnyAction={reloadInbox} />}
          {tab === "projects" && <ProjectWorkspace actor={actor} />}
          {tab === "org"      && <OrgDashboard selectedPeriod={selectedPeriod} />}
        </>
      )}
    </AppShell>
  );
}
