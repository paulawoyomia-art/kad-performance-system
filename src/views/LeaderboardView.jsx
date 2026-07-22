import { useState, useEffect } from "react";
import { leaderboard as lbApi } from "../api/client";

/**
 * Leaderboard — built to drive adoption.
 *
 * It ranks behaviour, not performance: signing up, accepting your target,
 * turning up. The one performance figure (achievement) is scoped to your own
 * KAD, because ranking it company-wide would really be ranking how generous
 * each target-setter was.
 *
 * The public list of people stops at 20 and each person is told their own
 * position separately, so nobody is publicly last out of 117. Every number
 * here is a count — no note, idea or submission content is exposed.
 */

const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default function LeaderboardView({ actor }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [board, setBoard] = useState("kads");   // kads | people | kad

  useEffect(() => { lbApi.get().then(setData).catch(e => setErr(e.message)); }, []);

  if (err) return <div className="alert alert-danger">{err}</div>;
  if (!data) return <div className="loading-center"><span className="spinner" /></div>;

  const { kads = [], top = [], me, total_people, kad_achievement = [] } = data;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2 className="t-title" style={{ marginBottom: 4 }}>Leaderboard</h2>
      <p className="t-caption mb-4">
        How the platform is being taken up, across KADs and people.
      </p>

      {me && <YourStanding me={me} total={total_people} />}

      <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        <button className={`btn btn-sm ${board === "kads" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setBoard("kads")}>KADs</button>
        <button className={`btn btn-sm ${board === "people" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setBoard("people")}>Top 20</button>
        {kad_achievement.length > 0 && (
          <button className={`btn btn-sm ${board === "kad" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setBoard("kad")}>My KAD</button>
        )}
      </div>

      {board === "kads"   && <KadBoard kads={kads} />}
      {board === "people" && <PeopleBoard top={top} meId={actor?.id} />}
      {board === "kad"    && <KadAchievement rows={kad_achievement} meId={actor?.id} />}
    </div>
  );
}

/* ── your own standing (private to you) ────────────────────────────────────── */

function YourStanding({ me, total }) {
  return (
    <div className="card mb-4" style={{ background: "var(--bg-accent)", border: "none" }}>
      <div className="flex justify-between items-center" style={{ gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="t-label" style={{ margin: 0 }}>Where you stand</p>
          <p className="t-caption" style={{ margin: 0 }}>Only you see this line.</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            #{me.rank}<span className="t-caption" style={{ fontWeight: 400 }}> of {total}</span>
          </div>
          <div className="t-caption">
            {me.days_active} active {me.days_active === 1 ? "day" : "days"}
            {me.submissions > 0 && ` · ${me.submissions} submissions`}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── KAD adoption ──────────────────────────────────────────────────────────── */

function KadBoard({ kads }) {
  if (kads.length === 0) return <p className="t-caption">No KADs yet.</p>;
  return (
    <>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th></th><th>KAD</th><th>Staff</th><th>Signed up</th>
              <th>Targets accepted</th><th>Adoption</th>
            </tr></thead>
            <tbody>
              {kads.map((k, i) => (
                <tr key={k.kad_id}>
                  <td className="t-mono" style={{ width: 32, color: "var(--text-muted)" }}>{i + 1}</td>
                  <td><strong>{k.kad_name}</strong></td>
                  <td className="t-mono">{k.staff}</td>
                  <td className="t-mono">
                    {pct(k.signup_pct)}
                    <span className="t-caption"> ({k.signed_up}/{k.staff})</span>
                  </td>
                  <td className="t-mono">
                    {pct(k.accept_pct)}
                    {k.targeted > 0 && <span className="t-caption"> ({k.accepted}/{k.targeted})</span>}
                  </td>
                  <td><Bar pct={k.adoption_pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="t-caption mt-2">
        Percentages, not totals — a KAD of 52 shouldn't beat a KAD of 15 on size alone.
        A dash means there's nothing assigned yet to accept.
      </p>
    </>
  );
}

function Bar({ pct: p }) {
  if (p == null) return <span className="t-caption">—</span>;
  const cls = p >= 0.9 ? "good" : p >= 0.6 ? "" : p >= 0.3 ? "warning" : "danger";
  return (
    <div className="flex items-center gap-2">
      <div className="progress-bar" style={{ width: 70, flexShrink: 0 }}>
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(100, p * 100)}%` }} />
      </div>
      <span className="t-mono t-caption">{Math.round(p * 100)}%</span>
    </div>
  );
}

/* ── company top 20 ────────────────────────────────────────────────────────── */

function PeopleBoard({ top, meId }) {
  if (top.length === 0) return <p className="t-caption">Nobody has used the platform yet.</p>;
  return (
    <>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th></th><th>Name</th><th>KAD</th><th>Active days</th>
              <th>Submissions</th><th>Notes</th><th>Ideas</th>
            </tr></thead>
            <tbody>
              {top.map(r => (
                <tr key={r.id} style={r.id === meId ? { background: "var(--bg-accent)" } : undefined}>
                  <td className="t-mono" style={{ width: 32, color: "var(--text-muted)" }}>
                    {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}
                  </td>
                  <td><strong>{r.full_name}</strong>{r.id === meId && <span className="t-caption"> — you</span>}</td>
                  <td className="t-caption">{r.kad_name || "—"}</td>
                  <td className="t-mono">{r.days_active}</td>
                  <td className="t-mono">{r.submissions}</td>
                  <td className="t-mono">{r.canvas_entries}</td>
                  <td className="t-mono">{r.ideas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="t-caption mt-2">
        Ranked on days you showed up, not how much you typed. Counts only — nobody's
        notes or ideas are visible here.
      </p>
    </>
  );
}

/* ── achievement, own KAD only ─────────────────────────────────────────────── */

function KadAchievement({ rows, meId }) {
  return (
    <>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th></th><th>Name</th><th>Allocations</th><th>Achievement</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.employee_id}
                  style={r.employee_id === meId ? { background: "var(--bg-accent)" } : undefined}>
                  <td className="t-mono" style={{ width: 32, color: "var(--text-muted)" }}>{i + 1}</td>
                  <td>
                    <strong>{r.employee_name}</strong>
                    {r.employee_id === meId && <span className="t-caption"> — you</span>}
                  </td>
                  <td className="t-mono">{r.allocations}</td>
                  <td><Bar pct={r.avg_achievement} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="t-caption mt-2">
        Your KAD only — this isn't shown company-wide. Achievement depends partly on how
        each target was set, so read it alongside the work, not as a pure ranking.
      </p>
    </>
  );
}
