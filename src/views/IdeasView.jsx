import { useState, useEffect, useCallback } from "react";
import { ideas as ideasApi } from "../api/client";

/**
 * Ideas — a private notebook.
 *
 * Deliberately unlike the canvas next door: the canvas is open and organised by
 * day, an idea is private and stands on its own. Nobody sees a note — manager,
 * HRBP or admin included — until its author shares it with a named person, and
 * recipients get read access only. The server enforces all of that; this view
 * just avoids showing buttons that would fail.
 */

const when = (s) => {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z"));
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export default function IdeasView() {
  const [openId, setOpenId] = useState(null);   // id | "new" | null
  return openId
    ? <Editor id={openId} onClose={() => setOpenId(null)} />
    : <IdeaList onOpen={setOpenId} />;
}

/* ── list ──────────────────────────────────────────────────────────────────── */

function IdeaList({ onOpen }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    ideasApi.list().then(setData).catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="alert alert-danger">{err}</div>;
  if (!data) return <div className="loading-center"><span className="spinner" /></div>;

  const { mine = [], shared = [], no_ideas } = data;

  if (no_ideas) return (
    <div className="empty">
      <p className="empty-title">No notebook on this account</p>
      <p className="empty-body">Ideas belong to an employee record. Sign in with your staff account to use them.</p>
    </div>
  );

  const nothing = mine.length === 0 && shared.length === 0;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="flex justify-between items-center mb-4" style={{ gap: 8, flexWrap: "wrap" }}>
        <h2 className="t-title" style={{ margin: 0 }}>Ideas</h2>
        {!nothing && (
          <button className="btn btn-primary btn-sm" onClick={() => onOpen("new")}>+ New idea</button>
        )}
      </div>

      {nothing && (
        <div className="empty" style={{ padding: "48px 16px" }}>
          <p className="empty-title">Got an idea? Pen it down.</p>
          <p className="empty-body">
            Anything worth keeping — a fix, a question, a half-formed thought.
            It stays private to you unless you choose to share it.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 16 }}
            onClick={() => onOpen("new")}>Write your first idea</button>
        </div>
      )}

      {mine.length > 0 && (
        <Section title="Yours" count={mine.length}>
          {mine.map(i => <Card key={i.id} idea={i} onOpen={onOpen} />)}
        </Section>
      )}

      {shared.length > 0 && (
        <Section title="Shared with you" count={shared.length}>
          {shared.map(i => <Card key={i.id} idea={i} onOpen={onOpen} shared />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="flex items-center gap-2 mb-2">
        <p className="t-label" style={{ margin: 0 }}>{title}</p>
        <span className="badge badge-neutral">{count}</span>
      </div>
      <div style={{ display: "grid", gap: 12,
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {children}
      </div>
    </div>
  );
}

function Card({ idea, onOpen, shared }) {
  return (
    <button className="card" onClick={() => onOpen(idea.id)}
      style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--border)",
        display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <span style={{ fontWeight: 600 }}>{idea.title}</span>
      <span className="t-caption">
        {when(idea.updated_at)}
        {shared && idea.author ? ` · ${idea.author}` : ""}
        {!shared && idea.shared_with > 0
          ? ` · shared with ${idea.shared_with}` : ""}
      </span>
      {idea.excerpt && (
        <span className="t-caption" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {idea.excerpt}{idea.truncated ? "…" : ""}
        </span>
      )}
    </button>
  );
}

/* ── editor ────────────────────────────────────────────────────────────────── */

function Editor({ id, onClose }) {
  const isNew = id === "new";
  const [idea, setIdea] = useState(isNew ? { title: "", content: "", is_owner: 1, shares: [] } : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(() => {
    if (isNew) return;
    ideasApi.get(id).then(setIdea).catch(e => setErr(e.message));
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  if (err && !idea) return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <button className="btn btn-ghost btn-sm mb-3" onClick={onClose}>← Back</button>
      <div className="alert alert-danger">{err}</div>
    </div>
  );
  if (!idea) return <div className="loading-center"><span className="spinner" /></div>;

  const owner = !!idea.is_owner;

  async function save() {
    const title = (idea.title || "").trim();
    if (!title) { setErr("Give it a title first."); return; }
    setErr(""); setBusy(true);
    try {
      if (isNew) {
        await ideasApi.create({ title, content: idea.content || "" });
        onClose();
      } else {
        await ideasApi.update(id, { title, content: idea.content || "" });
        setSaved(true); setTimeout(() => setSaved(false), 2000);
        load();
      }
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm("Delete this idea? This can't be undone.")) return;
    setBusy(true);
    try { await ideasApi.remove(id); onClose(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="flex justify-between items-center mb-3" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>← Back</button>
        <div className="flex gap-2 items-center">
          {saved && <span className="t-caption" style={{ color: "var(--success)" }}>Saved</span>}
          {owner && !isNew && (
            <button className="btn btn-secondary btn-sm" onClick={() => setSharing(true)}>
              Share{idea.shares?.length ? ` (${idea.shares.length})` : ""}
            </button>
          )}
          {owner && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
              {busy ? "Saving…" : isNew ? "Save idea" : "Save"}
            </button>
          )}
        </div>
      </div>

      {err && <div className="alert alert-danger mb-3">{err}</div>}

      {!owner && (
        <div className="alert alert-info mb-3">
          {idea.author} shared this with you. You can read it, but not change it.
        </div>
      )}

      {owner ? (
        <>
          <input className="form-input" value={idea.title} autoFocus={isNew}
            placeholder="Title"
            style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}
            onChange={e => setIdea(v => ({ ...v, title: e.target.value }))} />
          <textarea className="form-textarea" value={idea.content || ""}
            placeholder="Write it out…"
            style={{ minHeight: 320, lineHeight: 1.6 }}
            onChange={e => setIdea(v => ({ ...v, content: e.target.value }))} />
        </>
      ) : (
        <>
          <h2 className="t-title" style={{ marginBottom: 6 }}>{idea.title}</h2>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{idea.content}</div>
        </>
      )}

      {!isNew && (
        <p className="t-caption" style={{ marginTop: 12 }}>
          Created {when(idea.created_at)} · Last updated {when(idea.updated_at)}
        </p>
      )}

      {owner && !isNew && (
        <div className="flex justify-between items-center" style={{ marginTop: 24 }}>
          <button className="btn btn-ghost btn-sm" onClick={remove}
            style={{ color: "var(--danger, #c0392b)" }}>Delete idea</button>
        </div>
      )}

      {sharing && (
        <ShareModal idea={idea} onClose={() => { setSharing(false); load(); }} />
      )}
    </div>
  );
}

/* ── sharing ───────────────────────────────────────────────────────────────── */

function ShareModal({ idea, onClose }) {
  const [people, setPeople] = useState(null);
  const [shares, setShares] = useState(idea.shares || []);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { ideasApi.people().then(setPeople).catch(() => setPeople([])); }, []);

  const sharedIds = new Set(shares.map(s => s.person_id));

  async function add() {
    if (!pick) return;
    setErr(""); setBusy(true);
    try {
      await ideasApi.share(idea.id, Number(pick));
      const fresh = await ideasApi.get(idea.id);
      setShares(fresh.shares || []); setPick("");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function drop(personId) {
    setBusy(true);
    try {
      await ideasApi.unshare(idea.id, personId);
      setShares(s => s.filter(x => x.person_id !== personId));
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">Share this idea</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="t-caption mb-3">
            People you add can read this idea. They can't edit it, delete it, or pass it on.
          </p>

          <div className="flex gap-2 mb-3">
            <select className="form-select" value={pick} onChange={e => setPick(e.target.value)}>
              <option value="">Choose a colleague…</option>
              {(people || []).filter(p => !sharedIds.has(p.id)).map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}{p.kad_name ? ` · ${p.kad_name}` : ""}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={!pick || busy} onClick={add}>Share</button>
          </div>

          {err && <div className="alert alert-danger mb-3">{err}</div>}

          {shares.length === 0
            ? <p className="t-caption">Not shared with anyone yet — it's private to you.</p>
            : shares.map(s => (
                <div key={s.person_id} className="flex justify-between items-center"
                  style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{s.full_name}</span>
                  <button className="btn btn-ghost btn-sm" disabled={busy}
                    onClick={() => drop(s.person_id)}>Remove</button>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
