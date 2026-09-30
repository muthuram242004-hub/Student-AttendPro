import { Router } from "express";
import { Pool } from "pg";
import { z } from "zod";
import { AuthRequest, requireAuth, requireRole } from "../middleware/auth";
import { writeAudit } from "../services/audit";

const status = z.enum(["PRESENT","ABSENT","LATE","EXCUSED"]);

export function attendanceRoutes(db: Pool) {
  const router = Router();

  router.get("/roll-call", requireAuth, async (req, res) => {
    const sectionId = String(req.query.sectionId || "");
    const date = String(req.query.date || "");
    if (!sectionId || !date) return res.status(400).json({ message: "sectionId and date are required" });

    const result = await db.query(`
      SELECT u.id AS student_id, u.full_name,
             COALESCE(a.status, 'PRESENT') AS status,
             COALESCE(a.note, '') AS note
      FROM enrollments e
      JOIN users u ON u.id=e.student_id
      LEFT JOIN attendance a
        ON a.student_id=u.id AND a.section_id=e.section_id AND a.attendance_date=$2
      WHERE e.section_id=$1 AND e.active=true
      ORDER BY u.full_name
    `, [sectionId, date]);

    res.json({ date, sectionId, students: result.rows });
  });

  router.post("/bulk", requireAuth, requireRole("ADMIN","TEACHER"), async (req: AuthRequest, res) => {
    const schema = z.object({
      sectionId: z.string().uuid(),
      date: z.string(),
      records: z.array(z.object({
        studentId: z.string().uuid(),
        status,
        note: z.string().max(500).optional()
      })).min(1)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid attendance payload" });

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const record of parsed.data.records) {
        await client.query(`
          INSERT INTO attendance(student_id,section_id,attendance_date,status,note,marked_by)
          VALUES($1,$2,$3,$4,$5,$6)
          ON CONFLICT(student_id,section_id,attendance_date)
          DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,
                        marked_by=EXCLUDED.marked_by,marked_at=NOW()
        `, [
          record.studentId, parsed.data.sectionId, parsed.data.date,
          record.status, record.note ?? null, req.user!.id
        ]);
      }
      await client.query("COMMIT");
      await writeAudit(db, req.user?.id, "UPSERT", "ATTENDANCE", parsed.data.sectionId, {
        date: parsed.data.date,
        count: parsed.data.records.length
      });
      res.json({ message: "Attendance saved", count: parsed.data.records.length });
    } catch {
      await client.query("ROLLBACK");
      res.status(500).json({ message: "Could not save attendance" });
    } finally {
      client.release();
    }
  });

  router.get("/student/:studentId", requireAuth, async (req, res) => {
    const result = await db.query(`
      SELECT a.attendance_date, a.status, a.note,
             c.name AS class_name, s.name AS section_name
      FROM attendance a
      JOIN sections s ON s.id=a.section_id
      JOIN classes c ON c.id=s.class_id
      WHERE a.student_id=$1
      ORDER BY a.attendance_date DESC
    `, [req.params.studentId]);

    res.json({ attendance: result.rows });
  });

  return router;
}
