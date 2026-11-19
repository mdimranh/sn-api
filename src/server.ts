import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";

connectDb()
  .then(() => {
    serve({ fetch: app.fetch, port: config.port }, (info) => {
      console.log(`API listening on http://localhost:${info.port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });
