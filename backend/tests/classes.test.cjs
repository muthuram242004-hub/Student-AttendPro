const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { classRoutes } = require('../dist/routes/classes');
process.env.JWT_SECRET = 'class-route-test-secret';
const classId = '11111111-1111-4111-8111-111111111111';
const sectionId = '22222222-2222-4222-8222-222222222222';

async function request(t, { method = 'DELETE', path = '/' + classId, role = 'ADMIN', missing = false, history = false, lastSection = false, auditFailure = false, duplicate = false, body = { className: ' Physics ', academicYear: ' 2026-27 ', sectionName: ' B ' } } = {}) {
  const queries = [];
  let released = false;
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('AS has_history')) return { rows: [{ has_history: history }] };
      if (sql.startsWith('SELECT')) return { rows: missing ? [] : [{ id: classId }], rowCount: missing ? 0 : 1 };
      if (sql.startsWith('INSERT INTO classes')) return { rows: [{ id: classId }], rowCount: 1 };
      if (sql.startsWith('INSERT INTO sections')) {
        if (duplicate) throw Object.assign(new Error('Duplicate'), { code: '23505' });
        return { rows: [{ id: sectionId, class_id: classId, name: params[1] }], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO audit_logs') && auditFailure) throw new Error('Audit failed');
      if (sql.startsWith('DELETE FROM classes') && sql.includes('RETURNING')) return { rows: lastSection ? [{ id: classId }] : [], rowCount: lastSection ? 1 : 0 };
      return { rows: [], rowCount: 1 };
    },
    release() { released = true; }
  };
  const app = express();
  app.use(express.json());
  app.use('/classes', classRoutes({ connect: async () => client, query: client.query }));
  app.use((_error, _req, res, _next) => res.status(500).json({ message: 'Internal server error' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(done => server.once('listening', done));
  t.after(() => new Promise(done => { server.close(done); server.closeAllConnections(); }));
  const headers = { 'Content-Type': 'application/json' };
  if (role) headers.Authorization = 'Bearer ' + jwt.sign({ id: classId, role }, process.env.JWT_SECRET);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/classes${path}`, { method, headers, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json(), queries, released };
}

test('only admins can create or delete classes and sections', async t => {
  for (const action of [{}, { path: '/sections/' + sectionId }, { method: 'POST', path: '' }]) {
    for (const role of [null, 'STUDENT', 'TEACHER']) {
      const result = await request(t, { ...action, role });
      assert.equal(result.status, role ? 403 : 401);
      assert.equal(result.queries.length, 0);
    }
  }
});

test('class/section creation trims fields and commits the audit with the section', async t => {
  const result = await request(t, { method: 'POST', path: '' });
  assert.equal(result.status, 201);
  assert.deepEqual(result.queries.find(q => q.sql.startsWith('INSERT INTO classes')).params, ['Physics', '2026-27']);
  assert.equal(result.data.section.class_id, classId);
  assert.equal(result.data.section.name, 'B');
  assert.equal(result.queries.at(-1).sql, 'COMMIT');
});

test('duplicate sections return conflict and audit failures roll back creation', async t => {
  for (const [options, status] of [[{ duplicate: true }, 409], [{ auditFailure: true }, 500]]) {
    const result = await request(t, { method: 'POST', path: '', ...options });
    assert.equal(result.status, status);
    assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
    assert.equal(result.released, true);
  }
});

test('invalid deletion IDs and missing records are rejected', async t => {
  for (const path of ['/invalid', '/sections/invalid']) {
    const result = await request(t, { path });
    assert.equal(result.status, 400);
    assert.equal(result.queries.length, 0);
  }
  for (const path of ['/' + classId, '/sections/' + sectionId]) {
    const result = await request(t, { path, missing: true });
    assert.equal(result.status, 404);
    assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
  }
});

test('enrollment or attendance history blocks deletion before any data is removed', async t => {
  for (const path of ['/' + classId, '/sections/' + sectionId]) {
    const result = await request(t, { path, history: true });
    assert.equal(result.status, 409);
    assert.equal(result.queries.some(q => q.sql.startsWith('DELETE')), false);
    assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
  }
});

test('deletes an empty section and removes its parent only when it was the last section', async t => {
  for (const lastSection of [false, true]) {
    const result = await request(t, { path: '/sections/' + sectionId, lastSection });
    assert.equal(result.status, 200);
    assert.equal(result.data.removedClassId, lastSection ? classId : null);
    assert.deepEqual(result.queries.find(q => q.sql.startsWith('DELETE FROM sections')).params, [sectionId]);
    assert.equal(result.queries.at(-1).sql, 'COMMIT');
  }
});

test('deletes an empty whole class and rolls back if audit writing fails', async t => {
  const success = await request(t);
  assert.equal(success.status, 200);
  assert.deepEqual(success.queries.find(q => q.sql === 'DELETE FROM classes WHERE id=$1').params, [classId]);
  assert.equal(success.queries.at(-1).sql, 'COMMIT');
  for (const path of ['/' + classId, '/sections/' + sectionId]) {
    const failure = await request(t, { path, auditFailure: true });
    assert.equal(failure.status, 500);
    assert.equal(failure.queries.at(-1).sql, 'ROLLBACK');
    assert.equal(failure.released, true);
  }
});
