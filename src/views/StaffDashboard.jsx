import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AppShell, { Icons } from "../components/AppShell";
import { useAuth } from "../auth/AuthContext";
import { allocations as allocApi, periods as periodsApi, setup, flags as flagsApi,
         leaderboard as lbApi } from "../api/client";
import CanvasView from "./CanvasView";
import IdeasView from "./IdeasView";
import LeaderboardView from "./LeaderboardView";
import { KadDashboard, ManageView, FlagManagement, ProjectWorkspace, SubmissionReview,
         NewAllocationModal, NewProjectModal, ResourceVisibility, OrgDashboard, ConsolidationView } from "./ManagerViews";

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
/**
 * `initial` lets the Daily Work Canvas hand over what it already knows — the
 * date, and a narrative assembled from the tasks the person ticked off. It
 * deliberately never carries the figure or the proof: three tasks is not three
 * kilometres, and a proof that the system filled in for you isn't evidence.
 * Those two stay the employee's own assertion, which is what the whole
 * sign-off chain rests on.
 */
function SubmitModal({ alloc, onClose, onDone, initial = {} }) {
  const [form, setForm] = useState({
    date_of_activity: initial.date || "", actual_output: "",
    input: "", process: "", output_narrative: initial.narrative || "",
    blockers: "", proof_description: "" });
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
        Target: <strong>{alloc.target_value} {alloc.unit || "units"}</strong> · Current: <strong>{alloc.actual_output_rollup ?? 0} {alloc.unit || "units"}</strong>
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
/**
 * Table-row version of AllocRow, used only in the Register tab (KAD Director /
 * HRBP team view) so it reads as a dense table like the Admin console, instead
 * of a stack of cards. Same state, same actions, same banners — just laid out
 * as <tr>/<td> instead of a <div className="card">. The employee's own "My
 * work" view keeps the card version (AllocRow) unchanged.
 */
function AllocTableRow({ alloc, actor, roles, onAction, periodOpen = true }) {
  const [actionErr, setActionErr] = useState("");
  const [busy, setBusy]           = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const isOwner   = alloc.employee_id === actor?.id;
  const isHRBP    = roles?.some(r => r.role_name === "HRBP" &&
    (r.scope_employee_id === alloc.employee_id || r.scope_employee_id == null));
  const isDir     = roles?.some(r => r.role_name === "KAD Director" &&
    (r.scope_employee_id === alloc.employee_id || r.scope_employee_id == null));
  const isLM      = roles?.some(r => r.role_name === "Line Manager" &&
    (r.scope_employee_id === alloc.employee_id || r.scope_employee_id == null));

  async function act(fn, label) {
    setActionErr(""); setBusy(true);
    try { await fn(); onAction?.(); }
    catch (e) { setActionErr(e.message || label + " failed"); }
    finally { setBusy(false); }
  }

  const acknowledged = alloc.employee_acknowledged === 1;
  const locked = alloc.target_locked === 1;
  const workConfirmed = alloc.signoff_performed === 1;
  const hrbpChecked = alloc.hrbp_signoff_confirmation === 1;
  const reported = alloc.director_signoff_confirmation === 1;
  const hasTarget = !!alloc.target_set_by_id;
  const hasBanner = alloc.hrbp_flag_note || (isOwner && alloc.open_query_count > 0);

  return (
    <>
      <tr>
        <td><strong>{alloc.employee_name}</strong></td>
        <td>{alloc.output_metric}{alloc.unit && <span className="t-caption"> ({alloc.unit})</span>}</td>
        <td><WorkStatusBadge status={alloc.work_status} fallback={alloc.signoff_status} /></td>
        <td>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            <span className={`badge ${hasTarget ? "badge-success" : "badge-neutral"}`} style={{ fontSize: 10 }}>{hasTarget ? "✓ Target" : "No target"}</span>
            <span className={`badge ${acknowledged ? "badge-success" : "badge-neutral"}`} style={{ fontSize: 10 }}>{acknowledged ? "✓ Ack" : "Awaiting ack"}</span>
            <span className={`badge ${workConfirmed ? "badge-success" : "badge-neutral"}`} style={{ fontSize: 10 }}>{workConfirmed ? "✓ Confirmed" : "Unconfirmed"}</span>
            <span className={`badge ${hrbpChecked ? "badge-success" : "badge-neutral"}`} style={{ fontSize: 10 }}>{hrbpChecked ? "✓ HRBP" : "HRBP pending"}</span>
            <span className={`badge ${reported ? "badge-success" : "badge-neutral"}`} style={{ fontSize: 10 }}>{reported ? "✓ Reported" : "Not reported"}</span>
          </div>
        </td>
        <td className="t-mono">{hasTarget ? `${alloc.target_value} ${alloc.unit || ""}` : "—"}</td>
        <td>
          {locked
            ? <div className="flex items-center gap-2"><span className="t-mono">{alloc.actual_output_rollup ?? 0} {alloc.unit || ""}</span><AchievementBar pct={alloc.achievement_pct} /></div>
            : <span className="t-caption">—</span>}
        </td>
        <td>
          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            {!hasTarget && (isHRBP || isDir) && (
              <SetTargetButton allocId={alloc.id}
                who={alloc.employee_name} metric={alloc.output_metric} unit={alloc.unit}
                onDone={() => onAction?.()} />
            )}
            {hasTarget && !acknowledged && !isOwner && (isHRBP || isDir) && (
              <span className="badge badge-warning" style={{ alignSelf: "center" }}>Awaiting ack</span>
            )}
            {locked && !isOwner && (isHRBP || isDir || isLM) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setReviewing(true)}>Review work</button>
            )}
            {locked && !isOwner && isHRBP && !reported && !alloc.hrbp_flag_note && (
              <button className="btn btn-ghost btn-sm" disabled={busy}
                onClick={() => { const note = prompt("Flag this row for the KAD Director — what should they look at?"); if (note && note.trim()) act(() => allocApi.hrbpFlag(alloc.id, note.trim()), "Flag"); }}>
                ⚑ Flag
              </button>
            )}
            {locked && !workConfirmed && (isDir || isLM) && (
              <button className="btn btn-secondary btn-sm" disabled={busy}
                onClick={() => act(() => allocApi.confirm(alloc.id), "Confirm")}>Confirm work</button>
            )}
            {workConfirmed && !reported && (isDir || isLM) && (
              <button className="btn btn-ghost btn-sm" disabled={busy}
                onClick={() => act(() => allocApi.unconfirm(alloc.id), "Reopen")}>Reopen</button>
            )}
          </div>
          {actionErr && <p className="form-error" style={{ marginTop: 4 }}>{actionErr}</p>}
        </td>
      </tr>
      {hasBanner && (
        <tr>
          <td colSpan={7} style={{ background: "var(--surface-2, #fffbeb)", padding: "8px 12px" }}>
            {alloc.hrbp_flag_note && (
              <div style={{ marginBottom: isOwner && alloc.open_query_count > 0 ? 6 : 0 }}>
                <strong>⚑ HRBP flagged for the KAD:</strong> {alloc.hrbp_flag_note}
                {(isHRBP || isDir) && (
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8, padding: "2px 6px" }} disabled={busy}
                    onClick={() => act(() => allocApi.hrbpUnflag(alloc.id), "Clear flag")}>Clear</button>
                )}
              </div>
            )}
            {isOwner && alloc.open_query_count > 0 && (
              <div>
                A manager asked you to revise this work.{" "}
                <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }} onClick={() => setReviewing(true)}>Read the note</button>
                {" "}then use <strong>Submit output</strong> to send a corrected entry.
              </div>
            )}
          </td>
        </tr>
      )}
      {reviewing && (
        <SubmissionReview alloc={alloc} canQuery={isDir}
          onClose={() => setReviewing(false)}
          onQueried={() => { setReviewing(false); onAction?.(); }} />
      )}
    </>
  );
}

