import mongoose from "mongoose";
import {LEAD_STATUSES} from "./Lead.js";

const stageHistorySchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fromStage: {type: String, default: null},
    toStage: {type: String, enum: LEAD_STATUSES, required: true},
    changedAt: {type: Date, default: Date.now, required: true, index: true},
  },
  {timestamps: true},
);

stageHistorySchema.index({leadId: 1, changedAt: -1});

export const StageHistory = mongoose.model("StageHistory", stageHistorySchema);