import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { api } from "../services/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(""); setLoading(true);
    try {
      const data = await api<{token: string; user: unknown}>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem("attendance_token", data.token);
      localStorage.setItem("attendance_user", JSON.stringify(data.user));
      navigate("/");
    } catch (error) { setError(error instanceof Error ? error.message : "Login failed"); }
    finally { setLoading(false); }
  }
  return <main className="login-page"><section className="login-story"><div className="brand"><span className="brand-mark"><Icon name="attendance" /></span><span>Attend<span className="brand-light">Pro</span><small>EVERY STUDENT COUNTS</small></span></div><div className="login-story-copy"><p className="hero-kicker">LESS PAPERWORK. MORE POSSIBILITY.</p><h1>Every day.<br />Every student.<br /><em>Every possibility.</em></h1><p>A thoughtful space to manage your classrooms,<br />stay on top of attendance, and see the bigger picture.</p><div className="login-feature-list"><span><Icon name="check" /> Simple daily attendance</span><span><Icon name="check" /> All your classrooms, connected</span><span><Icon name="check" /> Clear reports, ready to share</span></div></div><div className="login-story-footer"><span>Built around your classroom.</span><Icon name="spark" width="40" height="40" /></div><div className="login-orbit" aria-hidden="true" /></section><section className="login-form-panel"><div className="login-form-wrap"><span className="icon-tile green login-icon"><Icon name="book" width="25" height="25" /></span><p className="eyebrow">YOUR WORKSPACE IS WAITING</p><h2>Welcome back.</h2><p className="muted">Sign in and start making a difference.</p><form className="login-card" onSubmit={submit}><label>Email address<input type="email" autoComplete="username" placeholder="you@school.edu" value={email} onChange={event => setEmail(event.target.value)} required disabled={loading} /></label><label>Password<span className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} required disabled={loading} /><button type="button" className="password-toggle" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? "Hide" : "Show"}</button></span></label>{error && <p className="error" role="alert">{error}</p>}<button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in to your workspace"}<Icon name="arrow" /></button></form><p className="login-help"><Icon name="shield" width="16" /> Need access? Contact your school administrator.</p></div><p className="login-copyright">AttendPro · A little attention goes a long way.</p></section></main>;
}

