import { createMiddleware } from "hono/factory";
import type { HydratedDocument } from "mongoose";
import { User, type IUser } from "../models/user.js";
import { verifyToken } from "../utils/security.js";

export type AppEnv = { Variables: { user: HydratedDocument<IUser> } };

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return c.json({ error: "Missing bearer token" }, 401);

  let sub: string;
  try {
    sub = verifyToken(header.slice(7)).sub;
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // _id lookup (default index). Ensures deleted users / role changes take effect immediately.
  const user = /^[a-f\d]{24}$/i.test(sub) ? await User.findById(sub) : null;
  if (!user) return c.json({ error: "Invalid or expired token" }, 401);

  c.set("user", user);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user").role !== "admin") return c.json({ error: "Admin access required" }, 403);
  await next();
});
