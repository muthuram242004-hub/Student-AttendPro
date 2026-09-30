import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { initials, Section } from "../services/display";
import { Icon } from "./Icon";
import { ConfirmDelete } from "./ConfirmDelete";

type Student = {
  id: string; full_name: string; email: string | null; section_id: string | null;
  class_name: string | null; section_name: string | null; academic_year: string | null;
};

export function StudentDirectory({ sections, revision, onSaved }: { sections: Section[]; revision: number; onSaved: () => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", sectionId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const editor = useRef<HTMLFormElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function deleteStudent() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true); setDeleteError("");
    try {
      await api(`/students/${deleting.id}`, { method: "DELETE" });
      setStudents(current => current.filter(student => student.id !== deleting.id));
      if (editing?.id === deleting.id) setEditing(null);
      setSuccess(`${deleting.full_name} was removed. Past attendance has been preserved.`);
      setDeleting(null); onSaved();
    } catch (error) { setDeleteError(error instanceof Error ? error.message : "Could not delete student."); }
    finally { setDeleteBusy(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api<{ students: Student[] }>("/students", { signal: controller.signal })
      .then(data => setStudents(data.students))
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, refresh]);

  useEffect(() => {
    if (editing) {
      editor.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      nameInput.current?.focus({ preventScroll: true });
    }
  }, [editing]);

  function edit(student: Student) {
    setEditing(student);
    setForm({ fullName: student.full_name, email: student.email || "", sectionId: student.section_id || "" });
    setFormError(""); setSuccess("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true); setFormError(""); setSuccess("");
    try {
      const { student } = await api<{ student: { id: string; full_name: string; email: string } }>(`/students/${editing.id}`, {
        method: "PATCH", body: JSON.stringify({ ...form, previousSectionId: editing.section_id })
      });
      const section = sections.find(section => section.id === form.sectionId)!;
      setStudents(current => current.map(row => row.id !== student.id ? row : {
        ...row, full_name: student.full_name, email: student.email,
        ...(row.section_id === editing.section_id ? {
          section_id: section.id, class_name: section.class_name,
          section_name: section.section_name, academic_year: section.academic_year
        } : {})
      }));
      setEditing(null);
      setSuccess(`${student.full_name}'s details were updated.`);
      onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not update the student. Please try again.");
    } finally { setSaving(false); }
  }

  const visible = students.filter(student =>
    (!filter || student.section_id === filter) &&
    `${student.full_name} ${student.email || ""}`.toLowerCase().includes(search.toLowerCase())
  );
  return <section className="student-directory" aria-label="Student directory">
    {deleting && <ConfirmDelete title={`Delete ${deleting.full_name}?`} message="Remove this student from active student lists and all current enrollments? Past attendance records will be kept." label="Delete student" busy={deleteBusy} error={deleteError} onConfirm={deleteStudent} onCancel={() => setDeleting(null)} />}
    {success && <p className="success" role="status"><Icon name="check" />{success}</p>}
    {editing && <form ref={editor} className="card student-form" onSubmit={save} aria-labelledby="edit-student-title">
      <h2 id="edit-student-title">Edit Student</h2>
      <p className="muted">Update their details or move this enrollment to another section. Previous attendance records stay with their original class.</p>
      {formError && <p className="error" role="alert">{formError}</p>}
      <fieldset disabled={saving}>
        <div className="grid student-fields">
          <label>Full name<input ref={nameInput} required maxLength={120} autoComplete="off" value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} /></label>
          <label>Email address<input type="email" required maxLength={255} autoComplete="off" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
          <label>Class / Section<select required value={form.sectionId} onChange={event => setForm({ ...form, sectionId: event.target.value })}>
            <option value="">Select class and section</option>
            {sections.map(section => <option key={section.id} value={section.id}>{section.class_name} / {section.section_name} ({section.academic_year})</option>)}
          </select></label>
        </div>
        <div className="toolbar student-actions"><button type="submit" disabled={saving || !sections.length}>{saving ? "Saving..." : "Save changes"}</button><button type="button" className="secondary" onClick={() => { setEditing(null); setFormError(""); }}>Cancel</button></div>
      </fieldset>
    </form>}
    <div className="card roster-card" aria-busy={loading}>
      <div className="section-heading"><div><h2>Student directory <span className="count-pill">{visible.length}</span></h2><p>Find a student and keep their details up to date.</p></div><button className="secondary small-button" disabled={loading || saving} onClick={() => { setEditing(null); setRefresh(value => value + 1); }}><Icon name="refresh" width="15" />Refresh students</button></div>
      <div className="directory-filters"><label className="search-field"><Icon name="search" /><input aria-label="Search student directory" placeholder="Search name or email..." value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="Filter student directory by section" value={filter} onChange={event => setFilter(event.target.value)}><option value="">All sections</option>{sections.map(section => <option key={section.id} value={section.id}>{section.class_name} / {section.section_name} ({section.academic_year})</option>)}</select></div>
      {error && <p className="error" role="alert">Could not load students: {error}</p>}
      <div className="table-wrap"><table><thead><tr><th>Student</th><th>Email</th><th>Class / Section</th><th>Action</th></tr></thead><tbody>
        {!loading && !error && visible.map((student, index) => <tr key={`${student.id}-${student.section_id}`}><td><div className="student-cell"><span className={`avatar avatar-tone-${index % 4}`}>{initials(student.full_name)}</span><strong>{student.full_name}</strong></div></td><td>{student.email || "Not provided"}</td><td>{student.class_name ? <><strong>{student.class_name} / {student.section_name}</strong><small className="cell-subtitle">{student.academic_year}</small></> : "Not enrolled"}</td><td><div className="record-actions"><button className="secondary small-button" disabled={saving || deleteBusy} aria-label={`Edit ${student.full_name}${student.section_name ? ` in section ${student.section_name}` : ""}`} onClick={() => edit(student)}>Edit Student</button><button className="danger-outline small-button" disabled={saving || deleteBusy} aria-label={`Delete ${student.full_name}`} onClick={() => { setDeleting(student); setDeleteError(""); }}>Delete Student</button></div></td></tr>)}
        {loading && <tr><td colSpan={4} className="empty-state" role="status">Loading students...</td></tr>}
        {!loading && !error && !visible.length && <tr><td colSpan={4} className="empty-state">{students.length ? "No students match these filters." : "Add your first student to see their details here."}</td></tr>}
      </tbody></table></div>
      <div className="table-footer"><span>{visible.length} enrollment records</span><span>Students in multiple sections appear once per section.</span></div>
    </div>
  </section>;
}
