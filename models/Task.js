import mongoose from "mongoose";

export const TASK_STATUSES = ["Pending", "In Progress", "Completed"];
export const TASK_PRIORITIES = ["Low", "Medium", "High"];

const taskSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    org: {type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null},
    assignedTo: {type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null},
    title: { type: String, required: [true, "Task title is required"], trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, trim: true, default: "", maxlength: 5000 },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: TASK_STATUSES, default: "Pending", index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: "Medium"},
    relatedLead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
    relatedContact: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", default: null },
    isNextAction: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Task = mongoose.model("Task", taskSchema);