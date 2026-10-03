import {Lead} from "../models/Lead.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import {
  generateLeadSummary,
  generateEmail,
  generateSalesInsights,
  isAIConfigured,
} from "../services/ai.service.js"
import {createStoredNotification} from "./notification.controller.js";
import {AIResult} from "../models/AIResult.js";

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
  if (["SUMMARY", "EMAIL", "INSIGHT"].includes(req.query.type)) filter.type = req.query.type;
  if (req.query.leadId) filter.lead = req.query.leadId;
  const results = await AIResult.find(filter).sort({createdAt: -1}).limit(10).populate("lead", "name company");
  res.json({success: true, results});
});

const resolveLead = async (req) => {
  if (req.body.leadId) {
    const lead = await Lead.findOne({_id: req.body.leadId, owner: req.user._id});
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
      {_id: req.body.leadId, owner: req.user._id},
      {$set: {aiSummary: result.summary, aiRiskScore: result.riskScore}}
    );
  }
  await createStoredNotification({owner: req.user._id, type: "AI_SUMMARY", title: `AI summary for ${lead.name}`, message: result.summary, details: `${result.nextBestAction} (suggested priority: ${result.suggestedPriority})`, lead: req.body.leadId || null});

  res.json({success: true, ...result});
});

export const generateEmailDraft = asyncHandler(async(req, res) => {
  const lead = await resolveLead(req);
  const {purpose, tone} = req.body;

  const result = normalizeAIResult(await generateEmail({
    lead,
    purpose,
    tone,
    sender: {name: req.user.name, company: req.user.company},
  }));
  await storeAIResult({owner: req.user._id, type: "EMAIL", lead: req.body.leadId || null, result});

  await createStoredNotification({owner: req.user._id, type: "AI_DRAFT", title: `AI email draft for ${lead.name}`, message: result.body, details: `Subject: ${result.subject}`, lead: req.body.leadId || null});

  res.json({success: true, ...result});
});

export const salesInsights = asyncHandler(async(req, res) => {
  let stats = req.body.stats;

  if (!stats) {
    const leads = await Lead.find({owner: req.user._id});
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

