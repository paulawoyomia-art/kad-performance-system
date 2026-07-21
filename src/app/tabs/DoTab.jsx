import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useAllocations } from "../shared/useAllocations";
import RowDrawer from "../shared/RowDrawer";

/**
 * DoTab — "what needs me now", split into two sections:
 *   Yours     — the viewer's own hat (accept target, submit, fix a query)
 *   Your team — the viewer's manager hat (set target, confirm, check, report, flag)
 *
 * Each item opens the shared RowDrawer. A person with no manager role never
 * sees the "Your team" section — it simply isn't rendered.
 */
export default function DoTab({ actor, periodId, periodOpen, onSubmit }) {
  const { data: allocs, loading, reload } = useAllocations(periodId, "team");
  const [openAlloc, setOpenAlloc] = useState(null);

  const roles = actor?.roles || [];
  const onRow = (a, name) => roles.some(r => r.role_name === name &&
    (r.scope_employee_id === a.employee_id || r.scope_employee_id == null));

  const yours = [];
  const team = [];
  let teamCompleteCount = 0;   // HRBP: rows work-confirmed, not yet checked
  let teamReportCount = 0;     // Director: HRBP-checked, not yet reported

  for (const a of allocs || []) {
    const isOwner = a.employee_id === actor?.id;
    const isHRBP = onRow(a, "HRBP");
    const isDir = onRow(a, "KAD Director");
    const isLM = onRow(a, "Line Manager");
    const hasTarget = !!a.target_set_by_id;
    const acked = a.employee_acknowledged === 1;
    const locked = a.target_locked === 1;
    const workConfirmed = a.signoff_performed === 1;
    const hrbpChecked = a.hrbp_signoff_confirmation === 1;
    const reported = a.director_signoff_confirmation === 1;
    const kadOpen = a.kad_is_open === 1;
    const queried = a.open_query_count > 0;

    // ── Yours ──
    if (isOwner && queried)
      yours.push({ a, urgent: true, action: "Fix your queried work",
        ctx: `${a.output_metric} — a manager asked you to revise; resubmit a corrected entry` });
    else if (isOwner && hasTarget && !acked)
      yours.push({ a, urgent: true, action: "Accept your target",
        ctx: `${a.output_metric} · ${a.target_value} ${a.unit || ""} — the cycle can't open until you accept` });
    else if (isOwner && locked && !workConfirmed && kadOpen)
      yours.push({ a, urgent: false, action: "Submit your work",
        ctx: `${a.output_metric} — log progress against your target of ${a.target_value}` });

    // ── Your team ── (only when the viewer manages this row)
    const managesRow = (isHRBP || isDir || isLM) && !isOwner;
    if (managesRow && !hasTarget)
      team.push({ a, urgent: true, action: `Set a target for ${a.employee_name}`,
        ctx: `${a.output_metric}${a.project_name ? ` · ${a.project_name}` : ""}` });
    if (managesRow && locked && !workConfirmed && (isDir || isLM))
      team.push({ a, urgent: false, action: `Confirm ${a.employee_name}'s work`,
        ctx: `${a.output_metric} — review the submission and confirm it was done` });
    if (managesRow && a.hrbp_flag_note && (isHRBP || isDir))
      team.push({ a, urgent: false, action: `Review flagged row — ${a.employee_name}`,
        ctx: `${a.output_metric} — ${a.hrbp_flag_note}` });
    if (isHRBP && !isOwner && workConfirmed && !hrbpChecked) teamCompleteCount++;
    if (isDir && hrbpChecked && !reported) teamReportCount++;
  }

  // Roll-up items (one line each, not per row)
  if (teamCompleteCount > 0)
    team.push({ rollup: true, urgent: false, action: "Mark the cycle complete",
      ctx: `${teamCompleteCount} work-confirmed row(s) ready for your completeness check`, goto: "register" });
  if (teamReportCount > 0)
    team.push({ rollup: true, urgent: false, action: "Report the KAD to org",
      ctx: `${teamReportCount} HRBP-checked row(s) ready for your final report-to-org`, goto: "register" });

  const byUrgent = (x, y) => (y.urgent ? 1 : 0) - (x.urgent ? 1 : 0);
  yours.sort(byUrgent);
  team.sort(byUrgent);

  const refresh = (kind, alloc) => {
    if (kind === "submit") { onSubmit?.(alloc); setOpenAlloc(null); return; }
    reload();
  };

  if (loading) return <div className="loading-center"><span className="spinner" /></div>;

  const nothing = yours.length === 0 && team.length === 0;

  return (
    <div>
      {nothing && (
        <div className="inbox-empty" style={{ padding: "40px 0" }}>
          <svg className="inbox-empty-icon" viewBox="0 0 20 20" fill="currentColor" style={{ width: 28, height: 28 }}>
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <p style={{ fontWeight: 600, marginTop: 8 }}>You're all caught up</p>
          <p className="t-caption">Nothing needs your attention this period.</p>
        </div>
      )}

      {yours.length > 0 && (
        <Section title="Yours" icon="user" items={yours} onOpen={setOpenAlloc} />
      )}
      {team.length > 0 && (
        <Section title="Your team" icon="users" items={team} onOpen={setOpenAlloc} />
      )}

      {openAlloc && (
        <RowDrawer alloc={openAlloc} onClose={() => setOpenAlloc(null)} onAction={refresh} />
      )}
    </div>
  );
}

function Section({ title, items, onOpen }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>{title}</span>
        <span className="badge badge-neutral">{items.length}</span>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {items.map((it, i) => (
          <button key={it.a ? it.a.id + it.action : it.action}
            onClick={() => it.a ? onOpen(it.a) : null}
            style={{ display: "flex", gap: 10, padding: "12px 14px", width: "100%", textAlign: "left",
              background: "none", border: "none", borderBottom: i < items.length - 1 ? "0.5px solid var(--border)" : "none",
              cursor: it.a ? "pointer" : "default", alignItems: "flex-start" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 5,
              background: it.urgent ? "var(--text-danger, #c0392b)" : "var(--border-strong, #ccc)" }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 500 }}>{it.action}</span>
              <span className="t-caption" style={{ color: "var(--text-secondary)" }}>{it.ctx}</span>
            </span>
            {it.a && <span style={{ color: "var(--text-muted)" }}>›</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
