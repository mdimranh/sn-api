import { Hono } from "hono";
import { requireAdmin, requireAuth, type AppEnv } from "../middleware/auth.js";
import { Note } from "../models/note.js";
import { objectId, pageMeta, parsePage } from "../utils/http.js";

export const adminRoutes = new Hono<AppEnv>();
adminRoutes.use("*", requireAuth, requireAdmin);

// Admin: everyone's notes (paginated), optional ?owner=<userId>
//  - no filter  -> sorted by _id desc (default _id index)
//  - ?owner=... -> { owner: 1, _id: -1 }
adminRoutes.get("/notes", async (c) => {
  const { page, limit, skip } = parsePage(c);
  const ownerParam = c.req.query("owner");
  const filter = ownerParam ? { owner: objectId(ownerParam) } : {};
  const [items, total] = await Promise.all([
    Note.find(filter)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .populate("owner", "name email") // _id lookups
      .lean(),
    ownerParam ? Note.countDocuments(filter) : Note.estimatedDocumentCount(),
  ]);
  return c.json({ items, pagination: pageMeta(page, limit, total) });
});
