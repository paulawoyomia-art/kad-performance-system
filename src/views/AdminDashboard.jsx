import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppShell, { Icons } from "../components/AppShell";
import { OrgDashboard } from "./ManagerViews";
import { setup, periods as periodsApi, proofs as proofsApi, downloadProof, downloadProofsCsv, downloadProofsZip, allocations as allocApi } from "../api/client";
import { exportCsv, useSort, SortTh } from "../lib/adminTable";

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
  const { sorted, sortKey, sortDir, toggle } = useSort(kads, "id");

  async function createKad(e) {
    e.preventDefault(); setErr(""); setSaving(true);
    try { await setup.createKad({ kad_name: name }); setCreating(false); setName(""); reload(); }
    catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  function doExport() {
    exportCsv("kads.csv", sorted, [
      { key: "id", label: "ID" }, { key: "kad_name", label: "Name" },
      { key: "status", label: "Status" }, { key: "headcount", label: "Headcount" },
    ]);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">KADs</h2>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={doExport}>Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ New KAD</button>
        </div>
      </div>
      {loading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:0}}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <SortTh label="ID" sortKeyName="id" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Name" sortKeyName="kad_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Status" sortKeyName="status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Headcount" sortKeyName="headcount" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <th></th>
              </tr></thead>
              <tbody>
                {sorted?.length === 0 && <tr><td colSpan={5}><div className="empty"><p className="empty-title">No KADs yet</p><p className="empty-body">Create your first KAD to get started.</p></div></td></tr>}
                {sorted?.map(k => (
                  <tr key={k.id}>
                    <td className="t-caption">{k.id}</td>
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
  const [onlyNeverLoggedIn, setOnlyNeverLoggedIn] = useState(false);
  const filtered = onlyNeverLoggedIn ? (people || []).filter(p => !p.last_login_at) : people;
  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, "full_name");
  const neverLoggedInCount = (people || []).filter(p => !p.last_login_at).length;

  function f(k, v)   { setForm(p => ({...p, [k]: v})); }
  function edf(k, v) { setEditing(p => ({...p, [k]: v})); }

  function doExport() {
    exportCsv("people.csv", sorted, [
      { key: "id", label: "ID" }, { key: "employee_id", label: "Employee Code" },
      { key: "full_name", label: "Full Name" }, { key: "designation", label: "Designation" },
      { key: "staff_type", label: "Type" }, { key: "kad_id", label: "KAD ID" },
      { key: "kad_name", label: "KAD" }, { key: "email", label: "Email" },
      { key: "status", label: "Status" }, { key: "is_hr_manager", label: "HR Manager" },
      { key: "last_login_at", label: "Last Login" },
    ]);
  }

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
          <button
            className={`btn btn-sm ${onlyNeverLoggedIn ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setOnlyNeverLoggedIn(v => !v)}
            title="Show only people who have never logged in even once"
          >
            {onlyNeverLoggedIn ? "✓ " : ""}Never logged in{neverLoggedInCount > 0 ? ` (${neverLoggedInCount})` : ""}
          </button>
        </div>
        <div className="flex gap-2">
          {DownloadTemplate("People", setup.peopleTemplate)}
          <button className="btn btn-secondary btn-sm" onClick={doExport}>Export CSV</button>
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
              <thead><tr>
                <SortTh label="ID" sortKeyName="id" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Code" sortKeyName="employee_id" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Name" sortKeyName="full_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Designation" sortKeyName="designation" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Type" sortKeyName="staff_type" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="KAD" sortKeyName="kad_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Email" sortKeyName="email" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Status" sortKeyName="status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <th>HR Manager</th><th></th>
              </tr></thead>
              <tbody>
                {sorted?.length === 0 && <tr><td colSpan={10}><div className="empty"><p className="empty-title">No people yet</p><p className="empty-body">Import a CSV or add someone manually.</p></div></td></tr>}
                {sorted?.map(p => (
                  <tr key={p.id}>
                    <td className="t-caption">{p.id}</td>
                    <td className="t-mono">{p.employee_id}</td>
                    <td><strong>{p.full_name}</strong></td>
                    <td>{p.designation}</td>
                    <td><span className="badge badge-neutral">{p.staff_type}</span></td>
                    <td>{p.kad_name || `KAD ${p.kad_id}`}</td>
                    <td className="t-caption">{p.email}</td>
                    <td>
                      <StatusBadge status={p.status}/>
                      {!p.last_login_at
                        ? <span className="badge badge-danger" style={{marginLeft:4}} title="Has never logged in, even once">Never logged in</span>
                        : p.must_change_password
                          ? <span className="badge badge-warning" style={{marginLeft:4}} title="Has logged in before, but a password reset is pending completion">Password reset pending</span>
                          : null}
                    </td>
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
  const { sorted, sortKey, sortDir, toggle } = useSort(clients, "client_name");
  function f(k,v){ setForm(p=>({...p,[k]:v})); }
  async function create(e){ e.preventDefault(); setErr(""); setSaving(true);
    try{ await setup.createClient({client_name:form.client_name, kad_id:Number(form.kad_id)}); setCreating(false); setForm({client_name:"",kad_id:""}); reload(); }
    catch(e){ setErr(e.message); } finally{ setSaving(false); } }
  function doExport() {
    exportCsv("clients.csv", sorted, [
      { key: "id", label: "ID" }, { key: "client_name", label: "Name" },
      { key: "kad_id", label: "KAD ID" }, { key: "kad_name", label: "KAD" },
      { key: "status", label: "Status" }, { key: "external_ref", label: "External Ref" },
    ]);
  }
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
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={doExport}>Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={()=>setCreating(true)}>+ New client</button>
        </div>
      </div>
      {loading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:0}}><div className="table-wrap"><table>
          <thead><tr>
            <SortTh label="ID" sortKeyName="id" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Name" sortKeyName="client_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="KAD" sortKeyName="kad_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Status" sortKeyName="status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <th></th>
          </tr></thead>
          <tbody>
            {sorted?.length===0 && <tr><td colSpan={5}><div className="empty"><p className="empty-title">No clients yet</p></div></td></tr>}
            {sorted?.map(c=><tr key={c.id}><td className="t-caption">{c.id}</td><td><strong>{c.client_name}</strong></td><td>{c.kad_name}</td><td><StatusBadge status={c.status}/></td>
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
  const { sorted, sortKey, sortDir, toggle } = useSort(allPeriods, "start_date", "desc");
  function f(k,v){ setForm(p=>({...p,[k]:v})); }

  async function create(e){ e.preventDefault(); setErr(""); setSaving(true);
    try{ await setup.createPeriod({...form, kad_id: form.kad_id ? Number(form.kad_id) : null}); setCreating(false); setForm({period_label:"",kad_id:"",start_date:"",end_date:""}); reload(); }
    catch(e){ setErr(e.message); } finally{ setSaving(false); } }

  async function act(fn, id){ setActionErr({});
    try{ await fn(id); reload(); }
    catch(e){ setActionErr({[id]: e.message}); } }

  function doExport() {
    exportCsv("periods.csv", sorted, [
      { key: "id", label: "ID" }, { key: "period_label", label: "Label" },
      { key: "kad_id", label: "KAD ID" }, { key: "kad_name", label: "KAD" },
      { key: "start_date", label: "Start" }, { key: "end_date", label: "End" },
      { key: "status", label: "Status" }, { key: "allocation_count", label: "Allocations" },
      { key: "locked_count", label: "Locked" },
    ]);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">Periods</h2>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={doExport}>Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={()=>setCreating(true)}>+ New period</button>
        </div>
      </div>
      {loading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:0}}><div className="table-wrap"><table>
          <thead><tr>
            <SortTh label="ID" sortKeyName="id" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Label" sortKeyName="period_label" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="KAD" sortKeyName="kad_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Start" sortKeyName="start_date" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="End" sortKeyName="end_date" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Status" sortKeyName="status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Allocations" sortKeyName="allocation_count" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <th>Actions</th>
          </tr></thead>
          <tbody>
            {sorted?.length===0 && <tr><td colSpan={8}><div className="empty"><p className="empty-title">No periods yet</p></div></td></tr>}
            {sorted?.map(p=>(
              <tr key={p.id}>
                <td className="t-caption">{p.id}</td>
                <td><strong>{p.period_label}</strong></td>
                <td>{p.kad_name}</td>
                <td className="t-caption">{p.start_date}</td>
                <td className="t-caption">{p.end_date}</td>
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
  const { sorted, sortKey, sortDir, toggle } = useSort(projects, "project_name");

  async function del(p) {
    if (!confirm(`Delete project "${p.project_name}"? If it has allocations, deletion is blocked — deactivate it instead.`)) return;
    try { await setup.deleteProject(p.id); reload(); } catch (e) { alert(e.message); }
  }

  function leadName(p) { return p.project_lead_id ? (people?.find(x=>x.id===p.project_lead_id)?.full_name || "") : ""; }
  function doExport() {
    const rows = sorted.map(p => ({ ...p, _lead: leadName(p) }));
    exportCsv("projects.csv", rows, [
      { key: "id", label: "ID" }, { key: "project_name", label: "Name" },
      { key: "client_name", label: "Client" }, { key: "kad_name", label: "KAD" },
      { key: "country", label: "Country" }, { key: "currency", label: "Currency" },
      { key: "status", label: "Status" }, { key: "contract_value", label: "Contract (native)" },
      { key: "revenue_collected", label: "Collected (native)" }, { key: "collection_pct", label: "Collection %" },
      { key: "_lead", label: "Project Lead" },
    ]);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">Projects</h2>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={doExport}>Export CSV</button>
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
          <thead><tr>
            <SortTh label="ID" sortKeyName="id" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Name" sortKeyName="project_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Client" sortKeyName="client_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="KAD" sortKeyName="kad_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Country" sortKeyName="country" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <th>Lead</th>
            <SortTh label="Status" sortKeyName="status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Contract" sortKeyName="contract_value" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Collection %" sortKeyName="collection_pct" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <th></th>
          </tr></thead>
          <tbody>
            {sorted?.length===0 && <tr><td colSpan={10}><div className="empty"><p className="empty-title">No projects yet</p><p className="empty-body">Add one, or import a CSV.</p></div></td></tr>}
            {sorted?.map(p=>(
              <tr key={p.id}>
                <td className="t-caption">{p.id}</td>
                <td><strong>{p.project_name}</strong></td>
                <td>{p.client_name}</td>
                <td>{p.kad_name}</td>
                <td>{p.country || "Nigeria"} <span className="t-caption">({p.currency || "NGN"})</span></td>
                <td>{leadName(p) || <span className="t-caption">—</span>}</td>
                <td><StatusBadge status={p.status}/></td>
                <td className="t-mono">{p.currency||"NGN"} {(p.contract_value||0).toLocaleString()}</td>
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
  const [form, setForm] = useState({ project_name:"", client_id:"", status:"Active", country:"Nigeria", currency:"NGN", contract_value:"", project_lead_id:"" });
  const [err, setErr] = useState(""); const [saving, setSaving] = useState(false);
  const [fxRates, setFxRates] = useState(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const STATUSES = ["Prospecting","Negotiation","Awarded","Active","Closing","On Hold","Completed"];
  useEffect(() => { setup.listFxRates().then(setFxRates).catch(() => setFxRates([])); }, []);
  async function save(){
    setErr("");
    if (!form.project_name.trim() || !form.client_id) { setErr("Project name and client are required."); return; }
    setSaving(true);
    try {
      await setup.createProject({ project_name:form.project_name.trim(), client_id:Number(form.client_id),
        status:form.status, country:form.country.trim()||"Nigeria", currency:form.currency,
        contract_value:form.contract_value?Number(form.contract_value):0,
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
        <div className="form-group"><label className="form-label">Country</label>
          <input className="form-input" value={form.country} onChange={e=>f("country",e.target.value)} placeholder="e.g. Nigeria, Ghana, Kenya"/></div>
        <div className="form-group"><label className="form-label">Currency</label>
          <select className="form-select" value={form.currency} onChange={e=>f("currency",e.target.value)}>
            {(fxRates||[]).map(r=><option key={r.currency_code} value={r.currency_code}>{r.currency_code} — {r.currency_name}</option>)}
          </select>
          {fxRates && fxRates.length <= 2 && (
            <p className="t-caption" style={{marginTop:4}}>Only USD and NGN are set up. Add more currencies under Admin → FX Rates first.</p>
          )}</div>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Contract value <span className="t-caption" style={{fontWeight:400}}>(in the currency above)</span></label>
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
    country: project.country || "Nigeria",
    currency: project.currency || "NGN",
    contract_value: project.contract_value ?? "",
    revenue_collected: project.revenue_collected ?? "",
    project_lead_id: project.project_lead_id ? String(project.project_lead_id) : "",
  });
  const [err, setErr] = useState(""); const [saving, setSaving] = useState(false);
  const [fxRates, setFxRates] = useState(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const STATUSES = ["Prospecting","Negotiation","Awarded","Active","Closing","On Hold","Completed"];
  // Only people in the project's KAD make sense as lead
  const eligible = (people || []).filter(p => p.kad_id === project.kad_id);
  useEffect(() => { setup.listFxRates().then(setFxRates).catch(() => setFxRates([])); }, []);
  const currencyChanged = form.currency !== (project.currency || "NGN");
  async function save(){
    setErr("");
    if (!form.project_name.trim()) { setErr("Project name is required."); return; }
    setSaving(true);
    try {
      await setup.updateProject(project.id, {
        project_name: form.project_name.trim(),
        status: form.status,
        country: form.country.trim() || "Nigeria",
        currency: form.currency,
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
        <div className="form-group"><label className="form-label">Country</label>
          <input className="form-input" value={form.country} onChange={e=>f("country",e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Currency</label>
          <select className="form-select" value={form.currency} onChange={e=>f("currency",e.target.value)}>
            {(fxRates||[]).map(r=><option key={r.currency_code} value={r.currency_code}>{r.currency_code} — {r.currency_name}</option>)}
          </select>
          {currencyChanged && (
            <p className="t-caption" style={{marginTop:4, color:"var(--warning, #b45309)"}}>
              Changing currency re-labels the contract/revenue figures below without converting them —
              make sure the amounts still make sense in the new currency.
            </p>
          )}
        </div>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Contract value <span className="t-caption" style={{fontWeight:400}}>(in the currency above)</span></label>
          <input className="form-input" type="number" value={form.contract_value} onChange={e=>f("contract_value",e.target.value)} placeholder="0"/></div>
        <div className="form-group"><label className="form-label">Revenue collected <span className="t-caption" style={{fontWeight:400}}>(in the currency above)</span></label>
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
  const [periodFilter, setPeriodFilter] = useState("");
  const { data: rawAllocations, loading: aLoading, reload: reloadAllocs } =
    useAsync(() => allocApi.list(periodFilter || null), [periodFilter]);
  const { sorted, sortKey, sortDir, toggle } = useSort(rawAllocations, "id");

  function doExportAllocations() {
    exportCsv("allocations.csv", sorted, [
      { key: "id", label: "ID" }, { key: "employee_code", label: "Employee Code" },
      { key: "employee_name", label: "Employee" }, { key: "employee_email", label: "Email" },
      { key: "kad_name", label: "KAD" }, { key: "project_name", label: "Project" },
      { key: "period_id", label: "Period ID" }, { key: "output_metric", label: "Metric" },
      { key: "unit", label: "Unit" }, { key: "target_value", label: "Target" },
      { key: "actual_output_rollup", label: "Actual" }, { key: "achievement_pct", label: "Achievement %" },
      { key: "work_status", label: "Status" },
    ]);
  }

  const WORK_STATUS_CLS = {
    "Target not locked": "badge-neutral", "Awaiting submission": "badge-neutral",
    "Under review": "badge-warning", "Queried": "badge-danger",
    "Work confirmed": "badge-success", "HRBP checked": "badge-success", "Reported": "badge-success",
  };

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
        <ImportRow label="allocations" onImport={setup.importAllocations} onDone={()=>{reload();reloadAllocs();}}/>
      </div>
      {pLoading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{marginBottom:16,padding:16}}>
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

      <div className="flex justify-between items-center mb-2" style={{flexWrap:"wrap", gap:8}}>
        <div className="flex gap-2 items-center">
          <p className="t-label" style={{margin:0}}>All allocations</p>
          <select className="form-select" style={{width:200}} value={periodFilter} onChange={e=>setPeriodFilter(e.target.value)}>
            <option value="">All periods</option>
            {periods?.map(p=><option key={p.id} value={p.id}>{p.period_label}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={doExportAllocations}>Export CSV</button>
      </div>
      {aLoading ? <div className="loading-center"><span className="spinner"/></div> : (
        <div className="card" style={{padding:0}}><div className="table-wrap"><table>
          <thead><tr>
            <SortTh label="ID" sortKeyName="id" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Employee" sortKeyName="employee_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Email" sortKeyName="employee_email" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="KAD" sortKeyName="kad_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Project" sortKeyName="project_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Metric" sortKeyName="output_metric" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Target" sortKeyName="target_value" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Actual" sortKeyName="actual_output_rollup" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Achievement" sortKeyName="achievement_pct" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Status" sortKeyName="work_status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
          </tr></thead>
          <tbody>
            {sorted?.length===0 && <tr><td colSpan={10}><div className="empty"><p className="empty-title">No allocations yet</p><p className="empty-body">Add one, or import a CSV.</p></div></td></tr>}
            {sorted?.map(a=>(
              <tr key={a.id}>
                <td className="t-caption">{a.id}</td>
                <td><strong>{a.employee_name}</strong> <span className="t-caption">({a.employee_code})</span></td>
                <td className="t-caption">{a.employee_email}</td>
                <td>{a.kad_name}</td>
                <td>{a.project_name}</td>
                <td>{a.output_metric} <span className="t-caption">{a.unit ? `(${a.unit})` : ""}</span></td>
                <td className="t-mono">{a.target_value ?? "—"}</td>
                <td className="t-mono">{a.actual_output_rollup ?? 0}</td>
                <td>{a.achievement_pct == null ? "—" : `${Math.round(a.achievement_pct*100)}%`}</td>
                <td><span className={`badge ${WORK_STATUS_CLS[a.work_status] || "badge-neutral"}`}>{a.work_status}</span></td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
      {adding && <AddAllocationModal onClose={()=>setAdding(false)} onDone={()=>{setAdding(false);reload();reloadAllocs();}} />}
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
  const { sorted, sortKey, sortDir, toggle } = useSort(groups, "person_name");

  function doExport() {
    const rows = sorted.map(g => ({
      ...g,
      scope_description: g.whole_kad ? "Whole KAD" : g.scoped.map(s => s.name).join("; "),
    }));
    exportCsv("role_assignments.csv", rows, [
      { key: "person_id", label: "Person ID" }, { key: "employee_id", label: "Employee Code" },
      { key: "person_name", label: "Person" }, { key: "kad_name", label: "KAD" },
      { key: "role_id", label: "Role ID" }, { key: "role_name", label: "Role" },
      { key: "scope_description", label: "Scope" },
    ]);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="t-title">Role assignments</h2>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={doExport}>Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={()=>setCreating(true)}>+ Assign role</button>
        </div>
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
          <thead><tr>
            <SortTh label="Person" sortKeyName="person_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="KAD" sortKeyName="kad_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <SortTh label="Role" sortKeyName="role_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
            <th>Scope</th><th></th>
          </tr></thead>
          <tbody>
            {sorted.length===0 && <tr><td colSpan={5}><div className="empty"><p className="empty-title">No assignments yet</p></div></td></tr>}
            {sorted.map(g=>{
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
const TABS = ["KADs","People","Clients","Role Assignments","Projects","FX Rates","Periods","Allocations","Organisation","Proofs"];
const TAB_SLUGS = {
  "KADs": "kads", "People": "people", "Clients": "clients",
  "Role Assignments": "role-assignments", "Projects": "projects",
  "FX Rates": "fx-rates",
  "Periods": "periods", "Allocations": "allocations", "Organisation": "org",
  "Proofs": "proofs",
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
    "FX Rates": Icons.allocations,
    "Periods": Icons.periods, "Allocations": Icons.allocations, "Organisation": Icons.org || Icons.periods,
    "Proofs": Icons.allocations,
  };
  const TAB_MOBILE = {
    "KADs": "KADs", "People": "People", "Clients": "Clients",
    "Role Assignments": "Roles", "Projects": "Projects",
    "FX Rates": "FX",
    "Periods": "Periods", "Allocations": "Allocs", "Organisation": "Org",
    "Proofs": "Proofs",
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
      {tab==="FX Rates"         && <FxRatesTab/>}
      {tab==="Periods"          && <PeriodsTab/>}
      {tab==="Allocations"      && <AllocationsTab/>}
      {tab==="Organisation"     && <AdminOrgTab/>}
      {tab==="Proofs"           && <ProofsTab/>}
    </AppShell>
  );
}

// Admin attachments inventory — every R2 proof, matched to KAD/client/project/
// period/person, filterable, with per-file download and a manifest CSV export.
// Admin-maintained currency conversion rates. Every KAD/Client/Org rollup
// converts a project's native contract/revenue figures into USD (Telinno's
// reporting currency) using whatever's set here — so this must be set up
// BEFORE a project in a new currency can be created (project creation is
// blocked otherwise).
function FxRatesTab() {
  const { data: rates, loading, reload } = useAsync(() => setup.listFxRates());
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ currency_code: "", currency_name: "", rate_to_usd: "" });
  const [err, setErr] = useState(""); const [saving, setSaving] = useState(false);

  async function save() {
    setErr("");
    const code = form.currency_code.trim().toUpperCase();
    if (!code || code.length !== 3) { setErr("Currency code should be a 3-letter ISO code, e.g. GHS."); return; }
    if (!form.currency_name.trim()) { setErr("Currency name is required."); return; }
    if (!form.rate_to_usd || Number(form.rate_to_usd) <= 0) { setErr("Rate must be a positive number."); return; }
    setSaving(true);
    try {
      await setup.upsertFxRate({ currency_code: code, currency_name: form.currency_name.trim(), rate_to_usd: Number(form.rate_to_usd) });
      setAdding(false); setForm({ currency_code: "", currency_name: "", rate_to_usd: "" });
      reload();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  }
  async function del(r) {
    if (!confirm(`Remove ${r.currency_code}? Blocked if any project still uses it.`)) return;
    try { await setup.deleteFxRate(r.currency_code); reload(); }
    catch (e) { alert(e.message); }
  }

  const staleNgn = rates?.find(r => r.currency_code === "NGN");
  const { sorted, sortKey, sortDir, toggle } = useSort(rates, "currency_code");

  function doExport() {
    exportCsv("fx_rates.csv", sorted, [
      { key: "currency_code", label: "Currency Code" }, { key: "currency_name", label: "Currency Name" },
      { key: "rate_to_usd", label: "Rate to $" }, { key: "updated_at", label: "Last Updated" },
      { key: "updated_by", label: "Updated By" },
    ]);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div>
          <h2 className="t-title">FX Rates</h2>
          <p className="t-caption">
            One row per currency your projects use. <strong>USD is the reporting currency</strong> (rate
            fixed at 1) — every KAD/Client/Org total is converted through these rates so projects in
            different countries can be summed meaningfully. Add a currency here <strong>before</strong>{" "}
            creating a project in it.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={doExport}>Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Add currency</button>
        </div>
      </div>

      {staleNgn && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          NGN's rate drifts — it's currently <strong>{staleNgn.rate_to_usd}</strong> (1 NGN = that many USD),
          last updated {staleNgn.updated_at}. Confirm this is still close to the market rate before relying
          on converted totals, and update it below if not.
        </div>
      )}

      {adding && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Currency code <span>*</span></label>
              <input className="form-input" value={form.currency_code} maxLength={3}
                onChange={e => setForm(p => ({ ...p, currency_code: e.target.value.toUpperCase() }))}
                placeholder="e.g. GHS, KES, NGN" /></div>
            <div className="form-group"><label className="form-label">Currency name <span>*</span></label>
              <input className="form-input" value={form.currency_name}
                onChange={e => setForm(p => ({ ...p, currency_name: e.target.value }))}
                placeholder="e.g. Ghanaian Cedi" /></div>
          </div>
          <div className="form-group"><label className="form-label">Rate to $ (1 unit of this currency = how many USD) <span>*</span></label>
            <input className="form-input" type="number" step="any" value={form.rate_to_usd}
              onChange={e => setForm(p => ({ ...p, rate_to_usd: e.target.value }))} placeholder="e.g. 0.067" />
            <p className="t-caption" style={{ marginTop: 4 }}>Check a current rate before entering this — it isn't looked up automatically.</p>
          </div>
          {err && <div className="alert alert-danger">{err}</div>}
          <div className="flex gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Save"}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setAdding(false); setErr(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div className="loading-center"><span className="spinner" /></div>
        : <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <SortTh label="Code" sortKeyName="currency_code" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortTh label="Name" sortKeyName="currency_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortTh label="Rate to $" sortKeyName="rate_to_usd" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortTh label="Last updated" sortKeyName="updated_at" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <th></th>
                </tr></thead>
                <tbody>
                  {sorted?.map(r => (
                    <tr key={r.currency_code}>
                      <td><strong>{r.currency_code}</strong></td>
                      <td>{r.currency_name}</td>
                      <td className="t-mono">{r.rate_to_usd}</td>
                      <td className="t-caption">{r.updated_at}{r.updated_by ? ` · ${r.updated_by}` : ""}</td>
                      <td>{r.currency_code !== "USD" &&
                        <button className="btn btn-danger btn-sm" onClick={() => del(r)}>Remove</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}
    </div>
  );
}

function ProofsTab() {
  const { data: periods } = useAsync(() => setup.listPeriods());
  const [period, setPeriod] = useState("");
  const { data, loading } = useAsync(() => proofsApi.manifest(period || null), [period]);
  const [f, setF] = useState({ kad: "", client: "", project: "", person: "" });
  const [busy, setBusy] = useState(null);

  const all = data?.proofs || [];
  const uniq = (key) => [...new Set(all.map(r => r[key]).filter(Boolean))].sort();
  const rows = all.filter(r =>
    (!f.kad || r.kad_name === f.kad) && (!f.client || r.client_name === f.client) &&
    (!f.project || r.project_name === f.project) && (!f.person || r.employee === f.person));

  async function dl(r) {
    setBusy(r.submission_id);
    try { await downloadProof(r.allocation_id, r.submission_id); }
    catch (e) { alert("Download failed: " + e.message); }
    finally { setBusy(null); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3" style={{ flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 className="t-title">Attachments ({rows.length})</h2>
          <p className="t-caption">Every uploaded proof, matched to KAD · client · project · period · person. Files download self-named.</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadProofsCsv(period || null)}>Export manifest CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => downloadProofsZip(period || null)}>Download all (ZIP)</button>
        </div>
      </div>

      <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        <select className="input input-sm" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="">All periods</option>
          {(periods || []).map(p => <option key={p.id} value={p.id}>{p.period_label}</option>)}
        </select>
        {[["kad", "kad_name", "All KADs"], ["client", "client_name", "All clients"], ["project", "project_name", "All projects"], ["person", "employee", "All people"]].map(([fk, dk, label]) => (
          <select key={fk} className="input input-sm" value={f[fk]} onChange={e => setF(s => ({ ...s, [fk]: e.target.value }))}>
            <option value="">{label}</option>
            {uniq(dk).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        ))}
        {(f.kad || f.client || f.project || f.person) &&
          <button className="btn btn-ghost btn-sm" onClick={() => setF({ kad: "", client: "", project: "", person: "" })}>Clear</button>}
      </div>

      {loading ? <div className="loading-center"><span className="spinner" /></div>
        : rows.length === 0 ? <div className="empty"><p className="empty-title">No attachments</p><p className="empty-body">Proofs appear here once staff submit output with a file.</p></div>
        : <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>KAD</th><th>Client</th><th>Project</th><th>Period</th><th>Person</th><th>Metric</th><th>Date</th><th>File</th><th></th></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.submission_id}>
                      <td>{r.kad_name}</td>
                      <td>{r.client_name || "—"}</td>
                      <td>{r.project_name || "—"}</td>
                      <td>{r.period_label}</td>
                      <td><strong>{r.employee}</strong> <span className="t-caption">{r.staff_code}</span></td>
                      <td>{r.output_metric}</td>
                      <td>{r.date_of_activity}</td>
                      <td className="t-caption" title={r.proof_description}>{r.filename}</td>
                      <td><button className="btn btn-secondary btn-sm" disabled={busy === r.submission_id} onClick={() => dl(r)}>{busy === r.submission_id ? "…" : "Download"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}
    </div>
  );
}

// Admin-side org view: same OrgDashboard the Executive sees, with a period picker.
function AdminOrgTab() {
  const { data: periods } = useAsync(() => setup.listPeriods());
  const [period, setPeriod] = useState("");
  useEffect(() => {
    if (periods && periods.length && !period) {
      const open = periods.find(p => p.status === "Open") || periods.find(p => p.status !== "Closed") || periods[0];
      if (open) setPeriod(String(open.id));
    }
  }, [periods]);
  return (
    <div>
      <div className="form-group" style={{ maxWidth: 320 }}>
        <label className="form-label">Period</label>
        <select className="form-input" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="">All periods</option>
          {(periods || []).map(p => <option key={p.id} value={p.id}>{p.period_label} · {p.status}</option>)}
        </select>
      </div>
      <OrgDashboard selectedPeriod={period || null} />
    </div>
  );
}
