import {User} from "../models/User.js";
import {Lead} from "../models/Lead.js";
import {Interaction} from "../models/Interaction.js";
import {StageHistory} from "../models/StageHistory.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {normalizeEmail, normalizeName, validateEmail, validateName, validatePhone} from "../utils/validation.js";
import {pickRoundRobinAssignee} from "../services/org.service.js";
import {createStoredNotification} from "./notification.controller.js";

/** Resolve an active org owner (admin) by its public form slug. */
const findOrgBySlug = async (slug) => {
  if (!slug || typeof slug !== "string") return null;
  return User.findOne({"orgSettings.slug": slug.toLowerCase().trim(), active: true});
};

// GET /api/public/orgs/:orgSlug — minimal branding for the public form.
export const getPublicOrg = asyncHandler(async (req, res) => {
  const org = await findOrgBySlug(req.params.orgSlug);
  if (!org) throw new ApiError(404, "This form is not available");
  res.json({success: true, org: {name: org.orgSettings?.name || org.company || org.name, slug: org.orgSettings.slug}});
});

// POST /api/public/leads/:orgSlug — unauthenticated, rate-limited lead capture.
export const submitPublicLead = asyncHandler(async (req, res) => {
  const {name, email, phone, phoneCountry, company, message, website} = req.body;

  // Honeypot: real users never fill this hidden field. Pretend success so bots
  // don't learn they were caught.
  if (website) return res.status(201).json({success: true, message: "Thanks! We'll be in touch shortly."});

  const org = await findOrgBySlug(req.params.orgSlug);
  if (!org) throw new ApiError(404, "This form is not available");

  const normalizedName = normalizeName(name);
  const normalizedEmail = normalizeEmail(email || "");
  const nameError = validateName(normalizedName, "Name");
  const emailError = email ? validateEmail(normalizedEmail) : null;
  const phoneError = phone ? validatePhone(String(phone).trim(), phoneCountry || "CM") : null;
  if (nameError || emailError || phoneError) throw new ApiError(400, nameError || emailError || phoneError);
  if (!normalizedEmail && !phone) throw new ApiError(400, "Please provide an email or phone number so we can reach you");
  if (message && String(message).length > 2000) throw new ApiError(400, "Message cannot exceed 2000 characters");

  const assignedTo = org.orgSettings?.autoAssign ? await pickRoundRobinAssignee(org) : org._id;

  const lead = await Lead.create({
    owner: org._id,
    org: org._id,
    assignedTo,
    name: normalizedName,
    email: normalizedEmail,
    phone: phone ? String(phone).trim() : "",
    phoneCountry: phoneCountry || "CM",
    company: typeof company === "string" ? company.trim().slice(0, 100) : "",
    source: "Website",
    status: "New",
    notes: message ? String(message).trim().slice(0, 2000) : "",
  });

  try {
    await StageHistory.create({leadId: lead._id, changedBy: org._id, fromStage: null, toStage: "New", changedAt: lead.createdAt});
    await Interaction.create({leadId: lead._id, createdBy: org._id, type: "NOTE", channel: "NOTE", summary: `Lead captured from the website form${message ? `: "${String(message).trim().slice(0, 300)}"` : ""}`, timestamp: lead.createdAt});
  } catch {
    // Timeline seeding is best-effort; the lead itself is what matters.
  }

  if (assignedTo) {
    await createStoredNotification({
      owner: assignedTo,
      type: "LEAD_WEB",
      title: `New website lead: ${lead.name}`,
      message: `${lead.name}${lead.company ? ` (${lead.company})` : ""} submitted the public form.`,
      details: message ? String(message).trim().slice(0, 500) : "",
      lead: lead._id,
    });
  }

  res.status(201).json({success: true, message: "Thanks! We'll be in touch shortly."});
});
