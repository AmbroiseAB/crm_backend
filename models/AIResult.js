import mongoose from "mongoose";

const aiResultSchema = new mongoose.Schema(
  {
    owner: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true},
    type: {type: String, enum: ["SUMMARY", "EMAIL", "INSIGHT", "NBA"], required: true},
    lead: {type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null},
    result: {type: mongoose.Schema.Types.Mixed, required: true},
  },
  {timestamps: true},
);

aiResultSchema.index({owner: 1, createdAt: -1});

export const AIResult = mongoose.model("AIResult", aiResultSchema);
