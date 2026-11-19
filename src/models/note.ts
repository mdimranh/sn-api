import { Schema, model, Types } from "mongoose";

export interface INote {
  owner: Types.ObjectId;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<INote>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: "", maxlength: 10000 },
  },
  { timestamps: true },
);

/*
 * INDEXES
 *
 * { owner: 1, _id: -1 }
 *    - "My notes" list: filter by owner, newest first, paginated
 *    - Admin "notes of user X" list (?owner=...) uses the same index
 *    - Equality on owner, then sort on _id (no in-memory sort)
 *    - also serves countDocuments({ owner }) for pagination totals
 *
 * NOT needed:
 *    - GET /notes/:id               -> _id index
 *    - Admin list of ALL notes      -> sort by _id desc uses the _id index
 */
noteSchema.index({ owner: 1, _id: -1 });

export const Note = model<INote>("Note", noteSchema);
