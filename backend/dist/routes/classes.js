"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classRoutes = classRoutes;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
function classRoutes(db) {
    const router = (0, express_1.Router)();
    router.get("/", auth_1.requireAuth, async (_req, res) => {
        const result = await db.query(`
      SELECT s.id, c.id AS class_id, c.name AS class_name, c.academic_year, s.name AS section_name,
             COUNT(e.id)::int AS student_count
      FROM sections s
      JOIN classes c ON c.id=s.class_id
      LEFT JOIN enrollments e ON e.section_id=s.id AND e.active=true
      GROUP BY s.id,c.id,c.name,c.academic_year,s.name
      ORDER BY c.name,s.name
    `);
        res.json({ sections: result.rows });
    });
    router.post("/", auth_1.requireAuth, (0, auth_1.requireRole)("ADMIN"), async (req, res, next) => {
        const schema = zod_1.z.object({
            className: zod_1.z.string().trim().min(1).max(100),
            academicYear: zod_1.z.string().trim().min(4).max(20),
            sectionName: zod_1.z.string().trim().min(1).max(50)
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ message: "Invalid class data" });
        let client;
        try {
            client = await db.connect();
            await client.query("BEGIN");
            const c = await client.query(`INSERT INTO classes(name, academic_year) VALUES($1,$2)
         ON CONFLICT(name, academic_year) DO UPDATE SET name=EXCLUDED.name
         RETURNING id`, [parsed.data.className, parsed.data.academicYear]);
            const s = await client.query(`INSERT INTO sections(class_id,name) VALUES($1,$2) RETURNING *`, [c.rows[0].id, parsed.data.sectionName]);
            await client.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details)
        VALUES($1,'CREATE','SECTION',$2,$3)`, [req.user.id, s.rows[0].id, parsed.data]);
            await client.query("COMMIT");
            res.status(201).json({ section: s.rows[0] });
        }
        catch (e) {
            if (client)
                await client.query("ROLLBACK").catch(() => { });
            if (e.code === "23505")
                return res.status(409).json({ message: "This section already exists in the selected class and academic year." });
            return next(e);
        }
        finally {
            client?.release();
        }
    });
    router.delete("/sections/:id", auth_1.requireAuth, (0, auth_1.requireRole)("ADMIN"), async (req, res, next) => {
        const parsed = zod_1.z.string().uuid().safeParse(req.params.id);
        if (!parsed.success)
            return res.status(400).json({ message: "Invalid section ID." });
        let client;
        try {
            client = await db.connect();
            await client.query("BEGIN");
            // Lock the parent before its sections, matching whole-class deletion and creation.
            const parent = await client.query("SELECT c.id FROM classes c JOIN sections s ON s.class_id=c.id WHERE s.id=$1 FOR UPDATE OF c", [parsed.data]);
            if (!parent.rowCount) {
                await client.query("ROLLBACK");
                return res.status(404).json({ message: "Section no longer exists." });
            }
            const section = await client.query("SELECT id FROM sections WHERE id=$1 FOR UPDATE", [parsed.data]);
            if (!section.rowCount) {
                await client.query("ROLLBACK");
                return res.status(404).json({ message: "Section no longer exists." });
            }
            const used = await client.query(`SELECT EXISTS(SELECT 1 FROM enrollments WHERE section_id=$1)
        OR EXISTS(SELECT 1 FROM attendance WHERE section_id=$1) AS has_history`, [parsed.data]);
            if (used.rows[0].has_history) {
                await client.query("ROLLBACK");
                return res.status(409).json({ message: "This section has enrollment or attendance history and cannot be deleted." });
            }
            await client.query("DELETE FROM sections WHERE id=$1", [parsed.data]);
            const removedClass = await client.query("DELETE FROM classes WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM sections WHERE class_id=$1) RETURNING id", [parent.rows[0].id]);
            await client.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details)
        VALUES($1,'DELETE','SECTION',$2,$3)`, [req.user.id, parsed.data, { classId: parent.rows[0].id, removedEmptyClass: Boolean(removedClass.rowCount) }]);
            await client.query("COMMIT");
            res.json({ message: "Section deleted.", removedClassId: removedClass.rows[0]?.id || null });
        }
        catch (error) {
            if (client)
                await client.query("ROLLBACK").catch(() => { });
            next(error);
        }
        finally {
            client?.release();
        }
    });
    router.delete("/:id", auth_1.requireAuth, (0, auth_1.requireRole)("ADMIN"), async (req, res, next) => {
        const parsed = zod_1.z.string().uuid().safeParse(req.params.id);
        if (!parsed.success)
            return res.status(400).json({ message: "Invalid class ID." });
        let client;
        try {
            client = await db.connect();
            await client.query("BEGIN");
            const found = await client.query("SELECT id FROM classes WHERE id=$1 FOR UPDATE", [parsed.data]);
            if (!found.rowCount) {
                await client.query("ROLLBACK");
                return res.status(404).json({ message: "Class no longer exists." });
            }
            await client.query("SELECT id FROM sections WHERE class_id=$1 ORDER BY id FOR UPDATE", [parsed.data]);
            const used = await client.query(`SELECT EXISTS(SELECT 1 FROM enrollments e JOIN sections s ON s.id=e.section_id WHERE s.class_id=$1)
        OR EXISTS(SELECT 1 FROM attendance a JOIN sections s ON s.id=a.section_id WHERE s.class_id=$1) AS has_history`, [parsed.data]);
            if (used.rows[0].has_history) {
                await client.query("ROLLBACK");
                return res.status(409).json({ message: "This class has enrollment or attendance history. Its sections cannot be deleted." });
            }
            await client.query("DELETE FROM classes WHERE id=$1", [parsed.data]);
            await client.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details)
        VALUES($1,'DELETE','CLASS',$2,$3)`, [req.user.id, parsed.data, { includedSections: true }]);
            await client.query("COMMIT");
            res.json({ message: "Class and its sections deleted." });
        }
        catch (error) {
            if (client)
                await client.query("ROLLBACK").catch(() => { });
            next(error);
        }
        finally {
            client?.release();
        }
    });
    return router;
}
