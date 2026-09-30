import { Pool } from "pg";

export async function writeAudit(
  db: Pool,
  actorId: string | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  details?: unknown
) {
  await db.query(
    `INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, details)
     VALUES ($1,$2,$3,$4,$5)`,
    [actorId ?? null, action, entityType, entityId ?? null, details ?? null]
  );
}
