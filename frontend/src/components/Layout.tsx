import { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Icon, IconName } from "./Icon";
import { currentUser, initials } from "../services/display";

const navigation: { path: string; label: string; icon: IconName }[] = [
  { path: "/", label: "Overview", icon: "grid" },
  { path: "/classes", label: "Classes & students", icon: "book" },
  { path: "/attendance", label: "Attendance", icon: "attendance" },
  { path: "/reports", label: "Reports & insights", icon: "chart" }
];
export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = currentUser();
  function logout() {
    localStorage.removeItem("attendance_token");
    localStorage.removeItem("attendance_user");
    navigate("/login");
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">
      <Link to="/" className="brand"><span className="brand-mark"><Icon name="attendance" /></span><span>Attend<span className="brand-light">Pro</span><small>EVERY STUDENT COUNTS</small></span></Link>
      <div className="workspace-label"><span className="workspace-icon"><Icon name="book" /></span><div>Campus workspace<small>Attendance management</small></div></div>
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="Main navigation">{navigation.map(item => <NavLink key={item.path} to={item.path} end={item.path === "/"} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}><Icon name={item.icon} /><span>{item.label}</span><span className="nav-active-dot" /></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-icon"><Icon name="spark" /></span><strong>Small check-ins.<br />Big possibilities.</strong><p>A little attention today helps every student move forward.</p><Link to="/attendance">Take attendance <Icon name="arrow" width="16" /></Link></div>
        <button className="logout-button" onClick={logout}><Icon name="logout" /> Sign out</button>
        <div className="sidebar-footer">AttendPro <span>Made for your classroom</span></div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{navigation.find(item => item.path === location.pathname)?.label || "Overview"}</strong></div><div className="topbar-right"><span className="topbar-date"><Icon name="calendar" width="16" />{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span><div className="user-profile"><span className="avatar">{initials(user.fullName || "User")}</span><div><strong>{user.fullName || "User"}</strong><small>{user.role ? user.role[0] + user.role.slice(1).toLowerCase() : "Workspace member"}</small></div></div></div></header>
      <main className="content" id="main-content">{children}<footer className="page-footer"><span>Thoughtful attendance. Better learning.</span><span>AttendPro / Campus workspace</span></footer></main>
    </div>
  </div>;
}

