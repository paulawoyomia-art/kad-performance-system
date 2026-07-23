import { useState, useEffect, useCallback } from "react";
import { canvas as canvasApi } from "../api/client";

/**
 * Daily Work Canvas — a personal daily workspace.
 *
 * Deliberately additive: it reads and writes only its own two tables and never
 * touches an allocation. The one connection to the performance system is the
 * banner at the bottom, which notices when finished work is tied to a target
 * and points the person at My work to submit it.
 *
 * Everything here is the signed-in person's own; the API has no path to anyone
 * else's canvas, so there is nothing to hide in the UI.
 */

// LOCAL calendar date, not UTC. toISOString() would hand back yesterday for
// anyone east of Greenwich in the small hours — in Lagos (UTC+1) that's every
// day between midnight and 01:00. getFullYear/getMonth/getDate read the
// browser's own timezone, so this is right for whoever is using it, wherever.
const ymd = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const TODAY = () => ymd(new Date());
const TOMORROW = () => ymd(new Date(Date.now() + 86400000));

/**
 * The date this screen thinks it is, kept honest.
 *
 * The canvas is often left open — overnight, over a weekend. Without this the
 * view keeps yesterday's date and quietly files new tasks to a day that has
 * already gone. So: re-check on a timer, and again whenever the tab is brought
 * back to the front, which is when a laptop waking from sleep notices.
 */
