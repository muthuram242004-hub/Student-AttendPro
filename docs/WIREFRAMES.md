# UI Wireframes

These are implementation-oriented ASCII wireframes.

## Login

```text
┌──────────────────────────────────────┐
│              AttendPro               │
│      Student Attendance System       │
│                                      │
│  Email                               │
│  [_______________________________]   │
│                                      │
│  Password                            │
│  [_______________________________]   │
│                                      │
│           [ Sign in ]                │
└──────────────────────────────────────┘
```

## Class List

```text
┌──────────────────────────────────────────────────────────────┐
│ AttendPro                         Search   User     Logout    │
├──────────────┬───────────────────────────────────────────────┤
│ Dashboard    │ Classes & Sections                             │
│ Classes      │                                                │
│ Attendance   │ [ + Create Class ]                             │
│ Reports      │                                                │
│              │ Class | Academic Year | Section | Students    │
│              │ CSE   | 2026-27       | A       | 42          │
│              │ CSE   | 2026-27       | B       | 39          │
└──────────────┴───────────────────────────────────────────────┘
```

## Attendance Marking

```text
┌──────────────────────────────────────────────────────────────┐
│ Mark Attendance                                               │
│ Section [CSE - A ▼]   Date [2026-09-24]    [Save Attendance] │
├──────────────────────────────────────────────────────────────┤
│ Student                  Status                               │
│ Arun Kumar               [PRESENT ▼]                         │
│ Bala Kumar               [ABSENT  ▼]                         │
│ Chitra Devi              [LATE    ▼]                         │
│ Deepak Raj               [EXCUSED ▼]                         │
└──────────────────────────────────────────────────────────────┘
```

## Reports

```text
┌──────────────────────────────────────────────────────────────┐
│ Attendance Reports                                            │
│ From [date]  To [date]  Class [All ▼] Student [All ▼]        │
│ [Run Report] [Export CSV]                                    │
├──────────────────────────────────────────────────────────────┤
│ Date | Student | Class | Section | Status                    │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

## Accessibility requirements

- Every input has a visible label.
- Keyboard focus must remain visible.
- Tables should have semantic headers.
- Error/success messages use `role="alert"` or `role="status"`.
- Maintain readable contrast.
- Do not rely on color alone to indicate attendance status.
- Responsive layout should work from 320px upward.
