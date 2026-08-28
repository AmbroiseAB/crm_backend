import {Task} from "../models/Task.js";
import {Lead} from "../models/Lead.js";
import {Contact} from "../models/Contact.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";

const validateTaskLinks = async ({updates, owner}) => {
  if (updates.relatedLead) {
    const lead = await Lead.exists({_id: updates.relatedLead, owner});
    if (!lead) throw new ApiError(404, "Lead not found");
  }
  if (updates.relatedContact) {
    const contact = await Contact.exists({_id: updates.relatedContact, owner});
    if (!contact) throw new ApiError(404, "Contact not found");
  }
};

export const getTasks = asyncHandler(async (req, res) => {
  const {status, priority, relatedLead} = req.query;
  const filter = {owner: req.user._id};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (relatedLead) filter.relatedLead = relatedLead;

  const tasks = await Task.find(filter)
    .sort({status: 1, dueDate: 1, createdAt: -1})
    .populate("relatedLead", "name company")
    .populate("relatedContact", "name company");

    res.json({success: true, count: tasks.length, tasks});
});

export const createTask = asyncHandler(async (req, res) => {
  const {owner, ...updates} = req.body;
  await validateTaskLinks({updates, owner: req.user._id});
  const task = await Task.create({...updates, owner: req.user._id});
  res.status(201).json({success: true, task});
});

export const updateTask = asyncHandler(async (req, res) => {
  const {owner, ...updates} = req.body;
  await validateTaskLinks({updates, owner: req.user._id});
  
  if (updates.status === "Completed" && !updates.completedAt) {
    updates.completedAt = new Date();
  }
  if (updates.status && updates.status !== "Completed") {
    updates.completedAt = null;
  }

  const task = await Task.findOneAndUpdate(
    {_id: req.params.id, owner: req.user._id},
    updates,
    {new: true, runValidators: true},
  );
  if (!task) throw new ApiError(404, "Task not found");
  res.json({success: true, task});
});

export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findOneAndDelete({
    _id: req.params.id,
    owner: req.user._id,
  });
  if (!task) throw new ApiError(404, "Task not found");
  res.json({success: true, message: "Task deleted"});
});