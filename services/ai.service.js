import {GoogleGenAI} from "@google/genai";
import {ApiError} from "../utils/ApiError.js";

let client = null;

const getClient = () => {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError(
      503,
      "Google GenAI API key is not configured. Please set GOOGLE_GENAI_API_KEY in your environment variables.",
    );
  }
  if (!client) client = new GoogleGenAI({apiKey});
  return client;
};

const MODEL = () => process.env.GENAI_MODEL || "gemini-2.5-flash";

export const isAIConfigured = () => Boolean(process.env.GEMINI_API_KEY);

const generateJSON = async (prompt, schema) => {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: MODEL(),
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.6,
      },
    });
    return JSON.parse(response.text);
  } catch (err) {
    console.error("Gemini JSON error:", err?.message || err);
    throw new ApiError(502, "AI request failed. Please try again in a moment.");
  }
};

const generateText = async (prompt, temperature = 0.7) => {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: MODEL(),
      contents: prompt,
      config: { temperature },
    });
    return response.text.trim();
  } catch (err) {
    console.error("Gemini text error:", err?.message || err);
    throw new ApiError(502, "AI request failed. Please try again in a moment.");
  }
};

export const generateLeadSummary = async (lead) => {
  const prompt = `You are an expert B2B sales analyst for a CRM called TTP CRM.
Analyze the following sales lead and provide a concise assessment,

Lead details:
Name: ${lead.name || "N/A"}
company: ${lead.company || "N/A"}
Email: ${lead.email || "N/A"}
current pipeline stage: ${lead.status || "New"}
potential deal value: ${lead.value || "0"}
source: ${lead.source || "Unknown"}
Note: ${lead.note || "None"}

Return JSON only.`;

  const schema = {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "2-3 sentence executive summary of the lead",
      },
      riskScore: {
        type: "integer",
        description: "Risk of losing this lead, 0 (safe) to 100 (high risk)",
      },
      suggestedPriority: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      nextBestAction: {
        type: "string",
        description: "One concrete recommended next step",
      },
    },
    required: ["summary", "riskScore", "suggestedPriority", "nextBestAction"],
  };

  return generateJSON(prompt, schema);
};

export const generateEmail = async ({lead, purpose, tone, sender}) => {
  const prompt = `You are a senior rep writing on behalf of ${sender?.name || "our team"}${sender?.company ? ` at ${sender.company}` : ""}.

  Write a professional sales email,
  Purpose: ${purpose || "follow-up"}
  Desired tone: ${tone || "friendly and professional"}

  Recipient (lead) details:
  Name: ${lead?.name || "N/A"}
  Company: ${lead?.company || "N/A"}
  pipeline stage: ${lead?.status || "New"}
  context / notes: ${lead?.notes || "None"}

  Return JSON only with a completing subject line and a complete email body,
  Use line breaks (\\) in the body. Keep it under 100 words. Sign off as ${
    sender?.name || "The TTP CRM team"
  },`;

  const schema = {
    type: "object",
    properties: {
      subject: {type: "string"},
      body:{type: "string"},
    },
    required: ["subject", "body"],
  };

  return generateJSON(prompt, schema);
};

export const generateSalesInsights = async (pipelineStats) => {
  const prompt = `You are a revenue-operations advisor. Given this insight of a
  sales pipeline, identify what is wrong, what is at risk, and concrete actions
  to improve conversion,
  
  Pipeline snapshot (JSON):
  ${JSON.stringify(pipelineStats, null, 2)}
  
  Return JSON only.`;

  const schema = {
    type: "object",
    properties: {
      headline: {
        type: "string",
        description: "One-sentence summary of pipelne health",
      },
      insights: {
        type: "array",
        description: "3-5 specific, data-driven observations",
        items: {type: "string"},
      },
      recommendations: {
        type: "array",
        description: "3-5 specific, actionable recommendations",
        items: {type: "string"},
      },
      healthScore: {
        type: "integer",
        description: "Overall pipeline health, 0-100"
      },
    },
    required: ["headline", "insights", "recommendations", "healthScore"],
  };

  return generateJSON(prompt, schema);
};