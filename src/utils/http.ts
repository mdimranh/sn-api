import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { Types } from "mongoose";
import { z } from "zod";

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export function parsePage(c: Context) {
  const { page, limit } = pageQuery.parse(c.req.query());
  return { page, limit, skip: (page - 1) * limit };
}

export const pageMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

export function objectId(id: string | undefined) {
  if (!id || !/^[a-f\d]{24}$/i.test(id)) throw new HTTPException(404, { message: "Not found" });
  return new Types.ObjectId(id);
}

export const readJson = (c: Context) => c.req.json().catch(() => ({}));
