import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    owner: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true},
    type: {type: String, enum: ["AI_SUMMARY", "AI_INSIGHT", "AI_DRAFT", "LEAD_NEW"], required: true},
    title: {type: String, required: true, trim: true},
    message: {type: String, required: true, trim: true},
    details: {type: String, default: "", trim: true},
    lead: {type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null},
    read: {type: Boolean, default: false},
  },
  {timestamps: true},
);

notificationSchema.index({owner: 1, createdAt: -1});

export const Notification = mongoose.model("Notification", notificationSchema);
