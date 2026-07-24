/**
 * KAD Performance System — API client
 * All Worker calls go through here. Components never call fetch() directly.
 *
 * During local dev:  vite proxies /api → Worker (no CORS needed)
 * On Pages:          VITE_API_URL env var points at the deployed Worker
 */

const BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "/api";

// ── token storage (sessionStorage so it clears on tab close) ────────────────
const TOKEN_KEY = "kps_token";
export const getToken   = ()        => sessionStorage.getItem(TOKEN_KEY);
export const setToken   = (t)       => sessionStorage.setItem(TOKEN_KEY, t);
export const clearToken = ()        => sessionStorage.removeItem(TOKEN_KEY);

// ── core fetch wrapper ───────────────────────────────────────────────────────
async function req(method, path, { body, form, auth = true } = {}) {
  const headers = {};
  if (auth) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  let bodyPayload;
  if (form) {
    bodyPayload = form; // FormData — browser sets content-type with boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyPayload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: bodyPayload });
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json();
  else if (ct.includes("text/csv"))    data = await res.blob();
  else                                 data = await res.text();
  if (!res.ok) {
    const msg = data?.error || (typeof data === "string" ? data : `HTTP ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data;
}

// ── proofs / attachments (admin) ─────────────────────────────────────────────
export const proofs = {
  manifest: (periodId) => req("GET", `/admin/proofs${periodId ? `?period=${periodId}` : ""}`),
};

// Fetch a binary file with auth and save it with the server's descriptive filename.
async function authedDownload(path, fallbackName) {
  const t = getToken();
  const res = await fetch(`${BASE}${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const cd = res.headers.get("content-disposition") || "";
  const m = /filename="([^"]+)"/.exec(cd);
  const name = (m && m[1]) || fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
export const downloadProof    = (allocId, subId) => authedDownload(`/allocations/${allocId}/submissions/${subId}/proof`, `proof-${subId}`);
export const downloadProofsCsv = (periodId) => authedDownload(`/admin/proofs?format=csv${periodId ? `&period=${periodId}` : ""}`, "proofs_manifest.csv");
export const downloadProofsZip = (periodId) => authedDownload(`/admin/proofs/zip${periodId ? `?period=${periodId}` : ""}`, "kad_proofs.zip");
export const downloadReportXlsx = (periodId) => authedDownload(`/admin/report.xlsx${periodId ? `?period=${periodId}` : ""}`, "KAD_Management_Report.xlsx");

// ── auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  login:          (email, password) => req("POST", "/auth/login",           { body: { email, password }, auth: false }),
  logout:         ()                => req("POST", "/auth/logout"),
  changePassword: (payload)         => req("POST", "/auth/change-password",  { body: payload }),
};

// ── setup (admin) ────────────────────────────────────────────────────────────
export const setup = {
  // KADs
  listKads:        ()         => req("GET",   "/setup/kads"),
  createKad:       (body)     => req("POST",  "/setup/kads",            { body }),
  updateKad:       (id, body) => req("PATCH", `/setup/kads/${id}`,      { body }),
  deleteKad:       (id)       => req("DELETE",`/setup/kads/${id}`),

  // People
  listPeople:      (kadId)    => req("GET",   `/setup/people${kadId ? `?kad=${kadId}` : ""}`),
  createPerson:    (body)     => req("POST",  "/setup/people",          { body }),
  updatePerson:    (id, body) => req("PATCH", `/setup/people/${id}`,    { body }),
  deletePerson:    (id)       => req("DELETE",`/setup/people/${id}`),
  resetPassword:   (id)       => req("POST",  `/setup/people/${id}/reset-password`),
  importPeople:    (file)     => { const f = new FormData(); f.append("file", file); return req("POST", "/setup/people/import", { form: f }); },
  peopleTemplate:  ()         => req("GET",   "/setup/people/template"),

  // Clients
  listClients:     (kadId)    => req("GET",   `/setup/clients${kadId ? `?kad=${kadId}` : ""}`),
  createClient:    (body)     => req("POST",  "/setup/clients",         { body }),
  updateClient:    (id, body) => req("PATCH", `/setup/clients/${id}`,   { body }),
  deleteClient:    (id)       => req("DELETE",`/setup/clients/${id}`),

  // Role Assignments
  listRoles:           ()     => req("GET",   "/setup/roles"),
  listRoleAssignments: (pid)  => req("GET",   `/setup/role-assignments${pid ? `?person=${pid}` : ""}`),
  createRoleAssignment:(body) => req("POST",  "/setup/role-assignments", { body }),
  deleteRoleAssignment:(id)   => req("DELETE",`/setup/role-assignments/${id}`),
  scopeCandidates:     (pid)  => req("GET",   `/setup/role-assignments/scope-candidates/${pid}`),
  updateScope:         (body) => req("POST",  "/setup/role-assignments/scope", { body }),

  // Projects
  listProjects:    (opts)     => req("GET",   `/setup/projects${opts?.kadId ? `?kad=${opts.kadId}` : ""}`),
  createProject:   (body)     => req("POST",  "/setup/projects",        { body }),
  updateProject:   (id, body) => req("PATCH", `/setup/projects/${id}`,  { body }),
  deleteProject:   (id)       => req("DELETE",`/setup/projects/${id}`),
  importProjects:  (file)     => { const f = new FormData(); f.append("file", file); return req("POST", "/setup/projects/import", { form: f }); },
  projectsTemplate:()         => req("GET",   "/setup/projects/template"),

  // FX rates — admin-maintained, drives multi-currency rollup conversion
  listFxRates:     ()             => req("GET",   "/setup/fx-rates"),
  upsertFxRate:    (body)         => req("POST",  "/setup/fx-rates",        { body }),
  deleteFxRate:    (code)         => req("DELETE",`/setup/fx-rates/${code}`),

  // Periods
  listPeriods:     (kadId)    => req("GET",   `/setup/periods${kadId ? `?kad=${kadId}` : ""}`),
  createPeriod:    (body)     => req("POST",  "/setup/periods",         { body }),
  updatePeriod:    (id, body) => req("PATCH", `/setup/periods/${id}`,  { body }),
  deletePeriod:    (id)       => req("DELETE",`/setup/periods/${id}`),

  // Allocations
  listAllocations:    (period) => req("GET", `/allocations${period ? `?period=${period}` : ""}`),
  createAllocation:   (body)   => req("POST", "/setup/allocations", { body }),
  deleteAllocation:   (id)     => req("DELETE", `/setup/allocations/${id}`),
  importAllocations:  (file)  => { const f = new FormData(); f.append("file", file); return req("POST", "/setup/allocations/import", { form: f }); },
  allocationsTemplate:()      => req("GET",   "/setup/allocations/template"),
};

// ── periods (admin cycle control) ────────────────────────────────────────────
export const periods = {
  list:  (kadId) => req("GET",  `/periods${kadId ? `?kad=${kadId}` : ""}`),
  open:  (id)    => req("POST", `/periods/${id}/open`),
  close: (id)    => req("POST", `/periods/${id}/close`),
  gate:  (id)    => req("GET",  `/periods/${id}/gate`),
  kadStatus: (id) => req("GET", `/periods/${id}/kad-status`),
};

// ── currencies (read-only, any authenticated actor — for project creation) ──
export const currencies = {
  list: () => req("GET", "/fx-rates"),
};

// ── projects (operational) ───────────────────────────────────────────────────
export const projects = {
  list:   (opts)     => req("GET",   `/projects${opts?.kadId ? `?kad=${opts.kadId}` : ""}`),
  create: (body)     => req("POST",  "/projects",        { body }),
  update: (id, body) => req("PATCH", `/projects/${id}`,  { body }),
};

// ── allocations ──────────────────────────────────────────────────────────────
export const allocations = {
  list:   (periodId, employeeId) => {
    const params = new URLSearchParams();
    if (periodId)   params.set("period",   periodId);
    if (employeeId) params.set("employee", employeeId);
    return req("GET", `/allocations?${params}`);
  },
  create: (body)  => req("POST", "/allocations",                { body }),
  // THREE-ACTOR CHAIN — KAD work-confirm (row) → HRBP completeness → KAD report-to-org
  setTarget:      (id, target_value)  => req("POST", `/allocations/${id}/target`,  { body: { target_value } }), // HRBP/KAD allocate
  acknowledge:    (id)                => req("POST", `/allocations/${id}/target/acknowledge`),  // employee
  confirm:        (id)                => req("POST", `/allocations/${id}/confirm`),    // KAD Director: Work confirmed (row)
  unconfirm:      (id)                => req("POST", `/allocations/${id}/unconfirm`),  // reopen row
  hrbpFlag:       (id, note)          => req("POST", `/allocations/${id}/hrbp-flag`,   { body: { note } }),  // HRBP raises for KAD
  hrbpUnflag:     (id)                => req("POST", `/allocations/${id}/hrbp-unflag`),
  hrbpComplete:   (period)            => req("POST", `/kad/hrbp-complete?period=${period}`),    // HRBP: cycle complete
  hrbpUncomplete: (period)            => req("POST", `/kad/hrbp-uncomplete?period=${period}`),
  kadSignoff:     (period)            => req("POST", `/kad/signoff?period=${period}`),   // KAD: report to org
  kadUnsignoff:   (period)            => req("POST", `/kad/unsignoff?period=${period}`),
  // Edit workflow (still available for changing a locked target)
  requestEdit:    (id, body)          => req("POST", `/allocations/${id}/edits`,            { body }),
  approveEdit:    (editId)            => req("POST", `/edits/${editId}/approve`),
  reconfirmEdit:  (editId)            => req("POST", `/edits/${editId}/reconfirm`),
  // Submission
  submit: (id, formData)              => req("POST", `/allocations/${id}/submissions`,      { form: formData }),
  // Query
  raiseQuery: (id, remarks)           => req("POST", `/allocations/${id}/query`,            { body: { remarks } }),
  // Optional SLA link
  linkSla: (id, sla_id)               => req("POST", `/allocations/${id}/sla`,              { body: { sla_id } }),
  // Submission review (before sign-off)
  listSubmissions: (id)               => req("GET", `/allocations/${id}/submissions`),
  // Per-submission query loop
  querySubmission:   (id, subId, note) => req("POST", `/allocations/${id}/submissions/${subId}/query`,   { body: { note } }),
  resolveSubmission: (id, subId)       => req("POST", `/allocations/${id}/submissions/${subId}/resolve`),
  // People this actor may allocate to (scoped: LM→reports, HRBP/Director→KAD)
  allocatablePeople: (kadId)          => req("GET", `/people/allocatable${kadId ? `?kad=${kadId}` : ""}`),
  // Clients in the actor's KAD (for project creation by operational roles)
  myClients: (kadId)                  => req("GET", `/clients/mine${kadId ? `?kad=${kadId}` : ""}`),
  // Output-type catalog (the allocation pick-list)
  outputTypes:        ()              => req("GET", "/output-types"),
  addOutputType:      (body)          => req("POST", "/output-types", { body }),
  // Proof needs auth, so fetch as a blob and return an object URL the UI can show/open
  fetchProof: async (id, subId) => {
    const token = getToken();
    const res = await fetch(`${BASE}/allocations/${id}/submissions/${subId}/proof`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error("Could not load proof");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};

// ── flags ────────────────────────────────────────────────────────────────────
export const flags = {
  list: (periodId, severity) => {
    const params = new URLSearchParams();
    if (periodId) params.set("period",   periodId);
    if (severity) params.set("severity", severity);
    return req("GET", `/flags?${params}`);
  },
  manage: (id, body) => req("PATCH", `/flags/${id}`, { body }),
};

// ── cross-KAD resource visibility (HRBP / Director / Executive / admin) ───────
export const resources = {
  list: (periodId, kadId) => {
    const params = new URLSearchParams();
    if (periodId) params.set("period", periodId);
    if (kadId)    params.set("kad", kadId);
    return req("GET", `/resources?${params}`);
  },
  bench: (periodId, kadId) => {
    const params = new URLSearchParams();
    if (periodId) params.set("period", periodId);
    if (kadId)    params.set("kad", kadId);
    return req("GET", `/resources/bench?${params}`);
  },
};

// ── dashboard ────────────────────────────────────────────────────────────────
export const dashboard = {
  kad: (periodId) => req("GET", `/dashboard/kad${periodId ? `?period=${periodId}` : ""}`),
  org: (periodId) => req("GET", `/dashboard/org${periodId ? `?period=${periodId}` : ""}`),
  consolidation: (periodId) => req("GET", `/dashboard/consolidation${periodId ? `?period=${periodId}` : ""}`),
};

// ── projects: management, SLAs, milestones ───────────────────────────────────
export const projectMgmt = {
  manage:        (id, body)      => req("PATCH", `/projects/${id}/manage`,      { body }),
  listSlas:      (id)            => req("GET",   `/projects/${id}/slas`),
  createSla:     (id, body)      => req("POST",  `/projects/${id}/slas`,        { body }),
  updateSla:     (slaId, body)   => req("PATCH", `/slas/${slaId}`,              { body }),
  deleteSla:     (slaId)         => req("DELETE",`/slas/${slaId}`),
  listMilestones:(id)            => req("GET",   `/projects/${id}/milestones`),
  createMilestone:(id, body)     => req("POST",  `/projects/${id}/milestones`,  { body }),
  updateMilestone:(msId, body)   => req("PATCH", `/milestones/${msId}`,         { body }),
  deleteMilestone:(msId)         => req("DELETE",`/milestones/${msId}`),
};

// ── daily work canvas ────────────────────────────────────────────────────────
// Personal workspace. Every call is scoped server-side to the signed-in person,
// so there are no ids to pass for "whose canvas" — there is only ever your own.
export const canvas = {
  day:         (date)        => req("GET",    `/canvas${date ? `?date=${date}` : ""}`),
  days:        ()            => req("GET",    `/canvas/days`),
  records:     (q, kind)     => req("GET",    `/canvas/records?q=${encodeURIComponent(q || "")}${kind ? `&kind=${kind}` : ""}`),
  addTask:     (body)        => req("POST",   `/canvas/tasks`, { body }),
  updateTask:  (id, body)    => req("PATCH",  `/canvas/tasks/${id}`, { body }),
  deleteTask:  (id)          => req("DELETE", `/canvas/tasks/${id}`),
  reorder:     (ids)         => req("POST",   `/canvas/tasks/reorder`, { body: { ids } }),
  carryOver:   (date)        => req("POST",   `/canvas/carry-over`, { body: { date } }),
  linkable:    ()            => req("GET",    `/canvas/linkable`),
  team:        (date)        => req("GET",    `/canvas/team${date ? `?date=${date}` : ""}`),
  addItem:     (body)        => req("POST",   `/canvas/items`, { body }),
  deleteItem:  (id)          => req("DELETE", `/canvas/items/${id}`),
};

// ── ideas ────────────────────────────────────────────────────────────────────
// Private notebook. The server decides what you can see (your own + what's been
// shared with you), so there's no "whose" parameter to pass anywhere here.
export const ideas = {
  list:       ()             => req("GET",    `/ideas`),
  get:        (id)           => req("GET",    `/ideas/${id}`),
  create:     (body)         => req("POST",   `/ideas`, { body }),
  update:     (id, body)     => req("PATCH",  `/ideas/${id}`, { body }),
  remove:     (id)           => req("DELETE", `/ideas/${id}`),
  people:     ()             => req("GET",    `/ideas/people`),
  share:      (id, personId) => req("POST",   `/ideas/${id}/shares`, { body: { person_id: personId } }),
  unshare:    (id, personId) => req("DELETE", `/ideas/${id}/shares/${personId}`),
};

// ── leaderboard ──────────────────────────────────────────────────────────────
// One call returns everything: KAD adoption, the public top 20, your own rank,
// and achievement scoped to your own KAD.
export const leaderboard = {
  get:    () => req("GET", `/leaderboard`),
  streak: () => req("GET", `/streak`),
};

// ── my kad ───────────────────────────────────────────────────────────────────
// People and clients, both scoped server-side to whatever the caller may see.
// Live company-wide activity — what everyone is doing now, not just what has
// completed the chain. Executives and admins only.
export const org = {
  activity: (period, kadId) => req("GET",
    `/org/activity?${[period && `period=${period}`, kadId && `kad=${kadId}`].filter(Boolean).join("&")}`),
};

export const kad = {
  // `kad` drills into another KAD — the server only honours it for executives
  // and admins, so passing it from anywhere else changes nothing.
  people:  (kadId) => req("GET", `/kad/people${kadId ? `?kad=${kadId}` : ""}`),
  clients: () => req("GET", `/kad/clients`),
};
