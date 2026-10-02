import {Lead} from "../models/Lead.js";
import {User} from "../models/User.js";
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
import {buildScope, seesWholeOrg} from "../utils/scope.js";
import {pickRoundRobinAssignee} from "../services/org.service.js";
import {createStoredNotification} from "./notification.controller.js";

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

// ── Stage rules ──────────────────────────────────────────────────────────
// Lightweight allowed-transition map over LEAD_STATUSES. Keeps the pipeline
// sane without blocking the normal forward/backward moves the kanban needs.
export const ALLOWED_TRANSITIONS = {
  New: ["Qualified", "Lost"],
  Qualified: ["Proposal", "Lost", "New"],
  Proposal: ["Won", "Lost", "Qualified"],
  Won: [],
  Lost: ["New", "Qualified"],
};

// A lead may be marked Won only once it is qualified (see Won gate below).
export const canMarkWon = (lead) => lead.qualificationStatus === "QUALIFIED";

/** Resolve the org owner (admin) document — needed for orgSettings + round-robin. */
const getOrgOwner = async (req) =>
  String(req.user._id) === String(req.user.org) ? req.user : await User.findById(req.user.org);

/**
 * Decide the assignee for a newly created lead.
 *   - agents always own the leads they create
 *   - admins/managers may pass an explicit assignedTo
 *   - otherwise fall back to round-robin when the org has auto-assign enabled,
 *     else the creator
 */
const resolveNewLeadAssignee = async (req, explicitAssignedTo) => {
  if (req.user.role === "agent") return req.user._id;
  if (explicitAssignedTo) {
    const assignee = await User.findOne({_id: explicitAssignedTo, org: req.user.org, active: true}).select("_id");
    if (!assignee) throw new ApiError(400, "Assignee must be an active member of your organization");
    return assignee._id;
  }
  const orgOwner = await getOrgOwner(req);
  if (orgOwner?.orgSettings?.autoAssign) return pickRoundRobinAssignee(orgOwner);
  return req.user._id;
};

export const getLeads = asyncHandler(async (req, res) => {
  const {status, priority, source, qualificationStatus, search, assignedTo} = req.query;

  const filter = buildScope(req);
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (source) filter.source = source;
  if (qualificationStatus) filter.qualificationStatus = qualificationStatus;
  // Assignment filter is only meaningful for admins/managers (agents are already
  // restricted to their own leads by buildScope).
  if (assignedTo && seesWholeOrg(req.user)) {
    filter.assignedTo = assignedTo === "unassigned" ? null : assignedTo;
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search.slice(0, 100)), "i");
    filter.$or = [{name: rx}, {email: rx}, {company: rx}];
  }

  const leads = await Lead.find(filter).sort({order: 1, createdAt: -1}).populate("assignedTo", "name email role");
    res.json({success: true, count: leads.length, leads: leads.map((lead) => ({...lead.toObject(), ...scoreLead(lead)}))});
});

export const getLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({_id: req.params.id, ...buildScope(req)}).populate("assignedTo", "name email role");
  if (!lead) throw new ApiError(404, "Lead not found");
  res.json({success: true, lead: {...lead.toObject(), ...scoreLead(lead)}});
});

