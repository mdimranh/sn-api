import { Schema, model, Types } from "mongoose";

export interface IPost {
  author: Types.ObjectId;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 10000 },
  },
  { timestamps: true },
);

/*
 * INDEXES
 *
 * { author: 1, _id: -1 }
 *    - Scenario 2: the $lookup (localField/foreignField + sub-pipeline) matches
 *      posts.author == users._id, sorts newest first and paginates.
 *      Equality + sort on the same index => no in-memory sort.
 *    - also used by the cascade delete when an admin removes a user.
 *
 * NOT needed: public "all posts" feed sorts by _id desc (default _id index).
 */
postSchema.index({ author: 1, _id: -1 });

export const Post = model<IPost>("Post", postSchema);
