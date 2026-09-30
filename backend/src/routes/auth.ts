import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { Pool } from "pg";
import { AuthRequest, requireAuth } from "../middleware/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export function authRoutes(db: Pool) {
  const router = Router();

  router.post("/login", async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid credentials" });

    const { email, password } = parsed.data;
    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.password_hash, r.name AS role
       FROM users u JOIN roles r ON r.id=u.role_id
       WHERE LOWER(u.email)=LOWER($1) AND u.is_active=true`,
      [email]
    );

    const user = result.rows[0];
    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const payload = {
      id: user.id,
      role: user.role,
      fullName: user.full_name,
      email: user.email
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "8h" });
    res.json({ token, user: payload });
  });

  router.get("/me", requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  return router;
}
