import { FormEvent, useEffect, useState } from "react";
import { api } from "../services/api";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { StudentDirectory } from "../components/StudentDirectory";
import { ConfirmDelete } from "../components/ConfirmDelete";

type Section = {
  id: string; class_id: string; class_name: string; academic_year: string;
  section_name: string; student_count: number;
};

export default function Classes() {
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", sectionId: "" });
  const [showClassForm, setShowClassForm] = useState(false);
  const [savingClass, setSavingClass] = useState(false);
  const [classError, setClassError] = useState("");
  const [classForm, setClassForm] = useState({ className: "", academicYear: "", sectionName: "" });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [studentRevision, setStudentRevision] = useState(0);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [sectionClassId, setSectionClassId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [savingSection, setSavingSection] = useState(false);
  const [sectionError, setSectionError] = useState("");
  const [deleting, setDeleting] = useState<{ section: Section; kind: "class" | "section" } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function deleteClassOrSection() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true); setDeleteError("");
    try {
      const { section, kind } = deleting;
      await api(kind === "class" ? `/classes/${section.class_id}` : `/classes/sections/${section.id}`, { method: "DELETE" });
      setSections(current => current.filter(row => kind === "class" ? row.class_id !== section.class_id : row.id !== section.id));
      setForm(current => ({ ...current, sectionId: "" }));
      setSectionClassId("");
      setSuccess(kind === "class" ? `${section.class_name} and its sections were deleted.` : `Section ${section.section_name} was deleted.`);
      setDeleting(null); setStudentRevision(value => value + 1);
    } catch (error) { setDeleteError(error instanceof Error ? error.message : "Could not delete. Please try again."); }
    finally { setDeleteBusy(false); }
  }

  async function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingSection) return;
    const selected = sections.find(section => section.id === sectionClassId);
    if (!selected || !sectionName.trim()) { setSectionError("Choose a class and enter a section name."); return; }
    setSavingSection(true); setSectionError(""); setSuccess("");
    try {
      const { section } = await api<{ section: { id: string } }>("/classes", {
        method: "POST", body: JSON.stringify({ className: selected.class_name, academicYear: selected.academic_year, sectionName: sectionName.trim() })
      });
      setSections(current => [...current, { ...selected, id: section.id, section_name: sectionName.trim(), student_count: 0 }]
        .sort((a, b) => a.class_name.localeCompare(b.class_name) || a.section_name.localeCompare(b.section_name)));
      setSuccess(`Section ${sectionName.trim()} was added to ${selected.class_name}.`);
      setShowSectionForm(false); setSectionClassId(""); setSectionName("");
    } catch (error) { setSectionError(error instanceof Error ? error.message : "Could not add section."); }
    finally { setSavingSection(false); }
  }

  function refreshClassCounts() {
    api<{ sections: Section[] }>("/classes").then(data => { setSections(data.sections); setError(""); })
      .catch(error => setError(`Change saved, but class counts could not refresh: ${error.message}`));
  }

  useEffect(() => {
    api<{sections: Section[]}>("/classes").then(d => setSections(d.sections)).catch(e => setError(e.message)).finally(() => setLoading(false));
    api<{user: {role: string}}>("/auth/me").then(d => setIsAdmin(d.user.role === "ADMIN")).catch(e => setError(e.message));
  }, []);

  async function addClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingClass) return;
    const details = {
      className: classForm.className.trim(),
      academicYear: classForm.academicYear.trim(),
      sectionName: classForm.sectionName.trim()
    };
    setClassError("");
    setSuccess("");
    if (!details.className || details.academicYear.length < 4 || !details.sectionName) {
      setClassError("Enter a class name, academic year (at least 4 characters), and section name.");
      return;
    }
    setSavingClass(true);
    try {
      const { section } = await api<{section: {id: string; class_id: string}}>("/classes", {
        method: "POST", body: JSON.stringify(details)
      });
      setSections(current => [...current, {
        id: section.id, class_id: section.class_id, class_name: details.className, academic_year: details.academicYear,
        section_name: details.sectionName, student_count: 0
      }].sort((a, b) => a.class_name.localeCompare(b.class_name) || a.section_name.localeCompare(b.section_name)));
      setSuccess(`${details.className} / ${details.sectionName} (${details.academicYear}) was added successfully.`);
      setClassForm({ className: "", academicYear: "", sectionName: "" });
      setShowClassForm(false);
    } catch (error) {
      setClassError(error instanceof Error ? error.message : "Could not add class. Please try again.");
    } finally {
      setSavingClass(false);
    }
  }

  async function addStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    setSuccess("");
    try {
      const { student } = await api<{student: {full_name: string}}>("/students", {
        method: "POST", body: JSON.stringify(form)
      });
      setSections(current => current.map(section => section.id === form.sectionId
        ? { ...section, student_count: section.student_count + 1 } : section));
      setSuccess(`${student.full_name} was added and enrolled successfully.`);
      setForm({ fullName: "", email: "", sectionId: "" });
      setShowForm(false);
      setStudentRevision(value => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not add student. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = sections.filter(section => `${section.class_name} ${section.section_name} ${section.academic_year}`.toLowerCase().includes(search.toLowerCase()));
  const classChoices = sections.filter((section, index) => sections.findIndex(other => other.class_name === section.class_name && other.academic_year === section.academic_year) === index);

  return (
    <>
      {deleting && <ConfirmDelete title={deleting.kind === "class" ? `Delete ${deleting.section.class_name}?` : `Delete section ${deleting.section.section_name}?`} message={deleting.kind === "class" ? `Delete this class for ${deleting.section.academic_year} and all its sections? Classes with enrollment or attendance history cannot be deleted.` : "Delete this section? Sections with enrollment or attendance history cannot be deleted. If this is the last section, its empty class will also be removed."} label={deleting.kind === "class" ? "Delete class" : "Delete section"} busy={deleteBusy} error={deleteError} onConfirm={deleteClassOrSection} onCancel={() => setDeleting(null)} />}
      <div className="page-header"><div><p className="eyebrow">ROOM TO LEARN, SPACE TO GROW</p><h1>Your learning community<span className="accent-dot">.</span></h1><p className="muted">Organize your classes. Welcome your students. Make it yours.</p></div>
        {isAdmin && <div className="page-actions">
          {!showClassForm && <button className="secondary" onClick={() => { setShowClassForm(true); setClassError(""); setSuccess(""); }}><Icon name="plus" />Add Class</button>}
          {!showSectionForm && <button className="secondary" onClick={() => { setShowSectionForm(true); setSectionError(""); setSuccess(""); }}><Icon name="plus" />Add Section</button>}
          {!showForm && <button onClick={() => { setShowForm(true); setFormError(""); setSuccess(""); }}><Icon name="plus" />Add Student</button>}
        </div>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">{success}</p>}
      {isAdmin && showClassForm && <form className="card student-form" onSubmit={addClass} aria-labelledby="add-class-title">
        <h2 id="add-class-title"><span className="form-step">01</span> Create class & first section</h2>
        <p className="muted">Enter a class, academic year, and its first section. Use Add Section to create more sections in an existing class.</p>
        {classError && <p className="error" role="alert">{classError}</p>}
        <fieldset disabled={savingClass}>
          <div className="grid student-fields">
            <label>Class name<input autoFocus required maxLength={100} placeholder="e.g. B.E CSE" value={classForm.className} onChange={e => setClassForm({ ...classForm, className: e.target.value })} /></label>
            <label>Academic year<input required minLength={4} maxLength={20} placeholder="e.g. 2026-27" value={classForm.academicYear} onChange={e => setClassForm({ ...classForm, academicYear: e.target.value })} /></label>
            <label>Section name<input required maxLength={50} placeholder="e.g. A" value={classForm.sectionName} onChange={e => setClassForm({ ...classForm, sectionName: e.target.value })} /></label>
          </div>
          <div className="toolbar student-actions">
            <button type="submit" disabled={savingClass}>{savingClass ? "Saving..." : "Save Class"}</button>
            <button type="button" className="secondary" onClick={() => { setShowClassForm(false); setClassError(""); setClassForm({ className: "", academicYear: "", sectionName: "" }); }}>Cancel</button>
          </div>
        </fieldset>
      </form>}
      {isAdmin && showSectionForm && <form className="card student-form" onSubmit={addSection} aria-labelledby="add-section-title">
        <h2 id="add-section-title">Add Section</h2>
        <p className="muted">Choose an existing class and give its new section a name.</p>
        {sectionError && <p className="error" role="alert">{sectionError}</p>}
        {!classChoices.length && <p className="info-message">Create your first class with Add Class before adding more sections.</p>}
        <fieldset disabled={savingSection}><div className="grid student-fields">
          <label>Existing class<select required value={sectionClassId} onChange={event => setSectionClassId(event.target.value)}><option value="">Select a class</option>{classChoices.map(section => <option key={section.id} value={section.id}>{section.class_name} ({section.academic_year})</option>)}</select></label>
          <label>New section name<input required maxLength={50} placeholder="e.g. B" value={sectionName} onChange={event => setSectionName(event.target.value)} /></label>
        </div><div className="toolbar student-actions"><button disabled={savingSection || !classChoices.length} type="submit">{savingSection ? "Saving..." : "Save Section"}</button><button type="button" className="secondary" onClick={() => { setShowSectionForm(false); setSectionError(""); setSectionClassId(""); setSectionName(""); }}>Cancel</button></div></fieldset>
      </form>}
      {isAdmin && showForm && <form className="card student-form" onSubmit={addStudent} aria-labelledby="add-student-title">
        <h2 id="add-student-title"><span className="form-step">02</span> Welcome a new student</h2>
        <p className="muted">Enter the student's name and email, then choose their class and section.</p>
        {formError && <p className="error" role="alert">{formError}</p>}
        {!sections.length && <p className="muted">Use Add Class above to create a class and section before adding a student.</p>}
        <fieldset disabled={saving}>
          <div className="grid student-fields">
            <label>Full name<input autoFocus required maxLength={120} autoComplete="off" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></label>
            <label>Email address<input type="email" required maxLength={255} autoComplete="off" placeholder="student@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
            <label>Class / Section<select required value={form.sectionId} onChange={e => setForm({ ...form, sectionId: e.target.value })}>
              <option value="">Select class and section</option>
              {sections.map(section => <option key={section.id} value={section.id}>{section.class_name} / {section.section_name} ({section.academic_year})</option>)}
            </select></label>
          </div>
          <div className="toolbar student-actions">
            <button type="submit" disabled={saving || !sections.length}>{saving ? "Saving..." : "Save Student"}</button>
            <button type="button" className="secondary" onClick={() => { setShowForm(false); setFormError(""); setForm({ fullName: "", email: "", sectionId: "" }); }}>Cancel</button>
          </div>
        </fieldset>
      </form>}
      <div className="community-banner"><span className="icon-tile green"><Icon name="book" /></span><div><strong>{loading ? "Loading your community…" : `${sections.length} class sections. Countless possibilities.`}</strong><p>{sections.reduce((total, section) => total + section.student_count, 0)} student enrollments across your workspace.</p></div><Icon name="spark" className="community-spark" width="40" height="40" /></div>
      <div className="section-heading class-list-heading"><div><h2>All classrooms <span className="count-pill">{sections.length}</span></h2><p>Choose a classroom to start your daily roll call.</p></div><label className="search-field"><Icon name="search" /><input aria-label="Search classes" placeholder="Search classes or sections…" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
      {loading ? <div className="card empty-state" role="status">Loading your classrooms…</div> : !filtered.length ? <div className="card empty-state"><span className="empty-icon"><Icon name="book" /></span><h3>{search ? "No classrooms found" : "Build your first classroom"}</h3><p>{search ? "Try another class name, section, or academic year." : "Start with Add Class, then add students to bring your classroom together."}</p></div> : <div className="class-grid">{filtered.map((section, index) => <article className="card classroom-card" key={section.id}><div className="classroom-top"><span className={`icon-tile ${["green", "purple", "gold", "coral"][index % 4]}`}><Icon name="book" /></span><span className="subtle-tag">{section.academic_year}</span></div><h2>{section.class_name}</h2><p>Section {section.section_name}</p><div className="classroom-count"><Icon name="users" /><strong>{section.student_count}</strong><span>students enrolled</span></div><div className="classroom-footer"><Link to={`/attendance?sectionId=${section.id}`} className="text-link">Take attendance <Icon name="arrow" width="16" /></Link>{isAdmin && <button className="icon-button" aria-label={`Add student to ${section.class_name} section ${section.section_name}`} onClick={() => { setForm(current => ({ ...current, sectionId: section.id })); setShowForm(true); setFormError(""); setSuccess(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Icon name="plus" /></button>}</div>{isAdmin && <div className="class-delete-actions"><button className="danger-outline small-button" disabled={deleteBusy || saving || savingClass || savingSection} onClick={() => { setDeleting({ section, kind: "section" }); setDeleteError(""); }}>Delete Section</button><button className="danger-outline small-button" disabled={deleteBusy || saving || savingClass || savingSection} onClick={() => { setDeleting({ section, kind: "class" }); setDeleteError(""); }}>Delete Class</button></div>}</article>)}</div>}
      {isAdmin && <StudentDirectory sections={sections} revision={studentRevision} onSaved={refreshClassCounts} />}
    </>
  );
}

