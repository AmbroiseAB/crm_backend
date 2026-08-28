import {Lead} from "../models/Lead.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {Interaction} from "../models/Interaction.js";
import {Task} from "../models/Task.js";
import {StageHistory} from "../models/StageHistory.js";
import {scoreLead, BUYING_INTENTS, QUALIFICATION_STATUSES} from "../services/lead-scoring.service.js";
import {
  INTERACTION_TYPES,
  INTERACTION_DIRECTIONS,
  INTERACTION_OUTCOMES,
} from "../models/Interaction.js";
import {normalizeEmail, normalizeName, validateEmail, validateName, validatePhone} from "../utils/validation.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const editableLeadFields = ["name", "email", "phone", "phoneCountry", "company", "status", "priority", "source", "value", "notes"];
const normalizeLead = (body) => {
  const updates = Object.fromEntries(editableLeadFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
  if (updates.name !== undefined) { updates.name = normalizeName(updates.name); const error = validateName(updates.name, "Lead name"); if (error) throw new ApiError(400, error); }
  if (updates.email !== undefined) { updates.email = normalizeEmail(updates.email); const error = validateEmail(updates.email); if (error) throw new ApiError(400, error); }
  if (updates.phone !== undefined) { updates.phone = typeof updates.phone === "string" ? updates.phone.trim() : updates.phone; const error = validatePhone(updates.phone, updates.phoneCountry); if (error) throw new ApiError(400, error); }
  if (updates.value !== undefined && (typeof updates.value !== "number" || !Number.isFinite(updates.value) || updates.value < 0)) throw new ApiError(400, "Deal value must be a finite non-negative number");
  return updates;
};

export const getLeads = asyncHandler(async (req, res) => {
  const {status, priority, source, qualificationStatus, search } = req.query;

  const filter = {owner: req.user._id};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (source) filter.source = source;
  if (qualificationStatus) filter.qualificationStatus = qualificationStatus;
  if (search) {
    const rx = new RegExp(escapeRegex(search.slice(0, 100)), "i");
    filter.$or = [{name: rx}, {email: rx}, {company: rx}];
  }

  const leads = await Lead.find(filter).sort({order: 1, createdAt: -1});
    res.json({success: true, count: leads.length, leads: leads.map((lead) => ({...lead.toObject(), ...scoreLead(lead)}))});
});

export const getLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({_id: req.params.id, owner: req.user._id});
  if (!lead) throw new ApiError(404, "Lead not found");
  res.json({success: true, lead: {...lead.toObject(), ...scoreLead(lead)}});
});

export const createLead = asyncHandler(async (req, res) => {
  const lead = await Lead.create({...normalizeLead(req.body), owner: req.user._id});
  try {
    await StageHistory.create({leadId: lead._id, changedBy: req.user._id, fromStage: null, toStage: lead.status, changedAt: lead.createdAt});
    await Interaction.create({
      leadId: lead._id,
      createdBy: req.user._id,
      type: "NOTE",
      channel: "NOTE",
      summary: "Lead created",
      timestamp: lead.createdAt,
    });
  } catch (error) {
    await StageHistory.deleteMany({leadId: lead._id});
    await Lead.deleteOne({_id: lead._id, owner: req.user._id});
    throw error;
  }
  res.status(201).json({success: true, lead});
});

export const validateInteraction = (body) => {
  const {type, channel, direction, outcome, summary, timestamp} = body;
  if (!type || !INTERACTION_TYPES.includes(type)) {
    throw new ApiError(400, `type must be one of: ${INTERACTION_TYPES.join(", ")}`);
  }
  if (!channel || !INTERACTION_TYPES.includes(channel)) {
    throw new ApiError(400, `channel must be one of: ${INTERACTION_TYPES.join(", ")}`);
  }
  if (direction && !INTERACTION_DIRECTIONS.includes(direction)) {
    throw new ApiError(400, `direction must be one of: ${INTERACTION_DIRECTIONS.join(", ")}`);
  }
  if (outcome && !INTERACTION_OUTCOMES.includes(outcome)) {
    throw new ApiError(400, `outcome must be one of: ${INTERACTION_OUTCOMES.join(", ")}`);
  }
  if (typeof summary !== "string" || !summary.trim()) {
    throw new ApiError(400, "Interaction summary is required");
  }
  if (summary.trim().length > 2000) {
    throw new ApiError(400, "Interaction summary cannot exceed 2000 characters");
  }
  if (timestamp && Number.isNaN(new Date(timestamp).getTime())) {
    throw new ApiError(400, "timestamp must be a valid date");
  }
};

