import { useState, useEffect } from "react";
import { org as orgApi } from "../api/client";

/**
 * Activity — what the company is doing right now.
 *
 * The Organisation dashboard next door only counts work that has completed the
 * whole chain and been reported. That's the honest basis for judging output,
 * but it makes a poor answer to "what is my company doing this week": mid-cycle
 * it shows almost nothing, because almost nothing has been reported yet.
 *
 * This shows every allocation at whatever stage it has reached, so an executive
 * can see live activity. Read-only by design — an executive can assign work on
 * the Register, but confirming it belongs to the KAD that owns it.
 */
export default function OrgActivity({ selectedPeriod }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [stage, setStage] = useState("all");
  const [kad, setKad] = useState("all");

  useEffect(() => {
    setData(null);
    orgApi.activity(selectedPeriod).then(setData).catch(e => setErr(e.message));
  }, [selectedPeriod]);

  if (err) return <div className="alert alert-danger">{err}</div>;
  if (!data) return <div className="loading-center"><span className="spinner" /></div>;

  const { summary = {}, rows = [] } = data;
  if (rows.length === 0)
    return <div className="empty"><p className="empty-title">Nothing allocated yet</p>
      <p className="empty-body">Work appears here as soon as it's assigned, at whatever stage it has reached.</p></div>;

  const stageOf = (r) =>
    !r.target_value ? "awaiting_target"
    : !r.employee_acknowledged ? "awaiting_accept"
    : r.reported ? "reported"
    : r.signoff_performed ? "confirmed"
    : "in_progress";

  const kads = [...new Set(rows.map(r => r.kad_name))].sort();
  const shown = rows.filter(r =>
    (stage === "all" || stageOf(r) === stage) &&
    (kad === "all" || r.kad_name === kad));

  const cards = [
    ["all", "Everything", summary.total],
    ["awaiting_target", "No target", summary.awaiting_target],
    ["awaiting_accept", "Not accepted", summary.awaiting_accept],
    ["in_progress", "In progress", summary.in_progress],
    ["confirmed", "Confirmed", summary.confirmed],
    ["reported", "Reported", summary.reported],
  ];

  return (
    <div>
      <div style={{ display: "grid", gap: 8, marginBottom: 14,
        gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
        {cards.map(([key, label, n]) => (
          <button key={key} onClick={() => setStage(key)}
            style={{ textAlign: "left", cursor: "pointer", border: "none",
              borderRadius: "var(--radius)", padding: "10px 12px", font: "inherit",
              background: stage === key ? "var(--bg-accent)" : "var(--surface)",
              color: stage === key ? "var(--text-accent)" : "inherit" }}>
            <div className="t-caption" style={{ color: "inherit" }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{n ?? 0}</div>
          </button>
        ))}
      </div>

      {kads.length > 1 && (
        <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
          <button className={`btn btn-sm ${kad === "all" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setKad("all")}>All KADs</button>
          {kads.map(k => (
            <button key={k} className={`btn btn-sm ${kad === k ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setKad(k)}>{k}</button>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Person</th><th>KAD</th><th>Work</th>
              <th>Target</th><th>Actual</th><th>Stage</th>
            </tr></thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.employee_name}</strong>
                    {r.designation && <span className="t-caption" style={{ display: "block" }}>{r.designation}</span>}
                  </td>
                  <td className="t-caption">{r.kad_name}</td>
                  <td>
                    {r.output_metric}
                    {r.project_name && <span className="t-caption" style={{ display: "block" }}>{r.project_name}</span>}
                  </td>
                  <td className="t-mono">{r.target_value != null ? `${r.target_value} ${r.unit || ""}` : "—"}</td>
                  <td className="t-mono">{r.target_locked ? `${r.actual ?? 0} ${r.unit || ""}` : "—"}</td>
                  <td><StageBadge s={stageOf(r)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="t-caption mt-2">
        Live, at whatever stage each piece of work has reached — unlike the consolidated
        figures, which only count work that has been through the full chain and reported.
      </p>
    </div>
  );
}

function StageBadge({ s }) {
  const map = {
    awaiting_target: ["No target", "badge-danger"],
    awaiting_accept: ["Not accepted", "badge-warning"],
    in_progress:     ["In progress", "badge-info"],
    confirmed:       ["Confirmed", "badge-success"],
    reported:        ["Reported", "badge-success"],
  };
  const [label, cls] = map[s] || ["—", "badge-neutral"];
  return <span className={`badge ${cls}`}>{label}</span>;
}
