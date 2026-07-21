import { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { allocations as allocApi } from "../../api/client";
import { SubmissionReview } from "../../views/ManagerViews";

/**
 * RowDrawer — the single detail + action surface for ONE allocation.
 *
 * This is the keystone of the rebuilt frontend. Every path that lets a user
 * look at or act on an allocation — the Do inbox, the Track table, a flag
 * badge — opens THIS component. It replaces the three near-duplicate row
 * components in the old build (AllocRow, AllocTableRow, MyAllocationRow),
 * which is where the isLM crash hid: with one component there is exactly one
 * place for each role check, so a variable can't be defined in one copy and
 * missing in another.
 *
 * It renders:
 *   - the lifecycle chain (target → accept → submit → confirm → HRBP → report)
 *   - the aggregation-aware progress tally + achievement bar
 *   - the submission log
 *   - only the actions the viewer's role permits on THIS row
 *
 * Props:
 *   alloc    — one v_allocations row
 *   onClose  — close the drawer
 *   onAction — called after any state change so the caller can refetch
 */
export default function RowDrawer({ alloc, onClose, onAction }) {
  const { actor } = useAuth();
  const roles = actor?.roles || [];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [subs, setSubs] = useState(null);
  const [reviewing, setReviewing] = useState(false);

  // Scope-aware role checks — a role counts on this row if it's whole-scope
  // (scope_employee_id null) or scoped to this specific employee.
  const onRow = (name) => roles.some(r => r.role_name === name &&
    (r.scope_employee_id === alloc.employee_id || r.scope_employee_id == null));
  const isOwner = alloc.employee_id === actor?.id;
  const isHRBP = onRow("HRBP");
  const isDir = onRow("KAD Director");
  const isLM = onRow("Line Manager");
  const canConfirm = isDir || isLM;   // Layer-1 work confirmation

  const hasTarget = !!alloc.target_set_by_id;
  const acknowledged = alloc.employee_acknowledged === 1;
  const locked = alloc.target_locked === 1;
  const workConfirmed = alloc.signoff_performed === 1;
  const hrbpChecked = alloc.hrbp_signoff_confirmation === 1;
  const reported = alloc.director_signoff_confirmation === 1;
  const kadOpen = alloc.kad_is_open === 1;
  const queried = alloc.open_query_count > 0;
  const unit = alloc.unit || "";

  useEffect(() => {
    let live = true;
    allocApi.listSubmissions(alloc.id).then(s => { if (live) setSubs(s); }).catch(() => { if (live) setSubs([]); });
    return () => { live = false; };
  }, [alloc.id]);

  async function act(fn) {
    setErr(""); setBusy(true);
    try {
      await fn();
      const fresh = await allocApi.listSubmissions(alloc.id).catch(() => subs);
      setSubs(fresh);
      onAction?.();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const chain = [
    { done: hasTarget, label: hasTarget ? "Target set" : "Target" },
    { done: acknowledged, label: acknowledged ? "Accepted" : "Accept" },
    { done: workConfirmed, label: workConfirmed ? "Submitted" : "Submitting" },
    { done: workConfirmed, label: workConfirmed ? "Work confirmed" : "Work confirm" },
    { done: hrbpChecked, label: hrbpChecked ? "HRBP checked" : "HRBP check" },
    { done: reported, label: reported ? "Reported" : "Report" },
  ];

  const tallyLabel = alloc.aggregation === "latest" ? "Latest reported"
    : alloc.aggregation === "average" ? "Average to date" : "Reported to date";

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ marginBottom: 2 }}>{alloc.output_metric}{unit && <span className="t-caption"> ({unit})</span>}</h2>
            <p className="t-caption" style={{ margin: 0 }}>
              {!isOwner && alloc.employee_name && <><strong>{alloc.employee_name}</strong> · </>}
              {alloc.project_name}{alloc.client_name && <> · {alloc.client_name}</>}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Lifecycle chain */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            {chain.map((c, i) => (
              <span key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className={`badge ${c.done ? "badge-success" : "badge-neutral"}`}>{c.done ? "✓ " : ""}{c.label}</span>
                {i < chain.length - 1 && <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>}
              </span>
            ))}
          </div>

          {/* Flag banner */}
          {alloc.hrbp_flag_note && (
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              <strong>⚑ HRBP flagged for the KAD:</strong> {alloc.hrbp_flag_note}
              {(isHRBP || isDir) && (
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8, padding: "2px 6px" }} disabled={busy}
                  onClick={() => act(() => allocApi.hrbpUnflag(alloc.id))}>Clear</button>
              )}
            </div>
          )}

          {/* Queried banner (owner) */}
          {isOwner && queried && (
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              A manager asked you to revise this work.{" "}
              <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }} onClick={() => setReviewing(true)}>Read the note</button>
              {" "}then submit a corrected entry below.
            </div>
          )}

          {/* Target awaiting acceptance (owner) */}
          {hasTarget && !acknowledged && isOwner && (
            <div className="alert" style={{ marginBottom: 12, background: "var(--bg-accent)" }}>
              You're being asked to deliver <strong>{alloc.target_value} {unit}</strong> of {alloc.output_metric} on <strong>{alloc.project_name}</strong>. Review, then accept below.
            </div>
          )}

          {/* Progress tally */}
          {locked && (
            <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius)", padding: "12px 14px", marginBottom: 12 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span className="t-caption">{tallyLabel}</span>
                <span style={{ fontWeight: 600 }}>{alloc.actual_output_rollup ?? 0} of {alloc.target_value} {unit}</span>
              </div>
              <Bar pct={alloc.achievement_pct} />
              {!workConfirmed && kadOpen && (
                <p className="t-caption" style={{ marginTop: 8, color: "var(--text-muted)" }}>
                  {alloc.aggregation === "latest"
                    ? "Your latest entry is your current figure — a new submission replaces it."
                    : alloc.aggregation === "average"
                      ? "Your figure is the average of all entries."
                      : "Each entry adds to your total."}
                </p>
              )}
            </div>
          )}

          {/* Submission log */}
          {locked && subs && subs.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p className="t-label" style={{ marginBottom: 6 }}>Submissions</p>
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

          {err && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{err}</div>}

          {/* Actions — exactly what this viewer may do on this row */}
          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            {/* Set target (manager) */}
            {!hasTarget && (isHRBP || isDir || isLM) && (
              <SetTarget allocId={alloc.id} unit={unit} onDone={() => { onAction?.(); onClose(); }} />
            )}
            {/* Accept target (owner) */}
            {hasTarget && !acknowledged && isOwner && (
              <button className="btn btn-primary btn-sm" disabled={busy}
                onClick={() => act(() => allocApi.acknowledge(alloc.id))}>Accept target</button>
            )}
            {/* Awaiting ack (manager view) */}
            {hasTarget && !acknowledged && !isOwner && (isHRBP || isDir || isLM) && (
              <span className="badge badge-warning" style={{ alignSelf: "center" }}>Awaiting employee acceptance</span>
            )}
            {/* Submit output (owner, KAD open) */}
            {locked && isOwner && !workConfirmed && kadOpen && (
              <button className="btn btn-primary btn-sm" onClick={() => onAction?.("submit", alloc)}>+ Add submission</button>
            )}
            {locked && isOwner && !workConfirmed && !kadOpen && (
              <span className="t-caption" style={{ color: "var(--text-muted)" }}>Your KAD hasn't opened yet — you'll be able to submit once it does.</span>
            )}
            {/* Review work (manager) */}
            {locked && !isOwner && (isHRBP || isDir || isLM) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setReviewing(true)}>Review work</button>
            )}
            {/* Confirm work (LM or Director) */}
            {locked && !workConfirmed && canConfirm && !isOwner && (
              <button className="btn btn-secondary btn-sm" disabled={busy}
                onClick={() => act(() => allocApi.confirm(alloc.id))}>Confirm work</button>
            )}
            {workConfirmed && !reported && canConfirm && !isOwner && (
              <button className="btn btn-ghost btn-sm" disabled={busy}
                onClick={() => act(() => allocApi.unconfirm(alloc.id))}>Reopen</button>
            )}
            {/* Flag for KAD (HRBP) */}
            {locked && !isOwner && isHRBP && !reported && !alloc.hrbp_flag_note && (
              <button className="btn btn-ghost btn-sm" disabled={busy}
                onClick={() => { const note = prompt("Flag this row for the KAD Director — what should they look at?"); if (note && note.trim()) act(() => allocApi.hrbpFlag(alloc.id, note.trim())); }}>
                ⚑ Flag for KAD
              </button>
            )}
          </div>
        </div>
      </div>

      {reviewing && (
        <SubmissionReview alloc={alloc} canQuery={isDir}
          onClose={() => setReviewing(false)}
          onQueried={() => { setReviewing(false); onAction?.(); }} />
      )}
    </div>
  );
}

function Bar({ pct }) {
  if (pct == null) return <span className="t-caption">No submissions yet</span>;
  const cls = pct >= 1 ? "good" : pct >= 0.5 ? "" : pct >= 0.2 ? "warning" : "danger";
  return (
    <div className="flex items-center gap-2">
      <div className="progress-bar" style={{ width: 120, flexShrink: 0 }}>
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
      <span className="t-mono t-caption">{(pct * 100).toFixed(0)}%</span>
    </div>
  );
}

function SetTarget({ allocId, unit, onDone }) {
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  async function save(e) {
    e.preventDefault(); if (!val) return;
    setErr(""); setSaving(true);
    try { await allocApi.setTarget(allocId, Number(val)); onDone?.(); }
    catch (e) { setErr(e.message); setSaving(false); }
  }
  return (
    <form onSubmit={save} className="flex gap-2 items-center" style={{ width: "100%" }}>
      <input className="form-input" type="number" min="0" step="any" value={val}
        onChange={e => setVal(e.target.value)} placeholder={`Target${unit ? ` in ${unit}` : ""}`}
        style={{ width: 160 }} autoFocus />
      <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !val}>
        {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Set target"}
      </button>
      {err && <span className="form-error">{err}</span>}
    </form>
  );
}
