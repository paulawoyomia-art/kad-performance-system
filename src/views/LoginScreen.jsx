import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [accountType, setAccountType] = useState("employee"); // "employee" | "admin"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // AuthContext → Router handles redirect
    } catch (err) {
      setError(err.message || "Invalid email or password");
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
      {/* Subtle orbit-ring decoration — nods to the logo */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {[400, 600, 820].map(size => (
          <div key={size} style={{
            position: "absolute",
            width: size, height: size * 0.4,
            border: "1px solid rgba(74,124,158,.12)",
            borderRadius: "50%",
            transform: "rotate(-25deg)",
          }} />
        ))}
      </div>

      <div style={{
        width: "100%", maxWidth: "420px",
        background: "var(--card)",
        borderRadius: "16px",
        boxShadow: "0 20px 60px rgba(0,0,0,.35)",
        overflow: "hidden",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Header */}
        <div style={{
          background: "var(--ink-90)",
          padding: "28px 28px 24px",
          borderBottom: "1px solid rgba(255,255,255,.07)",
        }}>
          <img
            src="/telinno-logo.png"
            alt="Telinno"
            style={{ height: 36, filter: "brightness(0) invert(1)", marginBottom: 14 }}
          />
          <h1 style={{ color: "#fff", fontSize: "1.286rem", fontWeight: 700, lineHeight: 1.2 }}>
            KAD Performance System
          </h1>
          <p style={{ color: "rgba(255,255,255,.45)", fontSize: ".857rem", marginTop: 4 }}>
            Sign in to continue
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px 28px" }}>
          {/* Account type toggle */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            background: "var(--surface)",
            borderRadius: "var(--radius)",
            padding: "3px",
            marginBottom: "20px",
          }}>
            {["employee", "admin"].map(type => (
              <button
                key={type}
                onClick={() => { setAccountType(type); setError(""); }}
                style={{
                  padding: "8px",
                  borderRadius: "calc(var(--radius) - 2px)",
                  fontSize: ".857rem",
                  fontWeight: 600,
                  transition: "all .15s",
                  background: accountType === type ? "var(--card)" : "transparent",
                  color: accountType === type ? "var(--orbit)" : "var(--text-secondary)",
                  boxShadow: accountType === type ? "var(--shadow-sm)" : "none",
                }}
              >
                {type === "employee" ? "Employee" : "Administrator"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">
                Work email <span>*</span>
              </label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={accountType === "admin" ? "admin@telinno-consulting.com" : "you@telinno-consulting.com"}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Password <span>*</span>
              </label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Signing in…</>
                : "Sign in"
              }
            </button>
          </form>

          <p style={{ fontSize: ".786rem", color: "var(--text-muted)", textAlign: "center", marginTop: 16 }}>
            {accountType === "employee"
              ? "First time? Use the default password shared by your HR team."
              : "Admin credentials are managed separately from employee accounts."
            }
          </p>
        </div>
      </div>
    </div>
  );
}
