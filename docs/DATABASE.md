# Database Schema

## Entity relationships

```text
ROLES 1 ───── * USERS
USERS (student) 1 ───── * ENROLLMENTS * ───── 1 SECTIONS
CLASSES 1 ───── * SECTIONS
USERS (teacher) * ───── * SECTIONS through TEACHER_SECTIONS
USERS (student) 1 ───── * ATTENDANCE * ───── 1 SECTIONS
USERS (actor) 1 ───── * AUDIT_LOGS
```

## Main tables

- `roles`: ADMIN, TEACHER, STUDENT
- `users`: identity, credentials, role
- `classes`: academic class/program and year
- `sections`: groups within a class
- `enrollments`: student-to-section relationship
- `teacher_sections`: teacher-to-section assignment
- `attendance`: one record per student/section/date
- `audit_logs`: traceability of sensitive actions

The full executable schema is in `database/schema.sql`.

Add Student requires an email and stores it in `users.email`, normalized to lowercase, without creating a password. The database columns `users.email` and `users.password_hash` remain nullable so existing students without email are preserved. Existing login credentials are unchanged. To update an older database that requires passwords, run `npm run db:migrate` from `backend`; the migration is safe to run again.
