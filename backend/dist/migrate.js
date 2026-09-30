"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const pg_1 = require("pg");
async function main() {
    if (!process.env.DATABASE_URL)
        throw new Error("DATABASE_URL is required");
    const db = new pg_1.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    try {
        const sql = await (0, promises_1.readFile)((0, node_path_1.resolve)(__dirname, "../../database/migrations/001_optional_student_credentials.sql"), "utf8");
        await db.query(sql);
        console.log("Student email and password are now optional in the database.");
    }
    finally {
        await db.end();
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
