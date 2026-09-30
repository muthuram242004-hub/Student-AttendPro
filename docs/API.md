# API Contract

Base URL: `/api`

## Auth

### POST `/auth/login`

Request:
```json
{"email":"teacher@example.com","password":"password123"}
```

Response:
```json
{
  "token":"JWT",
  "user":{
    "id":"uuid",
    "role":"TEACHER",
    "fullName":"Teacher Name",
    "email":"teacher@example.com"
  }
}
```

### GET `/auth/me`

Requires Bearer JWT.

## Classes

### GET `/classes`

Response:
```json
{
  "sections":[
    {
      "id":"uuid",
      "class_id":"uuid",
      "class_name":"B.E CSE",
      "academic_year":"2026-27",
      "section_name":"A",
      "student_count":42
    }
  ]
}
```

### POST `/classes`

Admin only.

```json
{
  "className":"B.E CSE",
  "academicYear":"2026-27",
  "sectionName":"A"
}
```

### DELETE `/classes/sections/:id`

Admin only. Deletes an empty section. Returns `409` if it has any enrollment (including inactive enrollment) or attendance history. If it was the last section, removes its empty parent class. Returns `200` with `message` and `removedClassId` (null if the class remains), `400` for invalid IDs, or `404` when missing.

### DELETE `/classes/:id`

Admin only. Deletes a class and all its sections only when none have enrollment or attendance history. Returns `200` on success, `409` if history exists, `400` for invalid IDs, or `404` when missing. Both deletion operations write audit records in the same transaction.

## Students

### DELETE `/students/:id`

Admin only. Archives the student by setting `users.is_active=false` and deactivating all their enrollments. Attendance, email, and audit history are retained; the reserved email cannot be reused. Returns `200` with a message, `400` for an invalid UUID, or `404` for a missing/inactive/non-student user. The entire change and its audit record commit together.

### GET `/students`

Admin only. Returns `{ students: [...] }` with `id`, `full_name`, `email`, `section_id`, `class_name`, `section_name`, and `academic_year`. Each active enrollment has its own row. Students without active enrollment have null section/class fields. Legacy students may have a null email.

### PATCH `/students/:id`

Admin only. Updates the student's name/email and the selected enrollment atomically.

```json
{
  "fullName": "Updated Student Name",
  "email": "updated@example.com",
  "sectionId": "destination-section-uuid",
  "previousSectionId": "original-section-uuid"
}
```

Use `previousSectionId: null` only for a student without active enrollments. A section move deactivates the original enrollment and creates/reactivates the destination; other enrollments and existing attendance records are preserved. Passwords are unchanged. Returns `200` with `student` (`id`, `full_name`, `email`), `400` for invalid data/section, `404` for a missing student, or `409` for duplicate email, stale enrollment, or an already active destination.

### POST `/students`

Admin only. Creates a student record and enrolls it in an existing section in one transaction. A name, email, and section are required. No password is created, so new students cannot sign in with this email alone.

```json
{
  "fullName": "Student Name",
  "email": "student@example.com",
  "sectionId": "uuid"
}
```

Returns `201` with `student` containing `id`, `full_name`, and `email`.
Emails are trimmed and stored in lowercase. An existing user email returns `409`.
Invalid input or a missing section returns `400`. Students with the same name are allowed and have distinct IDs.

## Attendance

### GET `/attendance/roll-call?sectionId=<uuid>&date=2026-09-24`

Response:
```json
{
  "date":"2026-09-24",
  "sectionId":"uuid",
  "students":[
    {
      "student_id":"uuid",
      "full_name":"Student One",
      "status":"PRESENT",
      "note":""
    }
  ]
}
```

### POST `/attendance/bulk`

Teacher/Admin only.

```json
{
  "sectionId":"uuid",
  "date":"2026-09-24",
  "records":[
    {
      "studentId":"uuid",
      "status":"PRESENT",
      "note":""
    },
    {
      "studentId":"uuid",
      "status":"LATE",
      "note":"Arrived at 9:15"
    }
  ]
}
```

Statuses:
- `PRESENT`
- `ABSENT`
- `LATE`
- `EXCUSED`

### GET `/attendance/student/:studentId`

Returns the student's attendance history.

## Reports

### GET `/reports/attendance?from=2026-09-01&to=2026-09-24`

Optional filters:
- `sectionId`
- `studentId`

### GET `/reports/attendance.csv?from=2026-09-01&to=2026-09-24`

Downloads a CSV report.

## HTTP behavior

- 200: successful read/update
- 201: successful creation
- 400: validation error
- 401: missing/invalid authentication
- 403: role not permitted
- 409: unique/conflict
- 500: unexpected server error
