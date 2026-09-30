import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const sql = await readFile(resolve(__dirname, "../../database/migrations/001_optional_student_credentials.sql"), "utf8");
    await db.query(sql);
    console.log("Student email and password are now optional in the database.");
  } finally {
    await db.end();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
