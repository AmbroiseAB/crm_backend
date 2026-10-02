import {Lead} from "../models/Lead.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import {
  generateLeadSummary,
  generateEmail,
  generateTimelineEmail,
  generateNextBestAction,
  generateSalesInsights,
  isAIConfigured,
} from "../services/ai.service.js"
import {createStoredNotification} from "./notification.controller.js";
import {AIResult} from "../models/AIResult.js";
import {Interaction} from "../models/Interaction.js";
import {buildScope} from "../utils/scope.js";

/** Load a lead's recent timeline (interactions) for AI context. */
const loadTimeline = async (leadId, limit = 20) => {
  if (!leadId) return [];
  const interactions = await Interaction.find({leadId}).sort({timestamp: -1, createdAt: -1}).limit(limit).lean();
  return interactions
    .map((item) => ({type: item.type, outcome: item.outcome, summary: item.summary, timestamp: item.timestamp || item.createdAt}))
    .reverse(); // newest last, for the prompt
};

const storeAIResult = ({owner, type, lead = null, result}) => AIResult.create({owner, type, lead, result});

const normalizeCurrency = (value) => typeof value === "string" ? value.replace(/\$/g, "FCFA ") : value;
const normalizeAIResult = (result) => Object.fromEntries(
  Object.entries(result).map(([key, value]) => [
    key,
    Array.isArray(value) ? value.map(normalizeCurrency) : normalizeCurrency(value),
  ]),
);

export const getAIResults = asyncHandler(async (req, res) => {
  const filter = {owner: req.user._id};
  if (["SUMMARY", "EMAIL", "INSIGHT", "NBA"].includes(req.query.type)) filter.type = req.query.type;
  if (req.query.leadId) filter.lead = req.query.leadId;
  const results = await AIResult.find(filter).sort({createdAt: -1}).limit(10).populate("lead", "name company");
  res.json({success: true, results});
});

const resolveLead = async (req) => {
  if (req.body.leadId) {
    const lead = await Lead.findOne({_id: req.body.leadId, ...buildScope(req)});
    if (!lead) throw new ApiError(404, "Lead not found");
    return lead;
  }
  if (req.body.lead) return req.body.lead;
  throw new ApiError(400, "Provide a leadId or an inline lead object");
};

export const aiStatus = asyncHandler(async(req, res) => {
  res.json({
    success: true,
    configured: isAIConfigured(),
    model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
  });
});

export const leadSummary = asyncHandler(async(req,res) => {
  const lead = await resolveLead(req);
  const result = normalizeAIResult(await generateLeadSummary(lead));
  await storeAIResult({owner: req.user._id, type: "SUMMARY", lead: req.body.leadId || null, result});

  if (req.body.leadId) {
    await Lead.updateOne(
      {_id: req.body.leadId, ...buildScope(req)},
      {$set: {aiSummary: result.summary, aiRiskScore: result.riskScore}}
    );
  }
  await createStoredNotification({owner: req.user._id, type: "AI_SUMMARY", title: `AI summary for ${lead.name}`, message: result.summary, details: `${result.nextBestAction} (suggested priority: ${result.suggestedPriority})`, lead: req.body.leadId || null});

  res.json({success: true, ...result});
});

export const generateEmailDraft = asyncHandler(async(req, res) => {
  const lead = await resolveLead(req);
  const {purpose, tone} = req.body;

  // When drafting for a saved lead, ground the email in its timeline; inline
  // leads (no id) fall back to the original stateless generator.
  const timeline = await loadTimeline(req.body.leadId);
  const sender = {name: req.user.name, company: req.user.company};
  const result = normalizeAIResult(
    timeline.length
      ? await generateTimelineEmail({lead, timeline, purpose, tone, sender})
      : await generateEmail({lead, purpose, tone, sender}),
  );
  await storeAIResult({owner: req.user._id, type: "EMAIL", lead: req.body.leadId || null, result});

  await createStoredNotification({owner: req.user._id, type: "AI_DRAFT", title: `AI email draft for ${lead.name}`, message: result.body, details: `Subject: ${result.subject}`, lead: req.body.leadId || null});

  res.json({success: true, ...result});
});

export const nextBestAction = asyncHandler(async(req, res) => {
  const lead = await resolveLead(req);
  const timeline = await loadTimeline(req.body.leadId);
  const result = normalizeAIResult(await generateNextBestAction({lead, timeline}));
  await storeAIResult({owner: req.user._id, type: "NBA", lead: req.body.leadId || null, result});
  await createStoredNotification({owner: req.user._id, type: "AI_INSIGHT", title: `Next best action for ${lead.name}`, message: result.recommendedAction, details: result.reason, lead: req.body.leadId || null});
  res.json({success: true, ...result});
});

export const salesInsights = asyncHandler(async(req, res) => {
  let stats = req.body.stats;

  if (!stats) {
    const leads = await Lead.find(buildScope(req));
    stats = buildPipelineStats(leads);
  }

  const result = normalizeAIResult(await generateSalesInsights(stats));
  await storeAIResult({owner: req.user._id, type: "INSIGHT", result});
  await createStoredNotification({owner: req.user._id, type: "AI_INSIGHT", title: "AI pipeline insight", message: result.headline, details: result.recommendations?.[0] || "Review the recommendations on the dashboard."});
  res.json({success: true, ...result});
});

const buildPipelineStats = (leads) => {
  const byStage = {};
  let totalValue = 0;
  for (const l of leads) {
    byStage[l.status] = byStage[l.status] || {count: 0, value: 0};
    byStage[l.status].count += 1;
    byStage[l.status].value += l.value || 0;
    totalValue += l.value || 0;
  }
  const won = byStage.Won?.count || 0;
  const lost = byStage.Lost?.count || 0;
  const closed = won + lost;
  return {
    totalLeads: leads.length,
    totalPipelineValue: totalValue,
    winRate: closed ? Math.round((won / closed) * 100) : 0,
    stages: byStage,
  };
};

