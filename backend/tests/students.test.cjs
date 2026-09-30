const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { studentRoutes } = require('../dist/routes/students');

process.env.JWT_SECRET = 'student-route-test-secret';
const studentId = '11111111-1111-4111-8111-111111111111';
const sectionId = '22222222-2222-4222-8222-222222222222';
const input = { fullName: ' Student Name ', email: ' Student@Example.com ', sectionId };

async function request(t, { role = 'ADMIN', body = input, method = 'POST', path = '', missingStudent = false, activeSections = [sectionId], failUpdate = false, missingSection = false, failEnrollment = false, existingEmail = false, duplicateInsert = false } = {}) {
  const queries = [];
  let released = false;
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('SELECT id FROM sections')) return { rowCount: missingSection ? 0 : 1 };
      if (sql.startsWith('SELECT id FROM users')) return { rowCount: existingEmail ? 1 : 0 };
      if (sql.startsWith('SELECT u.id FROM users')) return { rowCount: missingStudent ? 0 : 1 };
      if (sql.startsWith('SELECT section_id FROM enrollments')) return { rows: activeSections.map(section_id => ({ section_id })) };
      if (sql.startsWith('UPDATE users')) {
        if (failUpdate) throw new Error('Update failed');
        return { rows: [{ id: studentId, full_name: params[0], email: params[1] }] };
      }
      if (sql.startsWith('INSERT INTO users')) {
        if (duplicateInsert) throw Object.assign(new Error('Duplicate email'), { code: '23505', constraint: 'users_email_key' });
        return { rows: [{ id: studentId, full_name: params[0], email: params[1] }] };
      }
      if (sql.startsWith('INSERT INTO enrollments') && failEnrollment) throw new Error('Enrollment failed');
      return { rows: [], rowCount: 1 };
    },
    release() { released = true; }
  };
  const app = express();
  app.use(express.json());
  app.use('/students', studentRoutes({ connect: async () => client, query: client.query }));
  app.use((_err, _req, res, _next) => res.status(500).json({ message: 'Internal server error' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const headers = { 'Content-Type': 'application/json' };
  if (role) headers.Authorization = `Bearer ${jwt.sign({ id: studentId, role }, process.env.JWT_SECRET)}`;
  const response = await fetch(`http://127.0.0.1:${server.address().port}/students${path}`, {
    method, headers, ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, data: await response.json(), queries, released };
}

test('requires authentication and admin role before accessing the database', async t => {
  for (const [role, status] of [[null, 401], ['TEACHER', 403], ['STUDENT', 403]]) {
    const result = await request(t, { role });
    assert.equal(result.status, status);
    assert.equal(result.queries.length, 0);
  }
});

test('rejects invalid student details before accessing the database', async t => {
  for (const change of [{ fullName: ' ' }, { fullName: undefined }, { fullName: 'a'.repeat(121) }, { email: undefined }, { email: '' }, { email: 'invalid-email' }, { email: 'a'.repeat(250) + '@example.com' }, { sectionId: undefined }, { sectionId: 'bad' }]) {
    const result = await request(t, { body: { ...input, ...change } });
    assert.equal(result.status, 400);
    assert.equal(result.queries.length, 0);
  }
});

test('creates and enrolls a student with normalized email and no password', async t => {
  const result = await request(t);
  assert.equal(result.status, 201);
  assert.deepEqual(result.data, { student: { id: studentId, full_name: 'Student Name', email: 'student@example.com' } });
  const insert = result.queries.find(q => q.sql.startsWith('INSERT INTO users'));
  assert.deepEqual(insert.params, ['Student Name', 'student@example.com']);
  assert.equal(/password/.test(insert.sql), false);
  const enrollment = result.queries.find(q => q.sql.startsWith('INSERT INTO enrollments'));
  assert.deepEqual(enrollment.params, [studentId, sectionId]);
  const audit = result.queries.find(q => q.sql.startsWith('INSERT INTO audit_logs'));
  assert.deepEqual(audit.params, [studentId, studentId, { sectionId }]);
  assert.equal(result.queries.at(-1).sql, 'COMMIT');
  assert.equal(result.released, true);
});

test('rejects missing sections without creating a student', async t => {
  const result = await request(t, { missingSection: true });
  assert.equal(result.status, 400);
  assert.equal(result.queries.some(q => q.sql.startsWith('INSERT')), false);
  assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
  assert.equal(result.released, true);
});

test('rolls back student creation if enrollment fails', async t => {
  const result = await request(t, { failEnrollment: true });
  assert.equal(result.status, 500);
  assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
  assert.equal(result.queries.some(q => q.sql === 'COMMIT'), false);
  assert.equal(result.released, true);
});

test('rejects an existing email before creating or enrolling a student', async t => {
  const result = await request(t, { existingEmail: true });
  assert.equal(result.status, 409);
  assert.match(result.data.message, /email already exists/);
  assert.deepEqual(result.queries.find(q => q.sql.startsWith('SELECT id FROM users')).params, ['student@example.com']);
  assert.equal(result.queries.some(q => q.sql.startsWith('INSERT')), false);
  assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
  assert.equal(result.released, true);
});

test('handles a concurrent duplicate email with a clear conflict response', async t => {
  const result = await request(t, { duplicateInsert: true });
  assert.equal(result.status, 409);
  assert.equal(result.queries.some(q => q.sql.startsWith('INSERT INTO enrollments')), false);
  assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
  assert.equal(result.released, true);
});

const destinationId = '33333333-3333-4333-8333-333333333333';
const edit = { method: 'PATCH', path: '/' + studentId, body: { ...input, previousSectionId: sectionId } };

test('student directory and editing are restricted to admins', async t => {
  for (const options of [{ method: 'GET' }, edit]) {
    for (const role of [null, 'STUDENT', 'TEACHER']) {
      const result = await request(t, { ...options, role });
      assert.equal(result.status, role ? 403 : 401);
      assert.equal(result.queries.length, 0);
    }
  }
  const result = await request(t, { method: 'GET' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { students: [] });
});

test('edits name and normalized email without changing enrollment or credentials', async t => {
  const result = await request(t, edit);
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.student, { id: studentId, full_name: 'Student Name', email: 'student@example.com' });
  assert.deepEqual(result.queries.find(q => q.sql.startsWith('SELECT id FROM users')).params, ['student@example.com', studentId]);
  assert.equal(result.queries.some(q => /^(UPDATE enrollments|INSERT INTO enrollments)/.test(q.sql)), false);
  assert.equal(result.queries.some(q => /password/.test(q.sql)), false);
  assert.equal(result.queries.at(-1).sql, 'COMMIT');
  assert.equal(result.released, true);
});

test('moving one enrollment preserves attendance and other enrollments', async t => {
  const other = '44444444-4444-4444-8444-444444444444';
  const result = await request(t, { ...edit, activeSections: [sectionId, other], body: { ...edit.body, sectionId: destinationId } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.queries.find(q => q.sql.startsWith('UPDATE enrollments')).params, [studentId, sectionId]);
  assert.deepEqual(result.queries.find(q => q.sql.startsWith('INSERT INTO enrollments')).params, [studentId, destinationId]);
  assert.equal(result.queries.some(q => /attendance|DELETE/.test(q.sql)), false);
  assert.equal(result.queries.at(-1).sql, 'COMMIT');
});

test('can enroll a student who has no active section', async t => {
  const result = await request(t, { ...edit, activeSections: [], body: { ...edit.body, previousSectionId: null } });
  assert.equal(result.status, 200);
  assert.equal(result.queries.some(q => q.sql.startsWith('UPDATE enrollments')), false);
  assert.deepEqual(result.queries.find(q => q.sql.startsWith('INSERT INTO enrollments')).params, [studentId, sectionId]);
});

test('rejects invalid editing input before accessing the database', async t => {
  for (const change of [{ email: 'bad' }, { fullName: ' ' }, { sectionId: 'bad' }, { previousSectionId: undefined }]) {
    const result = await request(t, { ...edit, body: { ...edit.body, ...change } });
    assert.equal(result.status, 400);
    assert.equal(result.queries.length, 0);
  }
  assert.equal((await request(t, { ...edit, path: '/invalid' })).status, 400);
});

test('rejects missing student, missing section and duplicate email without edits', async t => {
  for (const [options, status] of [[{ missingStudent: true }, 404], [{ missingSection: true }, 400], [{ existingEmail: true }, 409]]) {
    const result = await request(t, { ...edit, ...options });
    assert.equal(result.status, status);
    assert.equal(result.queries.some(q => q.sql.startsWith('UPDATE users')), false);
    assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
  }
});

test('rejects stale enrollment and an already active destination', async t => {
  for (const options of [{ activeSections: [] }, { body: { ...edit.body, previousSectionId: null } }, { activeSections: [sectionId, destinationId], body: { ...edit.body, sectionId: destinationId } }]) {
    const result = await request(t, { ...edit, ...options });
    assert.equal(result.status, 409);
    assert.equal(result.queries.some(q => q.sql.startsWith('UPDATE users')), false);
    assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
  }
});

test('rolls back profile and enrollment changes on update or transfer failure', async t => {
  for (const options of [{ failUpdate: true }, { failEnrollment: true, body: { ...edit.body, sectionId: destinationId } }]) {
    const result = await request(t, { ...edit, ...options });
    assert.equal(result.status, 500);
    assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
    assert.equal(result.queries.some(q => q.sql === 'COMMIT'), false);
    assert.equal(result.released, true);
  }
});

test('student deletion requires admin, validates ID and rejects missing students', async t => {
  const remove = { method: 'DELETE', path: '/' + studentId };
  for (const role of [null, 'STUDENT', 'TEACHER']) {
    const result = await request(t, { ...remove, role });
    assert.equal(result.status, role ? 403 : 401);
    assert.equal(result.queries.length, 0);
  }
  assert.equal((await request(t, { ...remove, path: '/invalid' })).status, 400);
  assert.equal((await request(t, { ...remove, missingStudent: true })).status, 404);
});

test('student deletion deactivates the account and all enrollments while preserving history', async t => {
  const result = await request(t, { method: 'DELETE', path: '/' + studentId });
  assert.equal(result.status, 200);
  assert.ok(result.queries.some(q => q.sql.startsWith('UPDATE users SET is_active=false')));
  const enrollments = result.queries.find(q => q.sql.startsWith('UPDATE enrollments SET active=false'));
  assert.deepEqual(enrollments.params, [studentId]);
  assert.equal(result.queries.some(q => q.sql.startsWith('DELETE') || q.sql.includes('FROM attendance')), false);
  assert.equal(result.queries.at(-1).sql, 'COMMIT');
  assert.equal(result.released, true);
});

test('failed student deletion rolls back and releases the connection', async t => {
  const result = await request(t, { method: 'DELETE', path: '/' + studentId, failUpdate: true });
  assert.equal(result.status, 500);
  assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
  assert.equal(result.released, true);
});
