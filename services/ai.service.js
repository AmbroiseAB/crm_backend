import {GoogleGenAI} from "@google/genai";
import {ApiError} from "../utils/ApiError.js";

let client = null;

const getClient = () => {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ApiError(
      503,
      "Google GenAI API key is not configured. Please set GOOGLE_GENAI_API_KEY or GEMINI_API_KEY in your environment variables.",
    );
  }
  if (!client) client = new GoogleGenAI({apiKey});
  return client;
};

const MODEL = () =>
  process.env.GEMINI_MODEL ||
  process.env.GOOGLE_GENAI_MODEL ||
  process.env.GENAI_MODEL ||
  "gemini-flash-lite-latest";

const aiErrorMessage = (err) => {
  const status = Number(err?.status || err?.statusCode || err?.response?.status);
  const code = err?.code || err?.cause?.code;
  const details = `${err?.message || ""} ${err?.cause?.message || ""} ${err?.response?.data?.message || ""}`.toLowerCase();
  const safeDetails = String(err?.response?.data?.message || err?.message || "")
    .replace(/AIza[\w-]{20,}/g, "[hidden]")
    .replace(/([?&](?:key|token)=)[^&\s]+/gi, "$1[hidden]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  if (status === 401 || status === 403 || details.includes("api key") || details.includes("permission")) {
    return "Google AI rejected the API key or access. Check the key and its permissions in the backend settings.";
  }
  if (status === 404 || details.includes("not found") || details.includes("no longer available")) {
    return "The selected Google AI model is unavailable. Check GEMINI_MODEL in the backend settings.";
  }
  if (status === 429 || details.includes("quota") || details.includes("rate limit") || details.includes("billing")) {
    return "Google AI usage is currently limited. Check the API quota and billing, then try again.";
  }
  if (status === 400) {
    return `Google AI could not process this request${safeDetails ? `: ${safeDetails}` : ". Check the model and request settings."}`;
  }
  if (
    status >= 500 ||
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"].includes(code) ||
    /fetch failed|network error|socket|deadline exceeded|temporarily unavailable/.test(details)
  ) {
    return "Google AI is temporarily unavailable or unreachable. Check the backend connection and try again.";
  }
  return safeDetails
    ? `Google AI request failed: ${safeDetails}`
    : "Google AI request failed without an explanation. Check the backend logs for details.";
};

export const isAIConfigured = () => Boolean(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY);

const extractResponseText = (response) => {
  if (typeof response.text === "string" && response.text.trim()) return response.text.trim();
  if (Array.isArray(response.output)) {
    const textContent = response.output
      .flatMap((item) => item.content || [])
      .find((content) => content.mimeType === "text/plain" || content.text);
    if (textContent?.text) return String(textContent.text).trim();
  }
  return "";
};

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
    const raw = extractResponseText(response);
    if (!raw) {
      throw new ApiError(502, "AI responded with an empty body.");
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error("Gemini JSON error:", err?.message || err, err?.response || "no-response");
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, aiErrorMessage(err));
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
    throw new ApiError(502, aiErrorMessage(err));
  }
};

export const generateLeadSummary = async (lead) => {
  const prompt = `You help a sales team understand and follow up with leads.
Use plain, everyday English. Avoid sales jargon and acronyms. Keep sentences short and clear.
Analyze this lead and give a concise assessment.
Use XAF/FCFA for every monetary amount. Never use $, USD, or another currency symbol.

Lead details:
Name: ${lead.name || "N/A"}
company: ${lead.company || "N/A"}
Email: ${lead.email || "N/A"}
current pipeline stage: ${lead.status || "New"}
potential deal value: ${lead.value || "0"}
source: ${lead.source || "Unknown"}
Note: ${lead.notes || "None"}

Return JSON only.`;

  const schema = {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "A clear 2-3 sentence summary in simple English",
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
        description: "One specific next step in simple words, including who to contact and what to do when the details support it",
      },
    },
    required: ["summary", "riskScore", "suggestedPriority", "nextBestAction"],
  };

  return generateJSON(prompt, schema);
};

export const generateEmail = async ({lead, purpose, tone, sender}) => {
  const prompt = `You are a senior rep writing on behalf of ${sender?.name || "our team"}${sender?.company ? ` at ${sender.company}` : ""}.

  Write a professional sales email in plain, everyday English. Avoid jargon and acronyms. Keep sentences short and easy to understand.
Use XAF/FCFA for every monetary amount. Never use $, USD, or another currency symbol.
  Purpose: ${purpose || "follow-up"}
  Desired tone: ${tone || "friendly and professional"}

  Recipient (lead) details:
  Name: ${lead?.name || "N/A"}
  Company: ${lead?.company || "N/A"}
  pipeline stage: ${lead?.status || "New"}
  context / notes: ${lead?.notes || "None"}

  Return JSON only with a complete subject line and a complete email body.
  Separate paragraphs in the body with real line breaks. Keep it under 100 words. Sign off as ${
    sender?.name || "The Infonova team"
  }.`;

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
  const prompt = `You help a sales team understand its pipeline.
Use plain, everyday English. Avoid business jargon and acronyms. Keep sentences short and clear.
Based on this pipeline data, explain what needs attention and suggest clear actions.
Use XAF/FCFA for every monetary amount. Never use $, USD, or another currency symbol.
  
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