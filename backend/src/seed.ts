import "dotenv/config";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

async function main() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const role = await db.query(`SELECT id FROM roles WHERE name='ADMIN'`);
  await db.query(
    `INSERT INTO users(role_id,full_name,email,password_hash)
     VALUES($1,$2,$3,$4)
     ON CONFLICT(email) DO NOTHING`,
    [role.rows[0].id, "System Admin", "admin@example.com", passwordHash]
  );

  console.log("Seeded admin@example.com / ChangeMe123!");
  await db.end();
}
main().catch(e => { console.error(e); process.exit(1); });
