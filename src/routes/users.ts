import { Hono } from "hono";
import type { PipelineStage } from "mongoose";
import { requireAdmin, requireAuth, type AppEnv } from "../middleware/auth.js";
import { Note } from "../models/note.js";
import { Post } from "../models/post.js";
import { User } from "../models/user.js";
import { adminCreateUserSchema, adminUpdateUserSchema } from "../schemas.js";
import { objectId, pageMeta, parsePage, readJson } from "../utils/http.js";
import { hashPassword } from "../utils/security.js";

export const userRoutes = new Hono<AppEnv>();
userRoutes.use("*", requireAuth, requireAdmin);

// List users (paginated, newest first) -> default _id index
userRoutes.get("/", async (c) => {
  const { page, limit, skip } = parsePage(c);
  const [items, total] = await Promise.all([
    User.find().sort({ _id: -1 }).skip(skip).limit(limit).select("-__v").lean(),
    User.estimatedDocumentCount(),
  ]);
  return c.json({ items, pagination: pageMeta(page, limit, total) });
});

/*
 * SCENARIO 1 - users grouped by interests.
 * Exactly ONE User.aggregate() call; no other query methods are used.
 *
 *  $match  interests (equality if ?interest=chess, else $gte "") -> always an IXSCAN on { interests: 1 }
 *  $unwind interests                  -> one doc per (user, interest)
 *  $match  (re-filter after unwind so only the requested group is returned)
 *  $group  by interest                -> count + first 50 users of each group
 *  $sort   biggest groups first
 *  $facet  -> page of groups + total number of groups in the same round trip
 */
userRoutes.get("/grouped-by-interests", async (c) => {
  const { page, limit, skip } = parsePage(c);
  const interest = c.req.query("interest")?.trim().toLowerCase();
  // First stage ALWAYS hits the { interests: 1 } index:
  //  - with ?interest=chess  -> equality bounds on that single key
  //  - without a filter      -> $gte "" scans every string key of the index
  //    (users with an empty interests array are skipped, which $unwind would drop anyway)
  const firstMatch: PipelineStage = { $match: { interests: interest ? interest : { $gte: "" } } };
  const afterUnwind: PipelineStage[] = interest ? [{ $match: { interests: interest } }] : [];

  const [result] = await User.aggregate<{
    items: { _id: string; count: number; users: { _id: string; name: string; email: string }[] }[];
    meta: { total: number }[];
  }>([
    firstMatch,
    { $unwind: "$interests" },
    ...afterUnwind,
    {
      $group: {
        _id: "$interests",
        count: { $sum: 1 },
        users: {
          $firstN: { n: 50, input: { _id: "$_id", name: "$name", email: "$email" } },
        },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: "total" }],
      },
    },
  ]);

  const total = result?.meta[0]?.total ?? 0;
  const items = (result?.items ?? []).map((g) => ({ interest: g._id, count: g.count, users: g.users }));
  return c.json({ items, pagination: pageMeta(page, limit, total) });
});

userRoutes.post("/", async (c) => {
  const { password, ...rest } = adminCreateUserSchema.parse(await readJson(c));
  const user = await User.create({ ...rest, passwordHash: await hashPassword(password) });
  return c.json(user.toJSON(), 201);
});

userRoutes.get("/:id", async (c) => {
  const user = await User.findById(objectId(c.req.param("id"))).select("-__v").lean();
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

userRoutes.patch("/:id", async (c) => {
  const { password, ...rest } = adminUpdateUserSchema.parse(await readJson(c));
  const id = objectId(c.req.param("id"));
  const user = await User.findById(id);
  if (!user) return c.json({ error: "User not found" }, 404);

  if (rest.role && rest.role !== "admin" && user._id.equals(c.get("user")._id)) {
    return c.json({ error: "You cannot remove your own admin role" }, 400);
  }
  user.set(rest);
  if (password) user.passwordHash = await hashPassword(password);
  await user.save();
  return c.json(user.toJSON());
});

userRoutes.delete("/:id", async (c) => {
  const id = objectId(c.req.param("id"));
  if (id.equals(c.get("user")._id)) return c.json({ error: "You cannot delete yourself" }, 400);

  const res = await User.deleteOne({ _id: id });
  if (!res.deletedCount) return c.json({ error: "User not found" }, 404);

  // Cascade: both use the { owner|author: 1, _id: -1 } indexes
  await Promise.all([Note.deleteMany({ owner: id }), Post.deleteMany({ author: id })]);
  return c.json({ success: true });
});
