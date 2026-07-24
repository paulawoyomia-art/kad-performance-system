# Deploy — everything since the spill concern

254/254 tests pass. Two new files, seven replacements, one worker.

## 1. Worker first  (Cloudflare, not GitHub)

Workers & Pages → `kad-resource-utilization` → Edit code → select all →
paste `worker.bundled.js` → **Save and deploy**.

Do this BEFORE the frontend. The new screens call routes that only exist in
this worker; the other way round they'd 404.

## 2. GitHub — the two NEW files, first

Add file → Create new file → type the FULL PATH as the filename:

  src/views/HowToView.jsx
  src/views/OrgActivity.jsx

These must land before StaffDashboard.jsx, which imports them. If it goes up
first the Vite build fails and Pages keeps serving the old bundle — which looks
exactly like "nothing happened".

## 3. GitHub — the seven REPLACEMENTS

Navigate to each, pencil icon, Ctrl+A, delete, paste, commit:

  src/views/KadView.jsx
  src/views/ManagerViews.jsx
  src/views/StaffDashboard.jsx
  src/views/LeaderboardView.jsx
  src/views/AdminDashboard.jsx
  src/api/client.js
  src/App.jsx

## 4. Hard-refresh  (Ctrl+Shift+R)

## Database — nothing to do

All applied live already: canvas tables, ideas tables, activity_log,
people.reports_to_id, Executive sets_targets, the four directors' reporting
lines to Kehinde Adewoye.

## What lands with this

- Flags lens — 19 collection warnings that were raised but unreachable
- Utilisation promoted from a buried section to its own lens
- My KAD → People: who has never signed in, plus today's blockers
- Clients revenue fixed (SUM(DISTINCT) was dropping equal-valued projects)
- Projects: whole row opens the editor; + Project in the lens
- How to use — role-based journeys
- Leaderboard: People/KADs toggle, adoption percentages back
- Executive: assigns company-wide, scoped register, Activity now view
- Reporting lines: editable in Admin → People, loop-protected

## Check on landing

1. My KAD → Flags — should show ~19 collection warnings
2. My KAD → People — blockers at top, "Not signed in" count
3. Leaderboard — toggle at the top, not KADs stacked below
4. Admin → People — a "Reports to" column and picker
5. As the CEO: Organisation → Activity now
