import { useState, useEffect, useCallback } from "react";
import AppShell, { Icons } from "../components/AppShell";
import { setup, periods as periodsApi } from "../api/client";

// ── helpers ──────────────────────────────────────────────────────────────────
function useAsync(fn, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fn()); } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

function StatusBadge({ status }) {
  const map = {
    Active: "badge-success", Inactive: "badge-neutral", Completed: "badge-neutral",
    Open: "badge-success", Closed: "badge-neutral", Drafting: "badge-info",
    Awarded: "badge-success", Prospecting: "badge-info", Negotiation: "badge-warning",
    "On Hold": "badge-warning", Closing: "badge-warning",
  };
  return <span className={`badge ${map[status] || "badge-neutral"}`}>{status}</span>;
}

function DownloadTemplate(label, fn) {
  const [loading, setLoading] = useState(false);
  async function download() {
    setLoading(true);
    try {
      const blob = await fn();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = label.toLowerCase().replace(/\s+/g, "_") + "_template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert("Download failed: " + e.message); }
    finally { setLoading(false); }
  }
  return (
    <button className="btn btn-secondary btn-sm" onClick={download} disabled={loading}>
      {loading ? <span className="spinner" style={{width:14,height:14}}/> : "⬇"} Template
    </button>
  );
}

function ImportRow({ label, onImport, onDone }) {
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  async function run() {
    if (!file) return;
    setLoading(true); setResult(null);
    try {
      const r = await onImport(file);
      setResult(r); setFile(null);
      if (r.ok) onDone?.();
    } catch (e) { setResult({ ok: false, error: e.message }); }
    finally { setLoading(false); }
  }
  return (
    <div>
      <div className="flex gap-2 items-center" style={{marginBottom: result ? 8 : 0}}>
        <label style={{flex:1}}>
          <div className="upload-zone" style={{padding:"12px 16px", textAlign:"left"}}>
            <span className="upload-text">
              {file ? <strong>{file.name}</strong> : <><strong>Choose CSV file</strong> to import {label}</>}
            </span>
            <input type="file" accept=".csv" style={{display:"none"}} onChange={e => { setFile(e.target.files[0]); setResult(null); }} />
          </div>
        </label>
        <button className="btn btn-primary btn-sm" onClick={run} disabled={!file || loading}>
          {loading ? <span className="spinner" style={{width:14,height:14}}/> : "Import"}
        </button>
      </div>
      {result && (
        <div className={`alert ${result.ok ? "alert-success" : result.failed > 0 ? "alert-warning" : "alert-danger"}`} style={{marginTop:8}}>
          {result.error
            ? result.error
            : `${result.imported} imported, ${result.failed} failed of ${result.total} rows.`
          }
          {result.results?.filter(r=>!r.ok).map((r,i) => (
            <div key={i} style={{fontSize:".786rem",marginTop:4}}>
              Row {r.row} ({r.employee_id||r.project_name||"?"}): {r.errors?.join("; ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ── KADs tab ─────────────────────────────────────────────────────────────────
function KADsTab() {
  const { data: kads, loading, reload } = useAsync(() => setup.listKads());
  const [creating, setCreating] = useState(false);
  const [name, setName]         = useState("");
  const [err, setErr]           = useState("");
  const [saving, setSaving]     = useState(false);

  async function createKad(e) {
    e.preventDefault(); setErr(""); setSaving(true);
    try { await setup.createKad({ kad_name: name }); setCreating(false); setName(""); reload(); }
    catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">KADs</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ New KAD</button>
      </div>
      {loading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:0}}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Status</th><th>Headcount</th></tr></thead>
              <tbody>
                {kads?.length === 0 && <tr><td colSpan={3}><div className="empty"><p className="empty-title">No KADs yet</p><p className="empty-body">Create your first KAD to get started.</p></div></td></tr>}
                {kads?.map(k => (
                  <tr key={k.id}>
                    <td><strong>{k.kad_name}</strong></td>
                    <td><StatusBadge status={k.status}/></td>
                    <td>{k.headcount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {creating && (
        <Modal title="New KAD" onClose={() => { setCreating(false); setErr(""); setName(""); }}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={createKad} disabled={saving || !name.trim()}>
              {saving ? <span className="spinner" style={{width:14,height:14}}/> : "Create KAD"}
            </button>
          </>}>
          <div className="form-group">
            <label className="form-label">KAD name <span>*</span></label>
            <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. KAD-3" autoFocus/>
          </div>
          {err && <div className="alert alert-danger">{err}</div>}
        </Modal>
      )}
    </div>
  );
}

// ── People tab ────────────────────────────────────────────────────────────────
function PeopleTab() {
  const { data: kads } = useAsync(() => setup.listKads());
  const [kadId, setKadId]       = useState("");
  const { data: people, loading, reload } = useAsync(() => setup.listPeople(kadId || null), [kadId]);
  const [creating, setCreating] = useState(false);
  const [form, setForm]         = useState({ employee_id:"",full_name:"",designation:"",staff_type:"Management",kad_id:"",email:"",status:"Active",is_hr_manager:false });
  const [err, setErr]           = useState("");
  const [saving, setSaving]     = useState(false);
  const [newPw, setNewPw]       = useState(null);

  function f(k, v) { setForm(p => ({...p, [k]: v})); }

  async function createPerson(e) {
    e.preventDefault(); setErr(""); setSaving(true);
    try {
      const r = await setup.createPerson({...form, kad_id: Number(form.kad_id)});
      setNewPw(r.default_password); setCreating(false);
      setForm({ employee_id:"",full_name:"",designation:"",staff_type:"Management",kad_id:"",email:"",status:"Active",is_hr_manager:false });
      reload();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function resetPw(id) {
    if (!confirm("Reset this person's password to the default?")) return;
    const r = await setup.resetPassword(id);
    setNewPw(r.default_password);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2 items-center">
          <h2 className="t-title">People</h2>
          <select className="form-select" style={{width:140}} value={kadId} onChange={e=>setKadId(e.target.value)}>
            <option value="">All KADs</option>
            {kads?.map(k => <option key={k.id} value={k.id}>{k.kad_name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {DownloadTemplate("People", setup.peopleTemplate)}
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Add person</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:16,padding:16}}>
        <p className="t-label" style={{marginBottom:8}}>Bulk import from CSV</p>
        <ImportRow label="people" onImport={setup.importPeople} onDone={reload}/>
      </div>

      {newPw && (
        <div className="alert alert-success" style={{marginBottom:16}}>
          ✓ Account created. Default password: <strong style={{fontFamily:"monospace"}}>{newPw}</strong> — share with the employee out of band. They will be forced to change it on first login.
          <button className="btn btn-ghost btn-sm" onClick={()=>setNewPw(null)} style={{marginLeft:"auto"}}>Dismiss</button>
        </div>
      )}

      {loading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:0}}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Designation</th><th>Type</th><th>KAD</th><th>Status</th><th>HR Manager</th><th></th></tr></thead>
              <tbody>
                {people?.length === 0 && <tr><td colSpan={8}><div className="empty"><p className="empty-title">No people yet</p><p className="empty-body">Import a CSV or add someone manually.</p></div></td></tr>}
                {people?.map(p => (
                  <tr key={p.id}>
                    <td className="t-mono">{p.employee_id}</td>
                    <td><strong>{p.full_name}</strong></td>
                    <td>{p.designation}</td>
                    <td><span className="badge badge-neutral">{p.staff_type}</span></td>
                    <td>KAD {p.kad_id}</td>
                    <td><StatusBadge status={p.status}/>{p.must_change_password ? <span className="badge badge-warning" style={{marginLeft:4}}>First login</span> : null}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${p.is_hr_manager ? "btn-primary" : "btn-secondary"}`}
                        title={p.is_hr_manager ? "Remove HR Manager privilege" : "Grant HR Manager privilege"}
                        onClick={async () => {
                          try {
                            await setup.updatePerson(p.id, { is_hr_manager: p.is_hr_manager ? 0 : 1 });
                            reload();
                          } catch (e) { alert(e.message); }
                        }}
                      >
                        {p.is_hr_manager ? "✓ HR Mgr" : "HR Mgr"}
                      </button>
                    </td>
                    <td><button className="btn btn-ghost btn-sm" onClick={()=>resetPw(p.id)}>Reset PW</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <Modal title="Add person" onClose={() => {setCreating(false); setErr("");}}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={createPerson} disabled={saving}>
              {saving ? <span className="spinner" style={{width:14,height:14}}/> : "Create account"}
            </button>
          </>}>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Employee ID <span>*</span></label><input className="form-input" value={form.employee_id} onChange={e=>f("employee_id",e.target.value)} placeholder="TCL-001"/></div>
            <div className="form-group"><label className="form-label">KAD <span>*</span></label>
              <select className="form-select" value={form.kad_id} onChange={e=>f("kad_id",e.target.value)}>
                <option value="">Select…</option>
                {kads?.map(k=><option key={k.id} value={k.id}>{k.kad_name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Full name <span>*</span></label><input className="form-input" value={form.full_name} onChange={e=>f("full_name",e.target.value)}/></div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Designation <span>*</span></label><input className="form-input" value={form.designation} onChange={e=>f("designation",e.target.value)} placeholder="e.g. Field Engineer"/></div>
            <div className="form-group"><label className="form-label">Staff type <span>*</span></label>
              <select className="form-select" value={form.staff_type} onChange={e=>f("staff_type",e.target.value)}>
                {["Management","Support","Field"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Work email <span>*</span></label><input className="form-input" type="email" value={form.email} onChange={e=>f("email",e.target.value)}/></div>
          <div className="form-group">
            <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",userSelect:"none"}}>
              <input type="checkbox" checked={form.is_hr_manager} onChange={e=>f("is_hr_manager",e.target.checked)}
                style={{width:16,height:16,accentColor:"var(--orbit)",cursor:"pointer"}}/>
              <span style={{fontWeight:500,fontSize:".929rem"}}>HR Manager</span>
              <span className="t-caption" style={{color:"var(--text-secondary)"}}>Can manage people, roles &amp; allocations</span>
            </label>
          </div>
          {err && <div className="alert alert-danger">{err}</div>}
        </Modal>
      )}
    </div>
  );
}

// ── Clients tab ───────────────────────────────────────────────────────────────
function ClientsTab() {
  const { data: kads } = useAsync(() => setup.listKads());
  const [kadId, setKadId] = useState("");
  const { data: clients, loading, reload } = useAsync(() => setup.listClients(kadId||null), [kadId]);
  const [creating, setCreating] = useState(false);
  const [form, setForm]   = useState({client_name:"",kad_id:""});
  const [err, setErr]     = useState("");
  const [saving, setSaving] = useState(false);
  function f(k,v){ setForm(p=>({...p,[k]:v})); }
  async function create(e){ e.preventDefault(); setErr(""); setSaving(true);
    try{ await setup.createClient({client_name:form.client_name, kad_id:Number(form.kad_id)}); setCreating(false); setForm({client_name:"",kad_id:""}); reload(); }
    catch(e){ setErr(e.message); } finally{ setSaving(false); } }
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2 items-center">
          <h2 className="t-title">Clients</h2>
          <select className="form-select" style={{width:140}} value={kadId} onChange={e=>setKadId(e.target.value)}>
            <option value="">All KADs</option>
            {kads?.map(k=><option key={k.id} value={k.id}>{k.kad_name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary btn-sm" onClick={()=>setCreating(true)}>+ New client</button>
      </div>
      {loading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:0}}><div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>KAD</th><th>Status</th></tr></thead>
          <tbody>
            {clients?.length===0 && <tr><td colSpan={3}><div className="empty"><p className="empty-title">No clients yet</p></div></td></tr>}
            {clients?.map(c=><tr key={c.id}><td><strong>{c.client_name}</strong></td><td>{c.kad_name}</td><td><StatusBadge status={c.status}/></td></tr>)}
          </tbody>
        </table></div></div>
      )}
      {creating && (
        <Modal title="New client" onClose={()=>{setCreating(false);setErr("");}}
          footer={<><button className="btn btn-secondary" onClick={()=>setCreating(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={create} disabled={saving||!form.client_name||!form.kad_id}>
              {saving?<span className="spinner" style={{width:14,height:14}}/>:"Create"}
            </button></>}>
          <div className="form-group"><label className="form-label">Client name <span>*</span></label><input className="form-input" value={form.client_name} onChange={e=>f("client_name",e.target.value)} autoFocus/></div>
          <div className="form-group"><label className="form-label">KAD <span>*</span></label>
            <select className="form-select" value={form.kad_id} onChange={e=>f("kad_id",e.target.value)}>
              <option value="">Select…</option>
              {kads?.map(k=><option key={k.id} value={k.id}>{k.kad_name}</option>)}
            </select>
          </div>
          {err&&<div className="alert alert-danger">{err}</div>}
        </Modal>
      )}
    </div>
  );
}

// ── Periods tab ───────────────────────────────────────────────────────────────
function PeriodsTab() {
  const { data: kads } = useAsync(() => setup.listKads());
  const { data: allPeriods, loading, reload } = useAsync(() => setup.listPeriods());
  const [creating, setCreating] = useState(false);
  const [form, setForm]   = useState({period_label:"",kad_id:"",start_date:"",end_date:""});
  const [err, setErr]     = useState("");
  const [saving, setSaving] = useState(false);
  const [actionErr, setActionErr] = useState({});
  function f(k,v){ setForm(p=>({...p,[k]:v})); }

  async function create(e){ e.preventDefault(); setErr(""); setSaving(true);
    try{ await setup.createPeriod({...form, kad_id:Number(form.kad_id)}); setCreating(false); setForm({period_label:"",kad_id:"",start_date:"",end_date:""}); reload(); }
    catch(e){ setErr(e.message); } finally{ setSaving(false); } }

  async function act(fn, id){ setActionErr({});
    try{ await fn(id); reload(); }
    catch(e){ setActionErr({[id]: e.message}); } }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">Periods</h2>
        <button className="btn btn-primary btn-sm" onClick={()=>setCreating(true)}>+ New period</button>
      </div>
      {loading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:0}}><div className="table-wrap"><table>
          <thead><tr><th>Label</th><th>KAD</th><th>Dates</th><th>Status</th><th>Allocations</th><th>Actions</th></tr></thead>
          <tbody>
            {allPeriods?.length===0 && <tr><td colSpan={6}><div className="empty"><p className="empty-title">No periods yet</p></div></td></tr>}
            {allPeriods?.map(p=>(
              <tr key={p.id}>
                <td><strong>{p.period_label}</strong></td>
                <td>{p.kad_name}</td>
                <td className="t-caption">{p.start_date} → {p.end_date}</td>
                <td><StatusBadge status={p.status}/></td>
                <td><span className="t-mono">{p.locked_count}/{p.allocation_count}</span> locked</td>
                <td>
                  <div className="flex gap-2">
                    {p.status==="Drafting" && <button className="btn btn-secondary btn-sm" onClick={()=>act(periodsApi.open, p.id)}>Open</button>}
                    {p.status==="Open"     && <button className="btn btn-danger btn-sm"    onClick={()=>act(periodsApi.close, p.id)}>Close</button>}
                    {actionErr[p.id] && <span className="t-caption" style={{color:"var(--danger)"}}>{actionErr[p.id]}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
      {creating && (
        <Modal title="New period" onClose={()=>{setCreating(false);setErr("");}}
          footer={<><button className="btn btn-secondary" onClick={()=>setCreating(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={create} disabled={saving||!form.period_label||!form.kad_id||!form.start_date||!form.end_date}>
              {saving?<span className="spinner" style={{width:14,height:14}}/>:"Create"}
            </button></>}>
          <div className="form-group"><label className="form-label">Period label <span>*</span></label><input className="form-input" value={form.period_label} onChange={e=>f("period_label",e.target.value)} placeholder="e.g. 2026-W25/26" autoFocus/></div>
          <div className="form-group"><label className="form-label">KAD <span>*</span></label>
            <select className="form-select" value={form.kad_id} onChange={e=>f("kad_id",e.target.value)}>
              <option value="">Select…</option>
              {kads?.map(k=><option key={k.id} value={k.id}>{k.kad_name}</option>)}
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Start date <span>*</span></label><input className="form-input" type="date" value={form.start_date} onChange={e=>f("start_date",e.target.value)}/></div>
            <div className="form-group"><label className="form-label">End date <span>*</span></label><input className="form-input" type="date" value={form.end_date} onChange={e=>f("end_date",e.target.value)}/></div>
          </div>
          {err&&<div className="alert alert-danger">{err}</div>}
        </Modal>
      )}
    </div>
  );
}

// ── Projects tab ──────────────────────────────────────────────────────────────
function ProjectsTab() {
  const { data: clients } = useAsync(() => setup.listClients());
  const { data: projects, loading, reload } = useAsync(() => setup.listProjects());
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">Projects</h2>
        <div className="flex gap-2">
          {DownloadTemplate("Projects", setup.projectsTemplate)}
        </div>
      </div>
      <div className="card" style={{marginBottom:16,padding:16}}>
        <p className="t-label" style={{marginBottom:8}}>Bulk import from CSV</p>
        <ImportRow label="projects" onImport={setup.importProjects} onDone={reload}/>
      </div>
      {loading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:0}}><div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Client</th><th>Status</th><th>Contract</th><th>Collected</th></tr></thead>
          <tbody>
            {projects?.length===0 && <tr><td colSpan={5}><div className="empty"><p className="empty-title">No projects yet</p><p className="empty-body">Import a CSV to bulk-load projects.</p></div></td></tr>}
            {projects?.map(p=>(
              <tr key={p.id}>
                <td><strong>{p.project_name}</strong></td>
                <td>{p.client_name}</td>
                <td><StatusBadge status={p.status}/></td>
                <td className="t-mono">₦{(p.contract_value||0).toLocaleString()}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="progress-bar" style={{width:60, flexShrink:0}}>
                      <div className="progress-fill" style={{width:`${Math.min(100,(p.collection_pct||0)*100)}%`, background: (p.collection_pct||0) < 0.2 ? "var(--danger)" : "var(--success)"}}/>
                    </div>
                    <span className="t-mono t-caption">{((p.collection_pct||0)*100).toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
    </div>
  );
}

// ── Allocations tab ───────────────────────────────────────────────────────────
function AllocationsTab() {
  const { data: periods, loading: pLoading } = useAsync(() => setup.listPeriods());
  const reload = useCallback(() => {}, []);
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">Allocations</h2>
        {DownloadTemplate("Allocations", setup.allocationsTemplate)}
      </div>
      <div className="alert alert-info" style={{marginBottom:16}}>
        The template is dynamic — download it after creating your period and employees to see live IDs pre-filled.
      </div>
      <div className="card" style={{marginBottom:16,padding:16}}>
        <p className="t-label" style={{marginBottom:8}}>Bulk import from CSV</p>
        <ImportRow label="allocations" onImport={setup.importAllocations} onDone={reload}/>
      </div>
      {pLoading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:16}}>
          <p className="t-label" style={{marginBottom:12}}>Active periods</p>
          {periods?.filter(p=>p.status!=="Closed").length === 0
            ? <div className="empty"><p className="empty-title">No open periods</p><p className="empty-body">Create a period in the Periods tab first.</p></div>
            : <div className="table-wrap"><table>
                <thead><tr><th>Period</th><th>KAD</th><th>Status</th><th>Allocations</th><th>Locked</th></tr></thead>
                <tbody>{periods?.filter(p=>p.status!=="Closed").map(p=>(
                  <tr key={p.id}>
                    <td><strong>{p.period_label}</strong></td>
                    <td>{p.kad_name}</td>
                    <td><StatusBadge status={p.status}/></td>
                    <td className="t-mono">{p.allocation_count}</td>
                    <td className="t-mono">{p.locked_count}</td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      )}
    </div>
  );
}

// ── Role Assignments tab ──────────────────────────────────────────────────────
function RoleAssignmentsTab() {
  const { data: roles }   = useAsync(() => setup.listRoles());
  const { data: people }  = useAsync(() => setup.listPeople());
  const { data: ras, loading, reload } = useAsync(() => setup.listRoleAssignments());
  const [creating, setCreating] = useState(false);
  const [form, setForm]   = useState({person_id:"",role_id:"",scope_employee_id:""});
  const [err, setErr]     = useState("");
  const [saving, setSaving] = useState(false);
  function f(k,v){ setForm(p=>({...p,[k]:v})); }

  async function create(e){ e.preventDefault(); setErr(""); setSaving(true);
    try{
      await setup.createRoleAssignment({person_id:Number(form.person_id), role_id:Number(form.role_id), scope_employee_id: form.scope_employee_id ? Number(form.scope_employee_id) : null});
      setCreating(false); setForm({person_id:"",role_id:"",scope_employee_id:""}); reload();
    } catch(e){ setErr(e.message); } finally{ setSaving(false); } }

  async function remove(id){ if(!confirm("Remove this role assignment?")) return;
    try{ await setup.deleteRoleAssignment(id); reload(); } catch(e){ alert(e.message); } }

  const roleDesc = { "KAD Director": "Final approval + sign-off confirmation", "HRBP": "Target confirmation + sign-off confirmation", "Line Manager": "Sets targets + performs sign-off" };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">Role assignments</h2>
        <button className="btn btn-primary btn-sm" onClick={()=>setCreating(true)}>+ Assign role</button>
      </div>
      <div className="grid-3" style={{marginBottom:16}}>
        {roles?.map(r=>(
          <div key={r.id} className="card" style={{padding:14}}>
            <p style={{fontWeight:600,marginBottom:4}}>{r.role_name}</p>
            <p className="t-caption">{roleDesc[r.role_name]}</p>
          </div>
        ))}
      </div>
      {loading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:0}}><div className="table-wrap"><table>
          <thead><tr><th>Person</th><th>Role</th><th>Scope</th><th></th></tr></thead>
          <tbody>
            {ras?.length===0 && <tr><td colSpan={4}><div className="empty"><p className="empty-title">No assignments yet</p></div></td></tr>}
            {ras?.map(r=>(
              <tr key={r.id}>
                <td><strong>{r.person_name}</strong> <span className="t-caption t-mono">({r.employee_id})</span></td>
                <td><span className={`badge ${r.role_name==="KAD Director"?"badge-success":r.role_name==="HRBP"?"badge-warning":"badge-info"}`}>{r.role_name}</span></td>
                <td>{r.scope_employee_name ? <span>{r.scope_employee_name} <span className="t-caption t-mono">({r.scope_employee_id_str})</span></span> : <span className="t-caption">Whole KAD</span>}</td>
                <td><button className="btn btn-danger btn-sm" onClick={()=>remove(r.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
      {creating && (
        <Modal title="Assign role" onClose={()=>{setCreating(false);setErr("");}}
          footer={<><button className="btn btn-secondary" onClick={()=>setCreating(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={create} disabled={saving||!form.person_id||!form.role_id}>
              {saving?<span className="spinner" style={{width:14,height:14}}/>:"Assign"}
            </button></>}>
          <div className="form-group"><label className="form-label">Person <span>*</span></label>
            <select className="form-select" value={form.person_id} onChange={e=>f("person_id",e.target.value)}>
              <option value="">Select person…</option>
              {people?.map(p=><option key={p.id} value={p.id}>{p.full_name} ({p.employee_id})</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Role <span>*</span></label>
            <select className="form-select" value={form.role_id} onChange={e=>f("role_id",e.target.value)}>
              <option value="">Select role…</option>
              {roles?.map(r=><option key={r.id} value={r.id}>{r.role_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Scope (leave blank for whole-KAD)</label>
            <select className="form-select" value={form.scope_employee_id} onChange={e=>f("scope_employee_id",e.target.value)}>
              <option value="">Whole KAD</option>
              {people?.map(p=><option key={p.id} value={p.id}>{p.full_name} ({p.employee_id})</option>)}
            </select>
            <p className="form-hint">Whole-KAD = this person acts in this role for everyone in their KAD.</p>
          </div>
          {err&&<div className="alert alert-danger">{err}</div>}
        </Modal>
      )}
    </div>
  );
}

// ── AdminDashboard ────────────────────────────────────────────────────────────
const TABS = ["KADs","People","Clients","Role Assignments","Projects","Periods","Allocations"];

export default function AdminDashboard() {
  const [tab, setTab] = useState("KADs");
  const nav = TABS.map(t => (
    <button key={t} className={`nav-item ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
      {Icons.setup}
      {t}
    </button>
  ));

  return (
    <AppShell title={`Admin — ${tab}`} nav={nav}>
      <div className="tabs">
        {TABS.map(t=>(
          <button key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>
      {tab==="KADs"             && <KADsTab/>}
      {tab==="People"           && <PeopleTab/>}
      {tab==="Clients"          && <ClientsTab/>}
      {tab==="Role Assignments" && <RoleAssignmentsTab/>}
      {tab==="Projects"         && <ProjectsTab/>}
      {tab==="Periods"          && <PeriodsTab/>}
      {tab==="Allocations"      && <AllocationsTab/>}
    </AppShell>
  );
}