export const createInteraction = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({_id: req.params.id, owner: req.user._id}).select("_id");
  if (!lead) throw new ApiError(404, "Lead not found");
  validateInteraction(req.body);

  const {type, channel, direction, outcome, summary, timestamp} = req.body;
  const interaction = await Interaction.create({
    leadId: lead._id,
    createdBy: req.user._id,
    type,
    channel,
    direction: direction || null,
    outcome: outcome || null,
    summary: summary.trim(),
    timestamp: timestamp || new Date(),
  });
  const populated = await interaction.populate("createdBy", "name");
  res.status(201).json({success: true, interaction: populated});
});

export const getInteractions = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({_id: req.params.id, owner: req.user._id}).select("_id");
  if (!lead) throw new ApiError(404, "Lead not found");

  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const interactions = await Interaction.find({leadId: lead._id})
    .sort({timestamp: -1, createdAt: -1})
    .limit(limit)
    .populate("createdBy", "name");
  res.json({success: true, count: interactions.length, interactions, limit});
});

export const parseNextAction = (body) => {
  const {nextAction, nextActionDueAt} = body;
  if (nextAction == null || nextAction === "") {
    if (nextActionDueAt) throw new ApiError(400, "A due date requires a next action");
    return {nextAction: null, nextActionDueAt: null};
  }
  if (typeof nextAction !== "string" || !nextAction.trim()) {
    throw new ApiError(400, "Next action cannot be empty");
  }
  if (nextAction.trim().length > 500) {
    throw new ApiError(400, "Next action cannot exceed 500 characters");
  }
  if (!nextActionDueAt || Number.isNaN(new Date(nextActionDueAt).getTime())) {
    throw new ApiError(400, "A valid next action due date is required");
  }
  return {nextAction: nextAction.trim(), nextActionDueAt: new Date(nextActionDueAt)};
};

export const updateNextAction = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({_id: req.params.id, owner: req.user._id});
  if (!lead) throw new ApiError(404, "Lead not found");

  const next = parseNextAction(req.body);
  const previousAction = lead.nextAction;
  const {createTask = false} = req.body;
  let task = null;

  if (next.nextAction && createTask) {
    if (lead.nextActionTask) {
      task = await Task.findOneAndUpdate(
        {_id: lead.nextActionTask, owner: req.user._id, status: {$ne: "Completed"}},
        {title: next.nextAction, dueDate: next.nextActionDueAt, relatedLead: lead._id, isNextAction: true},
        {new: true, runValidators: true},
      );
    }
    if (!task) {
      task = await Task.create({
        owner: req.user._id,
        title: next.nextAction,
        dueDate: next.nextActionDueAt,
        priority: lead.priority,
        relatedLead: lead._id,
        isNextAction: true,
      });
    }
  }

  lead.nextAction = next.nextAction;
  lead.nextActionDueAt = next.nextActionDueAt;
  lead.nextActionTask = task?._id || (next.nextAction ? lead.nextActionTask : null);
  await lead.save();

  if (next.nextAction) {
    await Interaction.create({
      leadId: lead._id,
      createdBy: req.user._id,
      type: "NOTE",
      channel: "NOTE",
      summary: `Next action scheduled: ${next.nextAction}`,
      timestamp: new Date(),
    });
  }

  const updated = await Lead.findById(lead._id).populate("nextActionTask", "title dueDate status");
  res.json({success: true, lead: updated, task});
});

export const completeNextAction = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({_id: req.params.id, owner: req.user._id});
  if (!lead) throw new ApiError(404, "Lead not found");
  if (!lead.nextAction) throw new ApiError(400, "This lead has no next action");

  const action = lead.nextAction;
  let task = null;
  if (lead.nextActionTask) {
    task = await Task.findOneAndUpdate(
      {_id: lead.nextActionTask, owner: req.user._id, status: {$ne: "Completed"}},
      {status: "Completed", completedAt: new Date()},
      {new: true, runValidators: true},
    );
  }

  lead.nextAction = null;
  lead.nextActionDueAt = null;
  lead.nextActionTask = null;
  await lead.save();
  await Interaction.create({
    leadId: lead._id,
    createdBy: req.user._id,
    type: "NOTE",
    channel: "NOTE",
    summary: `Next action completed: ${action}`,
    timestamp: new Date(),
  });

  res.json({success: true, lead, task});
});

