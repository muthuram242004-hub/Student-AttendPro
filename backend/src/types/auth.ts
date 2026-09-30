export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export interface AuthUser {
  id: string;
  role: Role;
  fullName: string;
  email: string;
}
