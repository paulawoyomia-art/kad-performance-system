import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { auth as authApi } from "../api/client";

export default function FirstLoginSetup() {
  const { actor, completeSetup } = useAuth();
  const [newPw, setNewPw]       = useState("");
  const [confirm, setConfirm]   = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const pwMatch = newPw && confirm && newPw === confirm;
  const pwMismatch = confirm && newPw !== confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pwMatch) { setError("Passwords do not match"); return; }
    if (newPw.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (!recovery.trim()) { setError("Recovery answer is required"); return; }
    setError(""); setLoading(true);
    try {
      const res = await authApi.changePassword({ new_password: newPw, recovery_answer: recovery.trim() });
      completeSetup(res.token);
    } catch (err) {
      setError(err.message || "Setup failed — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--ink)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{
        width: "100%", maxWidth: "440px",
        background: "var(--card)",
        borderRadius: "16px",
        boxShadow: "0 20px 60px rgba(0,0,0,.35)",
        overflow: "hidden",
      }}>
        <div style={{
          background: "var(--orbit)",
          padding: "24px 28px",
        }}>
          <img
            src="/telinno-logo.png"
            alt="Telinno"
            style={{ height: 28, filter: "brightness(0) invert(1)", marginBottom: 12 }}
          />
          <h1 style={{ color: "#fff", fontSize: "1.143rem", fontWeight: 700 }}>
            Set up your account
          </h1>
          <p style={{ color: "rgba(255,255,255,.75)", fontSize: ".857rem", marginTop: 4 }}>
            Welcome, {actor?.full_name?.split(" ")[0]}. Choose a password and a recovery answer before continuing.
          </p>
        </div>

        <div style={{ padding: "24px 28px 28px" }}>
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            <span>Your recovery answer is used if you ever need to change a forgotten password. Choose something only you would know and remember it.</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">New password <span>*</span></label>
              <input
                className="form-input"
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm password <span>*</span></label>
              <input
                className="form-input"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                required
                style={pwMismatch ? { borderColor: "var(--danger)" } : pwMatch ? { borderColor: "var(--success)" } : {}}
              />
              {pwMismatch && <p className="form-error">Passwords do not match</p>}
              {pwMatch    && <p style={{ fontSize: ".786rem", color: "var(--success)", marginTop: 4 }}>✓ Passwords match</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Recovery answer <span>*</span></label>
              <input
                className="form-input"
                type="text"
                value={recovery}
                onChange={e => setRecovery(e.target.value)}
                placeholder="e.g. your mother's maiden name"
                required
                autoComplete="off"
              />
              <p className="form-hint">Case-insensitive — "Smith" and "smith" are treated the same.</p>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading || !pwMatch || !recovery.trim()}
            >
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</>
                : "Complete setup & continue"
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
