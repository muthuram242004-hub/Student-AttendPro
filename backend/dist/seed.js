"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const pg_1 = require("pg");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function main() {
    const db = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
    const passwordHash = await bcryptjs_1.default.hash("ChangeMe123!", 12);
    const role = await db.query(`SELECT id FROM roles WHERE name='ADMIN'`);
    await db.query(`INSERT INTO users(role_id,full_name,email,password_hash)
     VALUES($1,$2,$3,$4)
     ON CONFLICT(email) DO NOTHING`, [role.rows[0].id, "System Admin", "admin@example.com", passwordHash]);
    console.log("Seeded admin@example.com / ChangeMe123!");
    await db.end();
}
main().catch(e => { console.error(e); process.exit(1); });
