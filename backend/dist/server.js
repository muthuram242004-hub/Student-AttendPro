"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const pg_1 = require("pg");
const auth_1 = require("./routes/auth");
const classes_1 = require("./routes/classes");
const attendance_1 = require("./routes/attendance");
const reports_1 = require("./routes/reports");
const students_1 = require("./routes/students");
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 4000);
const db = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error("Not allowed by CORS"));
    }
}));
app.use(express_1.default.json({ limit: "1mb" }));
app.get("/api/health", async (_req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({ status: "ok", database: "connected" });
    }
    catch {
        res.status(503).json({ status: "error", database: "unavailable" });
    }
});
app.use("/api/auth", (0, auth_1.authRoutes)(db));
app.use("/api/classes", (0, classes_1.classRoutes)(db));
app.use("/api/students", (0, students_1.studentRoutes)(db));
app.use("/api/attendance", (0, attendance_1.attendanceRoutes)(db));
app.use("/api/reports", (0, reports_1.reportRoutes)(db));
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
});
app.listen(port, () => console.log(`Attendance API running on http://localhost:${port}`));