function AllocRow({ alloc, actor, roles, onAction, onSubmit, periodOpen = true }) {
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
  const workConfirmed = alloc.signoff_performed === 1;          // L1: KAD Director, per row
  const hrbpChecked = alloc.hrbp_signoff_confirmation === 1;    // L2: HRBP completeness
  const reported = alloc.director_signoff_confirmation === 1;   // L3: KAD report to org → consolidation
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

      {/* Three-actor chain: Target → Acknowledged → Work confirmed (KAD) → HRBP checked → Reported to org (KAD) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span className={`badge ${hasTarget ? "badge-success" : "badge-neutral"}`}>{hasTarget ? "✓ Target set" : "Needs target"}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
        <span className={`badge ${acknowledged ? "badge-success" : "badge-neutral"}`}>{acknowledged ? "✓ Acknowledged" : "Awaiting ack"}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
        <span className={`badge ${workConfirmed ? "badge-success" : "badge-neutral"}`}>{workConfirmed ? "✓ Work confirmed" : "Work confirm"}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
        <span className={`badge ${hrbpChecked ? "badge-success" : "badge-neutral"}`}>{hrbpChecked ? "✓ HRBP checked" : "HRBP check"}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
        <span className={`badge ${reported ? "badge-success" : "badge-neutral"}`}>{reported ? "✓ Reported to org" : "Report to org"}</span>
      </div>

      {hasTarget && (
        <div style={{ marginBottom: 10 }}>
          <div className="flex items-center gap-3" style={{ flexWrap: "wrap" }}>
            <span className="t-caption">Target: <strong>{alloc.target_value} {alloc.unit || ""}</strong></span>
            {locked && <span className="t-caption">Actual: <strong>{alloc.actual_output_rollup ?? 0} {alloc.unit || ""}</strong></span>}
            {locked && <AchievementBar pct={alloc.achievement_pct} />}
          </div>
          {!acknowledged && isOwner && (
            <p className="t-caption" style={{ marginTop: 4, color: "var(--text-muted)" }}>
              Review the target above, then acknowledge it below to unlock submissions once the period opens.
            </p>
          )}
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

      {/* HRBP flag — visible to everyone on the row; raised by HRBP, cleared by HRBP/KAD */}
      {alloc.hrbp_flag_note && (
        <div className="alert alert-warning" style={{ marginBottom: 10 }}>
          <strong>⚑ HRBP flagged for the KAD:</strong> {alloc.hrbp_flag_note}
          {(isHRBP || isDir) && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8, padding: "2px 6px" }} disabled={busy}
              onClick={() => act(() => allocApi.hrbpUnflag(alloc.id), "Clear flag")}>Clear</button>
          )}
        </div>
      )}

      {/* Actions — three-actor chain */}
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

        {/* Employee submits output — only until the KAD Director confirms the work.
            A query (or a Director Reopen) leaves the row un-confirmed, so the
            button correctly returns for revisions. */}
        {locked && isOwner && !workConfirmed && periodOpen && (
          <button className="btn btn-primary btn-sm" onClick={() => onSubmit?.(alloc)}>
            + Submit output
          </button>
        )}
        {locked && isOwner && !workConfirmed && !periodOpen && (
          <span className="t-caption" style={{ color: "var(--text-muted)" }}>Period closed — submissions are locked.</span>
        )}
        {locked && isOwner && workConfirmed && !reported && (
          <span className="t-caption" style={{ color: "var(--success)" }}>✓ Work confirmed by the KAD Director — submissions for this row are closed.</span>
        )}

        {/* HRBP + KAD both see the work. HRBP = view only; KAD can query (inside the reviewer). */}
        {locked && !isOwner && (isHRBP || isDir) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setReviewing(true)}>
            Review work
          </button>
        )}

        {/* HRBP raises a row for the KAD's attention (can't query, but can flag). */}
        {locked && !isOwner && isHRBP && !reported && !alloc.hrbp_flag_note && (
          <button className="btn btn-ghost btn-sm" disabled={busy}
            onClick={() => { const note = prompt("Flag this row for the KAD Director — what should they look at?"); if (note && note.trim()) act(() => allocApi.hrbpFlag(alloc.id, note.trim()), "Flag"); }}>
            ⚑ Flag for KAD
          </button>
        )}

        {/* Layer 1 — KAD Director confirms the work was done (line manager). KAD only. */}
        {locked && !workConfirmed && isDir && (
          <button className="btn btn-secondary btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.confirm(alloc.id), "Confirm")}>
            Confirm work
          </button>
        )}
        {/* Reopen a confirmed row (clears the chain from this row). KAD only. */}
        {workConfirmed && !reported && isDir && (
          <button className="btn btn-ghost btn-sm" disabled={busy}
            onClick={() => act(() => allocApi.unconfirm(alloc.id), "Reopen")}>
            Reopen
          </button>
        )}
      </div>
      {actionErr && <p className="form-error" style={{ marginTop: 8 }}>{actionErr}</p>}
      {reviewing && (
        <SubmissionReview alloc={alloc} canQuery={isDir}
          onClose={() => setReviewing(false)}
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
function MyAllocations({ actor, periods, selectedPeriod, setSelectedPeriod, onAnyAction, prefill, onPrefillUsed }) {
  const { data: allocs, loading, reload } = useAsync(
    () => selectedPeriod ? allocApi.list(selectedPeriod, actor.id) : Promise.resolve([]),
    [selectedPeriod, actor.id]
  );
  const [submitting, setSubmitting] = useState(null);
  const [seed, setSeed] = useState({});             // starting values handed over from My day
  const [expanded, setExpanded] = useState(null);   // allocation id whose detail is open
  const refresh = () => { reload(); onAnyAction?.(); };

  // Arriving from the canvas with work to submit: find the allocation it named
  // and open the form already part-filled. Cleared immediately so returning to
  // this tab later doesn't reopen it.
  useEffect(() => {
    if (!prefill || !allocs) return;
    const target = allocs.find(a => a.id === prefill.allocation_id);
    if (target) { setSeed({ date: prefill.date, narrative: prefill.narrative }); setSubmitting(target); }
    onPrefillUsed?.();
  }, [prefill, allocs]);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h2 className="t-title mb-4">My work this period</h2>
      {!selectedPeriod && <div className="empty"><p className="empty-title">Select a period</p><p className="empty-body">Choose a period above to see your work.</p></div>}
      {selectedPeriod && loading && <div className="loading-center"><span className="spinner" /></div>}
      {selectedPeriod && !loading && allocs?.length === 0 && <div className="empty"><p className="empty-title">Nothing assigned yet</p><p className="empty-body">You don't have any work targets for this period yet. Your manager or HR team will set these up.</p></div>}

      {selectedPeriod && !loading && allocs?.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table-sticky">
              <thead><tr>
                <th>Output metric</th><th>Project · Client</th><th>Target</th>
                <th>Progress</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {allocs.map(a => (
                  <MyAllocationRow key={a.id} alloc={a} actor={actor} roles={actor.roles}
                    expanded={expanded === a.id}
                    onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
                    onSubmit={setSubmitting} onAction={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {submitting && <SubmitModal alloc={submitting} initial={seed}
        onClose={() => { setSubmitting(null); setSeed({}); }} onDone={refresh} />}
    </div>
  );
}

// One employee allocation as a table row + an expandable detail panel showing
// the running submission tally (each entry's increment and the accumulating total).
function MyAllocationRow({ alloc, actor, roles, expanded, onToggle, onSubmit, onAction }) {
  const [busy, setBusy] = useState(false);
  const [subs, setSubs] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const isOwner = alloc.employee_id === actor.id;
  const hasTarget = !!alloc.target_set_by_id;
  const acknowledged = alloc.employee_acknowledged === 1;
  const locked = alloc.target_locked === 1;
  const workConfirmed = alloc.signoff_performed === 1;
  const reported = alloc.director_signoff_confirmation === 1;
  const kadOpen = alloc.kad_is_open === 1;
  const queried = alloc.open_query_count > 0;
  const unit = alloc.unit || "";

  // Load submissions when the row is expanded.
  async function loadSubs() {
    try { setSubs(await allocApi.listSubmissions(alloc.id)); } catch { setSubs([]); }
  }
  function toggle() { if (!expanded) loadSubs(); onToggle(); }

  async function act(fn, label) {
    setBusy(true);
    try { await fn(); onAction?.(); if (expanded) loadSubs(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }

  // Status the employee actually understands (per-KAD aware).
  let statusLabel, statusCls;
  if (!hasTarget)                     { statusLabel = "Awaiting target";  statusCls = "badge-neutral"; }
  else if (!acknowledged)             { statusLabel = "Accept target";    statusCls = "badge-warning"; }
  else if (queried)                   { statusLabel = "Revision needed";  statusCls = "badge-danger"; }
  else if (reported)                  { statusLabel = "Reported";         statusCls = "badge-success"; }
  else if (workConfirmed)             { statusLabel = "Work confirmed";   statusCls = "badge-success"; }
  else if (!kadOpen)                  { statusLabel = "Awaiting open";    statusCls = "badge-neutral"; }
  else                                { statusLabel = "Submitting";       statusCls = "badge-info"; }

  return (
    <>
      <tr>
        <td><strong>{alloc.output_metric}</strong>{unit && <span className="t-caption"> ({unit})</span>}</td>
        <td>{alloc.project_name}{alloc.client_name && <span className="t-caption"> · {alloc.client_name}</span>}</td>
        <td className="t-mono">{hasTarget ? `${alloc.target_value} ${unit}` : "—"}</td>
        <td className="t-mono">{locked ? `${alloc.actual_output_rollup ?? 0} ${unit}` : "—"}</td>
        <td><span className={`badge ${statusCls}`}>{statusLabel}</span></td>
        <td><button className="btn btn-ghost btn-sm" onClick={toggle}>{expanded ? "Hide" : "Details"}</button></td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: "var(--surface)", padding: "14px 18px" }}>
            {/* Lifecycle chain */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span className={`badge ${hasTarget ? "badge-success" : "badge-neutral"}`}>{hasTarget ? "✓ Target set" : "Target set"}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
              <span className={`badge ${acknowledged ? "badge-success" : "badge-neutral"}`}>{acknowledged ? "✓ Accepted" : "Accept"}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
              <span className={`badge ${(locked && kadOpen && !workConfirmed) ? "badge-info" : workConfirmed ? "badge-success" : "badge-neutral"}`}>{workConfirmed ? "✓ Submitted" : "Submitting"}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
              <span className={`badge ${workConfirmed ? "badge-success" : "badge-neutral"}`}>{workConfirmed ? "✓ Work confirmed" : "Work confirm"}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
              <span className={`badge ${reported ? "badge-success" : "badge-neutral"}`}>{reported ? "✓ Reported" : "Reported"}</span>
            </div>

            {/* Target awaiting acceptance */}
            {hasTarget && !acknowledged && isOwner && (
              <div className="alert" style={{ marginBottom: 12, background: "var(--bg-accent)" }}>
                You're being asked to deliver <strong>{alloc.target_value} {unit}</strong> of {alloc.output_metric} on <strong>{alloc.project_name}</strong>. Review, then accept below.
              </div>
            )}

            {/* Progress tally — reported to date vs target */}
            {locked && (
              <div style={{ background: "var(--card)", borderRadius: "var(--radius)", padding: "12px 14px", marginBottom: 12 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                  <span className="t-caption">
                    {alloc.aggregation === "latest" ? "Latest reported" : alloc.aggregation === "average" ? "Average to date" : "Reported to date"}
                  </span>
                  <span style={{ fontWeight: 600 }}>{alloc.actual_output_rollup ?? 0} of {alloc.target_value} {unit}</span>
                </div>
                <AchievementBar pct={alloc.achievement_pct} />
                {!workConfirmed && kadOpen && (
                  <p className="t-caption" style={{ marginTop: 8, color: "var(--text-muted)" }}>
                    {alloc.aggregation === "latest"
                      ? "Your latest entry is your current figure — a new submission replaces it. Keep updating until your manager confirms."
                      : alloc.aggregation === "average"
                        ? "Your figure is the average of all entries. Keep adding until your manager confirms."
                        : "Each entry adds to your total. Keep adding until your manager confirms — nothing is final until then."}
                  </p>
                )}
              </div>
            )}

            {/* Submission log: each entry */}
            {locked && subs && subs.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p className="t-label" style={{ marginBottom: 6 }}>Your submissions</p>
                <table><tbody>
                  {subs.map(s => (
                    <tr key={s.id}>
                      <td className="t-caption">{s.date_of_activity || "—"}</td>
                      <td>{s.output_narrative || <span className="t-caption">—</span>}</td>
                      <td className="t-mono" style={{ textAlign: "right" }}>{alloc.aggregation === "sum" ? "+" : ""}{s.actual_output} {unit}</td>
                      <td className="t-caption">{s.revised_at ? "revised" : s.query_note && !s.query_resolved_at ? "queried" : ""}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            )}
            {locked && subs && subs.length === 0 && (
              <p className="t-caption" style={{ marginBottom: 12, color: "var(--text-muted)" }}>No submissions yet.</p>
            )}

            {/* Queried banner */}
            {isOwner && queried && (
              <div className="alert alert-warning" style={{ marginBottom: 12 }}>
                A manager asked you to revise this work.{" "}
                <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }} onClick={() => setReviewing(true)}>Read the note</button>
                {" "}then submit a corrected entry.
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              {hasTarget && !acknowledged && isOwner && (
                <button className="btn btn-primary btn-sm" disabled={busy}
                  onClick={() => act(() => allocApi.acknowledge(alloc.id), "Acknowledge")}>Accept target</button>
              )}
              {locked && isOwner && !workConfirmed && kadOpen && (
                <button className="btn btn-primary btn-sm" onClick={() => onSubmit?.(alloc)}>+ Add submission</button>
              )}
              {locked && isOwner && !workConfirmed && !kadOpen && (
                <span className="t-caption" style={{ color: "var(--text-muted)" }}>
                  Your KAD hasn't been opened for this period yet — you'll be able to submit once it's opened.
                </span>
              )}
              {locked && isOwner && workConfirmed && !reported && (
                <span className="t-caption" style={{ color: "var(--success)" }}>✓ Work confirmed by your manager — this row is closed. Final: {alloc.actual_output_rollup ?? 0} {unit}.</span>
              )}
              {reported && (
                <span className="t-caption" style={{ color: "var(--success)" }}>✓ Reported to the organisation.</span>
              )}
            </div>
          </td>
        </tr>
      )}
      {reviewing && (
        <SubmissionReview alloc={alloc} canQuery={false}
          onClose={() => setReviewing(false)}
          onQueried={() => { setReviewing(false); onAction?.(); }} />
      )}
    </>
  );
}

// ── Team Allocations view (managers / directors / HRBP) ───────────────────────
function TeamAllocations({ actor, periods, selectedPeriod, setSelectedPeriod, onAnyAction }) {
  const { hasRole } = useAuth();
  const isHRBP = hasRole?.("HRBP");
  const { data: allocs, loading, reload } = useAsync(
    () => selectedPeriod ? allocApi.list(selectedPeriod) : Promise.resolve([]),
    [selectedPeriod]
  );
  const [quickAlloc, setQuickAlloc] = useState(false);
  const [quickProject, setQuickProject] = useState(false);
  const [groupMode, setGroupMode] = useState("stage"); // 'stage' | 'person'
  const [busy, setBusy] = useState(false);
  const [bannerErr, setBannerErr] = useState("");
  const refresh = () => { reload(); onAnyAction?.(); };

  // Backend already scopes this read to the manager's KAD/reports (Layer 1),
  // so we trust it directly rather than re-filtering client-side.
  const rows = allocs || [];

  // Three-actor chain: needs target → awaiting ack → in progress → work confirmed
  // (KAD) → HRBP checked → reported to org (KAD).
  const stageOf = (a) => {
    if (a.target_value == null || a.target_set_by_id == null) return "needs_target";
    if (a.employee_acknowledged !== 1) return "awaiting_ack";
    if (a.director_signoff_confirmation === 1) return "reported";
    if (a.hrbp_signoff_confirmation === 1) return "hrbp_checked";
    if (a.signoff_performed === 1) return "work_confirmed";
    return "in_progress";
  };
  const STAGES = [
    { key: "needs_target", title: "Needs a target", hint: "Set the number these are measured against. HRBP + KAD set targets here." },
    { key: "awaiting_ack", title: "Awaiting acknowledgement", hint: "Target set — waiting on the employee to acknowledge before the cycle can open." },
    { key: "in_progress",  title: "In progress", hint: "Acknowledged. The employee submits outputs; the KAD Director confirms each." },
    { key: "work_confirmed", title: "Work confirmed", hint: "The KAD Director confirmed the work was done. Awaiting the HRBP completeness check." },
    { key: "hrbp_checked",  title: "HRBP checked", hint: "HRBP confirmed the cycle is complete. Awaiting the KAD Director's report-to-org." },
    { key: "reported",    title: "Reported to org", hint: "Sealed by the KAD Director — in consolidation." },
  ];
  const grouped = {};
  for (const a of rows) { const s = stageOf(a); (grouped[s] ||= []).push(a); }

  const needsTargetCount = (grouped.needs_target || []).length;
  // HRBP completeness readiness: every row work-confirmed, none yet HRBP-checked.
  const lockedRows = rows.filter(a => a.target_locked === 1);
  const allWorkConfirmed = lockedRows.length > 0 && lockedRows.every(a => a.signoff_performed === 1);
  const anyHrbpChecked = rows.some(a => a.hrbp_signoff_confirmation === 1);
  const pendingWorkConfirm = lockedRows.filter(a => a.signoff_performed !== 1).length;

  async function markComplete(fn, label) {
    setBannerErr(""); setBusy(true);
    try { await fn(); refresh(); }
    catch (e) { setBannerErr(e.message); } finally { setBusy(false); }
  }

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

          {/* HRBP completeness (Layer 2) — confirm the cycle is fully filled, then the KAD reports to org */}
          {isHRBP && needsTargetCount === 0 && (
            <div className={`alert mb-3 ${anyHrbpChecked ? "alert-success" : allWorkConfirmed ? "alert-info" : "alert-warning"}`}>
              {anyHrbpChecked ? (
                <div className="flex justify-between items-center" style={{ gap: 10, flexWrap: "wrap" }}>
                  <span>✓ You marked this cycle complete. The KAD Director can now report it to the org.</span>
                  <button className="btn btn-ghost btn-sm" disabled={busy}
                    onClick={() => markComplete(() => allocApi.hrbpUncomplete(selectedPeriod), "Reopen")}>Reopen</button>
                </div>
              ) : allWorkConfirmed ? (
                <div className="flex justify-between items-center" style={{ gap: 10, flexWrap: "wrap" }}>
                  <span>All work is confirmed by the KAD Director. Confirm the cycle is complete to hand it back for report-to-org.</span>
                  <button className="btn btn-primary btn-sm" disabled={busy}
                    onClick={() => markComplete(() => allocApi.hrbpComplete(selectedPeriod), "Complete")}>Mark cycle complete</button>
                </div>
              ) : (
                <span><strong>{pendingWorkConfirm}</strong> row{pendingWorkConfirm === 1 ? "" : "s"} still awaiting the KAD Director's work-confirmation before you can mark the cycle complete.</span>
              )}
              {bannerErr && <p className="form-error" style={{ marginTop: 6 }}>{bannerErr}</p>}
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
                <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table>
                  <thead><tr><th>Employee</th><th>Metric</th><th>Status</th><th>Chain</th><th>Target</th><th>Actual</th><th>Actions</th></tr></thead>
                  <tbody>
                    {list.map(a => <AllocTableRow key={a.id} alloc={a} actor={actor} roles={actor.roles} onAction={refresh} />)}
                  </tbody>
                </table></div></div>
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
                  <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table>
                    <thead><tr><th>Employee</th><th>Metric</th><th>Status</th><th>Chain</th><th>Target</th><th>Actual</th><th>Actions</th></tr></thead>
                    <tbody>
                      {list.map(a => <AllocTableRow key={a.id} alloc={a} actor={actor} roles={actor.roles} onAction={refresh} />)}
                    </tbody>
                  </table></div></div>
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
function ActionInbox({ allocations, actor, roles, onGoTo, periodOpen = true }) {
  if (!allocations) return null;

  const items = [];
  let kadAwaitingSignoff = 0;   // KAD-level: rows HRBP-checked but not yet reported to org
  let kadAwaitingHrbp = 0;      // KAD-level: rows work-confirmed but not yet HRBP-checked
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
    const workConfirmed = a.signoff_performed === 1;
    const hrbpChecked = a.hrbp_signoff_confirmation === 1;
    const reported = a.director_signoff_confirmation === 1;

    // Owner: a submission was queried — revise it (highest priority for the employee)
    if (isOwner && a.open_query_count > 0)
      items.push({ key: `qry-${a.id}`, urgent: true, action: "Your work was queried",
        context: `${a.output_metric} — the KAD Director asked you to revise. Open it, read the note, and resubmit (this replaces the queried entry).`, goto: "my" });
    // Owner: acknowledge the target before the cycle can open
    if (isOwner && hasTarget && !acked)
      items.push({ key: `ack-${a.id}`, urgent: true, action: "Acknowledge your target",
        context: `${a.output_metric} — target of ${a.target_value}. The cycle can't open until you acknowledge.`, goto: "my" });
    // Owner: submit work (acknowledged, ready) — only until the KAD confirms the work
    if (isOwner && locked && !(a.open_query_count > 0) && a.signoff_performed !== 1 && periodOpen)
      items.push({ key: `sub-${a.id}`, urgent: false, action: "Submit your work",
        context: `${a.output_metric} — log progress against your target of ${a.target_value}`, goto: "my" });
    // HRBP/Dir: set a target (allocate the work)
    if (!hasTarget && (isDir || isHRBP) && !isOwner)
      items.push({ key: `set-${a.id}`, urgent: true, action: `Set a target for ${name}`,
        context: `${a.output_metric} — no target set yet`, goto: "register" });
    // KAD Director: confirm the work was done (layer 1, line manager)
    if (locked && !workConfirmed && isDir && !isOwner)
      items.push({ key: `conf-${a.id}`, urgent: false, action: `Confirm ${name}'s work`,
        context: `${a.output_metric} — review the submission and confirm the work was done`, goto: "register" });
    // HRBP: rows are work-confirmed and awaiting the completeness check
    if (isHRBP && !isOwner && workConfirmed && !hrbpChecked) kadAwaitingHrbp++;
    // KAD Director: HRBP-checked rows awaiting the report-to-org stamp
    if (isDir && hrbpChecked && !reported) kadAwaitingSignoff++;
  }
  // HRBP: one roll-up item — mark the cycle complete
  if (kadAwaitingHrbp > 0)
    items.push({ key: "hrbp-complete", urgent: false, action: "Mark the cycle complete",
      context: `${kadAwaitingHrbp} work-confirmed row(s) are ready for your completeness check`, goto: "register" });
  // KAD Director: one roll-up item — report the KAD to org
  if (kadAwaitingSignoff > 0)
    items.push({ key: "kad-signoff", urgent: false, action: "Report the KAD to org",
      context: `${kadAwaitingSignoff} HRBP-checked row(s) are ready for your final report-to-org`, goto: "kad" });

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
  const { data: periods, reload: reloadPeriods } = useAsync(() => periodsApi.list());
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  // A period created by admin AFTER this view mounted won't be in our list
  // (the fetch runs once on mount). Refetch when the window regains focus so
  // managers see a just-created period without a hard reload.
  useEffect(() => {
    const onFocus = () => reloadPeriods?.();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadPeriods]);

  const isDirector  = hasRole("KAD Director");
  const isHRBP      = hasRole("HRBP");
  const isExec      = hasRole("Executive");

  // Role-minimal model (Project Lead deferred):
  //   Employee      → My work
  //   Line Manager  → My work + Register (set targets, confirm their team's work)
  //   HRBP          → My work + Register
  //   KAD Director  → My work + Register + KAD dashboard + Projects
  //   Executive/CEO → Organisation
  const isLineManager = hasRole("Line Manager");
  const canRegister = isHRBP || isDirector || isLineManager;   // allocate/target/confirm
  const canKadDash  = isDirector;             // detailed KAD review + sign-off
  const canProjects = isDirector;             // projects + clients
  const canOrg      = isExec;                 // cross-KAD consolidation

  const ALL_TABS = ["my","canvas","ideas","leaderboard","register","consolidation","kad","projects","org"];
  // Tabs whose content is scoped to a performance period.
  const PERIOD_TABS = new Set(["my","register","consolidation","kad","org"]);
  const pathTab = location.pathname.replace(/^\//, "") || "my";
  // accept legacy paths so old bookmarks still land somewhere sensible
  const legacy = { team: "register", manage: "register", flags: "kad", resources: "kad" };
  const tab = ALL_TABS.includes(pathTab) ? pathTab : (legacy[pathTab] || "my");
  const setTab = (t) => navigate(`/${t}`);

  // Auto-select: first Open period → most recent non-closed → most recent of all.
  // Always lands on a real period when any exist, so manager tabs never sit empty.
  useEffect(() => {
    if (periods && periods.length > 0 && !selectedPeriod) {
      const pick = periods.find(p => p.status === "Open")
                || periods.find(p => p.status !== "Closed")
                || periods[0];
      if (pick) setSelectedPeriod(String(pick.id));
    }
  }, [periods, selectedPeriod]);

  const roles = actor?.roles || [];
  // Set when My day hands work over to My work, consumed once on arrival.
  const [canvasPrefill, setCanvasPrefill] = useState(null);

  // The streak is the point of the whole scheme, so it lives in the shell where
  // it's visible from every screen — not buried in the leaderboard tab. Re-read
  // on tab change, since almost any action can extend it.
  const [streak, setStreak] = useState(null);
  useEffect(() => { lbApi.streak().then(setStreak).catch(() => {}); }, [tab]);

  // Allocations for the inbox — pull both "mine" and (if a manager) my whole team's
  const { data: inboxAllocs, reload: reloadInbox } = useAsync(
    () => selectedPeriod ? allocApi.list(selectedPeriod) : Promise.resolve([]),
    [selectedPeriod]
  );

  // Build nav as structured items for AppShell (desktop sidebar + mobile bottom bar)
  const navItems = [
    { key: "my", label: "My work", mobileLabel: "My work", icon: Icons.allocations,
      active: tab === "my", onClick: () => setTab("my") },
    { key: "canvas", label: "My day", mobileLabel: "My day", icon: Icons.periods,
      active: tab === "canvas", onClick: () => setTab("canvas") },
    { key: "ideas", label: "Ideas", mobileLabel: "Ideas", icon: Icons.allocations,
      active: tab === "ideas", onClick: () => setTab("ideas") },
    { key: "leaderboard", label: "Leaderboard", mobileLabel: "Board", icon: Icons.home,
      active: tab === "leaderboard", onClick: () => setTab("leaderboard") },
    ...(canRegister ? [
      { key: "register", label: "Register", mobileLabel: "Register", icon: Icons.team,
        active: tab === "register", onClick: () => setTab("register") },
    ] : []),
    ...((isHRBP || isDirector) ? [
      { key: "consolidation", label: "Consolidation", mobileLabel: "Consol.", icon: Icons.periods,
        active: tab === "consolidation", onClick: () => setTab("consolidation") },
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

  const titleMap = { my: "My work", canvas: "My day", ideas: "Ideas", leaderboard: "Leaderboard", register: "Register", consolidation: "KAD Consolidation",
                     kad: "KAD dashboard", projects: "Projects",
                     org: "Organisation overview" };

  return (
    <AppShell title={titleMap[tab] || "My work"} navItems={navItems}
      navExtras={streak && streak.current > 0 ? (
        <button onClick={() => setTab("leaderboard")}
          title={`${streak.current}-day streak · best ${streak.longest}`}
          style={{ display: "flex", alignItems: "center", gap: 6, width: "100%",
            background: "none", border: "none", cursor: "pointer", padding: "6px 0",
            color: "inherit", font: "inherit" }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <span style={{ fontWeight: 600 }}>{streak.current}</span>
          <span className="t-caption">day streak</span>
        </button>
      ) : null}>
      {/* Period selector — only on the tabs that are actually scoped to a
          period. My day, Ideas and Leaderboard aren't: showing it there was
          dead furniture, and worse, implied your canvas belonged to a cycle. */}
      {PERIOD_TABS.has(tab) && periods && periods.length > 0 && (
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
          periodOpen={(periods || []).find(p => String(p.id) === String(selectedPeriod))?.status === "Open"}
          onGoTo={(t) => setTab(t)} />
      )}

      {/* No period at all — only worth saying on the tabs that need one. */}
      {PERIOD_TABS.has(tab) && (!periods || periods.length === 0) && (
        <div className="empty">
          <p className="empty-title">No active period yet</p>
          <p className="empty-body">Your administrator will open a performance period once targets are set. If one was just created, check again.</p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => reloadPeriods?.()}>Check again</button>
        </div>
      )}

      {/* Personal tabs — nothing to do with performance periods, so they must
          not disappear when no period exists. */}
      {tab === "canvas"      && <CanvasView actor={actor}
        onGoToWork={(p) => { setCanvasPrefill(p || null); setTab("my"); }} />}
      {tab === "ideas"       && <IdeasView />}
      {tab === "leaderboard" && <LeaderboardView actor={actor} />}

      {/* Period-scoped tabs. */}
      {periods && periods.length > 0 && (
        <>
          {tab === "my"       && <MyAllocations actor={actor} periods={periods} selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} onAnyAction={reloadInbox}
            prefill={canvasPrefill} onPrefillUsed={() => setCanvasPrefill(null)} />}
          {tab === "register" && <TeamAllocations actor={actor} periods={periods} selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} onAnyAction={reloadInbox} />}
          {tab === "consolidation" && (isHRBP || isDirector) && <ConsolidationView selectedPeriod={selectedPeriod} />}
          {tab === "consolidation" && !(isHRBP || isDirector) && <MyAllocations actor={actor} periods={periods} selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} onAnyAction={reloadInbox} />}
          {tab === "kad"      && <KadDashboard actor={actor} selectedPeriod={selectedPeriod} onAnyAction={reloadInbox} />}
          {tab === "projects" && <ProjectWorkspace actor={actor} />}
          {tab === "org"      && <OrgDashboard selectedPeriod={selectedPeriod} />}
        </>
      )}
    </AppShell>
  );
}
