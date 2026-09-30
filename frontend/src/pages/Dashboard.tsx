import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, IconName } from "../components/Icon";
import { api } from "../services/api";
import { currentUser, daysAgo, localDate, ReportRow, Section, statuses, statusLabel } from "../services/display";

export default function Dashboard() {
  const [sections, setSections] = useState<Section[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const today = localDate();
  const user = currentUser();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    Promise.all([
      api<{sections: Section[]}>("/classes", { signal: controller.signal }),
      api<{rows: ReportRow[]}>(`/reports/attendance?from=${daysAgo(6)}&to=${localDate()}`, { signal: controller.signal })
    ]).then(([classes, report]) => { setSections(classes.sections); setRows(report.rows); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const todayRows = rows.filter(row => row.attendance_date.slice(0, 10) === today);
  const counts = statuses.map(status => todayRows.filter(row => row.status === status).length);
  const rate = todayRows.length ? Math.round((counts[0] + counts[2]) / todayRows.length * 100) : null;
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = daysAgo(6 - i);
    const daily = rows.filter(row => row.attendance_date.slice(0, 10) === date);
    return { date, counts: statuses.map(status => daily.filter(row => row.status === status).length), total: daily.length };
  });
  const max = Math.max(1, ...days.map(day => day.total));
  let end = 0;
  const colors = ["#256b52", "#e5a08b", "#e4be66", "#a8b9d4"];
  const ring = todayRows.length ? `conic-gradient(${counts.map((count, i) => { const start = end; end += count / todayRows.length * 100; return `${colors[i]} ${start}% ${end}%`; }).join(",")})` : "#edf0e9";
  const stats: { title: string; value: string | number; note: string; icon: IconName; tone: string }[] = [
    { title: "Student enrollments", value: sections.reduce((sum, section) => sum + section.student_count, 0), note: "Across all class sections", icon: "users", tone: "green" },
    { title: "Class sections", value: sections.length, note: "Your learning communities", icon: "book", tone: "purple" },
    { title: "Attendance today", value: rate === null ? "—" : `${rate}%`, note: "Present + late / recorded entries", icon: "attendance", tone: "gold" },
    { title: "Absent today", value: counts[1], note: "Recorded entries to follow up", icon: "clock", tone: "coral" }
  ];
  return <>
    <div className="page-header"><div><p className="eyebrow">YOUR CAMPUS, AT A GLANCE</p><h1>A good day starts here<span className="accent-dot">.</span></h1><p className="muted">Welcome back, {user.fullName?.split(" ")[0] || "there"}. Let's make every student count.</p></div><button className="secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}><Icon name="refresh" />{loading ? "Refreshing…" : "Refresh"}</button></div>
    {error && <p className="error" role="alert">Could not load the overview: {error}</p>}
    <section className="hero-banner"><div className="hero-copy"><span className="hero-kicker"><span className="live-dot" /> A LITTLE CARE, EVERY DAY</span><h2>Be present.<br />Make a difference.</h2><p>Your classrooms, your students, one thoughtful space.<br />Start with today's attendance.</p><Link className="button light-button" to="/attendance">Mark attendance <Icon name="arrow" /></Link></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="art-star">✳</span><div className="attendance-illustration"><div className="illustration-top"><span className="mini-brand">a.</span><span>DAILY CHECK-IN</span><Icon name="calendar" /></div><div className="illustration-title">A little presence.<br />A lot of potential.</div>{["A new day", "A chance to learn", "A step forward"].map((text, i) => <div className="illustration-row" key={text}><span className={`illustration-avatar avatar-${i}`} /><span>{text}</span><span className="illustration-check"><Icon name="check" width="13" /></span></div>)}<div className="illustration-bottom">Every student. Every day.<span>↗</span></div></div><div className="floating-note"><Icon name="check" /> Ready when you are</div></div></section>
    <section className="grid cards" aria-label="Campus statistics" aria-busy={loading}>{stats.map(stat => <article className="card stat" key={stat.title}><div className="stat-top"><span>{stat.title}</span><span className={`icon-tile ${stat.tone}`}><Icon name={stat.icon} /></span></div><strong>{loading || error ? "—" : stat.value}</strong><small>{stat.note}</small></article>)}</section>
    <div className="dashboard-charts"><section className="card trend-card"><div className="section-heading"><div><h2>The week in attendance</h2><p>Recorded entries over the last 7 days</p></div><span className="subtle-tag">LAST 7 DAYS</span></div><div className="chart-legend">{statuses.map((status, i) => <span key={status}><i style={{ background: colors[i] }} />{statusLabel(status)}</span>)}</div>{loading ? <div className="chart-placeholder" role="status">Loading attendance trends…</div> : error ? <div className="chart-placeholder">Attendance data is unavailable.</div> : <div className="bar-chart" aria-label="Daily attendance totals">{days.map(day => <div className="chart-column" key={day.date} aria-label={`${day.date}: ${statuses.map((s, i) => `${day.counts[i]} ${statusLabel(s)}`).join(", ")}`}><span className="bar-value">{day.total}</span><div className="bar-track"><div className="bar-stack" style={{ height: `${day.total / max * 100}%` }}>{day.counts.map((count, i) => <div key={i} style={{ height: `${day.total ? count / day.total * 100 : 0}%`, background: colors[i] }} />)}</div></div><span className={day.date === today ? "day-label today" : "day-label"}>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</span><small>{day.date.slice(8)}</small></div>)}</div>}<p className="chart-footnote">{!loading && !error && !rows.length ? "Your first saved attendance will bring this chart to life." : "Each entry represents one student in one section on a given day."}</p></section>
      <section className="card today-card"><div className="section-heading"><div><h2>Today's snapshot</h2><p>A closer look at your check-ins</p></div></div><div className="attendance-ring" style={{ background: loading || error ? "#edf0e9" : ring }} role="img" aria-label={`${todayRows.length} attendance entries today`}><div><strong>{loading || error ? "—" : todayRows.length}</strong><span>entries recorded</span></div></div><div className="status-breakdown">{statuses.map((status, i) => <div key={status}><span><i style={{ background: colors[i] }} />{statusLabel(status)}</span><strong>{loading || error ? "—" : counts[i]}</strong></div>)}</div></section></div>
    <section className="card"><div className="section-heading"><div><h2>Your classrooms</h2><p>Good things happen when everyone shows up.</p></div><Link className="text-link" to="/classes">View all classes <Icon name="arrow" width="16" /></Link></div>{loading ? <div className="empty-state">Loading your classrooms…</div> : error ? <div className="empty-state">Classroom data is unavailable. Use Refresh to try again.</div> : !sections.length ? <div className="empty-state"><span className="empty-icon"><Icon name="book" /></span><h3>Your first classroom starts here</h3><p>Add a class and students to begin taking attendance.</p><Link className="button secondary" to="/classes">Open classes <Icon name="arrow" /></Link></div> : <div className="class-preview-grid">{sections.slice(0, 3).map((section, i) => <Link className="class-preview" to={`/attendance?sectionId=${section.id}`} key={section.id}><span className={`icon-tile ${["green", "purple", "gold"][i]}`}><Icon name="book" /></span><h3>{section.class_name}</h3><p>Section {section.section_name} <span>•</span> {section.academic_year}</p><div><span><Icon name="users" width="16" />{section.student_count} students</span><Icon name="arrow" width="18" /></div></Link>)}</div>}</section>
  </>;
}

