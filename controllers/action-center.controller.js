import {Lead} from "../models/Lead.js";
import {Interaction} from "../models/Interaction.js";
import {Task} from "../models/Task.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {scoreLead} from "../services/lead-scoring.service.js";

const ACTIVE_STATUSES = ["New", "Qualified", "Proposal"];
const priorityRank = {High: 3, Medium: 2, Low: 1};

const sortLeads = (a, b) =>
  (b.score || 0) - (a.score || 0) ||
  (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0) ||
  (Number(b.value) || 0) - (Number(a.value) || 0) ||
  new Date(a.nextActionDueAt || a.createdAt) - new Date(b.nextActionDueAt || b.createdAt);

const compactLead = (lead, task = null) => ({
  _id: lead._id,
  name: lead.name,
  company: lead.company,
  status: lead.status,
  priority: lead.priority,
  value: lead.value,
  createdAt: lead.createdAt,
  nextAction: lead.nextAction,
  nextActionDueAt: lead.nextActionDueAt,
  nextActionTask: task ? {_id: task._id, title: task.title, status: task.status, dueDate: task.dueDate} : null,
  ...scoreLead(lead),
});

export const classifyLead = ({lead, interactions, tasks, now = new Date()}) => {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const id = String(lead._id);
  const dueAt = lead.nextActionDueAt ? new Date(lead.nextActionDueAt) : null;
  const task = lead.nextActionTask
    ? tasks.find((candidate) => String(candidate._id) === String(lead.nextActionTask)) || null
    : null;
  const hasInteraction = interactions.some((interaction) => String(interaction.leadId) === id);
  const recentFollowUp = interactions.some((interaction) =>
    String(interaction.leadId) === id &&
    ["FOLLOW_UP", "QUOTE_SENT"].includes(interaction.outcome) &&
    new Date(interaction.timestamp) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  );

  return {
    item: compactLead(lead, task),
    overdue: Boolean(dueAt && dueAt < now),
    dueToday: Boolean(dueAt && dueAt >= startOfToday && dueAt < endOfToday),
    awaitingResponse: lead.status === "New" && !hasInteraction,
    noNextAction: !lead.nextAction && !lead.nextActionDueAt,
    proposalFollowUp: lead.status === "Proposal" && (!lead.nextAction || !recentFollowUp),
  };
};

export const getActionCenter = asyncHandler(async (req, res) => {
  const owner = req.user._id;
  const now = new Date();
  const leads = await Lead.find({owner, status: {$in: ACTIVE_STATUSES}})
    .sort({priority: -1, value: -1})
    .lean();
  const leadIds = leads.map((lead) => lead._id);
  const [interactions, tasks] = await Promise.all([
    Interaction.find({leadId: {$in: leadIds}}).select("leadId timestamp outcome").lean(),
    Task.find({owner, relatedLead: {$in: leadIds}}).select("_id relatedLead title status dueDate completedAt isNextAction").lean(),
  ]);

  const overdue = [];
  const dueToday = [];
  const awaitingResponse = [];
  const noNextAction = [];
  const proposalFollowUps = [];

  for (const lead of leads) {
    const classified = classifyLead({lead, interactions, tasks, now});
    if (classified.overdue) overdue.push(classified.item);
    else if (classified.dueToday) dueToday.push(classified.item);
    if (classified.awaitingResponse) awaitingResponse.push(classified.item);
    if (classified.noNextAction) noNextAction.push(classified.item);
    if (classified.proposalFollowUp) proposalFollowUps.push(classified.item);
  }

  [overdue, dueToday, awaitingResponse, noNextAction, proposalFollowUps].forEach((items) => items.sort(sortLeads));
  const uniqueIds = new Set([
    ...overdue, ...dueToday, ...awaitingResponse, ...noNextAction, ...proposalFollowUps,
  ].map((item) => String(item._id)));

  res.json({
    success: true,
    overdue,
    dueToday,
    awaitingResponse,
    noNextAction,
    proposalFollowUps,
    summary: {
      total: uniqueIds.size,
      overdue: overdue.length,
      dueToday: dueToday.length,
      awaitingResponse: awaitingResponse.length,
      noNextAction: noNextAction.length,
      proposalFollowUps: proposalFollowUps.length,
    },
  });
});