import { useState, useEffect } from "react";
import { leaderboard as lbApi } from "../api/client";

/**
 * Leaderboard — one table, four rules, weekly reset.
 *
 * The purpose is engagement, so the design constraint is comprehension. Every
 * rule fits on one line and every row of the scoring table is something a
 * person can go and do today. There are no weights to tune, no capped
 * components and no percentages: a score you can't predict doesn't change
 * anyone's behaviour.
 *
 * The streak carries most of the motivation. It sits at the top, on the
 * viewer's own card, and is never ranked — a public streak ranking would
 * compound into exactly the unwinnable board this replaced.
 */
export default function LeaderboardView({ actor }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { lbApi.get().then(setData).catch(e => setErr(e.message)); }, []);

  if (err) return <div className="alert alert-danger">{err}</div>;
  if (!data) return <div className="loading-center"><span className="spinner" /></div>;

  const { top = [], me, total_people, kads = [], points } = data;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      {me && <YourCard me={me} total={total_people} />}

      <Rules points={points} />

      <p className="t-label mb-2">This week</p>
      {top.length === 0
        ? <p className="t-caption">Nobody has scored yet this week. First mover takes it.</p>
        : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th></th><th>Name</th><th>KAD</th><th>Points</th><th>Streak</th>
                </tr></thead>
                <tbody>
                  {top.map(r => (
                    <tr key={r.id} style={r.id === actor?.id ? { background: "var(--bg-accent)" } : undefined}>
                      <td className="t-mono" style={{ width: 34, color: "var(--text-muted)" }}>
                        {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}
                      </td>
                      <td>
                        <strong>{r.full_name}</strong>
                        {r.id === actor?.id && <span className="t-caption"> — you</span>}
                      </td>
                      <td className="t-caption">{r.kad_name || "—"}</td>
                      <td className="t-mono"><strong>{r.points}</strong></td>
                      <td className="t-mono">{r.streak > 0 ? `🔥 ${r.streak}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      <p className="t-caption mt-2">
        Resets every Monday. Only the top 20 is public — your own position is yours alone.
      </p>

      {kads.length > 0 && (
        <>
          <p className="t-label mb-2" style={{ marginTop: 24 }}>KADs this cycle</p>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th></th><th>KAD</th><th>Staff</th><th>Points</th>
                </tr></thead>
                <tbody>
                  {kads.map((k, i) => (
                    <tr key={k.kad_id}>
                      <td className="t-mono" style={{ width: 34, color: "var(--text-muted)" }}>{i + 1}</td>
                      <td><strong>{k.kad_name}</strong></td>
                      <td className="t-mono">{k.staff}</td>
                      <td className="t-mono"><strong>{k.points}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="t-caption mt-2">
            KADs run on the performance cycle rather than the week, because a KAD's rhythm is the cycle.
          </p>
        </>
      )}
    </div>
  );
}

function YourCard({ me, total }) {
  const alive = me.streak > 0;
  return (
    <div className="card mb-4" style={{ background: "var(--bg-accent)", border: "none" }}>
      <div className="flex justify-between items-center" style={{ gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>
            {alive ? `🔥 ${me.streak}` : "🔥 0"}
          </div>
          <p className="t-caption" style={{ margin: 0 }}>
            {alive
              ? `day streak · best ${me.streak_longest}`
              : "Do one thing today to start a streak"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>
            #{me.rank}<span className="t-caption" style={{ fontWeight: 400 }}> of {total}</span>
          </div>
          <p className="t-caption" style={{ margin: 0 }}>{me.points} points this week</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Collapsed by default. The rules have to be findable, but once someone has
 * read them they don't want a scoring table between them and the board every
 * single visit.
 */
function Rules({ points = {} }) {
  const [open, setOpen] = useState(false);
  const rows = [
    ["Submit work", points.submitted, "per submission"],
    ["Accept a target", points.accepted, "per target"],
    ["Confirm someone's work", points.confirmed, "per row"],
    ["Write an idea", points.idea, "per day"],
    ["Plan your day in My day", points.planned, "per day"],
    ["Log a win, blocker or learning", points.captured, "per day"],
    ["Show up and do anything", points.day, "per day"],
  ];
  return (
    <div className="card mb-4" style={{ padding: 0, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", background: "none", border: "none", cursor: "pointer",
          font: "inherit", color: "inherit", textAlign: "left" }}>
        <span style={{ fontWeight: 600 }}>How points work</span>
        <span style={{ color: "var(--text-muted)" }}>{open ? "▾" : "›"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ display: "grid", gap: 6 }}>
            {rows.map(([label, n, per]) => (
              <div key={label} className="flex justify-between" style={{ gap: 10 }}>
                <span>{label} <span className="t-caption">· {per}</span></span>
                <span className="t-mono">+{n}</span>
              </div>
            ))}
          </div>
          <p className="t-caption" style={{ marginTop: 10 }}>
            Anything you write yourself — tasks, notes, ideas — counts once a day, however
            much of it you write. Forty notes earns what one note earns.
          </p>
          <p className="t-caption" style={{ marginTop: 6 }}>
            Streaks count weekdays. A weekend can't break one, and doesn't extend one either.
          </p>
        </div>
      )}
    </div>
  );
}
