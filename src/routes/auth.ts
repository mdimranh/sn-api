import { Hono } from "hono";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import { User } from "../models/user.js";
import { loginSchema, registerSchema, updateMeSchema } from "../schemas.js";
import { readJson } from "../utils/http.js";
import { DUMMY_HASH, hashPassword, signToken, verifyPassword } from "../utils/security.js";

export const authRoutes = new Hono<AppEnv>();

// Public self-registration always creates a plain "user"
authRoutes.post("/register", async (c) => {
  const body = registerSchema.parse(await readJson(c));
  const user = await User.create({
    name: body.name,
    email: body.email,
    interests: body.interests,
    passwordHash: await hashPassword(body.password),
  });
  return c.json({ token: signToken(user), user: user.toJSON() }, 201);
});

authRoutes.post("/login", async (c) => {
  const { email, password } = loginSchema.parse(await readJson(c));
  const user = await User.findOne({ email }).select("+passwordHash"); // uses { email: 1 }
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return c.json({ error: "Invalid email or password" }, 401);
  return c.json({ token: signToken(user), user: user.toJSON() });
});

authRoutes.get("/me", requireAuth, (c) => c.json(c.get("user").toJSON()));

authRoutes.patch("/me", requireAuth, async (c) => {
  const { password, ...rest } = updateMeSchema.parse(await readJson(c));
  const user = c.get("user");
  user.set(rest);
  if (password) user.passwordHash = await hashPassword(password);
  await user.save();
  return c.json(user.toJSON());
});
