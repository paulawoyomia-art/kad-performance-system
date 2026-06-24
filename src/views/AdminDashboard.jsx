import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
              <thead><tr><th>Name</th><th>Status</th><th>Headcount</th><th></th></tr></thead>
              <tbody>
                {kads?.length === 0 && <tr><td colSpan={4}><div className="empty"><p className="empty-title">No KADs yet</p><p className="empty-body">Create your first KAD to get started.</p></div></td></tr>}
                {kads?.map(k => (
                  <tr key={k.id}>
                    <td><strong>{k.kad_name}</strong></td>
                    <td><StatusBadge status={k.status}/></td>
                    <td>{k.headcount}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={async()=>{ const next = k.status==="Active" ? "Dissolved" : "Active"; try{ await setup.updateKad(k.id,{status:next}); reload(); }catch(e){ alert(e.message); } }}>
                          {k.status==="Active" ? "Deactivate" : "Reactivate"}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={async()=>{ if(!confirm(`Delete KAD "${k.kad_name}"? Blocked if it has people, clients, or periods.`)) return; try{ await setup.deleteKad(k.id); reload(); }catch(e){ alert(e.message); } }}>Delete</button>
                      </div>
                    </td>
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
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ employee_id:"",full_name:"",designation:"",staff_type:"Management",kad_id:"",email:"",status:"Active",is_hr_manager:false });
  const [err, setErr]           = useState("");
  const [saving, setSaving]     = useState(false);
  const [newPw, setNewPw]       = useState(null);

  function f(k, v)   { setForm(p => ({...p, [k]: v})); }
  function edf(k, v) { setEditing(p => ({...p, [k]: v})); }

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

  async function savePerson(e) {
    e.preventDefault(); setErr(""); setSaving(true);
    try {
      await setup.updatePerson(editing.id, {
        full_name:    editing.full_name,
        designation:  editing.designation,
        staff_type:   editing.staff_type,
        email:        editing.email,
        kad_id:       Number(editing.kad_id),
        status:       editing.status,
        is_hr_manager: editing.is_hr_manager ? 1 : 0,
      });
      setEditing(null); reload();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function resetPw(id) {
    if (!confirm("Reset this person's password to the default?")) return;
    const r = await setup.resetPassword(id);
    setNewPw(r.default_password);
  }

  async function deletePerson(p) {
    if (!confirm(`Delete ${p.full_name}? This cannot be undone.\n\nIf they have any history (allocations, submissions, roles), deletion will be blocked — deactivate them instead.`)) return;
    try {
      await setup.deletePerson(p.id);
      reload();
    } catch (e) {
      alert(e.message); // server explains if blocked by dependents
    }
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
          ✓ Default password: <strong style={{fontFamily:"monospace"}}>{newPw}</strong> — share out of band. Forced to change on first login.
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
                      {p.is_hr_manager
                        ? <span className="badge badge-success" title="Granted automatically when a person holds the HRBP role. Manage this via Role Assignments.">HR Manager</span>
                        : <span className="t-caption" title="HR Manager privilege is granted automatically by assigning the HRBP role in Role Assignments.">—</span>}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing({...p}); setErr(""); }}>Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>resetPw(p.id)} title="Reset this person's password back to the default so they can log in again">Reset password</button>
                        <button className="btn btn-danger btn-sm" onClick={()=>deletePerson(p)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <Modal title={`Edit — ${editing.full_name}`} onClose={() => { setEditing(null); setErr(""); }}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={savePerson} disabled={saving}>
              {saving ? <span className="spinner" style={{width:14,height:14}}/> : "Save changes"}
            </button>
          </>}>
          <div className="form-group"><label className="form-label">Full name</label>
            <input className="form-input" value={editing.full_name} onChange={e=>edf("full_name",e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Designation</label>
            <input className="form-input" value={editing.designation} onChange={e=>edf("designation",e.target.value)}/></div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Staff type</label>
              <select className="form-select" value={editing.staff_type} onChange={e=>edf("staff_type",e.target.value)}>
                {["Management","Support","Field"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">KAD</label>
              <select className="form-select" value={editing.kad_id} onChange={e=>edf("kad_id",e.target.value)}>
                {kads?.map(k=><option key={k.id} value={k.id}>{k.kad_name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Email</label>
            <input className="form-input" type="email" value={editing.email} onChange={e=>edf("email",e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Status</label>
            <select className="form-select" value={editing.status} onChange={e=>edf("status",e.target.value)}>
              <option>Active</option><option>Inactive</option>
            </select>
          </div>
          {err && <div className="alert alert-danger">{err}</div>}
        </Modal>
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
            <div className="form-group"><label className="form-label">KAD (optional)</label>
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
  const [renaming, setRenaming] = useState(null);
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
          <thead><tr><th>Name</th><th>KAD</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {clients?.length===0 && <tr><td colSpan={4}><div className="empty"><p className="empty-title">No clients yet</p></div></td></tr>}
            {clients?.map(c=><tr key={c.id}><td><strong>{c.client_name}</strong></td><td>{c.kad_name}</td><td><StatusBadge status={c.status}/></td>
              <td>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={async()=>{ const name = prompt("Client name", c.client_name); if(name && name.trim() && name.trim()!==c.client_name){ try{ await setup.updateClient(c.id,{client_name:name.trim()}); reload(); }catch(e){ alert(e.message); } } }}>Rename</button>
                  <button className="btn btn-secondary btn-sm" onClick={async()=>{ const next = c.status==="Active" ? "Inactive" : "Active"; try{ await setup.updateClient(c.id,{status:next}); reload(); }catch(e){ alert(e.message); } }}>
                    {c.status==="Active" ? "Deactivate" : "Reactivate"}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={async()=>{ if(!confirm(`Delete client "${c.client_name}"? Blocked if it has projects — deactivate instead.`)) return; try{ await setup.deleteClient(c.id); reload(); }catch(e){ alert(e.message); } }}>Delete</button>
                </div>
              </td></tr>)}
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
          <div className="form-group"><label className="form-label">KAD (optional)</label>
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
  const [editing, setEditing] = useState(null);
  const [form, setForm]   = useState({period_label:"",kad_id:"",start_date:"",end_date:""});
  const [err, setErr]     = useState("");
  const [saving, setSaving] = useState(false);
  const [actionErr, setActionErr] = useState({});
  function f(k,v){ setForm(p=>({...p,[k]:v})); }

  async function create(e){ e.preventDefault(); setErr(""); setSaving(true);
    try{ await setup.createPeriod({...form, kad_id: form.kad_id ? Number(form.kad_id) : null}); setCreating(false); setForm({period_label:"",kad_id:"",start_date:"",end_date:""}); reload(); }
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
                    {p.status==="Drafting" && <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(p)}>Edit</button>}
                    {p.status==="Drafting" && <button className="btn btn-danger btn-sm" onClick={()=>{ if(confirm(`Delete period "${p.period_label}"?`)) act(setup.deletePeriod, p.id); }}>Delete</button>}
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
            <button className="btn btn-primary" onClick={create} disabled={saving||!form.period_label||!form.start_date||!form.end_date}>
              {saving?<span className="spinner" style={{width:14,height:14}}/>:"Create"}
            </button></>}>
          <div className="form-group"><label className="form-label">Period label <span>*</span></label><input className="form-input" value={form.period_label} onChange={e=>f("period_label",e.target.value)} placeholder="e.g. 2026-W25/26" autoFocus/></div>
          <div className="form-group"><label className="form-label">KAD</label>
            <select className="form-select" value={form.kad_id} onChange={e=>f("kad_id",e.target.value)}>
              <option value="">Org-wide — all KADs share this period</option>
              {kads?.map(k=><option key={k.id} value={k.id}>KAD-only: {k.kad_name}</option>)}
            </select>
            <p className="form-hint">Leave as org-wide unless one KAD genuinely needs its own private calendar.</p>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Start date <span>*</span></label><input className="form-input" type="date" value={form.start_date} onChange={e=>f("start_date",e.target.value)}/></div>
            <div className="form-group"><label className="form-label">End date <span>*</span></label><input className="form-input" type="date" value={form.end_date} onChange={e=>f("end_date",e.target.value)}/></div>
          </div>
          {err&&<div className="alert alert-danger">{err}</div>}
        </Modal>
      )}
      {editing && <EditPeriodModal period={editing}
        onClose={()=>setEditing(null)} onDone={()=>{setEditing(null);reload();}} />}
    </div>
  );
}

function EditPeriodModal({ period, onClose, onDone }) {
  const [form, setForm] = useState({
    period_label: period.period_label || "",
    start_date: period.start_date || "",
    end_date: period.end_date || "",
  });
  const [err, setErr] = useState(""); const [saving, setSaving] = useState(false);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  async function save(){
    setErr("");
    if (!form.period_label.trim() || !form.start_date || !form.end_date) { setErr("All fields are required."); return; }
    setSaving(true);
    try { await setup.updatePeriod(period.id, form); onDone?.(); }
    catch(e){ setErr(e.message); } finally { setSaving(false); }
  }
  return (
    <Modal title={`Edit — ${period.period_label}`} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?<span className="spinner" style={{width:14,height:14}}/>:"Save changes"}</button></>}>
      <div className="form-group"><label className="form-label">Period label <span>*</span></label>
        <input className="form-input" value={form.period_label} onChange={e=>f("period_label",e.target.value)} autoFocus/></div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Start date <span>*</span></label>
          <input className="form-input" type="date" value={form.start_date} onChange={e=>f("start_date",e.target.value)}/></div>
        <div className="form-group"><label className="form-label">End date <span>*</span></label>
          <input className="form-input" type="date" value={form.end_date} onChange={e=>f("end_date",e.target.value)}/></div>
      </div>
      <p className="t-caption">Only Drafting periods can be edited. The KAD scope is fixed at creation.</p>
      {err&&<div className="alert alert-danger">{err}</div>}
    </Modal>
  );
}
function ProjectsTab() {
  const { data: clients } = useAsync(() => setup.listClients());
  const { data: people } = useAsync(() => setup.listPeople());
  const { data: projects, loading, reload } = useAsync(() => setup.listProjects());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  async function del(p) {
    if (!confirm(`Delete project "${p.project_name}"? If it has allocations, deletion is blocked — deactivate it instead.`)) return;
    try { await setup.deleteProject(p.id); reload(); } catch (e) { alert(e.message); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">Projects</h2>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={()=>setAdding(true)}>+ Add project</button>
          {DownloadTemplate("Projects", setup.projectsTemplate)}
        </div>
      </div>
      <div className="card" style={{marginBottom:16,padding:16}}>
        <p className="t-label" style={{marginBottom:8}}>Bulk import from CSV</p>
        <ImportRow label="projects" onImport={setup.importProjects} onDone={reload}/>
      </div>
      {loading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:0}}><div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Client</th><th>Lead</th><th>Status</th><th>Contract</th><th>Collected</th><th></th></tr></thead>
          <tbody>
            {projects?.length===0 && <tr><td colSpan={7}><div className="empty"><p className="empty-title">No projects yet</p><p className="empty-body">Add one, or import a CSV.</p></div></td></tr>}
            {projects?.map(p=>(
              <tr key={p.id}>
                <td><strong>{p.project_name}</strong></td>
                <td>{p.client_name}</td>
                <td>{p.project_lead_id ? (people?.find(x=>x.id===p.project_lead_id)?.full_name || "—") : <span className="t-caption">—</span>}</td>
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
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-secondary btn-sm" onClick={()=>setEditing(p)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>del(p)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
      {adding && <AddProjectModal clients={clients} people={people}
        onClose={()=>setAdding(false)} onDone={()=>{setAdding(false);reload();}} />}
      {editing && <EditProjectModal project={editing} clients={clients} people={people}
        onClose={()=>setEditing(null)} onDone={()=>{setEditing(null);reload();}} />}
    </div>
  );
}

function AddProjectModal({ clients, people, onClose, onDone }) {
  const [form, setForm] = useState({ project_name:"", client_id:"", status:"Active", contract_value:"", project_lead_id:"" });
  const [err, setErr] = useState(""); const [saving, setSaving] = useState(false);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const STATUSES = ["Prospecting","Negotiation","Awarded","Active","Closing","On Hold","Completed"];
  async function save(){
    setErr("");
    if (!form.project_name.trim() || !form.client_id) { setErr("Project name and client are required."); return; }
    setSaving(true);
    try {
      await setup.createProject({ project_name:form.project_name.trim(), client_id:Number(form.client_id),
        status:form.status, contract_value:form.contract_value?Number(form.contract_value):0,
        project_lead_id:form.project_lead_id?Number(form.project_lead_id):null });
      onDone?.();
    } catch(e){ setErr(e.message); } finally { setSaving(false); }
  }
  return (
    <Modal title="Add project" onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving||!form.project_name.trim()||!form.client_id}>
          {saving?<span className="spinner" style={{width:14,height:14}}/>:"Add project"}</button></>}>
      <div className="form-group"><label className="form-label">Project name <span>*</span></label>
        <input className="form-input" value={form.project_name} onChange={e=>f("project_name",e.target.value)} placeholder="e.g. MTN Site Rollout Q3"/></div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Client <span>*</span></label>
          <select className="form-select" value={form.client_id} onChange={e=>f("client_id",e.target.value)}>
            <option value="">Select…</option>
            {clients?.map(c=><option key={c.id} value={c.id}>{c.client_name}</option>)}
          </select></div>
        <div className="form-group"><label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e=>f("status",e.target.value)}>
            {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select></div>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Contract value (₦)</label>
          <input className="form-input" type="number" value={form.contract_value} onChange={e=>f("contract_value",e.target.value)} placeholder="0"/></div>
        <div className="form-group"><label className="form-label">Project Lead <span className="t-caption" style={{fontWeight:400}}>(optional — assign later)</span></label>
          <select className="form-select" value={form.project_lead_id} onChange={e=>f("project_lead_id",e.target.value)}>
            <option value="">None</option>
            {people?.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select></div>
      </div>
      {err&&<div className="alert alert-danger">{err}</div>}
    </Modal>
  );
}

function EditProjectModal({ project, clients, people, onClose, onDone }) {
  const [form, setForm] = useState({
    project_name: project.project_name || "",
    status: project.status || "Active",
    contract_value: project.contract_value ?? "",
    revenue_collected: project.revenue_collected ?? "",
    project_lead_id: project.project_lead_id ? String(project.project_lead_id) : "",
  });
  const [err, setErr] = useState(""); const [saving, setSaving] = useState(false);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const STATUSES = ["Prospecting","Negotiation","Awarded","Active","Closing","On Hold","Completed"];
  // Only people in the project's KAD make sense as lead
  const eligible = (people || []).filter(p => p.kad_id === project.kad_id);
  async function save(){
    setErr("");
    if (!form.project_name.trim()) { setErr("Project name is required."); return; }
    setSaving(true);
    try {
      await setup.updateProject(project.id, {
        project_name: form.project_name.trim(),
        status: form.status,
        contract_value: form.contract_value === "" ? 0 : Number(form.contract_value),
        revenue_collected: form.revenue_collected === "" ? 0 : Number(form.revenue_collected),
        project_lead_id: form.project_lead_id ? Number(form.project_lead_id) : null,
      });
      onDone?.();
    } catch(e){ setErr(e.message); } finally { setSaving(false); }
  }
  return (
    <Modal title={`Edit — ${project.project_name}`} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving||!form.project_name.trim()}>
          {saving?<span className="spinner" style={{width:14,height:14}}/>:"Save changes"}</button></>}>
      <div className="form-group"><label className="form-label">Project name <span>*</span></label>
        <input className="form-input" value={form.project_name} onChange={e=>f("project_name",e.target.value)}/></div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e=>f("status",e.target.value)}>
            {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select></div>
        <div className="form-group"><label className="form-label">Project Lead</label>
          <select className="form-select" value={form.project_lead_id} onChange={e=>f("project_lead_id",e.target.value)}>
            <option value="">None</option>
            {eligible.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          {eligible.length===0 && <p className="t-caption mt-1">No employees in this KAD yet — add people first, then come back to assign a lead.</p>}
        </div>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Contract value (₦)</label>
          <input className="form-input" type="number" value={form.contract_value} onChange={e=>f("contract_value",e.target.value)} placeholder="0"/></div>
        <div className="form-group"><label className="form-label">Revenue collected (₦)</label>
          <input className="form-input" type="number" value={form.revenue_collected} onChange={e=>f("revenue_collected",e.target.value)} placeholder="0"/></div>
      </div>
      {err&&<div className="alert alert-danger">{err}</div>}
    </Modal>
  );
}

// ── Allocations tab ───────────────────────────────────────────────────────────
function AllocationsTab() {
  const { data: periods, loading: pLoading, reload } = useAsync(() => setup.listPeriods());
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">Allocations</h2>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={()=>setAdding(true)}>+ Add allocation</button>
          {DownloadTemplate("Allocations", setup.allocationsTemplate)}
        </div>
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
                    <td>{p.kad_name || <span className="t-caption">Org-wide</span>}</td>
                    <td><StatusBadge status={p.status}/></td>
                    <td className="t-mono">{p.allocation_count}</td>
                    <td className="t-mono">{p.locked_count}</td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      )}
      {adding && <AddAllocationModal onClose={()=>setAdding(false)} onDone={()=>{setAdding(false);reload();}} />}
    </div>
  );
}

function AddAllocationModal({ onClose, onDone }) {
  const { data: people } = useAsync(() => setup.listPeople());
  const { data: projects } = useAsync(() => setup.listProjects());
  const { data: periods } = useAsync(() => setup.listPeriods());
  const [form, setForm] = useState({ employee_id:"", project_id:"", period_id:"", output_metric:"", unit:"" });
  const [err, setErr] = useState(""); const [saving, setSaving] = useState(false);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  async function save(){
    setErr("");
    if (!form.employee_id||!form.project_id||!form.period_id||!form.output_metric.trim()) { setErr("Employee, project, period and output metric are required."); return; }
    setSaving(true);
    try {
      const r = await setup.createAllocation({ employee_id:Number(form.employee_id), project_id:Number(form.project_id),
        period_id:Number(form.period_id), output_metric:form.output_metric.trim(), unit:form.unit.trim()||null });
      if (r.cross_kad) alert("Note: employee's KAD differs from the project's KAD — this was recorded as cross-KAD work and flagged.");
      onDone?.();
    } catch(e){ setErr(e.message); } finally { setSaving(false); }
  }
  return (
    <Modal title="Add allocation" onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving?<span className="spinner" style={{width:14,height:14}}/>:"Add allocation"}</button></>}>
      <div className="form-group"><label className="form-label">Employee <span>*</span></label>
        <select className="form-select" value={form.employee_id} onChange={e=>f("employee_id",e.target.value)}>
          <option value="">Select…</option>
          {people?.map(p=><option key={p.id} value={p.id}>{p.full_name} ({p.employee_id})</option>)}
        </select></div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Project <span>*</span></label>
          <select className="form-select" value={form.project_id} onChange={e=>f("project_id",e.target.value)}>
            <option value="">Select…</option>
            {projects?.map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select></div>
        <div className="form-group"><label className="form-label">Period <span>*</span></label>
          <select className="form-select" value={form.period_id} onChange={e=>f("period_id",e.target.value)}>
            <option value="">Select…</option>
            {periods?.filter(p=>p.status!=="Closed").map(p=><option key={p.id} value={p.id}>{p.period_label}</option>)}
          </select></div>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Output metric <span>*</span></label>
          <input className="form-input" value={form.output_metric} onChange={e=>f("output_metric",e.target.value)} placeholder="e.g. Sites commissioned"/></div>
        <div className="form-group"><label className="form-label">Unit</label>
          <input className="form-input" value={form.unit} onChange={e=>f("unit",e.target.value)} placeholder="count, %, km"/></div>
      </div>
      {err&&<div className="alert alert-danger">{err}</div>}
    </Modal>
  );
}

