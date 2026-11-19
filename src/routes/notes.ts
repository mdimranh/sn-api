import { Hono } from "hono";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import { Note } from "../models/note.js";
import { noteCreateSchema, noteUpdateSchema } from "../schemas.js";
import { objectId, pageMeta, parsePage, readJson } from "../utils/http.js";

export const noteRoutes = new Hono<AppEnv>();
noteRoutes.use("*", requireAuth);

// List MY notes (paginated). Index: { owner: 1, _id: -1 }
noteRoutes.get("/", async (c) => {
  const { page, limit, skip } = parsePage(c);
  const filter = { owner: c.get("user")._id };
  const [items, total] = await Promise.all([
    Note.find(filter).sort({ _id: -1 }).skip(skip).limit(limit).select("-__v").lean(),
    Note.countDocuments(filter),
  ]);
  return c.json({ items, pagination: pageMeta(page, limit, total) });
});

noteRoutes.post("/", async (c) => {
  const body = noteCreateSchema.parse(await readJson(c));
  const note = await Note.create({ ...body, owner: c.get("user")._id });
  return c.json(note.toJSON(), 201);
});

// Owner can read their note; admin can read anyone's. Lookup by _id.
noteRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const note = await Note.findById(objectId(c.req.param("id"))).select("-__v").lean();
  if (!note || (user.role !== "admin" && !note.owner.equals(user._id))) {
    return c.json({ error: "Note not found" }, 404);
  }
  return c.json(note);
});

// Only the owner can modify / delete (admin "inherits user capabilities" = own notes)
noteRoutes.patch("/:id", async (c) => {
  const body = noteUpdateSchema.parse(await readJson(c));
  const note = await Note.findOneAndUpdate(
    { _id: objectId(c.req.param("id")), owner: c.get("user")._id },
    body,
    { new: true, runValidators: true },
  )
    .select("-__v")
    .lean();
  if (!note) return c.json({ error: "Note not found" }, 404);
  return c.json(note);
});

noteRoutes.delete("/:id", async (c) => {
  const res = await Note.deleteOne({ _id: objectId(c.req.param("id")), owner: c.get("user")._id });
  if (!res.deletedCount) return c.json({ error: "Note not found" }, 404);
  return c.json({ success: true });
});
