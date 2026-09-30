"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAudit = writeAudit;
async function writeAudit(db, actorId, action, entityType, entityId, details) {
    await db.query(`INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, details)
     VALUES ($1,$2,$3,$4,$5)`, [actorId ?? null, action, entityType, entityId ?? null, details ?? null]);
}
