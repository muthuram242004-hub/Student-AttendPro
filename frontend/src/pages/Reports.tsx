import { FormEvent, useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { api } from "../services/api";
import { daysAgo, initials, localDate, ReportRow, Section, statuses, statusLabel } from "../services/display";

export default function Reports() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(localDate());
  const [sectionId, setSectionId] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [applied, setApplied] = useState({ from: daysAgo(29), to: localDate(), sectionId: "" });
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sectionError, setSectionError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<{sections: Section[]}>("/classes", { signal: controller.signal }).then(data => setSections(data.sections))
      .catch(error => { if (!controller.signal.aborted) setSectionError(error.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setRows([]);
    const query = new URLSearchParams({ from: applied.from, to: applied.to });
    if (applied.sectionId) query.set("sectionId", applied.sectionId);
    api<{rows: ReportRow[]}>(`/reports/attendance?${query}`, { signal: controller.signal })
      .then(data => setRows(data.rows))
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [applied]);
  function run(event: FormEvent) {
    event.preventDefault();
    if (!from || !to || from > to) { setError("Choose a valid date range. The end date must be on or after the start date."); return; }
    setApplied({ from, to, sectionId });
  }
  const filtered = rows.filter(row => (!status || row.status === status) && row.student_name.toLowerCase().includes(search.toLowerCase()));
  const present = rows.filter(row => row.status === "PRESENT" || row.status === "LATE").length;
  const unapplied = from !== applied.from || to !== applied.to || sectionId !== applied.sectionId;
  function exportCsv() {
    const escape = (value: string) => {
      const safe = /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    const csv = ["date,student,class,section,status,note", ...filtered.map(row => [
      row.attendance_date.slice(0, 10), row.student_name, row.class_name, row.section_name, row.status, row.note || ""
    ].map(escape).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `attendance-${applied.from}-to-${applied.to}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    <div className="page-header"><div><p className="eyebrow">TURN CHECK-INS INTO INSIGHT</p><h1>The bigger picture<span className="accent-dot">.</span></h1><p className="muted">Explore attendance patterns and take your records with you.</p></div><button className="secondary" onClick={exportCsv} disabled={loading || !filtered.length || unapplied}><Icon name="download" />Export CSV</button></div>
    <form className="card toolbar filter-panel" onSubmit={run}><label>From date<input required type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} /></label><label>To date<input required type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label><label>Class & section<select value={sectionId} onChange={event => setSectionId(event.target.value)}><option value="">All classes</option>{sections.map(section => <option key={section.id} value={section.id}>{section.class_name} / {section.section_name} · {section.academic_year}</option>)}</select></label><button type="submit" disabled={loading}><Icon name="chart" />{loading ? "Loading…" : "Apply filters"}</button></form>
    {error && <p className="error" role="alert">{error}</p>}
    {sectionError && <p className="error" role="alert">Class filters could not load: {sectionError}</p>}
    {unapplied && <p className="info-message" role="status">Apply your new filters to update the report.</p>}
    <div className="report-stats"><div><span className="icon-tile green"><Icon name="attendance" /></span><div><small>Recorded entries</small><strong>{loading ? "—" : rows.length}</strong></div></div><div><span className="icon-tile gold"><Icon name="chart" /></span><div><small>Present + late rate</small><strong>{loading || !rows.length ? "—" : Math.round(present / rows.length * 100) + "%"}</strong></div></div><div><span className="icon-tile coral"><Icon name="clock" /></span><div><small>Absent entries</small><strong>{loading ? "—" : rows.filter(row => row.status === "ABSENT").length}</strong></div></div></div>
    <section className="card roster-card" aria-busy={loading}><div className="section-heading"><div><h2>Attendance records <span className="count-pill">{filtered.length}</span></h2><p>{applied.from} — {applied.to} · {applied.sectionId ? "Selected class section" : "All class sections"}</p></div><div className="roster-actions"><label className="search-field"><Icon name="search" /><input aria-label="Search report by student" placeholder="Find a student…" value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="Filter by attendance status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map(item => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></div></div>
    <div className="table-wrap"><table><thead><tr><th>Student</th><th>Date</th><th>Class / section</th><th>Status</th><th>Note</th></tr></thead><tbody>{!loading && filtered.map((row, index) => <tr key={index}><td><div className="student-cell"><span className={`avatar avatar-tone-${index % 4}`}>{initials(row.student_name)}</span><strong>{row.student_name}</strong></div></td><td className="date-cell">{row.attendance_date.slice(0, 10)}</td><td><strong>{row.class_name}</strong><small className="cell-subtitle">Section {row.section_name}</small></td><td><span className={`status-badge ${row.status.toLowerCase()}`}><span className="status-dot" />{statusLabel(row.status)}</span></td><td className="report-note">{row.note || "—"}</td></tr>)}{loading && <tr><td colSpan={5} className="empty-state" role="status">Gathering your attendance records…</td></tr>}{!loading && !filtered.length && <tr><td colSpan={5}><div className="empty-state"><span className="empty-icon"><Icon name="chart" /></span><h3>{error ? "We couldn't load this report" : "No records in this view"}</h3><p>{error ? "Try applying the filters again." : "Try a different date range or save attendance to see it here."}</p></div></td></tr>}</tbody></table></div><div className="table-footer"><span>Showing {filtered.length} of {rows.length} entries</span><span>CSV exports the records shown in this table.</span></div></section>
  </>;
}

