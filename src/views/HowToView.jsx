import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

/**
 * How to use — the integrated flow, with your step marked.
 *
 * The obvious structure here is one journey per role. It's also wrong: the
 * target cycle is a single sequence that six actors hand along, and splitting
 * it six ways hides the handoffs. A line manager reading only their own version
 * never learns that a slow confirmation is what stalls the HRBP, who stalls the
 * director, who can't report the KAD. Those dependencies ARE the system.
 *
 * So the cycle is shown once, whole, with every actor named — and the steps the
 * reader personally performs are highlighted. You see your part in context
 * rather than in isolation.
 *
 * Grouped by the three genuinely different modes of work:
 *   Yours   — tasks, notes, ideas. No handoffs; nobody else involved.
 *   KAD     — the target cycle. Multi-actor, sequential, verified.
 *   Org     — oversight across KADs. Read-mostly, plus the CEO's reach.
 */
export default function HowToView() {
  const { hasRole } = useAuth();
  const roles = {
    lm:   hasRole("Line Manager"),
    hrbp: hasRole("HRBP"),
    dir:  hasRole("KAD Director"),
    exec: hasRole("Executive"),
  };
  const manages = roles.lm || roles.hrbp || roles.dir || roles.exec;

  const [mode, setMode] = useState("cycle");

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h2 className="t-title" style={{ marginBottom: 4 }}>How to use this</h2>
      <p className="t-caption mb-3">
        Three kinds of work happen here. The middle one is a chain — several people
        hand it along, and your part is highlighted.
      </p>

      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        {[["own", "Your own work"], ["cycle", "The target cycle"], ["org", "Oversight"]]
          .map(([k, label]) => (
            <button key={k} className={`btn btn-sm ${mode === k ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setMode(k)}>{label}</button>
          ))}
      </div>

      {mode === "own"   && <OwnWork />}
      {mode === "cycle" && <Cycle roles={roles} />}
      {mode === "org"   && <Oversight roles={roles} manages={manages} />}
    </div>
  );
}

/* ── shared pieces ─────────────────────────────────────────────────────────── */

const Row = ({ children, gap = 8 }) => (
  <div className="flex items-center" style={{ gap, flexWrap: "wrap" }}>{children}</div>
);
const Chip = ({ cls = "badge-neutral", children, w }) => (
  <span className={`badge ${cls}`} style={w ? { minWidth: w, textAlign: "center" } : undefined}>{children}</span>
);
const Fake = ({ children }) => (
  <span style={{ border: "0.5px solid var(--border-strong, #ccc)", borderRadius: "var(--radius)",
    padding: "4px 10px", fontSize: 13 }}>{children}</span>
);
const Note = ({ children }) => (
  <p className="t-caption" style={{ margin: "8px 0 0" }}>{children}</p>
);

/* ── mode 1: your own work ─────────────────────────────────────────────────── */

function OwnWork() {
  const steps = [
    ["Plan the day", "My day",
     "Add two or three things. Yesterday's unfinished work offers to move across.",
     <Row><Fake>Add a task for today</Fake><span className="btn btn-primary btn-sm">Add</span></Row>],
    ["Work through it", "My day",
     "Tap the chip to move a task: To do → Doing → Done. → Tmw pushes it to tomorrow; tomorrow's tasks have ← Today.",
     <Row><Chip cls="badge-info" w={68}>Doing</Chip>
       <span style={{ flex: 1, minWidth: 110 }}>Patrol KN-4471</span>
       <span className="t-caption">→ Tmw</span></Row>],
    ["Capture what happened", "My day",
     "One tap each. A win, something blocking you, or something you learned.",
     <Row gap={6}><Fake>+ Win</Fake><Fake>+ Blocker</Fake><Fake>+ Learnt</Fake></Row>],
    ["Keep your own notes", "Ideas",
     "Private in the system itself — no manager, HRBP or administrator can open them. Share one with named colleagues when it's ready; they can read it, not change it.",
     <Row><Fake>+ New idea</Fake></Row>],
    ["Look back", "My day → Your records",
     "Search everything you've written and browse past days. Before reconstructing something from memory, search for it.",
     <Row><Fake>Search “offer letter”</Fake></Row>],
    ["Keep your streak", "Leaderboard",
     "Consecutive weekdays you did something. It sits in the sidebar on every screen.",
     <Row><span style={{ fontSize: 18 }}>🔥</span>
       <span style={{ fontWeight: 700, fontSize: 18 }}>7</span>
       <span className="t-caption">day streak</span></Row>],
  ];
  return (
    <>
      <div className="alert alert-info mb-3">
        Nobody else is involved in any of this. It's yours, it takes about five minutes
        a day, and it's what makes the cycle below almost write itself.
      </div>
      {steps.map(([title, where, text, visual], i) => (
        <div key={title} className="card mb-2">
          <Row gap={8}>
            <span style={{ fontWeight: 600 }}>{i + 1}. {title}</span>
            <Chip>{where}</Chip>
          </Row>
          <p style={{ margin: "6px 0 8px", lineHeight: 1.55 }}>{text}</p>
          {visual}
        </div>
      ))}
      <Note>
        The one link outward: tie a task to a target and finishing it offers to submit
        the work, carrying the date and description across. That's step 6 of the cycle.
      </Note>
    </>
  );
}

/* ── mode 2: the target cycle — one flow, every actor ──────────────────────── */

function Cycle({ roles }) {
  // `mine` decides whether a step is highlighted as the reader's own. Everyone
  // has allocations, so accepting and submitting are always theirs.
  const managerSets = roles.lm || roles.hrbp || roles.dir || roles.exec;
  const steps = [
    { n: 1, actor: "Admin", title: "Sets the foundations",
      where: "Admin console", mine: false,
      text: "KADs, people, clients, projects, and the period itself." },
    { n: 2, actor: "Line manager · HRBP · Director · CEO", title: "Creates the allocation",
      where: "Register", mine: managerSets,
      text: "One person, one metric, one project, for this period. Nothing exists to target or submit until this row does.",
      visual: <Row><Fake>+ Allocation</Fake></Row> },
    { n: 3, actor: "Line manager · HRBP · Director · CEO", title: "Sets the target",
      where: "Register", mine: managerSets,
      text: "The number being asked for. Can be set in the same step as creating the row.",
      unblocks: "Nothing can be submitted until this exists." },
    { n: 4, actor: "The employee", title: "Accepts it", where: "My work", mine: true,
      text: "Read what's being asked, then accept. If the number looks wrong, say so first — until you accept, a manager can simply correct it. After that it locks.",
      visual: <Row><Chip cls="badge-warning">Accept target</Chip>
        <span className="t-caption">PPM Patrol · 40 KM</span></Row>,
      unblocks: "Until EVERY target in the KAD is accepted, the KAD can't open — so nobody in it can submit. An unaccepted target holds up colleagues." },
    { n: 5, actor: "Admin", title: "Opens the KAD", where: "Admin console", mine: false,
      text: "Each KAD opens on its own once its targets are all accepted. A slow KAD doesn't hold up the others." },
    { n: 6, actor: "The employee", title: "Does the work, and submits", where: "My day → My work", mine: true,
      text: "Tie your tasks to the target as you go. Finishing one offers to submit, carrying the date and a description built from your task titles.",
      visual: <Row gap={6}><Chip cls="badge-success">Date ✓</Chip>
        <Chip cls="badge-success">Description ✓</Chip>
        <Chip>Figure — you</Chip><Chip>Proof — you</Chip></Row>,
      unblocks: "The figure and the proof are never filled in for you — they're your word, and they're why the numbers are trusted." },
    { n: 7, actor: "Line manager or KAD director", title: "Confirms the work", where: "Register",
      mine: roles.lm || roles.dir,
      text: "Review the submission and its proof, then confirm. Either role can — whoever gets there first. A director can also query it, sending it back for correction.",
      unblocks: "An unconfirmed row blocks the HRBP's check, which blocks the director's report. One slow confirmation stalls everything behind it." },
    { n: 8, actor: "HRBP", title: "Checks the cycle is complete", where: "Consolidation", mine: roles.hrbp,
      text: "Confirms the cycle is genuinely finished rather than partly filled in. Only unlocks once every row has been confirmed at step 7.",
      unblocks: "Until this is done, the KAD cannot be reported to the organisation." },
    { n: 9, actor: "KAD director", title: "Reports the KAD to the org", where: "Consolidation", mine: roles.dir,
      text: "The final stamp. Only unlocks after the HRBP's check.",
      unblocks: "This is what puts the KAD's numbers into the company view." },
    { n: 10, actor: "Executives", title: "Read the consolidated result", where: "Organisation", mine: roles.exec,
      text: "Only work that passed all nine steps appears. Every figure has been through three people." },
  ];

  const mineCount = steps.filter(s => s.mine).length;

  return (
    <>
      <div className="alert alert-info mb-3">
        One chain, ten steps, six kinds of actor. <strong>Your {mineCount} step{mineCount === 1 ? "" : "s"} {mineCount === 1 ? "is" : "are"} highlighted.</strong>
        {" "}The rest are here because what you do lands on someone, and someone's work lands on you.
      </div>

      {steps.map((s, i) => (
        <div key={s.n} style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13,
              background: s.mine ? "var(--bg-accent)" : "var(--surface)",
              color: s.mine ? "var(--text-accent)" : "var(--text-muted)" }}>{s.n}</div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, width: 2, marginTop: 4, background: "var(--border)" }} />
            )}
          </div>

          <div style={{ flex: 1, paddingBottom: 18 }}>
            <div style={{ borderRadius: "var(--radius)",
              padding: s.mine ? "10px 12px" : "0",
              background: s.mine ? "var(--bg-accent)" : "transparent" }}>
              <Row gap={8}>
                <span style={{ fontWeight: 600 }}>{s.title}</span>
                {s.mine && <Chip cls="badge-info">You</Chip>}
              </Row>
              <p className="t-caption" style={{ margin: "2px 0 6px" }}>
                {s.actor} · {s.where}
              </p>
              <p style={{ margin: "0 0 8px", lineHeight: 1.55 }}>{s.text}</p>
              {s.visual}
              {s.unblocks && (
                <p className="t-caption" style={{ margin: "8px 0 0" }}>
                  <strong>Why it matters:</strong> {s.unblocks}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="card">
        <p className="t-label" style={{ marginBottom: 6 }}>Two side doors</p>
        <p style={{ margin: "0 0 6px" }}>
          <strong>Flag</strong> — an HRBP raises a row for the director's attention with a note.
          It doesn't stop the chain; it asks someone to look.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Query</strong> — a director sends a submission back. It returns to the employee
          with the note, and submitting a correction clears it automatically.
        </p>
      </div>
    </>
  );
}

/* ── mode 3: oversight ─────────────────────────────────────────────────────── */

function Oversight({ roles, manages }) {
  if (!manages) return (
    <div className="empty">
      <p className="empty-title">Not part of your role</p>
      <p className="empty-body">
        Oversight views belong to line managers, HRBPs, KAD directors and executives.
        Your work lives in the other two sections.
      </p>
    </div>
  );

  const kadLevel = roles.hrbp || roles.dir || roles.exec;
  const lmOnly = roles.lm && !kadLevel;

  return (
    <>
      <div className="alert alert-info mb-3">
        Read-mostly. These answer "how are things going" — the acting happens in the cycle.
      </div>

      <div className="card mb-3">
        <p className="t-label" style={{ marginBottom: 8 }}>Your people — My KAD → People</p>
        <p style={{ margin: "0 0 8px" }}>
          {lmOnly ? "Your reports" : "Everyone in your KAD"}, including anyone who has
          <strong> never signed in</strong>. The Register can't show you those people — it lists
          allocations, and they haven't got one.
        </p>
        <Row gap={6}>
          <Chip cls="badge-danger">Not signed in</Chip>
          <Chip cls="badge-warning">Target waiting · 6d</Chip>
          <Chip cls="badge-success">Active</Chip>
        </Row>
        <Note>Today's blockers appear above the list. Filter and export to work through them.</Note>
      </div>

      {kadLevel && (
        <div className="card mb-3">
          <p className="t-label" style={{ marginBottom: 8 }}>The rest of My KAD</p>
          {[["Flags", "Collection warnings, missing submissions, unresolved queries — acknowledge, assign or resolve"],
            ["Utilisation", "How loaded people are across EVERY KAD, and who's on the bench"],
            ["Overview", "Your KAD's headline numbers for the cycle"],
            ["Projects", "Click a row to edit status, revenue, health, SLAs and milestones"],
            ["Clients", "Contract and collected per client, in USD"]].map(([n, d]) => (
              <div key={n} style={{ marginBottom: 4 }}>
                <Chip>{n}</Chip> <span className="t-caption">{d}</span>
              </div>
            ))}
        </div>
      )}

      {roles.exec && (
        <div className="card mb-3">
          <p className="t-label" style={{ marginBottom: 8 }}>Across the company — Organisation</p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Activity now</strong> — every piece of work at whatever stage it has reached.
            Mid-cycle this is the only view that tells you anything, because almost nothing has
            been reported yet.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Reported output</strong> — the consolidated figures. Only work that completed
            all ten steps.
          </p>
          <p style={{ margin: 0 }}>
            You're also the only role that can <strong>assign work in any KAD</strong>. Your
            register shows what you assigned plus your own KAD — confirming it stays with the KAD
            that owns it.
          </p>
          <Note>
            Your directors report to you, so they appear in My KAD → People with a link into the
            KAD each of them runs.
          </Note>
        </div>
      )}

      <div className="card">
        <p className="t-label" style={{ marginBottom: 8 }}>Adoption — Leaderboard</p>
        <p style={{ margin: 0 }}>
          <strong>People</strong> resets weekly, so nobody is ever out of it.
          <strong> KADs</strong> runs on the cycle and ranks on adoption percentages rather than
          points, so a KAD of 52 doesn't beat a KAD of 15 on size alone.
        </p>
      </div>
    </>
  );
}
