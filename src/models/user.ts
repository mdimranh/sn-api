import { Schema, model } from "mongoose";

export type Role = "user" | "admin";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  interests: string[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    interests: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

/*
 * INDEXES (only what the queries require)
 *
 * 1. { email: 1 } unique
 *    - POST /auth/login and register look users up by email (read op)
 *    - enforces email uniqueness
 *
 * 2. { interests: 1 } (multikey)
 *    - Scenario 1: GET /users/grouped-by-interests?interest=chess starts with
 *      a $match on interests, which uses this multikey index.
 *
 * NOT needed (the default _id index already covers them):
 *    - GET /users/:id, GET /auth/me          -> lookup by _id
 *    - GET /users (admin list, newest first) -> sort by _id desc
 *      (ObjectId embeds a timestamp, so _id order == creation order)
 */
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ interests: 1 });

export const User = model<IUser>("User", userSchema);
