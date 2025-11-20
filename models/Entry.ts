import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEntry extends Document {
  name: string;
  type: string;
  completed: boolean;
  count: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const EntrySchema = new Schema<IEntry>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    completed: { type: Boolean, default: false },
    count: { type: Number, default: 1, required: true },
  },
  { timestamps: true }
);

const Entry: Model<IEntry> = (mongoose.models.Entry as Model<IEntry>) || mongoose.model<IEntry>("Entry", EntrySchema);

export default Entry;
