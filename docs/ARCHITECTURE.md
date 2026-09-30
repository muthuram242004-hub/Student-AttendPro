# System Architecture

## Logical architecture

```text
┌─────────────────────────────── Browser ───────────────────────────────┐
│                                                                       │
│  React + TypeScript + Vite                                            │
│  ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ Login    │ │ Classes    │ │ Attendance │ │ Reports    │           │
│  └──────────┘ └────────────┘ └────────────┘ └────────────┘           │
│                    │ HTTPS / JSON + JWT                                │
└────────────────────┼──────────────────────────────────────────────────┘
                     ▼
              ┌──────────────────────┐
              │ Node.js + Express    │
              │ REST API             │
              │ Auth / RBAC / Zod    │
              └──────────┬───────────┘
                         │ parameterized SQL
                         ▼
              ┌──────────────────────┐
              │ PostgreSQL           │
              │ users / classes      │
              │ enrollments          │
              │ attendance / audit   │
              └──────────────────────┘
```

## Authentication

1. User submits email/password.
2. Backend loads active user and role.
3. Password is verified using bcrypt.
4. API returns a signed JWT.
5. Frontend sends `Authorization: Bearer <token>`.
6. Middleware validates token and role.
7. Production should add refresh tokens, secure cookie strategy, MFA where required, and rate limiting.

## Scalability

- Keep API stateless.
- Add indexes on attendance date/student/section.
- Use pagination for large class lists and reports.
- Add Redis only when caching/rate limiting becomes necessary.
- Use background jobs for large exports.
- Partition attendance by academic year/date only after measuring database growth.
