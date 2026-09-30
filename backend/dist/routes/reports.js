"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRoutes = reportRoutes;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
function reportRoutes(db) {
    const router = (0, express_1.Router)();
    router.get("/attendance", auth_1.requireAuth, async (req, res) => {
        const from = String(req.query.from || "2000-01-01");
        const to = String(req.query.to || "2999-12-31");
        const sectionId = req.query.sectionId ? String(req.query.sectionId) : null;
        const studentId = req.query.studentId ? String(req.query.studentId) : null;
        const result = await db.query(`
      SELECT TO_CHAR(a.attendance_date, 'YYYY-MM-DD') AS attendance_date, u.full_name AS student_name,
             c.name AS class_name, s.name AS section_name,
             a.status, a.note
      FROM attendance a
      JOIN users u ON u.id=a.student_id
      JOIN sections s ON s.id=a.section_id
      JOIN classes c ON c.id=s.class_id
      WHERE a.attendance_date BETWEEN $1 AND $2
        AND ($3::uuid IS NULL OR a.section_id=$3)
        AND ($4::uuid IS NULL OR a.student_id=$4)
      ORDER BY a.attendance_date DESC, student_name
    `, [from, to, sectionId, studentId]);
        res.json({ rows: result.rows });
    });
    router.get("/attendance.csv", auth_1.requireAuth, async (req, res) => {
        const from = String(req.query.from || "2000-01-01");
        const to = String(req.query.to || "2999-12-31");
        const result = await db.query(`
      SELECT TO_CHAR(a.attendance_date, 'YYYY-MM-DD') AS attendance_date, u.full_name AS student_name,
             c.name AS class_name, s.name AS section_name,
             a.status, COALESCE(a.note,'') AS note
      FROM attendance a
      JOIN users u ON u.id=a.student_id
      JOIN sections s ON s.id=a.section_id
      JOIN classes c ON c.id=s.class_id
      WHERE a.attendance_date BETWEEN $1 AND $2
      ORDER BY a.attendance_date DESC, student_name
    `, [from, to]);
        const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
        const csv = [
            "date,student,class,section,status,note",
            ...result.rows.map(r => [
                r.attendance_date.toISOString?.().slice(0, 10) ?? r.attendance_date,
                r.student_name, r.class_name, r.section_name, r.status, r.note
            ].map(esc).join(","))
        ].join("\n");
        res.header("Content-Type", "text/csv");
        res.attachment("attendance-report.csv");
        res.send(csv);
    });
    return router;
}
