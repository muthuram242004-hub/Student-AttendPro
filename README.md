# Student Attendance Management System

Professional MVP for school/university attendance management.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL
- Authentication: JWT + bcrypt
- Validation: Zod
- Export: CSV
- Deployment: Docker Compose-ready

## Roles

- **Admin**: manage users, classes, sections, enrollments, and view reports/audit logs.
- **Teacher**: view assigned classes, mark/update attendance, view reports.
- **Student**: view only their attendance.

## MVP Features

1. JWT authentication and role-based access control
2. Admin Add Class form with class name, academic year, and section
3. Admin Add Student form with name, email, and section enrollment (no password required)
4. Attendance statuses: Present, Absent, Late, Excused
5. Daily roll call
6. Attendance calendar/history
7. Reports by date range/class/student/month
8. CSV export
9. Audit log
10. Responsive frontend with basic accessibility

## Project structure

```text
student-attendance-management-system/
├── backend/
│   ├── src/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   └── server.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
├── database/
│   └── schema.sql
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── WIREFRAMES.md
├── docker-compose.yml
└── README.md
```

## 1. Run PostgreSQL

Recommended:

```bash
docker compose up -d db
```

The database is exposed on `localhost:5432`.

## 2. Backend

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Linux/macOS:

```bash
cp .env.example .env
npm install
npm run dev
```

Backend runs at `http://localhost:4000`.

The Docker database automatically runs `database/schema.sql` on first initialization.

For an existing database, run `npm run db:migrate` from `backend` once to allow students without email or password. Existing login credentials are preserved.

## 3. Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Linux/macOS:

```bash
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Interface and daily workflow

- The overview shows live enrollment counts, today's recorded attendance, and a seven-day chart. Attendance rate is present plus late entries divided by all recorded entries; unmarked students are not included.
- Classes & students provides searchable class cards and the Add Class / Add Student forms. Student entry requires a name, email, and section; no password is required.
- Admins can use the Student Directory on the same page to search by name/email, filter by section, and edit student details. Moving an enrollment preserves past attendance and the student's other class enrollments.
- Add Class creates a class with its first section. Add Section lets admins select an existing class and create another section without retyping its class name or academic year.
- Delete Student asks for confirmation, removes the student from active lists and enrollments, and preserves their previous attendance. Their email remains reserved. Delete Section and Delete Class only remove records without enrollment or attendance history; deleting a class includes all its sections. Deleting the last empty section also removes its empty parent class.
- Attendance supports student search, quick status buttons, Mark all present, optional notes, and visible save feedback. On mobile, each student has a stacked attendance card.
- Reports filter by date, section, student name, and status. CSV export contains the rows currently shown, with spreadsheet formula escaping.
- The interface uses local calendar dates and provides loading, empty, and error states.

### Browser verification

Build the frontend, then run `node frontend/scripts/browser-check.mjs` from the project root. The script uses installed Chrome (or the `CHROME_PATH` environment variable), a temporary browser profile, and in-memory API fixtures. It verifies desktop/mobile layouts and the main forms without modifying the database. Screenshots are saved in `artifacts/`.

## Demo users

The schema contains optional seed users. Their passwords are placeholders intentionally; generate real bcrypt hashes before using them.

For development, use the `/api/auth/register` endpoint or insert users with a bcrypt hash.

## API

See `docs/API.md`.

## Security notes

- Store JWT secret only in environment variables.
- Use HTTPS in staging/production.
- Add rate limiting to authentication endpoints.
- Use short-lived access tokens and refresh tokens for production.
- Never log passwords or access tokens.
- Restrict CORS to the production frontend origin.
- Add database backups and restore testing.
- Use parameterized SQL queries.
- Validate every API payload.
- Enforce unique attendance per student/date.
- Add stronger audit coverage before production.

## Production deployment

Suggested topology:

```text
Browser
  |
HTTPS / CDN
  |
React static frontend
  |
Reverse proxy / Load balancer
  |
Express API
  |
PostgreSQL
```

Use managed PostgreSQL, centralized logging, monitoring, automated migrations, backups, secrets management, and CI/CD.
