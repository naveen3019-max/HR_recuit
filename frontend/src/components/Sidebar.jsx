import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Candidates", to: "/candidates" },
  { label: "Pipeline", to: "/pipeline" }
];

const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div>
        <h1 className="brand">TalentPulse CRM</h1>
        <p className="muted">Recruitment Operations</p>
      </div>
      <nav>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `nav-link ${isActive ? "nav-link-active" : ""}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="user-panel">
        <p>{user?.name || "Recruiter"}</p>
        <p className="muted small">{user?.role || "recruiter"}</p>
        <button type="button" onClick={logout} className="btn btn-outline">
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
