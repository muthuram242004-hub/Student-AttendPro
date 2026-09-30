// Dependency-free browser smoke test. Uses a temporary Chrome profile and in-memory API fixtures.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const dist = join(root, "dist");
const artifacts = resolve(root, "../artifacts");
await mkdir(artifacts, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "attendpro-browser-"));
const browserPath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let path = resolve(dist, "." + pathname);
    if (path !== dist && !path.startsWith(dist + sep)) { res.writeHead(403).end(); return; }
    if (!extname(path)) path = join(dist, "index.html");
    res.setHeader("Content-Type", mime[extname(path)] || "application/octet-stream");
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = spawn(browserPath, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-extensions", "about:blank"], { windowsHide: true, stdio: "ignore" });
const sleep = ms => new Promise(done => setTimeout(done, ms));
let ws, sessionId, nextId = 0;
const pending = new Map();
const errors = [];
const today = new Date();
const date = d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
const sectionId = "22222222-2222-4222-8222-222222222222";
let sections = [
  { id: sectionId, class_name: "Computer Science", academic_year: "2026–27", section_name: "A", student_count: 3 },
  { id: "33333333-3333-4333-8333-333333333333", class_name: "Mathematics", academic_year: "2026–27", section_name: "B", student_count: 2 },
  { id: "44444444-4444-4444-8444-444444444444", class_name: "Business Studies", academic_year: "2026–27", section_name: "A", student_count: 2 }
];
sections = sections.map(section => ({ ...section, class_id: randomUUID() }));
let students = ["Ananya Sharma", "Arjun Kumar", "Diya Patel"].map((name, i) => ({ student_id: "student-" + i, full_name: name, status: i === 1 ? "ABSENT" : "PRESENT", note: "" }));
let reportRows = Array.from({length: 7}, (_, i) => {
  const d = new Date(today); d.setDate(d.getDate() - i);
  return students.map((s, n) => ({ attendance_date: date(d), student_name: s.full_name, class_name: "Computer Science", section_name: "A", status: ["PRESENT", "ABSENT", "LATE", "EXCUSED"][(n + i) % 4], note: "" }));
}).flat();
let directory = students.map((student, index) => ({ id: `66666666-6666-4666-8666-66666666666${index}`, full_name: student.full_name, email: `student${index}@example.com`, section_id: sectionId, class_name: sections[0].class_name, section_name: sections[0].section_name, academic_year: sections[0].academic_year }));
let lastStudentRequest, lastAttendanceRequest, lastEditRequest, failReports = false;
const requests = [];
const user = { fullName: "Alex Morgan", role: "ADMIN" };
function send(method, params = {}, session = sessionId) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error("Timed out: " + method)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    ws.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
  });
}
async function fixture(event) {
  const request = event.params.request;
  const url = new URL(request.url);
  const path = url.pathname.replace("/api", "");
  requests.push({ path, method: request.method });
  let response = {}, code = 200;
  if (request.method !== "OPTIONS") {
    if (path === "/auth/me") response = { user };
    else if (path === "/auth/login") response = { token: "test-token", user };
    else if (path.startsWith("/classes/") && request.method === "DELETE") {
      const id = path.split("/").at(-1);
      const wholeClass = !path.startsWith("/classes/sections/");
      const targets = sections.filter(section => wholeClass ? section.class_id === id : section.id === id);
      if (targets.some(section => section.student_count > 0)) { code = 409; response = { message: "This class or section has enrollment or attendance history and cannot be deleted." }; }
      else { sections = sections.filter(section => !targets.includes(section)); response = { message: "Deleted" }; }
    } else if (path === "/classes" && request.method === "POST") {
      const data = JSON.parse(request.postData);
      const existing = sections.find(section => section.class_name === data.className && section.academic_year === data.academicYear);
      const section = { id: randomUUID(), class_id: existing?.class_id || randomUUID(), class_name: data.className, section_name: data.sectionName, academic_year: data.academicYear, student_count: 0 };
      sections.push(section); response = { section }; code = 201;
    } else if (path === "/classes") response = { sections };
    else if (path === "/students" && request.method === "GET") response = { students: directory };
    else if (path.startsWith("/students/") && request.method === "DELETE") {
      const removed = directory.filter(student => student.id === path.split("/")[2]);
      for (const student of removed) sections.find(section => section.id === student.section_id).student_count--;
      directory = directory.filter(student => !removed.includes(student));
      response = { message: "Student removed. Past attendance has been preserved." };
    } else if (path.startsWith("/students/") && request.method === "PATCH") {
      lastEditRequest = JSON.parse(request.postData);
      if (lastEditRequest.email === "duplicate@example.com") { code = 409; response = { message: "A user with this email already exists." }; }
      else {
        const student = directory.find(row => row.id === path.split("/")[2]);
        const destination = sections.find(section => section.id === lastEditRequest.sectionId);
        if (student.section_id !== destination.id) {
          sections.find(section => section.id === student.section_id).student_count--;
          destination.student_count++;
        }
        Object.assign(student, { full_name: lastEditRequest.fullName, email: lastEditRequest.email, section_id: destination.id, class_name: destination.class_name, section_name: destination.section_name, academic_year: destination.academic_year });
        response = { student };
      }
    } else if (path === "/students") {
      lastStudentRequest = JSON.parse(request.postData);
      const section = sections.find(section => section.id === lastStudentRequest.sectionId);
      const student = { id: "77777777-7777-4777-8777-777777777777", full_name: lastStudentRequest.fullName, email: lastStudentRequest.email, section_id: section.id, class_name: section.class_name, section_name: section.section_name, academic_year: section.academic_year };
      directory.push(student); section.student_count++;
      response = { student }; code = 201;
    } else if (path === "/attendance/roll-call") response = { students };
    else if (path === "/attendance/bulk") { lastAttendanceRequest = JSON.parse(request.postData); response = { message: "Saved" }; }
    else if (path === "/reports/attendance") {
      if (failReports) { response = { message: "Test service unavailable" }; code = 503; }
      else response = { rows: reportRows };
    } else { code = 404; response = { message: "No fixture for " + path }; }
  }
  await send("Fetch.fulfillRequest", { requestId: event.params.requestId, responseCode: code, responseHeaders: [
    { name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" },
    { name: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" }, { name: "Access-Control-Allow-Methods", value: "GET, POST, PATCH, DELETE, OPTIONS" }
  ], body: Buffer.from(JSON.stringify(response)).toString("base64") }, event.sessionId);
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ": " + JSON.stringify(result.exceptionDetails.exception));
  return result.result.value;
}
async function waitFor(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await sleep(100); }
  throw new Error("Page condition failed: " + expression);
}
async function go(path) {
  await send("Page.navigate", { url: origin + path });
  await waitFor("document.querySelector('h1') !== null");
}
async function click(text) {
  await evaluate(`(() => { const b = [...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('Missing control: ' + ${JSON.stringify(text)}); b.click(); })()`);
}
async function fill(selector, value) {
  await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing input'); const setter = Object.getOwnPropertyDescriptor(el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set; setter.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
}
async function screenshot(name) {
  const data = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(join(artifacts, name + ".png"), Buffer.from(data.data, "base64"));
}
async function assertFits() {
  const fits = await evaluate("document.documentElement.scrollWidth <= window.innerWidth");
  if (!fits) {
    console.log(await evaluate("JSON.stringify({ path: location.pathname, width: innerWidth, scroll: document.documentElement.scrollWidth, actions: [...document.querySelectorAll('.page-actions')].map(e => ({ width: e.getBoundingClientRect().width, right: e.getBoundingClientRect().right })) })"));
    await screenshot("viewport-overflow");
  }
  assert.equal(fits, true, "Page overflows the viewport");
}
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n"); break; } catch { await sleep(100); }
  }
  if (!port) throw new Error("Chrome did not expose its debugging port");
  ws = new WebSocket("ws://127.0.0.1:" + port[0] + port[1].trim());
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id); if (!task) return;
      clearTimeout(task.timeout); pending.delete(message.id);
      if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
    } else if (message.method === "Fetch.requestPaused") fixture(message).catch(error => errors.push(error.message));
    else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  };
  const target = await send("Target.createTarget", { url: "about:blank" }, null);
  const attached = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true }, null);
  sessionId = attached.sessionId;
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*localhost:4000/api/*" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("attendance_token", "test-token"); localStorage.setItem("attendance_user", ${JSON.stringify(JSON.stringify(user))});` });
  await go("/");
  await waitFor("document.querySelector('.stat > strong')?.textContent === '7'");
  await assertFits(); await screenshot("dashboard-desktop");
  console.log("PASS dashboard: live statistics and desktop layout");
  await go("/classes");
  await waitFor("document.querySelectorAll('.classroom-card').length === 3");
  await click("Add Class");
  await fill('input[placeholder="e.g. B.E CSE"]', "Physics");
  await fill('input[placeholder="e.g. 2026-27"]', "2026-27");
  await fill('input[placeholder="e.g. A"]', "C");
  await click("Save Class");
  await waitFor("document.querySelectorAll('.classroom-card').length === 4");
  await click("Add Section");
  await fill('form[aria-labelledby="add-section-title"] select', sections.find(section => section.class_name === "Physics").id);
  await fill('form[aria-labelledby="add-section-title"] input', "D");
  await click("Save Section");
  await waitFor("document.querySelectorAll('.classroom-card').length === 5");
  await click("Add Student");
  assert.equal(await evaluate("document.querySelector('input[type=password]') === null"), true);
  await fill('input[autocomplete="off"]', "New Student");
  await fill('input[type=email]', "student@example.com");
  await fill('form[aria-labelledby="add-student-title"] select', sectionId);
  await click("Save Student");
  await waitFor("document.querySelector('.success')?.textContent.includes('New Student')");
  assert.deepEqual(Object.keys(lastStudentRequest).sort(), ["email", "fullName", "sectionId"]);
  assert.equal(lastStudentRequest.email, "student@example.com");
  await fill('input[aria-label="Search classes"]', "Physics");
  assert.equal(await evaluate("document.querySelectorAll('.classroom-card').length"), 2);
  await assertFits(); await screenshot("classes-desktop");
  console.log("PASS classes: create class, add student with email and no password, search");
  await waitFor("document.querySelectorAll('.student-directory tbody tr').length === 4");
  await fill('input[aria-label="Search student directory"]', "student0@example.com");
  await click("Edit Student");
  assert.equal(await evaluate("document.querySelector('form[aria-labelledby=edit-student-title] input').value"), "Ananya Sharma");
  await fill('form[aria-labelledby="edit-student-title"] input', "Ananya Rao");
  await fill('form[aria-labelledby="edit-student-title"] input[type=email]', "duplicate@example.com");
  await click("Save changes");
  await waitFor("document.querySelector('form[aria-labelledby=edit-student-title] [role=alert]')?.textContent.includes('email already exists')");
  await fill('form[aria-labelledby="edit-student-title"] input[type=email]', "ananya.rao@example.com");
  await fill('form[aria-labelledby="edit-student-title"] select', sections[1].id);
  await screenshot("edit-student-desktop");
  await click("Save changes");
  await waitFor("document.querySelector('.student-directory .success')?.textContent.includes('Ananya Rao')");
  assert.equal(lastEditRequest.previousSectionId, sectionId);
  assert.equal(lastEditRequest.sectionId, sections[1].id);
  await fill('input[aria-label="Search student directory"]', "ananya.rao@example.com");
  await waitFor("document.querySelector('.student-directory tbody').textContent.includes('Mathematics / B')");
  await click("Edit Student");
  await fill('form[aria-labelledby="edit-student-title"] input', "Not saved");
  const patchCount = requests.filter(request => request.method === "PATCH").length;
  await click("Cancel");
  assert.equal(requests.filter(request => request.method === "PATCH").length, patchCount);
  await go("/classes");
  await waitFor("document.querySelector('.student-directory tbody')?.textContent.includes('Ananya Rao')");
  console.log("PASS editing: prefilled form, email conflict, section transfer, persistence, cancel");
  await fill('input[aria-label="Search student directory"]', "student@example.com");
  await click("Delete Student");
  await waitFor("document.querySelector('dialog[open]') !== null");
  let deleteCount = requests.filter(request => request.method === "DELETE").length;
  await click("Cancel");
  assert.equal(requests.filter(request => request.method === "DELETE").length, deleteCount);
  await click("Delete Student");
  await click("Delete student");
  await waitFor("document.querySelector('.student-directory .success')?.textContent.includes('was removed')");
  assert.equal(directory.some(student => student.full_name === "New Student"), false);
  await fill('input[aria-label="Search classes"]', "Physics");
  await click("Delete Section");
  deleteCount = requests.filter(request => request.method === "DELETE").length;
  await click("Cancel");
  assert.equal(requests.filter(request => request.method === "DELETE").length, deleteCount);
  await click("Delete Section");
  await click("Delete section");
  await waitFor("document.querySelectorAll('.classroom-card').length === 1");
  await click("Delete Class");
  await click("Delete class");
  await waitFor("document.querySelectorAll('.classroom-card').length === 0");
  await fill('input[aria-label="Search classes"]', "Computer Science");
  await click("Delete Class");
  await click("Delete class");
  await waitFor("document.querySelector('dialog [role=alert]')?.textContent.includes('history')");
  await screenshot("delete-protected-class");
  await click("Cancel");
  assert.equal(await evaluate("document.querySelectorAll('.classroom-card').length"), 1);
  console.log("PASS deletion and sections: add section, cancel, remove student, delete empty section/class, history conflict");
  await go("/attendance?sectionId=" + sectionId);
  await waitFor("document.querySelectorAll('.student-cell').length === 3");
  await click("All present");
  await fill('input[aria-label="Note for Ananya Sharma"]', "Arrived on time");
  await click("Save attendance");
  await waitFor("document.querySelector('.success')?.textContent.includes('Attendance saved')");
  assert.equal(lastAttendanceRequest.records.length, 3);
  assert.equal(lastAttendanceRequest.records.every(row => row.status === "PRESENT"), true);
  assert.equal(lastAttendanceRequest.records[0].note, "Arrived on time");
  await screenshot("attendance-desktop");
  await fill('input[aria-label="Search students"]', "Arjun");
  assert.equal(await evaluate("document.querySelectorAll('.student-cell').length"), 1);
  console.log("PASS attendance: notes, mark all present, save, search");
  await go("/reports");
  await waitFor("document.querySelectorAll('tbody tr').length === 21");
  await fill('select[aria-label="Filter by attendance status"]', "ABSENT");
  assert.equal(await evaluate("[...document.querySelectorAll('.status-badge')].every(e => e.textContent === 'Absent')"), true);
  await fill('input[aria-label="Search report by student"]', "Arjun");
  assert.equal(await evaluate("[...document.querySelectorAll('.student-cell')].every(e => e.textContent.includes('Arjun'))"), true);
  await evaluate("window.__csv = ''; const original = URL.createObjectURL; URL.createObjectURL = blob => { blob.text().then(text => window.__csv = text); return original(blob); };");
  await click("Export CSV");
  await waitFor("window.__csv.length > 0");
  const csv = await evaluate("window.__csv");
  assert.ok(csv.includes("Arjun Kumar")); assert.ok(!csv.includes("Ananya Sharma"));
  await screenshot("reports-desktop");
  console.log("PASS reports: status/name filtering and matching CSV export");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  for (const [path, name, selector] of [["/", "dashboard-mobile", ".stat"], ["/classes", "classes-mobile", ".classroom-card"], ["/attendance", "attendance-mobile", ".student-cell"], ["/reports", "reports-mobile", ".student-cell"], ["/login", "login-mobile", ".login-card"]]) {
    await go(path); await waitFor(`document.querySelector(${JSON.stringify(selector)}) !== null`);
    await sleep(200); await assertFits(); await screenshot(name);
  }
  console.log("PASS mobile: all five pages fit a 390px viewport");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await go("/login"); await screenshot("login-desktop");
  await fill('input[type=email]', "admin@example.com"); await fill('input[type=password]', "test-password");
  await click("Sign in to your workspace"); await waitFor("location.pathname === '/'");
  sections = []; reportRows = [];
  await go("/"); await waitFor("document.body.textContent.includes('Your first classroom starts here')");
  await screenshot("dashboard-empty");
  failReports = true;
  await click("Refresh"); await waitFor("document.querySelector('[role=alert]')?.textContent.includes('Test service unavailable')");
  assert.equal(await evaluate("[...document.querySelectorAll('.stat > strong')].every(e => e.textContent === '—')"), true);
  assert.deepEqual(errors, []);
  console.log("PASS login, empty states, service-error state, no uncaught browser errors");
  console.log("Screenshots: " + artifacts);
} finally {
  if (ws?.readyState === 1) {
    try { await send("Browser.close", {}, null); } catch {}
    ws.close();
  }
  browser.kill();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}