const changeLeadStage = async ({lead, nextStage, userId}) => {
  if (!nextStage || nextStage === lead.status) return lead;
  if (!Lead.schema.path("status").enumValues.includes(nextStage)) throw new ApiError(400, "Invalid lead stage");
  const previousStage = lead.status;
  lead.status = nextStage;
  try {
    await lead.save();
    await StageHistory.create({leadId: lead._id, changedBy: userId, fromStage: previousStage, toStage: nextStage, changedAt: new Date()});
  } catch (error) {
    lead.status = previousStage;
    await lead.save();
    throw error;
  }
  return lead;
};

export const updateLead = asyncHandler(async (req, res) => {
  const updates = normalizeLead(req.body);
  const lead = await Lead.findOne({_id: req.params.id, owner: req.user._id});
  if (!lead) throw new ApiError(404, "Lead not found");
  const requestedStage = updates.status;
  delete updates.status;
  const previousStage = lead.status;
  Object.assign(lead, updates);
  await lead.save();
  if (requestedStage && requestedStage !== previousStage) await changeLeadStage({lead, nextStage: requestedStage, userId: req.user._id});
  res.json({success: true, lead});
});

export const deleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOneAndDelete({_id: req.params.id, owner: req.user._id});
  if (!lead) throw new ApiError(404, "Lead not found");
  res.json({success: true, message: "Lead deleted"});
});

export const reorderLeads = asyncHandler(async (req, res) => {
  const {updates} = req.body;
  if (!Array.isArray(updates)) {
    throw new ApiError(400, "Updates must be an array");
  }

  await Promise.all(updates.map(async (u) => {
    if (u.order !== undefined && (typeof u.order !== "number" || !Number.isFinite(u.order) || u.order < 0)) throw new ApiError(400, "Lead order must be a finite non-negative number");
    const lead = await Lead.findOne({_id: u.id, owner: req.user._id});
    if (!lead) return;
    if (u.status && u.status !== lead.status) await changeLeadStage({lead, nextStage: u.status, userId: req.user._id});
    if (u.order !== undefined) await Lead.updateOne({_id: lead._id, owner: req.user._id}, {$set: {order: u.order}});
  }));

  res.json({success: true, message: "Pipeline updated"});
});

export const parseQualification = (body) => {
  const {qualificationStatus, buyingIntent, decisionMakerIdentified, budgetKnown, timelineKnown, needIdentified} = body;
  if (!QUALIFICATION_STATUSES.includes(qualificationStatus)) throw new ApiError(400, "Invalid qualification status");
  if (buyingIntent !== null && buyingIntent !== "" && !BUYING_INTENTS.includes(buyingIntent)) throw new ApiError(400, "Invalid buying intent");
  for (const value of [decisionMakerIdentified, budgetKnown, timelineKnown, needIdentified]) {
    if (typeof value !== "boolean") throw new ApiError(400, "Qualification evidence fields must be boolean");
  }
  return {
    qualificationStatus,
    buyingIntent: buyingIntent || null,
    decisionMakerIdentified,
    budgetKnown,
    timelineKnown,
    needIdentified,
  };
};

export const updateQualification = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({_id: req.params.id, owner: req.user._id});
  if (!lead) throw new ApiError(404, "Lead not found");
  const next = parseQualification(req.body);
  const previousStatus = lead.qualificationStatus || "UNQUALIFIED";
  const changed = Object.keys(next).some((key) => lead[key] !== next[key]);
  Object.assign(lead, next);
  await lead.save();
  if (changed) {
    const changedFields = [];
    if (previousStatus !== lead.qualificationStatus) changedFields.push(`Status: ${previousStatus} → ${lead.qualificationStatus}`);
    else if (lead.qualificationStatus) changedFields.push(`Status: ${lead.qualificationStatus}`);
    if (lead.buyingIntent) changedFields.push(`Buying intent: ${lead.buyingIntent}`);
    if (lead.decisionMakerIdentified) changedFields.push("Decision maker: Identified");
    if (lead.budgetKnown) changedFields.push("Budget: Known");
    if (lead.timelineKnown) changedFields.push("Timeline: Known");
    if (lead.needIdentified) changedFields.push("Need: Identified");
    await Interaction.create({leadId: lead._id, createdBy: req.user._id, type: "NOTE", channel: "NOTE", summary: `Qualification updated\n${changedFields.join("\n")}`, timestamp: new Date()});
  }
  res.json({success: true, changed, lead: {...lead.toObject(), ...scoreLead(lead)}});
});