import { z } from "zod";

const name = z.string().trim().min(1).max(100);
const email = z.string().trim().toLowerCase().email().max(254);
// bcrypt only uses the first 72 bytes, so cap there
const password = z.string().min(8).max(72);
const interests = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(20)
  .transform((list) => [...new Set(list)]);
const role = z.enum(["user", "admin"]);

export const registerSchema = z.object({ name, email, password, interests: interests.default([]) });
export const loginSchema = z.object({ email, password: z.string().min(1) });
export const updateMeSchema = z.object({ name, password, interests }).partial();

export const adminCreateUserSchema = registerSchema.extend({ role: role.default("user") });
export const adminUpdateUserSchema = z.object({ name, email, password, role, interests }).partial();

const title = z.string().trim().min(1).max(200);
const body = z.string().max(10000);
export const noteCreateSchema = z.object({ title, content: body.default("") });
export const noteUpdateSchema = z.object({ title, content: body }).partial();
export const postCreateSchema = z.object({ title, content: body.min(1) });
