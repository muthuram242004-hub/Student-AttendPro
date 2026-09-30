import { Router } from "express";
import { Pool } from "pg";
import { z } from "zod";
import { AuthRequest, requireAuth, requireRole } from "../middleware/auth";

const studentSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).transform(value => value.toLowerCase()),
  sectionId: z.string().uuid()
});

export function studentRoutes(db: Pool) {
  const router = Router();

  router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
    const parsed = z.string().uuid().safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json({ message: "Invalid student ID." });
    let client;
    try {
      client = await db.connect();
      await client.query("BEGIN");
      const student = await client.query(
        `SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id
         WHERE u.id=$1 AND r.name='STUDENT' AND u.is_active=true FOR UPDATE OF u`, [parsed.data]
      );
      if (!student.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Student no longer exists." });
      }
      await client.query("UPDATE users SET is_active=false,updated_at=NOW() WHERE id=$1", [parsed.data]);
      await client.query("UPDATE enrollments SET active=false WHERE student_id=$1", [parsed.data]);
      await client.query(
        `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details)
         VALUES($1,'DELETE','STUDENT',$2,$3)`,
        [req.user!.id, parsed.data, { archived: true, attendancePreserved: true }]
      );
      await client.query("COMMIT");
      return res.json({ message: "Student removed. Past attendance has been preserved." });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      return next(error);
    } finally { client?.release(); }
  });

  router.get("/", requireAuth, requireRole("ADMIN"), async (_req, res, next) => {
    try {
      const result = await db.query(`
        SELECT u.id, u.full_name, u.email, e.section_id,
               c.name AS class_name, c.academic_year, s.name AS section_name
        FROM users u JOIN roles r ON r.id=u.role_id
        LEFT JOIN enrollments e ON e.student_id=u.id AND e.active=true
        LEFT JOIN sections s ON s.id=e.section_id
        LEFT JOIN classes c ON c.id=s.class_id
        WHERE r.name='STUDENT' AND u.is_active=true
        ORDER BY u.full_name, c.name, s.name
      `);
      res.json({ students: result.rows });
    } catch (error) { next(error); }
  });

  router.patch("/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
    const id = z.string().uuid().safeParse(req.params.id);
    const parsed = studentSchema.extend({ previousSectionId: z.string().uuid().nullable() }).safeParse(req.body);
    if (!id.success || !parsed.success) {
      return res.status(400).json({ message: "Enter a student name, valid email, and class/section." });
    }
    let client;
    try {
      const { fullName, email, sectionId, previousSectionId } = parsed.data;
      client = await db.connect();
      await client.query("BEGIN");
      const student = await client.query(
        `SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id
         WHERE u.id=$1 AND r.name='STUDENT' AND u.is_active=true FOR UPDATE OF u`, [id.data]
      );
      if (!student.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Student no longer exists." });
      }
      const section = await client.query("SELECT id FROM sections WHERE id=$1 FOR KEY SHARE", [sectionId]);
      if (!section.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Selected class/section no longer exists." });
      }
      const existing = await client.query("SELECT id FROM users WHERE LOWER(email)=$1 AND id<>$2", [email, id.data]);
      if (existing.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "A user with this email already exists." });
      }
      const enrolled = await client.query("SELECT section_id FROM enrollments WHERE student_id=$1 AND active=true FOR UPDATE", [id.data]);
      const activeSections = enrolled.rows.map(row => row.section_id as string);
      if ((previousSectionId && !activeSections.includes(previousSectionId)) || (!previousSectionId && activeSections.length)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "This student's enrollment changed. Refresh the student list and try again." });
      }
      if (sectionId !== previousSectionId && activeSections.includes(sectionId)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "This student is already enrolled in the selected section." });
      }
      const updated = await client.query(
        "UPDATE users SET full_name=$1,email=$2,updated_at=NOW() WHERE id=$3 RETURNING id,full_name,email",
        [fullName, email, id.data]
      );
      if (sectionId !== previousSectionId) {
        if (previousSectionId) {
          await client.query("UPDATE enrollments SET active=false WHERE student_id=$1 AND section_id=$2", [id.data, previousSectionId]);
        }
        await client.query(
          `INSERT INTO enrollments(student_id,section_id) VALUES($1,$2)
           ON CONFLICT(student_id,section_id) DO UPDATE SET active=true,enrolled_on=CURRENT_DATE`,
          [id.data, sectionId]
        );
      }
      await client.query(
        `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details)
         VALUES($1,'UPDATE','STUDENT',$2,$3)`,
        [req.user!.id, id.data, { previousSectionId, sectionId }]
      );
      await client.query("COMMIT");
      return res.json({ student: updated.rows[0] });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      if ((error as { code?: string; constraint?: string }).code === "23505" &&
          (error as { constraint?: string }).constraint === "users_email_key") {
        return res.status(409).json({ message: "A user with this email already exists." });
      }
      return next(error);
    } finally { client?.release(); }
  });

  router.post("/", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res, next) => {
    const parsed = studentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Enter a student name, valid email, and select a class/section." });
    }

    let client;
    try {
      const { fullName, email, sectionId } = parsed.data;
      client = await db.connect();
      await client.query("BEGIN");
      const section = await client.query("SELECT id FROM sections WHERE id=$1 FOR KEY SHARE", [sectionId]);
      if (!section.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Selected class/section no longer exists." });
      }
      const existing = await client.query("SELECT id FROM users WHERE LOWER(email)=$1", [email]);
      if (existing.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "A user with this email already exists." });
      }
      const result = await client.query(
        `INSERT INTO users(role_id,full_name,email)
         VALUES((SELECT id FROM roles WHERE name='STUDENT'),$1,$2)
         RETURNING id,full_name,email`,
        [fullName, email]
      );
      const student = result.rows[0];
      await client.query("INSERT INTO enrollments(student_id,section_id) VALUES($1,$2)", [student.id, sectionId]);
      await client.query(
        `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details)
         VALUES($1,'CREATE','STUDENT',$2,$3)`,
        [req.user!.id, student.id, { sectionId }]
      );
      await client.query("COMMIT");
      return res.status(201).json({ student });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      if ((error as { code?: string; constraint?: string }).code === "23505" &&
          (error as { constraint?: string }).constraint === "users_email_key") {
        return res.status(409).json({ message: "A user with this email already exists." });
      }
      return next(error);
    } finally {
      client?.release();
    }
  });

  return router;
}
