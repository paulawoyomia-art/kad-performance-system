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

const ymd = (d) => d.toISOString().slice(0, 10);
const TODAY = () => ymd(new Date());
const TOMORROW = () => ymd(new Date(Date.now() + 86400000));

const prettyDate = (s) =>
  new Date(s + "T00:00:00").toLocaleDateString(undefined,
    { weekday: "long", day: "numeric", month: "long" });

export default function CanvasView({ actor, onGoToWork }) {
  const [screen, setScreen] = useState("today");   // today | records
  return screen === "today"
    ? <TodayScreen actor={actor} onGoToWork={onGoToWork} onRecords={() => setScreen("records")} />
    : <RecordsScreen onBack={() => setScreen("today")} />;
}

/* ── Today ─────────────────────────────────────────────────────────────────── */

function TodayScreen({ actor, onGoToWork, onRecords }) {
  const [day, setDay] = useState(null);
  const [tomorrow, setTomorrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newTomorrow, setNewTomorrow] = useState("");
  const [capture, setCapture] = useState(null);     // 'win' | 'blocker' | 'learning'
  const [captureText, setCaptureText] = useState("");

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

  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setErr("");
    try { await fn(); await load(); }
    catch (e) { setErr(e.message); }
  };

  async function addTask(e) {
    e?.preventDefault();
    const title = newTask.trim(); if (!title) return;
    setNewTask("");
    await run(() => canvasApi.addTask({ title, planned_for: TODAY() }));
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
  const submittable = tasks.filter(t => t.status === "done" && t.allocation_id);

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
        <button className="btn btn-secondary btn-sm" onClick={onRecords}>Your records</button>
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
          <form onSubmit={addTask} className="flex gap-2 mb-3">
            <input className="form-input" value={newTask} placeholder="Add a task for today"
              onChange={e => setNewTask(e.target.value)} />
            <button className="btn btn-primary" type="submit" disabled={!newTask.trim()}>Add</button>
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
              {tasks.length === 0
                ? <p className="t-caption">Nothing planned yet. Add your first task above.</p>
                : <TaskList tasks={tasks} onChange={load} onError={setErr} />}
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
              <div key={t.id} className="flex items-center gap-2" style={{ padding: "6px 0" }}>
                <span className="t-caption">□</span>
                <span style={{ flex: 1 }}>{t.title}</span>
                <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }}
                  onClick={() => run(() => canvasApi.deleteTask(t.id))}>✕</button>
              </div>
            ))}
            <form onSubmit={addTomorrow} className="flex gap-2 mt-2">
              <input className="form-input" value={newTomorrow} placeholder="Add something for tomorrow"
                onChange={e => setNewTomorrow(e.target.value)} />
              <button className="btn btn-secondary" type="submit" disabled={!newTomorrow.trim()}>Add</button>
            </form>
            <p className="t-caption mt-1">These become your list when tomorrow arrives.</p>
          </section>

          {submittable.length > 0 && (
            <div className="alert alert-info" style={{ marginTop: 20 }}>
              <div className="flex justify-between items-center" style={{ gap: 10, flexWrap: "wrap" }}>
                <span>
                  {submittable.length} completed {submittable.length === 1 ? "task maps" : "tasks map"} to
                  {" "}{submittable.length === 1 ? "a target" : "targets"} you're measured on.
                </span>
                <button className="btn btn-primary btn-sm" onClick={() => onGoToWork?.()}>
                  Submit in My work
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Task list with ordering ───────────────────────────────────────────────── */

/**
 * Order is the person's own arrangement, not a computed priority. Two ways to
 * change it because neither works everywhere: drag is natural with a mouse but
 * unreliable on touch, so the arrows are always there as the dependable path.
 */
function TaskList({ tasks, onChange, onError }) {
  const [dragId, setDragId] = useState(null);

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
          style={{ padding: "10px 12px", gap: 8,
            borderBottom: i < tasks.length - 1 ? "1px solid var(--border)" : "none",
            background: dragId === t.id ? "var(--surface)" : "transparent" }}>

          <span style={{ display: "flex", flexDirection: "column" }}>
            <button className="btn btn-ghost btn-sm" style={{ padding: 0, lineHeight: 1, height: 16 }}
              disabled={i === 0} onClick={() => move(t.id, -1)} aria-label="Move up">▲</button>
            <button className="btn btn-ghost btn-sm" style={{ padding: 0, lineHeight: 1, height: 16 }}
              disabled={i === tasks.length - 1} onClick={() => move(t.id, 1)} aria-label="Move down">▼</button>
          </span>

          <button className="btn btn-ghost btn-sm" style={{ padding: "0 4px" }}
            onClick={() => cycle(t)} aria-label="Change status">
            {t.status === "done" ? "☑" : t.status === "doing" ? "◐" : "☐"}
          </button>

          <span style={{ flex: 1,
            textDecoration: t.status === "done" ? "line-through" : "none",
            color: t.status === "done" ? "var(--text-secondary)" : "inherit" }}>
            {t.title}
            {(t.project_name || t.output_metric) && (
              <span className="t-caption" style={{ display: "block" }}>
                {t.output_metric || t.project_name}
                {t.output_metric && t.project_name ? ` · ${t.project_name}` : ""}
              </span>
            )}
          </span>

          <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }}
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

/* ── helpers ───────────────────────────────────────────────────────────────── */

function labelOf(kind) {
  return kind === "win" ? "Win" : kind === "blocker" ? "Blocker" : "Learnt";
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
