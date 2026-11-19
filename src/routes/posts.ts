import { Hono } from "hono";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import { Post } from "../models/post.js";
import { User } from "../models/user.js";
import { postCreateSchema } from "../schemas.js";
import { objectId, pageMeta, parsePage, readJson } from "../utils/http.js";

export const postRoutes = new Hono<AppEnv>();

// Posts are visible to everyone (no auth). Sorted by _id desc -> default _id index.
postRoutes.get("/", async (c) => {
  const { page, limit, skip } = parsePage(c);
  const [items, total] = await Promise.all([
    Post.find().sort({ _id: -1 }).skip(skip).limit(limit).select("-__v").populate("author", "name").lean(),
    Post.estimatedDocumentCount(),
  ]);
  return c.json({ items, pagination: pageMeta(page, limit, total) });
});

/*
 * SCENARIO 2 - all posts belonging to a particular user, via $lookup.
 * One aggregation pipeline on `users`:
 *   $match  _id            -> _id index
 *   $lookup posts          -> localField _id / foreignField author, with a
 *                             sub-pipeline (sort newest, skip, limit) that is
 *                             served by the { author: 1, _id: -1 } index
 *   $lookup posts (count)  -> total number of posts for pagination, same index
 */
postRoutes.get("/user/:userId", async (c) => {
  const { page, limit, skip } = parsePage(c);
  const userId = objectId(c.req.param("userId"));

  const [result] = await User.aggregate<{
    _id: string;
    name: string;
    total: number;
    posts: { _id: string; title: string; content: string; createdAt: string }[];
  }>([
    { $match: { _id: userId } },
    {
      $lookup: {
        from: Post.collection.name,
        localField: "_id",
        foreignField: "author",
        pipeline: [
          { $sort: { _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: { title: 1, content: 1, createdAt: 1 } },
        ],
        as: "posts",
      },
    },
    {
      $lookup: {
        from: Post.collection.name,
        localField: "_id",
        foreignField: "author",
        pipeline: [{ $count: "n" }],
        as: "postCount",
      },
    },
    {
      $project: {
        name: 1,
        posts: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$postCount.n", 0] }, 0] },
      },
    },
  ]);

  if (!result) return c.json({ error: "User not found" }, 404);
  return c.json({
    user: { _id: result._id, name: result.name },
    items: result.posts,
    pagination: pageMeta(page, limit, result.total),
  });
});

postRoutes.post("/", requireAuth, async (c) => {
  const body = postCreateSchema.parse(await readJson(c));
  const post = await Post.create({ ...body, author: c.get("user")._id });
  return c.json(post.toJSON(), 201);
});
