import mongoose from "mongoose";
import {BUYING_INTENTS, QUALIFICATION_STATUSES} from "../services/lead-scoring.service.js";

export const LEAD_STATUSES = ["New", "Qualified", "Proposal", "Won", "Lost"];
export const LEAD_PRIORITIES = ["Low", "Medium", "High"];

const leadSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {type: String, required: [true, "Lead name is required"], trim: true, minlength: 2, maxlength: 100},
    email: {type: String, trim: true, lowercase: true, default:"", maxlength: 254},
    phone: {type: String, trim:true, default:""},
    phoneCountry: {type: String, trim: true, uppercase: true, default: "CM", maxlength: 2},
    company: {type: String, trim: true, default: ""},
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "New",
      index: true,
    },
    priority: {
      type: String,
      enum: LEAD_PRIORITIES,
      default: "Medium"
    },
    source: {
      type: String,
      enum: ["Website", "Referral", "Cold Outreach", "Social", "Event", "Public Form", "Other"],
      default: "Other",
    },
    value: {type: Number, default: 0, min: 0},
    notes: {type: String, trim: true, default: "", maxlength: 5000},
    tags: [{type: String, trim: true}],
    nextAction: {type: String, trim: true, default: null, maxlength: 500},
    nextActionDueAt: {type: Date, default: null, index: true},
    nextActionTask: {type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null},
    qualificationStatus: {type: String, enum: QUALIFICATION_STATUSES, default: "UNQUALIFIED", index: true},
    buyingIntent: {type: String, enum: BUYING_INTENTS, default: null},
    decisionMakerIdentified: {type: Boolean, default: false},
    budgetKnown: {type: Boolean, default: false},
    timelineKnown: {type: Boolean, default: false},
    needIdentified: {type: Boolean, default: false},
    aiSummary: {type: String, default: ""},
    aiRiskScore: {type: Number, default: null},
    order: {type: Number, default: 0},
  },
  {timestamps: true}
);

export const Lead = mongoose.model("Lead", leadSchema);