import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    org: {type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null},
    content: { type: String, required: [true , "Note content is required"], trim: true, maxlength: 10000 },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
    contact: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Contact",
      default: null,
    },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Note = mongoose.model("Note", noteSchema);
      