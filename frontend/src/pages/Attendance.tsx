import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { api } from "../services/api";
import { currentUser, initials, localDate, Section, Status, statuses, statusLabel } from "../services/display";

type Student = { student_id: string; full_name: string; status: Status; note: string };
export default function Attendance() {
  const [params] = useSearchParams();
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(localDate());
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSections, setLoadingSections] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [retry, setRetry] = useState(0);
  const canMark = ["ADMIN", "TEACHER"].includes(currentUser().role || "");
  useEffect(() => {
    const controller = new AbortController();
    setLoadingSections(true);
    api<{sections: Section[]}>("/classes", { signal: controller.signal }).then(data => {
      setSections(data.sections);
      const requested = params.get("sectionId");
      setSectionId(data.sections.find(section => section.id === requested)?.id || data.sections[0]?.id || "");
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) { setLoadingSections(false); setLoading(false); } });
    return () => controller.abort();
  }, [params]);
  useEffect(() => {
    if (!sectionId || !date) { setStudents([]); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setMessage(""); setStudents([]); setDirty(false);
    api<{students: Student[]}>(`/attendance/roll-call?sectionId=${sectionId}&date=${date}`, { signal: controller.signal })
      .then(data => setStudents(data.students))
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [sectionId, date, retry]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function changeContext(action: () => void) {
    if (dirty && !window.confirm("You have unsaved attendance changes. Discard them and continue?")) return;
    setDirty(false); setMessage(""); setStudents([]); action();
  }
  function update(studentId: string, change: Partial<Student>) {
    setStudents(current => current.map(student => student.student_id === studentId ? { ...student, ...change } : student));
    setDirty(true); setMessage("");
  }
  async function save() {
    if (saving || !students.length) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await api("/attendance/bulk", { method: "POST", body: JSON.stringify({
        sectionId, date, records: students.map(student => ({ studentId: student.student_id, status: student.status, note: student.note }))
      }) });
      setDirty(false); setMessage("Attendance saved. You're all set.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save attendance. Please try again."); }
    finally { setSaving(false); }
  }
  const filtered = students.filter(student => student.full_name.toLowerCase().includes(search.toLowerCase()));
  const selected = sections.find(section => section.id === sectionId);
  return <>
    <div className="page-header"><div><p className="eyebrow">A MOMENT FOR EVERY STUDENT</p><h1>Daily attendance<span className="accent-dot">.</span></h1><p className="muted">A quick check-in. A clear picture of your classroom.</p></div><span className="page-chip"><Icon name="calendar" />{new Date(`${date || localDate()}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</span></div>
    <div className="card toolbar filter-panel">
      <label>Class & section<select value={sectionId} disabled={saving || loadingSections} onChange={event => changeContext(() => setSectionId(event.target.value))}><option value="" disabled>Select a class</option>{sections.map(section => <option value={section.id} key={section.id}>{section.class_name} / {section.section_name} · {section.academic_year}</option>)}</select></label>
      <label>Attendance date<input type="date" value={date} max={localDate()} disabled={saving} onChange={event => changeContext(() => setDate(event.target.value))} /></label>
      {canMark && <button onClick={save} disabled={saving || loading || !students.length || !date}><Icon name="check" />{saving ? "Saving…" : "Save attendance"}</button>}
    </div>
    {error && <div className="error" role="alert">{error} {!dirty && <button className="text-button" onClick={() => setRetry(value => value + 1)}>Retry roster</button>}</div>}
    {message && <p className="success" role="status"><Icon name="check" />{message}</p>}
    <div className="attendance-summary">{statuses.map(status => <div className={`summary-item ${status.toLowerCase()}`} key={status}><span className="status-dot" /><span>{statusLabel(status)}</span><strong>{students.filter(student => student.status === status).length}</strong></div>)}</div>
    <section className="card roster-card attendance-roster" aria-busy={loading}>
      <div className="section-heading"><div><h2>{selected ? selected.class_name + " / " + selected.section_name : "Class roster"} <span className="count-pill">{students.length}</span></h2><p>{dirty ? "You have unsaved changes." : "Review each status, then save your attendance."}</p></div><div className="roster-actions"><label className="search-field"><Icon name="search" /><input aria-label="Search students" placeholder="Find a student…" value={search} onChange={event => setSearch(event.target.value)} /></label>{canMark && <button className="secondary small-button" disabled={loading || saving || !students.length} onClick={() => { setStudents(current => current.map(student => ({ ...student, status: "PRESENT" }))); setDirty(true); setMessage(""); }}>All present</button>}</div></div>
      <div className="table-wrap"><table><thead><tr><th>Student</th><th>Attendance status</th><th>Note <span className="muted">(optional)</span></th></tr></thead><tbody>
        {!loading && filtered.map((student, index) => <tr key={student.student_id}><td><div className="student-cell"><span className={`avatar avatar-tone-${index % 4}`}>{initials(student.full_name)}</span><div><strong>{student.full_name}</strong><small>Student · {student.student_id.slice(0, 8)}</small></div></div></td><td><div className="status-controls" role="group" aria-label={`Attendance for ${student.full_name}`}>{statuses.map(status => <button key={status} className={`status-option ${student.status === status ? "selected " + status.toLowerCase() : ""}`} aria-pressed={student.status === status} disabled={saving || !canMark} onClick={() => update(student.student_id, { status })}>{student.status === status && <Icon name="check" width="13" />}{statusLabel(status)}</button>)}</div></td><td><input className="note-input" aria-label={`Note for ${student.full_name}`} placeholder="Add a short note…" maxLength={500} value={student.note || ""} disabled={saving || !canMark} onChange={event => update(student.student_id, { note: event.target.value })} /></td></tr>)}
        {loading && <tr><td colSpan={3} className="empty-state" role="status">Loading your students…</td></tr>}
        {!loading && !filtered.length && <tr><td colSpan={3}><div className="empty-state"><span className="empty-icon"><Icon name="users" /></span><h3>{search ? "No students match your search" : "Your roster is waiting"}</h3><p>{search ? "Try a different name." : "Choose a class with enrolled students to get started."}</p>{!search && <Link className="text-link" to="/classes">Manage classes & students <Icon name="arrow" /></Link>}</div></td></tr>}
      </tbody></table></div>
      <div className="table-footer"><span>{filtered.length} of {students.length} students</span><span>{dirty ? "● Unsaved changes" : "New entries default to Present. Review before saving."}</span></div>
    </section>
  </>;
}

