import { useAuth } from "../auth/AuthContext";

const Icons = {
  home: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h0a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
    </svg>
  ),
  allocations: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
    </svg>
  ),
  team: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
    </svg>
  ),
  flags: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 7l2.55 2.4A1 1 0 0116 11H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd"/>
    </svg>
  ),
  setup: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
    </svg>
  ),
  periods: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
    </svg>
  ),
};

function RoleBadges({ roles, isAdmin }) {
  if (isAdmin) return (
    <div className="role-badges">
      <span className="role-badge role-badge--admin">Admin</span>
    </div>
  );
  if (!roles?.length) return null;
  const cls = { "KAD Director": "dir", "HRBP": "hrbp", "Line Manager": "lm" };
  return (
    <div className="role-badges">
      {[...new Set(roles.map(r => r.role_name))].map(name => (
        <span key={name} className={`role-badge role-badge--${cls[name] || "lm"}`}>{name}</span>
      ))}
    </div>
  );
}

export default function AppShell({ title, navItems = [], children, navExtras }) {
  const { actor, logout, isAdmin } = useAuth();
  const firstName = (actor?.full_name || "Account").split(" ")[0];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/telinno-logo.png" alt="Telinno" />
            <div>
              <div className="sidebar-logo-text">KAD Performance</div>
              <div className="sidebar-logo-sub">giving you the edge</div>
            </div>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-name">{actor?.full_name || "Administrator"}</div>
          <div className="sidebar-user-email">{actor?.email}</div>
          <RoleBadges roles={actor?.roles} isAdmin={isAdmin()} />
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.key}
              className={`nav-item ${item.active ? "active" : ""}`}
              onClick={item.onClick}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
          {navExtras}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={logout}>
            <span className="nav-icon">{Icons.logout}</span>
            Sign out
          </button>
        </div>
      </aside>

      <header className="mobile-topbar">
        <div className="mobile-topbar-logo">
          <img src="/telinno-logo.png" alt="Telinno" />
          <span>KAD Performance</span>
        </div>
        <button className="mobile-topbar-user" onClick={logout}>
          {firstName} · Sign out
        </button>
      </header>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
        </header>
        <div className="page-content">
          {children}
        </div>
      </div>

      <nav className="mobile-nav">
        {navItems.slice(0, 5).map(item => (
          <button key={item.key}
            className={`mobile-nav-item ${item.active ? "active" : ""}`}
            onClick={item.onClick}>
            {item.icon}
            {item.mobileLabel || item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export { Icons };
