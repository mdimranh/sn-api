import mongoose from "mongoose";
import { assertConfig, config } from "./config.js";
import { User } from "./models/user.js";
import { Note } from "./models/note.js";
import { Post } from "./models/post.js";
import { hashPassword } from "./utils/security.js";

async function ensureAdmin() {
  if (!config.adminEmail || !config.adminPassword) return;
  const email = config.adminEmail.toLowerCase();
  if (await User.exists({ email })) return;
  try {
    await User.create({
      name: config.adminName,
      email,
      role: "admin",
      passwordHash: await hashPassword(config.adminPassword),
    });
    console.log(`Seeded admin ${email}`);
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err; // another instance won the race
  }
}

let connecting: Promise<void> | null = null;

export function connectDb() {
  if (!connecting) {
    connecting = (async () => {
      assertConfig();
      await mongoose.connect(config.mongoUri);
      // Build the indexes declared with schema.index()
      await Promise.all([User.init(), Note.init(), Post.init()]);
      await ensureAdmin();
    })().catch((err) => {
      connecting = null;
      throw err;
    });
  }
  return connecting;
}