// ── Role Assignments tab ──────────────────────────────────────────────────────
function RoleAssignmentsTab() {
  const { data: roles }   = useAsync(() => setup.listRoles());
  const { data: people }  = useAsync(() => setup.listPeople());
  const { data: ras, loading, reload } = useAsync(() => setup.listRoleAssignments());
  const [creating, setCreating] = useState(false);
  const [editingScope, setEditingScope] = useState(null); // {person_id, role_id, person_name, role_name}

  async function remove(id){ if(!confirm("Remove this role assignment?")) return;
    try{ await setup.deleteRoleAssignment(id); reload(); } catch(e){ alert(e.message); } }

  const roleDesc = { "KAD Director": "Confirms output (end of cycle)", "HRBP": "Sets targets + confirms output", "Line Manager": "Sets targets + reviews work", "Executive": "Org-wide oversight (cross-KAD visibility)" };

  // Group assignment rows by person+role, so a scoped LM with several rows shows
  // as ONE line ("manages N people") instead of N separate rows.
  const grouped = {};
  for (const r of (ras || [])) {
    const key = `${r.person_id}:${r.role_id}`;
    if (!grouped[key]) grouped[key] = {
      person_id: r.person_id, role_id: r.role_id, person_name: r.person_name,
      employee_id: r.employee_id, role_name: r.role_name,
      kad_name: r.person_kad_name, rows: [], whole_kad: false, scoped: [],
    };
    grouped[key].rows.push(r);
    if (r.scope_employee_id == null) grouped[key].whole_kad = true;
    else grouped[key].scoped.push({ name: r.scope_employee_name, code: r.scope_employee_id_str, raId: r.id });
  }
  const groups = Object.values(grouped).sort((a,b) =>
    (a.kad_name||"").localeCompare(b.kad_name||"") || a.person_name.localeCompare(b.person_name));

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
          <thead><tr><th>Person</th><th>KAD</th><th>Role</th><th>Scope</th><th></th></tr></thead>
          <tbody>
            {groups.length===0 && <tr><td colSpan={5}><div className="empty"><p className="empty-title">No assignments yet</p></div></td></tr>}
            {groups.map(g=>{
              const isLM = g.role_name === "Line Manager";
              return (
                <tr key={`${g.person_id}:${g.role_id}`}>
                  <td><strong>{g.person_name}</strong> <span className="t-caption t-mono">({g.employee_id})</span></td>
                  <td><span className="badge badge-neutral">{g.kad_name || "—"}</span></td>
                  <td><span className={`badge ${g.role_name==="KAD Director"?"badge-success":g.role_name==="HRBP"?"badge-warning":g.role_name==="Executive"?"badge-neutral":"badge-info"}`}>{g.role_name}</span></td>
                  <td>
                    {g.whole_kad
                      ? <span className="t-caption">Whole KAD</span>
                      : <span className="t-caption">{g.scoped.map(s=>s.name).join(", ") || "—"} <span className="t-mono">({g.scoped.length})</span></span>}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {isLM && <button className="btn btn-ghost btn-sm" onClick={()=>setEditingScope({
                        person_id:g.person_id, role_id:g.role_id, person_name:g.person_name, role_name:g.role_name,
                        whole_kad:g.whole_kad, scoped:g.scoped.map(s=>s.raId)
                      })}>Edit scope</button>}
                      {g.rows.map(r=>(
                        <button key={r.id} className="btn btn-danger btn-sm" onClick={()=>remove(r.id)}
                          title={g.rows.length>1?`Remove ${r.scope_employee_name||"whole-KAD"}`:"Remove"}>
                          Remove{g.rows.length>1 && r.scope_employee_name ? ` ${r.scope_employee_name.split(" ")[0]}` : ""}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
      )}
      {creating && <AssignRoleModal roles={roles} people={people}
        onClose={()=>setCreating(false)} onDone={()=>{setCreating(false);reload();}} />}
      {editingScope && <EditScopeModal target={editingScope}
        onClose={()=>setEditingScope(null)} onDone={()=>{setEditingScope(null);reload();}} />}
    </div>
  );
}

// Assign role — scope picker is KAD-filtered to the selected person, with an
// explicit Whole-KAD option and multi-select for Line Managers.
function AssignRoleModal({ roles, people, onClose, onDone }) {
  const [form, setForm] = useState({ person_id:"", role_id:"", whole_kad:true, employee_ids:[] });
  const [candidates, setCandidates] = useState([]);
  const [err, setErr] = useState(""); const [saving, setSaving] = useState(false);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const selectedRole = roles?.find(r=>String(r.id)===String(form.role_id));
  const isLM = selectedRole?.role_name === "Line Manager";

  // When a person is chosen, load only their KAD-mates for the scope picker.
  async function onPerson(pid){
    f("person_id", pid); f("employee_ids", []);
    if (pid) { try { const r = await setup.scopeCandidates(Number(pid)); setCandidates(r.candidates||[]); } catch { setCandidates([]); } }
    else setCandidates([]);
  }
  function toggleEmp(id){ setForm(p=>({...p, employee_ids: p.employee_ids.includes(id) ? p.employee_ids.filter(x=>x!==id) : [...p.employee_ids, id]})); }

  async function save(){
    setErr("");
    if (!form.person_id || !form.role_id) { setErr("Person and role are required."); return; }
    setSaving(true);
    try {
      if (isLM && !form.whole_kad) {
        if (form.employee_ids.length===0) { setErr("Pick at least one employee, or choose Whole KAD."); setSaving(false); return; }
        await setup.updateScope({ person_id:Number(form.person_id), role_id:Number(form.role_id), whole_kad:false, employee_ids:form.employee_ids });
      } else {
        // whole-KAD (Director/HRBP always; LM if chosen)
        await setup.updateScope({ person_id:Number(form.person_id), role_id:Number(form.role_id), whole_kad:true });
      }
      onDone?.();
    } catch(e){ setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title="Assign role" onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving||!form.person_id||!form.role_id}>
          {saving?<span className="spinner" style={{width:14,height:14}}/>:"Assign"}</button></>}>
      <div className="form-group"><label className="form-label">Person <span>*</span></label>
        <select className="form-select" value={form.person_id} onChange={e=>onPerson(e.target.value)}>
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
      {isLM ? (
        <div className="form-group">
          <label className="form-label">Scope</label>
          <div className="flex gap-2 mb-2">
            <button type="button" className={`btn btn-sm ${form.whole_kad?"btn-primary":"btn-secondary"}`} onClick={()=>f("whole_kad",true)}>Whole KAD</button>
            <button type="button" className={`btn btn-sm ${!form.whole_kad?"btn-primary":"btn-secondary"}`} onClick={()=>f("whole_kad",false)}>Specific people</button>
          </div>
          {!form.whole_kad && (
            <div className="card" style={{padding:10, maxHeight:220, overflowY:"auto"}}>
              {!form.person_id && <p className="t-caption">Pick a person first.</p>}
              {form.person_id && candidates.length===0 && <p className="t-caption">No other active people in this KAD.</p>}
              {candidates.map(c=>(
                <label key={c.id} className="flex items-center gap-2" style={{padding:"3px 0", cursor:"pointer"}}>
                  <input type="checkbox" checked={form.employee_ids.includes(c.id)} onChange={()=>toggleEmp(c.id)} />
                  <span>{c.full_name} <span className="t-caption t-mono">({c.employee_id})</span></span>
                </label>
              ))}
            </div>
          )}
          <p className="form-hint">Line Managers can be scoped to specific reports (they change across cycles). Only people in this person's KAD are shown.</p>
        </div>
      ) : (
        <p className="t-caption">{selectedRole ? `${selectedRole.role_name} acts for the whole KAD.` : "Directors and HRBPs act for the whole KAD."}</p>
      )}
      {err&&<div className="alert alert-danger">{err}</div>}
    </Modal>
  );
}

// Edit an existing Line Manager's scope (KAD-filtered, multi-select).
function EditScopeModal({ target, onClose, onDone }) {
  const [wholeKad, setWholeKad] = useState(!!target.whole_kad);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(""); const [saving, setSaving] = useState(false);

  // Load the person's KAD-mates + which are currently in scope.
  useEffect(() => {
    (async () => {
      try {
        const r = await setup.scopeCandidates(target.person_id);
        setCandidates(r.candidates||[]);
        // current scope: fetch this person's assignments to mark checked
        const ras = await setup.listRoleAssignments(target.person_id);
        const current = (ras||[]).filter(x=>x.role_id===target.role_id && x.scope_employee_id!=null).map(x=>x.scope_employee_id);
        setSelected(current);
        if (current.length===0) setWholeKad(true);
      } catch(e){ setErr(e.message); } finally { setLoading(false); }
    })();
  }, [target.person_id, target.role_id]);

  function toggle(id){ setSelected(s=> s.includes(id) ? s.filter(x=>x!==id) : [...s, id]); }

  async function save(){
    setErr("");
    if (!wholeKad && selected.length===0) { setErr("Pick at least one person, or choose Whole KAD."); return; }
    setSaving(true);
    try {
      await setup.updateScope({ person_id:target.person_id, role_id:target.role_id,
        whole_kad: wholeKad, employee_ids: wholeKad ? [] : selected });
      onDone?.();
    } catch(e){ setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title={`Edit scope — ${target.person_name}`} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving?<span className="spinner" style={{width:14,height:14}}/>:"Save scope"}</button></>}>
      <div className="flex gap-2 mb-3">
        <button type="button" className={`btn btn-sm ${wholeKad?"btn-primary":"btn-secondary"}`} onClick={()=>setWholeKad(true)}>Whole KAD</button>
        <button type="button" className={`btn btn-sm ${!wholeKad?"btn-primary":"btn-secondary"}`} onClick={()=>setWholeKad(false)}>Specific people</button>
      </div>
      {loading ? <div className="loading-center"><span className="spinner"/></div> : (
        !wholeKad && (
          <div className="card" style={{padding:10, maxHeight:260, overflowY:"auto"}}>
            {candidates.length===0 && <p className="t-caption">No other active people in this KAD.</p>}
            {candidates.map(c=>(
              <label key={c.id} className="flex items-center gap-2" style={{padding:"3px 0", cursor:"pointer"}}>
                <input type="checkbox" checked={selected.includes(c.id)} onChange={()=>toggle(c.id)} />
                <span>{c.full_name} <span className="t-caption t-mono">({c.employee_id})</span></span>
              </label>
            ))}
          </div>
        )
      )}
      {wholeKad && <p className="t-caption">This Line Manager will act for everyone in their KAD.</p>}
      {err&&<div className="alert alert-danger">{err}</div>}
    </Modal>
  );
}

// ── AdminDashboard ────────────────────────────────────────────────────────────
const TABS = ["KADs","People","Clients","Role Assignments","Projects","Periods","Allocations"];
const TAB_SLUGS = {
  "KADs": "kads", "People": "people", "Clients": "clients",
  "Role Assignments": "role-assignments", "Projects": "projects",
  "Periods": "periods", "Allocations": "allocations",
};
const SLUG_TABS = Object.fromEntries(Object.entries(TAB_SLUGS).map(([k,v]) => [v,k]));

export default function AdminDashboard() {
  const { tab: tabSlug } = useParams();
  const navigate = useNavigate();
  const tab = SLUG_TABS[tabSlug] || "KADs";
  const setTab = (t) => navigate(`/admin/${TAB_SLUGS[t]}`);

  const TAB_ICONS = {
    "KADs": Icons.setup, "People": Icons.team, "Clients": Icons.allocations,
    "Role Assignments": Icons.setup, "Projects": Icons.allocations,
    "Periods": Icons.periods, "Allocations": Icons.allocations,
  };
  const TAB_MOBILE = {
    "KADs": "KADs", "People": "People", "Clients": "Clients",
    "Role Assignments": "Roles", "Projects": "Projects",
    "Periods": "Periods", "Allocations": "Allocs",
  };

  const navItems = TABS.map(t => ({
    key: t, label: t, mobileLabel: TAB_MOBILE[t], icon: TAB_ICONS[t],
    active: tab === t, onClick: () => setTab(t),
  }));

  return (
    <AppShell title={`Admin — ${tab}`} navItems={navItems}>
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
