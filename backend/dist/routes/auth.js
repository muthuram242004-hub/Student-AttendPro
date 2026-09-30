"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const schema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6)
});
function authRoutes(db) {
    const router = (0, express_1.Router)();
    router.post("/login", async (req, res) => {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ message: "Invalid credentials" });
        const { email, password } = parsed.data;
        const result = await db.query(`SELECT u.id, u.full_name, u.email, u.password_hash, r.name AS role
       FROM users u JOIN roles r ON r.id=u.role_id
       WHERE LOWER(u.email)=LOWER($1) AND u.is_active=true`, [email]);
        const user = result.rows[0];
        if (!user || !user.password_hash || !(await bcryptjs_1.default.compare(password, user.password_hash))) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        const payload = {
            id: user.id,
            role: user.role,
            fullName: user.full_name,
            email: user.email
        };
        const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });
        res.json({ token, user: payload });
    });
    router.get("/me", auth_1.requireAuth, (req, res) => {
        res.json({ user: req.user });
    });
    return router;
}
