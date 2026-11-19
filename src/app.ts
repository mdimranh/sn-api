import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { noteRoutes } from "./routes/notes.js";
import { postRoutes } from "./routes/posts.js";
import { userRoutes } from "./routes/users.js";

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.corsOrigin === "*" ? "*" : config.corsOrigin.split(",").map((o) => o.trim()),
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/", (c) => c.json({ name: "secure-notes-api", status: "ok" }));
app.get("/health", (c) => c.json({ status: "ok" }));

// make sure Mongo is connected + indexes are built before any data route runs
app.use("*", async (_c, next) => {
  await connectDb();
  await next();
});

app.route("/auth", authRoutes);
app.route("/notes", noteRoutes);
app.route("/users", userRoutes);
app.route("/posts", postRoutes);
app.route("/admin", adminRoutes);

app.notFound((c) => c.json({ error: "Route not found" }, 404));

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        error: "Validation failed",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      400,
    );
  }
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status as ContentfulStatusCode);
  if ((err as { code?: number }).code === 11000) return c.json({ error: "Email is already in use" }, 409);
  if (err.name === "ValidationError" || err.name === "CastError") return c.json({ error: err.message }, 400);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});
