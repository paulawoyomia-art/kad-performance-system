import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

/**
 * How to use — organised as journeys, not topics.
 *
 * A topical help page ("Targets", "Metrics", "Privacy") answers questions you
 * already know how to ask. Someone opening this doesn't have a question, they
 * have a moment: it's Monday morning, or a target just landed, or work is
 * finished and they don't know what happens next. So each role gets the
 * sequence it actually walks, numbered, with a picture of the screen at each
 * step.
 *
 * Everyone gets the employee journey, because everyone has targets to accept
 * and work to submit — a KAD director is an employee too. Extra journeys appear
 * for the hats you additionally wear.
 */
export default function HowToView() {
  const { hasRole } = useAuth();
  const isLM   = hasRole("Line Manager");
  const isHRBP = hasRole("HRBP");
  const isDir  = hasRole("KAD Director");
  const isExec = hasRole("Executive");

  const journeys = [
    { id: "employee", label: "My own work", show: true,    steps: employeeJourney },
    { id: "lm",       label: "As a line manager", show: isLM,   steps: lmJourney },
    { id: "hrbp",     label: "As an HRBP",        show: isHRBP, steps: hrbpJourney },
    { id: "dir",      label: "As a KAD director", show: isDir,  steps: dirJourney },
    { id: "exec",     label: "As an executive",   show: isExec, steps: execJourney },
  ].filter(j => j.show);

  const [pick, setPick] = useState(journeys[0].id);
  const active = journeys.find(j => j.id === pick) || journeys[0];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h2 className="t-title" style={{ marginBottom: 4 }}>How to use this</h2>
      <p className="t-caption mb-3">
        {journeys.length > 1
          ? "You wear more than one hat. My own work is yours too — you have targets to accept and work to submit like anyone else."
          : "Start to finish, in the order you'll do it."}
      </p>

      {journeys.length > 1 && (
        <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
          {journeys.map(j => (
            <button key={j.id}
              className={`btn btn-sm ${pick === j.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setPick(j.id)}>{j.label}</button>
          ))}
        </div>
      )}

      {active.steps.map((s, i) => (
        <Step key={s.title} n={i + 1} last={i === active.steps.length - 1} {...s} />
      ))}
    </div>
  );
}

/* ── the step frame ────────────────────────────────────────────────────────── */

function Step({ n, title, where, visual, text, note, last }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      {/* number + the line joining one step to the next */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bg-accent)",
          color: "var(--text-accent)", display: "flex", alignItems: "center",
          justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{n}</div>
        {!last && <div style={{ flex: 1, width: 2, background: "var(--border)", marginTop: 4 }} />}
      </div>

      <div style={{ flex: 1, paddingBottom: last ? 0 : 22 }}>
        <div className="flex items-baseline" style={{ gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600 }}>{title}</span>
          {where && <span className="badge badge-neutral">{where}</span>}
        </div>
        {text && <p style={{ margin: "4px 0 8px", lineHeight: 1.55 }}>{text}</p>}
        {visual && (
          <div style={{ border: "1px dashed var(--border-strong, #ccc)",
            borderRadius: "var(--radius)", padding: 12, background: "var(--surface)" }}>
            {visual}
          </div>
        )}
        {note && <p className="t-caption" style={{ margin: "8px 0 0" }}>{note}</p>}
      </div>
    </div>
  );
}

/* ── small mock pieces, built from the app's own classes ───────────────────── */

const Row = ({ children, gap = 8 }) => (
  <div className="flex items-center" style={{ gap, flexWrap: "wrap" }}>{children}</div>
);

const Chip = ({ cls = "badge-neutral", children, w }) => (
  <span className={`badge ${cls}`} style={w ? { minWidth: w, textAlign: "center" } : undefined}>
    {children}
  </span>
);

const Fake = ({ children }) => (
  <span style={{ border: "0.5px solid var(--border-strong, #ccc)", borderRadius: "var(--radius)",
    padding: "4px 10px", fontSize: 13 }}>{children}</span>
);

/* ── everyone: my own work ─────────────────────────────────────────────────── */

const employeeJourney = [
  {
    title: "Start the day with a list",
    where: "My day",
    text: "Add the two or three things you mean to do. Anything unfinished from yesterday offers to move across — take it or leave it.",
    visual: (
      <>
        <Row><Fake>Add a task for today</Fake><span className="btn btn-primary btn-sm">Add</span></Row>
        <Row gap={6}><span className="t-caption" style={{ marginTop: 8 }}>
          Under it: <strong>Not tied to a target ▾</strong> — change this if the work counts toward one.
        </span></Row>
        <div style={{ marginTop: 10 }}>
          <Row>
            <Chip w={68}>To do</Chip>
            <span style={{ flex: 1, minWidth: 110 }}>Site survey notes
              <span className="t-caption" style={{ display: "block", textDecoration: "underline" }}>
                + tie to a target
              </span></span>
          </Row>
        </div>
      </>
    ),
    note: "Forgot to tie it at the time? Tap the line under any task title to tie it afterwards, or change which target it counts toward. Arrows on the left reorder your list — on a computer you can drag instead. If yesterday left things unfinished, a bar at the top offers Move to today.",
  },
  {
    title: "Accept your target",
    where: "My work",
    text: "A manager sets what you're being asked to deliver. Nothing can be submitted until you accept it — and until everyone in your KAD has, the KAD can't open at all.",
    visual: (
      <Row>
        <Chip cls="badge-warning">Accept target</Chip>
        <span className="t-caption">PPM Patrol · 40 KM · GICL Kano fiber</span>
      </Row>
    ),
    note: "If the number looks wrong, say so BEFORE you accept — a manager can still correct it in seconds. After you accept it locks, and changing it needs a written justification.",
  },
  {
    title: "Work, and tick things off",
    where: "My day",
    text: "Tap the chip to move a task along. If a task is tied to a target, your progress against the real number builds as you go.",
    visual: (
      <>
        <Row>
          <Chip cls="badge-info" w={68}>Doing</Chip>
          <span style={{ flex: 1, minWidth: 110 }}>Patrol KN-4471</span>
          <span className="t-caption">→ Tmw</span>
        </Row>
        <div style={{ marginTop: 10, background: "var(--card, var(--surface))",
          borderRadius: "var(--radius)", padding: "10px 12px" }}>
          <div className="flex justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>PPM Patrol</span>
            <span className="t-caption">4 of 6 today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="progress-bar" style={{ width: 90, flexShrink: 0 }}>
              <div className="progress-fill warning" style={{ width: "45%" }} />
            </div>
            <span className="t-caption">18 of 40 KM reported</span>
          </div>
        </div>
      </>
    ),
    note: "To do → Doing → Done, then back round. → Tmw pushes a task to tomorrow; tomorrow's tasks have ← Today to pull one forward.",
  },
  {
    title: "Capture what happened",
    where: "My day",
    text: "Three one-tap notes. A win worth remembering, a blocker stopping you, or something you learned and don't want to lose.",
    visual: (
      <Row gap={6}>
        <Fake>+ Win</Fake><Fake>+ Blocker</Fake><Fake>+ Learnt</Fake>
      </Row>
    ),
    note: "Blockers are the one your manager sees, the same day — that's how a Tuesday problem gets cleared by Wednesday. Wins and learnings stay yours.",
  },
  {
    title: "Submit the work",
    where: "My day → My work",
    text: "When a tied task is done, a banner offers to submit it. The date and a description of what you did come across with you.",
    visual: (
      <>
        <div className="alert alert-info" style={{ marginBottom: 10 }}>
          <Row>
            <span style={{ flex: 1, minWidth: 160 }}>
              3 finished tasks count toward <strong>PPM Patrol</strong>.
            </span>
            <span className="btn btn-primary btn-sm">Submit this work</span>
          </Row>
        </div>
        <Row gap={6}>
          <Chip cls="badge-success">Date ✓</Chip>
          <Chip cls="badge-success">Description ✓</Chip>
          <Chip cls="badge-neutral">Figure — you</Chip>
          <Chip cls="badge-neutral">Proof — you</Chip>
        </Row>
      </>
    ),
    note: "The figure and the proof are never filled in for you. Three tasks isn't three kilometres, and a proof the system wrote wouldn't be evidence of anything.",
  },
  {
    title: "Watch it travel",
    where: "My work",
    text: "After you submit, three people check it in turn. You can see exactly where your work has reached.",
    visual: (
      <Row gap={6}>
        <Chip cls="badge-success">Submitted</Chip>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <Chip cls="badge-success">Confirmed</Chip>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <Chip>HRBP check</Chip>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <Chip>Reported</Chip>
      </Row>
    ),
    note: "If a manager queries it, it comes back with a note — submit a correction and the query clears. Expanding a row shows every entry you've made and the running total.",
  },
  {
    title: "Close the day",
    where: "My day",
    text: "Add anything for tomorrow. There's no transfer step — tomorrow's list IS tomorrow's tasks, waiting when you open the app.",
    visual: (
      <>
        <p className="t-caption" style={{ margin: "0 0 6px" }}>Tomorrow</p>
        <Row><span className="t-caption">☐</span>
          <span style={{ flex: 1 }}>Complete onboarding pack</span>
          <span className="t-caption">← Today</span></Row>
      </>
    ),
  },
  {
    title: "Look back when you need to",
    where: "My day → Your records",
    text: "Search everything you've ever written, and browse past days. Before reconstructing something from memory, search for it.",
    visual: (
      <>
        <Row><Fake>Search “offer letter”</Fake></Row>
        <p className="t-caption" style={{ margin: "8px 0 0" }}>
          10 Jul · CEO approved offer letter<br />
          25 Jun · Sent offer letter
        </p>
      </>
    ),
    note: "Filter to tasks, wins, blockers or learnings. Your diary becomes searchable.",
  },
  {
    title: "Keep your own notebook",
    where: "Ideas",
    text: "A private place for the half-formed things — a process that could be better, a question you're not ready to ask, something you'll want in six months.",
    visual: (
      <>
        <Row><Fake>+ New idea</Fake></Row>
        <Row gap={6}><span className="t-caption" style={{ marginTop: 8 }}>
          Private in the system itself — no manager, HRBP or administrator can open it.
        </span></Row>
      </>
    ),
    note: "When one is ready you can share it with named colleagues. They can read it; they cannot edit, delete or pass it on. Unshare and it's yours alone again.",
  },
  {
    title: "Keep your streak",
    where: "Leaderboard",
    text: "Your streak counts weekdays you did something. It sits in the sidebar on every screen, so you always know where it stands.",
    visual: (
      <>
        <Row><span style={{ fontSize: 18 }}>🔥</span>
          <span style={{ fontWeight: 700, fontSize: 18 }}>7</span>
          <span className="t-caption">day streak</span></Row>
        <p className="t-caption" style={{ margin: "8px 0 0" }}>
          Submit +10 · accept a target +5 · write an idea +3 · plan your day +2 · show up +1
        </p>
      </>
    ),
    note: "Weekends can't break a streak. Everyone resets on Monday, so being at zero today means nothing by Wednesday.",
  },
  {
    title: "See how you and your KAD compare",
    where: "Leaderboard",
    text: "The top 20 is public. Your own position is shown only to you, however far down it is. Below that, how the KADs stack up over the cycle.",
    visual: (
      <>
        <Row><span className="t-caption">Where you stand</span>
          <span style={{ marginLeft: "auto", fontWeight: 700 }}>#34</span>
          <span className="t-caption">of 117</span></Row>
        <p className="t-caption" style={{ margin: "8px 0 0" }}>
          Tap <strong>How points work</strong> to see the full scoring at any time.
        </p>
      </>
    ),
  },
];

/* ── line manager ──────────────────────────────────────────────────────────── */

const lmJourney = [
  {
    title: "Create the work",
    where: "Register",
    text: "An allocation is one person, one metric, one project, for this period. It's the row everything else hangs off — nothing can be targeted or submitted until it exists.",
    visual: (
      <Row><Fake>+ Allocation</Fake><Fake>+ Project</Fake></Row>
    ),
    note: "You can set the target in the same step, or leave it and set it after.",
  },
  {
    title: "Set targets for your team",
    where: "Register",
    text: "Give each person a number to deliver against. Do this early — the KAD can't open until every target is accepted, so a slow start holds up your own people.",
    visual: (
      <Row>
        <span style={{ flex: 1, minWidth: 140 }}>Yunus Salim · PPM Patrol</span>
        <span className="btn btn-primary btn-sm">Set target</span>
      </Row>
    ),
  },
  {
    title: "Fix any mistakes now",
    where: "Register",
    text: "Mistyped a number? While it's unaccepted you can simply change it.",
    visual: (
      <Row><Chip cls="badge-warning">Awaiting ack</Chip><Fake>Edit target</Fake></Row>
    ),
    note: "Once the employee accepts, the target locks and a change needs a written justification and re-approval.",
  },
  {
    title: "See where everything stands",
    where: "Register",
    text: "Group by stage to see what's stuck where, or by person to see one individual's whole picture.",
    visual: (
      <Row gap={6}>
        <Chip cls="badge-warning">Needs a target</Chip>
        <Chip cls="badge-neutral">Awaiting acceptance</Chip>
        <Chip cls="badge-info">In progress</Chip>
        <Chip cls="badge-success">Work confirmed</Chip>
      </Row>
    ),
  },
  {
    title: "Chase who hasn't started",
    where: "My KAD → People",
    text: "Your reports, including anyone who has never signed in — the Register can't show you those, because it only lists allocations.",
    visual: (
      <Row gap={6}>
        <Chip cls="badge-danger">Not signed in</Chip>
        <Chip cls="badge-warning">Target waiting · 6d</Chip>
        <Chip cls="badge-success">Active</Chip>
      </Row>
    ),
    note: "Filter to the ones that need chasing and export the list to work through.",
  },
  {
    title: "Read the blockers",
    where: "My day → Your team",
    text: "Who's moving, who's stuck, and what's stopping them — the day it happens.",
    visual: (
      <div className="alert alert-warning" style={{ margin: 0 }}>
        <strong>Ibrahim Musa:</strong> no access to the KN-4480 gate
      </div>
    ),
    note: "Counts tell you what happened. Blockers tell you what you can change.",
  },
  {
    title: "Confirm the work",
    where: "Register",
    text: "Review each submission and confirm the work was done.",
    visual: (
      <Row>
        <span style={{ flex: 1, minWidth: 130 }}>PPM Patrol · 38 of 40 KM</span>
        <Fake>Review work</Fake>
        <span className="btn btn-secondary btn-sm">Confirm work</span>
      </Row>
    ),
    note: "Review work opens every submission and its proof before you commit. Confirmed something too early? Reopen puts it back. Do it promptly either way — an unconfirmed row blocks the HRBP's check, which blocks the director's report.",
  },
];

/* ── HRBP ──────────────────────────────────────────────────────────────────── */

const hrbpJourney = [
  {
    title: "Get everyone onto the system",
    where: "My KAD → People",
    text: "Before anything else: who in your KAD has never signed in. They can't accept a target, so they hold the whole KAD's opening.",
    visual: (
      <Row gap={10}>
        <span><strong style={{ fontSize: 20 }}>15</strong> <span className="t-caption">not signed in</span></span>
        <span><strong style={{ fontSize: 20 }}>4</strong> <span className="t-caption">target waiting</span></span>
        <Fake>Export list</Fake>
      </Row>
    ),
    note: "Nothing else you do here matters as much while people can't log in.",
  },
  {
    title: "Create the work and set targets",
    where: "Register",
    text: "Use + Allocation to create a row — one person, one metric, one project — then set what they're being asked to deliver. You can do both in one step.",
    visual: (
      <Row><Chip cls="badge-warning">Awaiting ack</Chip><Fake>Edit target</Fake></Row>
    ),
  },
  {
    title: "Flag anything that needs a look",
    where: "Register",
    text: "You can't query a submission — that's the director's call — but you can raise a row for their attention with a note.",
    visual: (
      <Row><Fake>⚑ Flag for KAD</Fake>
        <span className="t-caption">the director sees your note</span></Row>
    ),
  },
  {
    title: "Watch the flags",
    where: "My KAD → Flags",
    text: "Collection warnings, missing submissions, unresolved queries. Acknowledge, assign, or resolve them.",
    visual: (
      <Row gap={6}>
        <Chip cls="badge-warning">Collection below 20%</Chip>
        <Chip cls="badge-danger">Missing submission</Chip>
      </Row>
    ),
  },
  {
    title: "Mark the cycle complete",
    where: "Consolidation",
    text: "Your check says the cycle is genuinely finished, not just partly filled in. It only unlocks once every row has been confirmed.",
    visual: (
      <Row gap={6}>
        <Chip cls="badge-success">Confirmed</Chip>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <Chip cls="badge-info">Your check</Chip>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <Chip>Reported</Chip>
      </Row>
    ),
    note: "Once you mark it complete, the KAD director can report it to the organisation.",
  },
];

/* ── KAD director ──────────────────────────────────────────────────────────── */

const dirJourney = [
  {
    title: "See where your KAD stands",
    where: "My KAD → Overview",
    text: "Headline numbers for the cycle: allocations, how many are locked, average achievement, open flags.",
  },
  {
    title: "Confirm work as it lands",
    where: "Register",
    text: "Row by row. You and your line managers can both do this — whoever gets there first.",
    visual: (
      <Row>
        <span style={{ flex: 1, minWidth: 130 }}>Uptime · 98% of 100%</span>
        <span className="btn btn-secondary btn-sm">Confirm work</span>
      </Row>
    ),
  },
  {
    title: "Query what doesn't add up",
    where: "Register",
    text: "Send a submission back with a note. It returns to the employee, who submits a correction — which clears the query automatically.",
    visual: (
      <div className="alert alert-warning" style={{ margin: 0 }}>
        <strong>Queried:</strong> proof shows 12 sites, figure says 20
      </div>
    ),
  },
  {
    title: "Run your projects",
    where: "My KAD → Projects",
    text: "Click any row to open it. Update status, record revenue collected, set a health rating, and manage SLAs and milestones.",
    visual: (
      <>
        <Row><span style={{ flex: 1, minWidth: 130 }}>GICL Kano fiber</span>
          <Chip cls="badge-success">On track</Chip></Row>
        <Row gap={6}><span className="t-caption" style={{ marginTop: 8 }}>
          Status · contract · collected · health · SLAs · milestones
        </span></Row>
      </>
    ),
    note: "Use + Project to add one. Project health turns Critical automatically if an SLA is breached.",
  },
  {
    title: "See your clients",
    where: "My KAD → Clients",
    text: "Contract and collected per client, converted to USD so clients billing in different currencies compare directly.",
    visual: (
      <Row gap={10}>
        <span style={{ flex: 1, minWidth: 100 }}>Huawei</span>
        <span className="t-mono">$412,000</span>
        <span className="t-mono t-caption">$18,000 collected</span>
      </Row>
    ),
    note: "Clients themselves are set up by an administrator — ask them to add or change one.",
  },
  {
    title: "Check capacity before you ask for more",
    where: "My KAD → Utilisation",
    text: "How loaded people are across every KAD, and who's on the bench. The one genuinely cross-KAD view in the app.",
  },
  {
    title: "Report the KAD to the organisation",
    where: "Consolidation",
    text: "Your final stamp. It unlocks once the HRBP has marked the cycle complete, and it's what puts your KAD's numbers into the company view.",
    visual: (
      <Row>
        <span style={{ flex: 1, minWidth: 150 }}>All rows checked by HRBP</span>
        <span className="btn btn-primary btn-sm">Report to org</span>
      </Row>
    ),
    note: "You can reopen it if something went out too early.",
  },
];

/* ── executive ─────────────────────────────────────────────────────────────── */

const execJourney = [
  {
    title: "See what the company is doing now",
    where: "Organisation → Activity now",
    text: "Every piece of work at whatever stage it has reached — no target yet, not accepted, in progress, confirmed, reported. Filter by stage or by KAD.",
    visual: (
      <Row gap={6}>
        <Chip cls="badge-danger">No target</Chip>
        <Chip cls="badge-warning">Not accepted</Chip>
        <Chip cls="badge-info">In progress</Chip>
        <Chip cls="badge-success">Reported</Chip>
      </Row>
    ),
    note: "Different from the reported figures: mid-cycle almost nothing has been reported yet, which is correct but tells you nothing about what's happening.",
  },
  {
    title: "Assign work anywhere in the company",
    where: "Register",
    text: "You are the only role that reaches across every KAD. Create an allocation for anyone, and set their target in the same step.",
    visual: (
      <Row><Fake>+ Allocation</Fake>
        <span className="t-caption">any person · any KAD · target set with it</span></Row>
    ),
    note: "Your register shows what you assigned plus your own KAD — not all 117 rows, which wouldn't be yours to police. Confirming the work stays with the KAD that owns it.",
  },
  {
    title: "Read the consolidated picture",
    where: "Organisation → Reported output",
    text: "Every KAD that has been reported, side by side: output, achievement, contract and collection — all converted to USD so KADs operating in different currencies compare directly.",
    visual: (
      <Row gap={10}>
        <span><strong style={{ fontSize: 18 }}>$1.69m</strong> <span className="t-caption">contract</span></span>
        <span><strong style={{ fontSize: 18 }}>4.8%</strong> <span className="t-caption">collected</span></span>
      </Row>
    ),
  },
  {
    title: "Know what the numbers mean",
    where: "Organisation",
    text: "Only work that passed the full chain appears here — submitted, confirmed by a manager, checked by an HRBP, reported by a director.",
    visual: (
      <Row gap={6}>
        <Chip cls="badge-success">Submitted</Chip>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <Chip cls="badge-success">Confirmed</Chip>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <Chip cls="badge-success">Checked</Chip>
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <Chip cls="badge-success">Reported</Chip>
      </Row>
    ),
    note: "Every figure has been through three people. A KAD mid-cycle shows less than it has done — that's the check working, not data missing.",
  },
  {
    title: "See where adoption stands",
    where: "Leaderboard",
    text: "Which KADs are actually using the system. Percentages rather than totals, so a KAD of 52 doesn't beat a KAD of 15 on size alone.",
  },
];
