import mongoose from "mongoose";

export const INTERACTION_TYPES = ["CALL", "EMAIL", "WHATSAPP", "SMS", "MEETING", "NOTE"];
export const INTERACTION_DIRECTIONS = ["INBOUND", "OUTBOUND"];
export const INTERACTION_OUTCOMES = [
  "CONNECTED",
  "NO_ANSWER",
  "REPLIED",
  "MEETING_BOOKED",
  "QUOTE_REQUESTED",
  "QUOTE_SENT",
  "FOLLOW_UP",
  "WON",
  "LOST",
  "OTHER",
];

const interactionSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, enum: INTERACTION_TYPES, required: true },
    direction: { type: String, enum: INTERACTION_DIRECTIONS, default: null },
    channel: { type: String, enum: INTERACTION_TYPES, required: true },
    outcome: { type: String, enum: INTERACTION_OUTCOMES, default: null },
    summary: { type: String, required: [true, "Interaction summary is required"], trim: true, maxlength: 2000 },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

interactionSchema.index({ leadId: 1, timestamp: -1 });

export const Interaction = mongoose.model("Interaction", interactionSchema);