import "dotenv/config";
import express from "express";
import cors from "cors";
import { Pool } from "pg";
import { authRoutes } from "./routes/auth";
import { classRoutes } from "./routes/classes";
import { attendanceRoutes } from "./routes/attendance";
import { reportRoutes } from "./routes/reports";
import { studentRoutes } from "./routes/students";

const app = express();
const port = Number(process.env.PORT || 4000);
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.use("/api/auth", authRoutes(db));
app.use("/api/classes", classRoutes(db));
app.use("/api/students", studentRoutes(db));
app.use("/api/attendance", attendanceRoutes(db));
app.use("/api/reports", reportRoutes(db));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(port, () => console.log(`Attendance API running on http://localhost:${port}`));