export const createLead = asyncHandler(async (req, res) => {
  const assignedTo = await resolveNewLeadAssignee(req, req.body.assignedTo);
  const lead = await Lead.create({...normalizeLead(req.body), owner: req.user._id, org: req.user.org, assignedTo});
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
    await Lead.deleteOne({_id: lead._id, org: req.user.org});
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
  const lead = await Lead.findOne({_id: req.params.id, ...buildScope(req)}).select("_id");
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
  const lead = await Lead.findOne({_id: req.params.id, ...buildScope(req)}).select("_id");
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
  const lead = await Lead.findOne({_id: req.params.id, ...buildScope(req)});
  if (!lead) throw new ApiError(404, "Lead not found");

  const next = parseNextAction(req.body);
  const {createTask = false} = req.body;
  let task = null;

  if (next.nextAction && createTask) {
    if (lead.nextActionTask) {
      task = await Task.findOneAndUpdate(
        {_id: lead.nextActionTask, org: lead.org, status: {$ne: "Completed"}},
        {title: next.nextAction, dueDate: next.nextActionDueAt, relatedLead: lead._id, isNextAction: true, assignedTo: lead.assignedTo},
        {new: true, runValidators: true},
      );
    }
    if (!task) {
      task = await Task.create({
        owner: lead.owner,
        org: lead.org,
        assignedTo: lead.assignedTo,
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
  const lead = await Lead.findOne({_id: req.params.id, ...buildScope(req)});
  if (!lead) throw new ApiError(404, "Lead not found");
  if (!lead.nextAction) throw new ApiError(400, "This lead has no next action");

  const action = lead.nextAction;
  let task = null;
  if (lead.nextActionTask) {
    task = await Task.findOneAndUpdate(
      {_id: lead.nextActionTask, org: lead.org, status: {$ne: "Completed"}},
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

/**
 * Single choke point for stage changes (used by updateLead + reorderLeads).
 * Enforces allowed transitions, the Won qualification gate (with a
 * manager/admin reason-override), records StageHistory, and auto-creates a
 * follow-up task when moving into a non-terminal stage.
 */
const changeLeadStage = async ({lead, nextStage, user, overrideReason}) => {
  if (!nextStage || nextStage === lead.status) return lead;
  if (!Lead.schema.path("status").enumValues.includes(nextStage)) throw new ApiError(400, "Invalid lead stage");

  const allowed = ALLOWED_TRANSITIONS[lead.status] || [];
  if (!allowed.includes(nextStage)) {
    throw new ApiError(400, `Cannot move a lead from ${lead.status} to ${nextStage}`);
  }

  let overrideNote = null;
  if (nextStage === "Won" && !canMarkWon(lead)) {
    const canOverride = user && (user.role === "admin" || user.role === "manager");
    const reason = typeof overrideReason === "string" ? overrideReason.trim() : "";
    if (!canOverride || !reason) {
      throw new ApiError(400, "This lead must be marked Qualified before it can be won. A manager or admin can override with a reason.");
    }
    overrideNote = reason.slice(0, 500);
  }

  const previousStage = lead.status;
  lead.status = nextStage;
  try {
    await lead.save();
    await StageHistory.create({leadId: lead._id, changedBy: user._id, fromStage: previousStage, toStage: nextStage, changedAt: new Date()});
  } catch (error) {
    lead.status = previousStage;
    await lead.save();
    throw error;
  }

  if (overrideNote) {
    await Interaction.create({leadId: lead._id, createdBy: user._id, type: "NOTE", channel: "NOTE", summary: `Won without full qualification. Override reason: ${overrideNote}`, timestamp: new Date()});
  }

  // Auto-create a follow-up task when entering a non-terminal stage so leads
  // stay accompanied rather than just collected.
  if (nextStage !== "Won" && nextStage !== "Lost") {
    try {
      await Task.create({
        owner: lead.owner,
        org: lead.org,
        assignedTo: lead.assignedTo,
        title: `Follow up: ${lead.name} moved to ${nextStage}`,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        priority: lead.priority,
        relatedLead: lead._id,
      });
    } catch {
      // A follow-up task is a convenience; never fail the stage change over it.
    }
  }

  return lead;
};

export const updateLead = asyncHandler(async (req, res) => {
  const updates = normalizeLead(req.body);
  const lead = await Lead.findOne({_id: req.params.id, ...buildScope(req)});
  if (!lead) throw new ApiError(404, "Lead not found");
  const requestedStage = updates.status;
  delete updates.status;
  const previousStage = lead.status;
  Object.assign(lead, updates);
  await lead.save();
  if (requestedStage && requestedStage !== previousStage) {
    await changeLeadStage({lead, nextStage: requestedStage, user: req.user, overrideReason: req.body.overrideReason});
  }
  res.json({success: true, lead});
});

export const deleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOneAndDelete({_id: req.params.id, ...buildScope(req)});
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
    const lead = await Lead.findOne({_id: u.id, ...buildScope(req)});
    if (!lead) return;
    if (u.status && u.status !== lead.status) await changeLeadStage({lead, nextStage: u.status, user: req.user, overrideReason: u.overrideReason});
    if (u.order !== undefined) await Lead.updateOne({_id: lead._id, org: lead.org}, {$set: {order: u.order}});
  }));

  res.json({success: true, message: "Pipeline updated"});
});

/**
 * Manager/admin assign (or unassign) a lead to an agent in the same org.
 * Records a timeline note and notifies the new assignee.
 */
export const assignLead = asyncHandler(async (req, res) => {
  const {assignedTo} = req.body;
  const lead = await Lead.findOne({_id: req.params.id, org: req.user.org});
  if (!lead) throw new ApiError(404, "Lead not found");

  let assignee = null;
  if (assignedTo) {
    assignee = await User.findOne({_id: assignedTo, org: req.user.org, active: true}).select("_id name");
    if (!assignee) throw new ApiError(400, "Assignee must be an active member of your organization");
  }

  const previous = lead.assignedTo ? String(lead.assignedTo) : null;
  lead.assignedTo = assignee ? assignee._id : null;
  await lead.save();

  await Interaction.create({
    leadId: lead._id,
    createdBy: req.user._id,
    type: "NOTE",
    channel: "NOTE",
    summary: assignee ? `Lead assigned to ${assignee.name}` : "Lead unassigned",
    timestamp: new Date(),
  });

  if (assignee && String(assignee._id) !== previous && String(assignee._id) !== String(req.user._id)) {
    await createStoredNotification({
      owner: assignee._id,
      type: "LEAD_ASSIGNED",
      title: `New lead assigned: ${lead.name}`,
      message: `${req.user.name} assigned ${lead.name}${lead.company ? ` (${lead.company})` : ""} to you.`,
      lead: lead._id,
    });
  }

  const updated = await Lead.findById(lead._id).populate("assignedTo", "name email role");
  res.json({success: true, lead: {...updated.toObject(), ...scoreLead(updated)}});
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
  const lead = await Lead.findOne({_id: req.params.id, ...buildScope(req)});
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
