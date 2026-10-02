import {Lead, LEAD_STATUSES} from "../models/Lead.js";
import {StageHistory} from "../models/StageHistory.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {buildScope} from "../utils/scope.js";

const activeStages = LEAD_STATUSES.filter((stage) => stage !== "Won" && stage !== "Lost");

export const hoursBetween = (start, end) => Math.max(0, (new Date(end) - new Date(start)) / 3600000);
export const conversionRate = (advanced, entered) => entered >= 2 ? Math.round((advanced / entered) * 100) : null;
const formatDuration = (hours) => {
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
};

export const getStageHistory = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({_id: req.params.id, ...buildScope(req)}).select("_id");
  if (!lead) throw new ApiError(404, "Lead not found");
  const histories = await StageHistory.find({leadId: lead._id})
    .sort({changedAt: -1, createdAt: -1})
    .limit(100)
    .populate("changedBy", "name");
  res.json({success: true, count: histories.length, histories});
});

export const getPipelineIntelligence = asyncHandler(async (req, res) => {
  const now = new Date();
  const leads = await Lead.find(buildScope(req)).select("_id status").lean();
  const leadIds = leads.map((lead) => lead._id);
  const histories = await StageHistory.find({leadId: {$in: leadIds}}).sort({changedAt: 1}).lean();
  const byLead = new Map();
  histories.forEach((history) => {
    const key = String(history.leadId);
    if (!byLead.has(key)) byLead.set(key, []);
    byLead.get(key).push(history);
  });

  const transitions = Object.fromEntries(LEAD_STATUSES.map((stage) => [stage, {entered: 0, left: 0, lost: 0, hours: 0, completed: 0}]));
  const conversion = [];
  for (let i = 0; i < LEAD_STATUSES.length - 1; i += 1) {
    conversion.push({from: LEAD_STATUSES[i], to: LEAD_STATUSES[i + 1], entered: 0, advanced: 0, rate: null});
  }

  for (const lead of leads) {
    const events = byLead.get(String(lead._id)) || [];
    events.forEach((event, index) => {
      const stage = transitions[event.toStage];
      if (!stage) return;
      stage.entered += 1;
      const next = events[index + 1];
      const end = next?.changedAt || (String(lead.status) === event.toStage ? now : event.changedAt);
      stage.hours += hoursBetween(event.changedAt, end);
      if (next) {
        stage.left += 1;
        if (next.toStage === "Lost") stage.lost += 1;
        const pair = conversion.find((item) => item.from === event.toStage && item.to === next.toStage);
        if (pair) pair.advanced += 1;
      }
    });
  }
  conversion.forEach((pair) => {
    pair.entered = transitions[pair.from].entered;
    pair.rate = conversionRate(pair.advanced, pair.entered);
  });

  res.json({
    success: true,
    conversion,
    durations: activeStages.map((stage) => ({
      stage,
      samples: transitions[stage].left,
      averageHours: transitions[stage].left ? transitions[stage].hours / transitions[stage].left : null,
      average: transitions[stage].left ? formatDuration(transitions[stage].hours / transitions[stage].left) : null,
    })),
    leakage: LEAD_STATUSES.map((stage) => ({stage, lost: transitions[stage].lost})).filter((item) => item.lost > 0),
    historyCount: histories.length,
  });
});