function useToday() {
  const [day, setDay] = useState(TODAY);
  useEffect(() => {
    const check = () => setDay(prev => (TODAY() !== prev ? TODAY() : prev));
    const timer = setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);
  return day;
}

const prettyDate = (s) =>
  new Date(s + "T00:00:00").toLocaleDateString(undefined,
    { weekday: "long", day: "numeric", month: "long" });

export default function CanvasView({ actor, onGoToWork }) {
  const [screen, setScreen] = useState("today");   // today | records | team
  if (screen === "records") return <RecordsScreen onBack={() => setScreen("today")} />;
  if (screen === "team")    return <TeamScreen onBack={() => setScreen("today")} />;
  return <TodayScreen actor={actor} onGoToWork={onGoToWork}
                      onRecords={() => setScreen("records")}
                      onTeam={() => setScreen("team")} />;
}

/* ── Today ─────────────────────────────────────────────────────────────────── */

function TodayScreen({ actor, onGoToWork, onRecords, onTeam }) {
  const todayStr = useToday();          // rolls over at midnight on its own
  const [day, setDay] = useState(null);
  const [tomorrow, setTomorrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newTomorrow, setNewTomorrow] = useState("");
  const [capture, setCapture] = useState(null);     // 'win' | 'blocker' | 'learning'
  const [captureText, setCaptureText] = useState("");
  const [targets, setTargets] = useState([]);       // live allocations to link against
  const [linkTo, setLinkTo] = useState("");         // allocation_id chosen on the add form

  const load = useCallback(async () => {
    setErr("");
    try {
      const [d, t] = await Promise.all([
        canvasApi.day(TODAY()),
        canvasApi.day(TOMORROW()),
      ]);
      setDay(d); setTomorrow(t);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  // Reloads on mount AND whenever the calendar day changes underneath us.
  useEffect(() => { load(); }, [load, todayStr]);

  // The targets this person is measured on, so a task can be tied to one.
  useEffect(() => { canvasApi.linkable().then(setTargets).catch(() => setTargets([])); }, []);

  // Managers get a team view. We ask the API rather than reading roles here —
  // it already knows the scope rules, and this way the button can't appear for
  // someone the server would refuse anyway.
  const [managesTeam, setManagesTeam] = useState(false);
  useEffect(() => {
    canvasApi.team().then(t => setManagesTeam((t?.people || []).length > 0)).catch(() => {});
  }, []);

  const run = async (fn) => {
    setErr("");
    try { await fn(); await load(); }
    catch (e) { setErr(e.message); }
  };

  async function addTask(e) {
    e?.preventDefault();
    const title = newTask.trim(); if (!title) return;
    const t = targets.find(x => String(x.allocation_id) === linkTo);
    setNewTask("");
    await run(() => canvasApi.addTask({
      title, planned_for: TODAY(),
      allocation_id: t ? t.allocation_id : null,
      project_id:    t ? t.project_id    : null,
    }));
  }

  async function addTomorrow(e) {
    e?.preventDefault();
    const title = newTomorrow.trim(); if (!title) return;
    setNewTomorrow("");
    await run(() => canvasApi.addTask({ title, planned_for: TOMORROW() }));
  }

  async function saveCapture(e) {
    e?.preventDefault();
    const body = captureText.trim(); if (!body) return;
    const kind = capture;
    setCaptureText(""); setCapture(null);
    await run(() => canvasApi.addItem({ kind, body, entry_date: TODAY() }));
  }

  const tasks = day?.tasks || [];
  const items = day?.items || [];

  // Finished work that's tied to a target — the one link back to the platform.
  // Grouped by target, because a submission is made against ONE allocation:
  // handing over three targets at once would just be ambiguous.
  const submittable = tasks.filter(t => t.status === "done" && t.allocation_id
                                     && t.signoff_performed !== 1);
  const handover = submittable.length ? (() => {
    const allocId = submittable[0].allocation_id;
    const same = submittable.filter(t => t.allocation_id === allocId);
    return {
      allocation_id: allocId,
      metric: same[0].output_metric,
      count: same.length,
      date: TODAY(),
      // The narrative starts as what they actually did today, in their words.
      narrative: same.map(t => t.title).join("; "),
    };
  })() : null;

  if (loading) return <div className="loading-center"><span className="spinner" /></div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="flex justify-between items-center mb-3" style={{ gap: 8, flexWrap: "wrap" }}>
        <div>
          <h2 className="t-title" style={{ marginBottom: 2 }}>
            {greeting()}, {(actor?.full_name || "").split(" ")[0]}
          </h2>
          <p className="t-caption" style={{ margin: 0 }}>{prettyDate(TODAY())}</p>
        </div>
        <div className="flex gap-2">
          {managesTeam && (
            <button className="btn btn-secondary btn-sm" onClick={onTeam}>Your team</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={onRecords}>Your records</button>
        </div>
      </div>

      {err && <div className="alert alert-danger mb-3">{err}</div>}

      {day?.no_canvas && (
        <div className="empty">
          <p className="empty-title">No work canvas on this account</p>
          <p className="empty-body">The canvas belongs to an employee record. Sign in with your staff account to use it.</p>
        </div>
      )}

      {!day?.no_canvas && (
        <>
          <form onSubmit={addTask} className="mb-3">
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              <input className="form-input" value={newTask} placeholder="Add a task for today"
                style={{ flex: "1 1 200px" }}
                onChange={e => setNewTask(e.target.value)} />
              <button className="btn btn-primary" type="submit" disabled={!newTask.trim()}>Add</button>
            </div>
            {targets.length > 0 && (
              <>
                <select className="form-select mt-2" value={linkTo}
                  onChange={e => setLinkTo(e.target.value)}>
                  <option value="">Not tied to a target</option>
                  {targets.map(t => (
                    <option key={t.allocation_id} value={t.allocation_id}>
                      {t.output_metric}{t.project_name ? ` · ${t.project_name}` : ""}
                    </option>
                  ))}
                </select>
                {/* The choice deliberately sticks — someone logging five site
                    visits against one target shouldn't re-pick five times. But
                    sticky AND silent would quietly file unrelated work against
                    the wrong target, so it says what it's about to do. */}
                {linkTo && (
                  <p className="t-caption mt-1" style={{ color: "var(--text-accent, inherit)" }}>
                    Next task will also count toward{" "}
                    <strong>{targets.find(t => String(t.allocation_id) === linkTo)?.output_metric}</strong>
                    {" "}— change it above if that's not right.
                  </p>
                )}
              </>
            )}
          </form>

          {day?.carry_over > 0 && (
            <div className="alert alert-warning mb-3 flex justify-between items-center" style={{ gap: 10, flexWrap: "wrap" }}>
              <span>{day.carry_over} unfinished {day.carry_over === 1 ? "task" : "tasks"} from earlier.</span>
              <button className="btn btn-secondary btn-sm"
                onClick={() => run(() => canvasApi.carryOver(TODAY()))}>Move to today</button>
            </div>
          )}

          <div className="canvas-grid" style={{ display: "grid", gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>

            <section>
              <p className="t-label mb-2">Today · {tasks.filter(t => t.status === "done").length} of {tasks.length} done</p>
              <TargetProgress tasks={tasks} />
              {tasks.length === 0
                ? <p className="t-caption">Nothing planned yet. Add your first task above.</p>
                : <TaskList tasks={tasks} targets={targets} onChange={load} onError={setErr} />}
            </section>

            <section>
              <p className="t-label mb-2">Today's notes</p>
              <div className="flex gap-2 mb-2" style={{ flexWrap: "wrap" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setCapture("win")}>+ Win</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setCapture("blocker")}>+ Blocker</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setCapture("learning")}>+ Learnt</button>
              </div>

              {capture && (
                <form onSubmit={saveCapture} className="flex gap-2 mb-2">
                  <input className="form-input" autoFocus value={captureText}
                    placeholder={capture === "win" ? "What went well?"
                      : capture === "blocker" ? "What slowed you down?"
                      : "What did you learn?"}
                    onChange={e => setCaptureText(e.target.value)} />
                  <button className="btn btn-primary btn-sm" type="submit">Save</button>
                  <button className="btn btn-ghost btn-sm" type="button"
                    onClick={() => { setCapture(null); setCaptureText(""); }}>✕</button>
                </form>
              )}

              {items.length === 0 && !capture && <p className="t-caption">Nothing captured yet today.</p>}
              {items.map(it => (
                <div key={it.id} className="flex justify-between items-center"
                  style={{ padding: "8px 10px", marginBottom: 6, borderRadius: "var(--radius)",
                    background: "var(--surface)", gap: 8 }}>
                  <span style={{ flex: 1 }}>
                    <span className={`badge ${it.kind === "win" ? "badge-success"
                      : it.kind === "blocker" ? "badge-warning" : "badge-info"}`}
                      style={{ marginRight: 8 }}>{labelOf(it.kind)}</span>
                    {it.body}
                  </span>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }}
                    onClick={() => run(() => canvasApi.deleteItem(it.id))}>✕</button>
                </div>
              ))}
            </section>
          </div>

          <section style={{ marginTop: 20 }}>
            <p className="t-label mb-2">Tomorrow</p>
            {(tomorrow?.tasks || []).map(t => (
              <div key={t.id} className="flex items-center gap-2"
                style={{ padding: "6px 0", gap: 8, flexWrap: "wrap" }}>
                <span className="t-caption">□</span>
                <span style={{ flex: 1, minWidth: 120 }}>
                  {t.title}
                  {t.output_metric && (
                    <span className="t-caption" style={{ display: "block" }}>
                      {t.output_metric}{t.project_name ? ` · ${t.project_name}` : ""}
                    </span>
                  )}
                </span>
                {/* Plans change in both directions — something you parked for
                    tomorrow often turns out to be today's job. Pushing forward
                    without a way back would just mean deleting and retyping. */}
                <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px", flexShrink: 0 }}
                  onClick={() => run(() => canvasApi.updateTask(t.id, { planned_for: TODAY() }))}
                  title="Bring into today">← Today</button>
                <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px", flexShrink: 0 }}
                  onClick={() => run(() => canvasApi.deleteTask(t.id))} aria-label="Delete">✕</button>
              </div>
            ))}
            <form onSubmit={addTomorrow} className="flex gap-2 mt-2">
              <input className="form-input" value={newTomorrow} placeholder="Add something for tomorrow"
                onChange={e => setNewTomorrow(e.target.value)} />
              <button className="btn btn-secondary" type="submit" disabled={!newTomorrow.trim()}>Add</button>
            </form>
            <p className="t-caption mt-1">These become your list when tomorrow arrives.</p>
          </section>

          {handover && (
            <div className="alert alert-info" style={{ marginTop: 20 }}>
              <div className="flex justify-between items-center" style={{ gap: 10, flexWrap: "wrap" }}>
                <span>
                  {handover.count} finished {handover.count === 1 ? "task counts" : "tasks count"} toward{" "}
                  <strong>{handover.metric}</strong>. Submit it and the date and description
                  come with you — you add the figure and the proof.
                </span>
                <button className="btn btn-primary btn-sm" onClick={() => onGoToWork?.(handover)}>
                  Submit this work
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Progress against the targets you're actually measured on ──────────────── */

function AchievementBar({ pct }) {
  if (pct == null) return <span className="t-caption">Nothing reported yet</span>;
  const cls = pct >= 1 ? "good" : pct >= 0.5 ? "" : pct >= 0.2 ? "warning" : "danger";
  return (
    <div className="flex items-center gap-2">
      <div className="progress-bar" style={{ width: 90, flexShrink: 0 }}>
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
      <span className="t-mono t-caption">{Math.round(pct * 100)}%</span>
    </div>
  );
}

/**
 * Ticking tasks off is satisfying but it isn't the measure. What counts is the
 * target: 40 km of patrol, 100% uptime. So for every task tied to a target,
 * this shows both — how much of today's work is done, and where the reported
 * figure stands against the number being asked for.
 */
function TargetProgress({ tasks }) {
  const linked = tasks.filter(t => t.allocation_id);
  if (linked.length === 0) return null;

  const byTarget = new Map();
  for (const t of linked) {
    const g = byTarget.get(t.allocation_id) || {
      metric: t.output_metric, project: t.project_name, unit: t.unit || "",
      target: t.target_value, reported: t.actual_output_rollup ?? 0,
      pct: t.achievement_pct, confirmed: t.signoff_performed === 1,
      total: 0, done: 0,
    };
    g.total += 1;
    if (t.status === "done") g.done += 1;
    byTarget.set(t.allocation_id, g);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {[...byTarget.entries()].map(([id, g]) => (
        <div key={id} style={{ background: "var(--surface)", borderRadius: "var(--radius)",
          padding: "10px 12px", marginBottom: 8 }}>
          <div className="flex justify-between items-center" style={{ gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600 }}>{g.metric}</span>
            <span className="t-caption">{g.done} of {g.total} today</span>
          </div>
          {g.project && <p className="t-caption" style={{ margin: "2px 0 6px" }}>{g.project}</p>}
          <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
            <AchievementBar pct={g.pct} />
            <span className="t-caption">
              {g.reported} of {g.target} {g.unit} reported
            </span>
          </div>
          {g.confirmed && (
            <p className="t-caption" style={{ margin: "6px 0 0", color: "var(--success)" }}>
              ✓ Confirmed by your manager — this target is closed.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Task list with ordering ───────────────────────────────────────────────── */

// Short labels on purpose: these sit on a phone next to the task title, so
// "Not started" would eat the row. Tapping cycles To do → Doing → Done.
const STATUS = {
  open:     { label: "To do", cls: "badge-neutral" },
  doing:    { label: "Doing", cls: "badge-info" },
  done:     { label: "Done",  cls: "badge-success" },
  deferred: { label: "Later", cls: "badge-neutral" },
};

/**
 * Order is the person's own arrangement, not a computed priority. Two ways to
 * change it because neither works everywhere: drag is natural with a mouse but
 * unreliable on touch, so the arrows are always there as the dependable path.
 */
function TaskList({ tasks, targets = [], onChange, onError }) {
  const [dragId, setDragId] = useState(null);
  const [editingLink, setEditingLink] = useState(null);   // task id being re-linked

  const run = async (fn) => {
    try { await fn(); onChange(); }
    catch (e) { onError?.(e.message); }
  };

  const move = (id, dir) => {
    const ids = tasks.map(t => t.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => canvasApi.reorder(ids));
  };

  const drop = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const ids = tasks.map(t => t.id).filter(x => x !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(null);
    run(() => canvasApi.reorder(ids));
  };

  const cycle = (t) => {
    const next = t.status === "open" ? "doing" : t.status === "doing" ? "done" : "open";
    run(() => canvasApi.updateTask(t.id, { status: next }));
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {tasks.map((t, i) => (
        <div key={t.id}
          draggable
          onDragStart={() => setDragId(t.id)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => drop(t.id)}
          className="flex items-center gap-2"
          style={{ padding: "10px 12px", gap: 8, flexWrap: "wrap",
            borderBottom: i < tasks.length - 1 ? "1px solid var(--border)" : "none",
            background: dragId === t.id ? "var(--surface)" : "transparent" }}>

          <span style={{ display: "flex", flexDirection: "column" }}>
            <button className="btn btn-ghost btn-sm" style={{ padding: 0, lineHeight: 1, height: 16 }}
              disabled={i === 0} onClick={() => move(t.id, -1)} aria-label="Move up">▲</button>
            <button className="btn btn-ghost btn-sm" style={{ padding: 0, lineHeight: 1, height: 16 }}
              disabled={i === tasks.length - 1} onClick={() => move(t.id, 1)} aria-label="Move down">▼</button>
          </span>

          {/* The status carries a word, not just a glyph. A bare checkbox looks
              like a toggle, so nobody discovers that it actually cycles — and
              ☐ vs ◐ is a coin-flip on a phone in daylight. */}
          <button className={`badge ${(STATUS[t.status] || STATUS.open).cls}`}
            onClick={() => cycle(t)}
            style={{ border: "none", cursor: "pointer", flexShrink: 0, minWidth: 68 }}
            title="Tap to change status">
            {(STATUS[t.status] || STATUS.open).label}
          </button>

          <span style={{ flex: 1, minWidth: 120 }}>
            <span style={{
              textDecoration: t.status === "done" ? "line-through" : "none",
              color: t.status === "done" ? "var(--text-secondary)" : "inherit" }}>
              {t.title}
            </span>

            {/* The link line IS the control. Work gets tied to a target after
                the fact as often as before it — you finish the patrol, then
                realise it counts. Making this editable removes the only other
                route, which was delete and retype. */}
            {targets.length > 0 && (
              editingLink === t.id ? (
                <select className="form-select mt-1" autoFocus
                  value={t.allocation_id || ""}
                  onBlur={() => setEditingLink(null)}
                  onChange={e => {
                    const pick = targets.find(x => String(x.allocation_id) === e.target.value);
                    setEditingLink(null);
                    run(() => canvasApi.updateTask(t.id, {
                      allocation_id: pick ? pick.allocation_id : null,
                      project_id:    pick ? pick.project_id    : null,
                    }));
                  }}>
                  <option value="">Not tied to a target</option>
                  {targets.map(x => (
                    <option key={x.allocation_id} value={x.allocation_id}>
                      {x.output_metric}{x.project_name ? ` · ${x.project_name}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <button className="t-caption"
                  onClick={() => setEditingLink(t.id)}
                  style={{ display: "block", background: "none", border: "none", padding: 0,
                    cursor: "pointer", textAlign: "left",
                    color: t.output_metric ? "var(--text-muted)" : "var(--text-accent, inherit)",
                    textDecoration: t.output_metric ? "none" : "underline" }}>
                  {t.output_metric
                    ? `${t.output_metric}${t.project_name ? ` · ${t.project_name}` : ""}`
                    : "+ tie to a target"}
                </button>
              )
            )}
          </span>

          {/* Moving a task on is more useful than marking it "deferred" — it
              says where it went, and it lands on tomorrow's list by itself. */}
          {t.status !== "done" && (
            <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px", flexShrink: 0 }}
              onClick={() => run(() => canvasApi.updateTask(t.id, { planned_for: TOMORROW() }))}
              title="Move to tomorrow">→ Tmw</button>
          )}

          <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px", flexShrink: 0 }}
            onClick={() => run(() => canvasApi.deleteTask(t.id))} aria-label="Delete">✕</button>
        </div>
      ))}
    </div>
  );
}

/* ── Records ───────────────────────────────────────────────────────────────── */

function RecordsScreen({ onBack }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [results, setResults] = useState(null);
  const [days, setDays] = useState([]);
  const [openDay, setOpenDay] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { canvasApi.days().then(setDays).catch(() => setDays([])); }, []);

  useEffect(() => {
    if (!q.trim() && !kind) { setResults(null); return; }
    setBusy(true);
    const id = setTimeout(() => {
      canvasApi.records(q, kind).then(setResults).catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(id);
  }, [q, kind]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="flex items-center gap-2 mb-3">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <h2 className="t-title" style={{ margin: 0 }}>Your records</h2>
      </div>

      <input className="form-input mb-2" value={q} placeholder="Search everything you've written"
        onChange={e => setQ(e.target.value)} />

      <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        {[["", "All"], ["task", "Tasks"], ["win", "Wins"], ["blocker", "Blockers"], ["learning", "Learnings"]]
          .map(([k, label]) => (
            <button key={k} className={`btn btn-sm ${kind === k ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setKind(k)}>{label}</button>
          ))}
      </div>

      {busy && <div className="loading-center"><span className="spinner" /></div>}

      {results && !busy && (
        <div className="mb-4">
          <p className="t-label mb-2">{results.length} result{results.length === 1 ? "" : "s"}</p>
          {results.length === 0 && <p className="t-caption">Nothing matched.</p>}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {results.map((r, i) => (
              <div key={r.type + r.id} style={{ padding: "10px 12px",
                borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none" }}>
                <p className="t-caption" style={{ margin: 0 }}>{prettyDate(r.date)}</p>
                <span>
                  {r.type !== "task" && (
                    <span className={`badge ${r.type === "win" ? "badge-success"
                      : r.type === "blocker" ? "badge-warning" : "badge-info"}`}
                      style={{ marginRight: 8 }}>{labelOf(r.type)}</span>
                  )}
                  {r.body}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!results && (
        <>
          <p className="t-label mb-2">Recent days</p>
          {days.length === 0 && <p className="t-caption">Nothing recorded yet.</p>}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {days.map((d, i) => (
              <button key={d.date}
                onClick={() => setOpenDay(openDay === d.date ? null : d.date)}
                style={{ display: "flex", width: "100%", textAlign: "left", gap: 10,
                  alignItems: "center", padding: "10px 12px", background: "none", border: "none",
                  cursor: "pointer",
                  borderBottom: i < days.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ flex: 1 }}>{prettyDate(d.date)}</span>
                <span className="t-caption">
                  {d.done} of {d.tasks} done
                  {d.wins > 0 && ` · ${d.wins} win${d.wins === 1 ? "" : "s"}`}
                  {d.blockers > 0 && ` · ${d.blockers} blocker${d.blockers === 1 ? "" : "s"}`}
                </span>
                <span style={{ color: "var(--text-muted)" }}>{openDay === d.date ? "▾" : "›"}</span>
              </button>
            ))}
          </div>
          {openDay && <DayDetail date={openDay} />}
        </>
      )}
    </div>
  );
}

function DayDetail({ date }) {
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); canvasApi.day(date).then(setD).catch(() => setD({ tasks: [], items: [] })); }, [date]);
  if (!d) return <div className="loading-center"><span className="spinner" /></div>;
  return (
    <div className="card mt-3">
      <p className="t-label mb-2">{prettyDate(date)}</p>
      {(d.tasks || []).map(t => (
        <div key={t.id} style={{ padding: "4px 0" }}>
          <span style={{ marginRight: 6 }}>{t.status === "done" ? "☑" : "☐"}</span>
          <span style={{ textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</span>
        </div>
      ))}
      {(d.items || []).map(it => (
        <div key={it.id} style={{ padding: "4px 0" }}>
          <span className={`badge ${it.kind === "win" ? "badge-success"
            : it.kind === "blocker" ? "badge-warning" : "badge-info"}`}
            style={{ marginRight: 8 }}>{labelOf(it.kind)}</span>
          {it.body}
        </div>
      ))}
      {(d.tasks || []).length === 0 && (d.items || []).length === 0 &&
        <p className="t-caption">Nothing recorded on this day.</p>}
    </div>
  );
}

/* ── Team view (managers) ──────────────────────────────────────────────────── */

/**
 * What a manager sees of their people's day: who's moving, and who is stuck.
 *
 * Counts and blockers only — no task titles, no wins, no learnings, and nothing
 * at all from Ideas. The point is to surface "I can't get onto the site" the
 * same day it happens, not to read over anyone's shoulder.
 */
function TeamScreen({ onBack }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { canvasApi.team(TODAY()).then(setData).catch(e => setErr(e.message)); }, []);

  if (err) return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <button className="btn btn-ghost btn-sm mb-3" onClick={onBack}>← Back</button>
      <div className="alert alert-danger">{err}</div>
    </div>
  );
  if (!data) return <div className="loading-center"><span className="spinner" /></div>;

  const { people = [], blockers = [], scope } = data;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="flex items-center gap-2 mb-1">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <h2 className="t-title" style={{ margin: 0 }}>Your team today</h2>
      </div>
      <p className="t-caption mb-4">
        {scope === "kad" ? "Everyone in your KAD" : "The people who report to you"} ·
        {" "}{prettyDate(TODAY())}
      </p>

      {blockers.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p className="t-label mb-2">Blockers raised today</p>
          {blockers.map(b => (
            <div key={b.id} className="alert alert-warning" style={{ marginBottom: 6 }}>
              <strong>{b.full_name}:</strong> {b.body}
            </div>
          ))}
        </div>
      )}

      {people.length === 0
        ? <p className="t-caption">Nobody in scope yet.</p>
        : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Name</th><th>Planned</th><th>Done</th><th>Blockers</th><th>Wins</th>
                </tr></thead>
                <tbody>
                  {people.map(p => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.full_name}</strong>
                        {p.designation && <span className="t-caption" style={{ display: "block" }}>{p.designation}</span>}
                      </td>
                      <td className="t-mono">{p.planned}</td>
                      <td className="t-mono">{p.done}</td>
                      <td className="t-mono">{p.blockers > 0 ? p.blockers : "—"}</td>
                      <td className="t-mono">{p.wins > 0 ? p.wins : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <p className="t-caption mt-2">
        Counts and blockers only. Task details, wins, learnings and Ideas stay with the person.
      </p>
    </div>
  );
}

/* ── helpers ───────────────────────────────────────────────────────────────── */

function labelOf(kind) {
  return kind === "win" ? "Win" : kind === "blocker" ? "Blocker" : "Learnt";
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
