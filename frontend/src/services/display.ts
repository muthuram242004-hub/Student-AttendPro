export type Section = { id: string; class_name: string; academic_year: string; section_name: string; student_count: number };
export const statuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
export type Status = typeof statuses[number];
export type ReportRow = { attendance_date: string; student_name: string; class_name: string; section_name: string; status: Status; note: string | null };
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDate(date);
}
export function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }
export function statusLabel(status: string) { return status.charAt(0) + status.slice(1).toLowerCase(); }
export function currentUser(): { fullName?: string; role?: string } {
  try { return JSON.parse(localStorage.getItem("attendance_user") || "{}") || {}; } catch { return {}; }
}

