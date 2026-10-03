import {User} from "../models/User.js";
import {Lead} from "../models/Lead.js";
import {Interaction} from "../models/Interaction.js";
import {StageHistory} from "../models/StageHistory.js";
import {createStoredNotification} from "./notification.controller.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {normalizeEmail, normalizeName, validateEmail, validateName, validatePhone} from "../utils/validation.js";

// Resolve the account that owns a public link, or 404 if the token is unknown.
const ownerFromToken = async (token) => {
  if (typeof token !== "string" || !token.trim()) throw new ApiError(404, "This form link is not valid");
  const user = await User.findOne({publicToken: token});
  if (!user) throw new ApiError(404, "This form link is not valid or has been disabled");
  return user;
};

// Public: lightweight info so the form can greet the visitor with the business name.
export const getPublicForm = asyncHandler(async (req, res) => {
  const user = await ownerFromToken(req.params.token);
  res.json({success: true, business: user.company || user.name});
});

// Public: anyone with the link may submit one lead. Inputs are validated the
// same way the authenticated lead form is, so bad data never reaches the CRM.
export const submitPublicLead = asyncHandler(async (req, res) => {
  const user = await ownerFromToken(req.params.token);
  const {name, email, phone, company, message} = req.body;

  const normalizedName = normalizeName(name);
  const nameError = validateName(normalizedName, "Name");
  if (nameError) throw new ApiError(400, nameError);

  const normalizedEmail = normalizeEmail(email);
  const emailError = validateEmail(normalizedEmail);
  if (emailError) throw new ApiError(400, emailError);

  const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
  const phoneError = validatePhone(trimmedPhone, "CM");
  if (phoneError) throw new ApiError(400, phoneError);

  if (!normalizedEmail && !trimmedPhone) {
    throw new ApiError(400, "Please provide an email address or a phone number so we can reach you");
  }

  if (company !== undefined && (typeof company !== "string" || company.length > 200)) {
    throw new ApiError(400, "Company must be 200 characters or fewer");
  }
  if (message !== undefined && (typeof message !== "string" || message.length > 5000)) {
    throw new ApiError(400, "Message must be 5000 characters or fewer");
  }

  const lead = await Lead.create({
    owner: user._id,
    name: normalizedName,
    email: normalizedEmail,
    phone: trimmedPhone,
    company: typeof company === "string" ? company.trim() : "",
    notes: typeof message === "string" ? message.trim() : "",
    source: "Public Form",
    status: "New",
    priority: "Medium",
  });

  try {
    await StageHistory.create({leadId: lead._id, changedBy: user._id, fromStage: null, toStage: "New", changedAt: lead.createdAt});
    await Interaction.create({leadId: lead._id, createdBy: user._id, type: "NOTE", channel: "NOTE", summary: "Lead submitted through the public form", timestamp: lead.createdAt});
    await createStoredNotification({
      owner: user._id,
      type: "LEAD_NEW",
      title: `New lead: ${lead.name}`,
      message: `${lead.name}${lead.company ? ` from ${lead.company}` : ""} submitted the public lead form.`,
      details: lead.notes ? lead.notes.slice(0, 200) : "",
      lead: lead._id,
    });
  } catch (error) {
    // Best-effort side effects — never fail the public submission over them.
    console.error("Public lead side-effect error:", error?.message || error);
  }

  res.status(201).json({success: true, message: "Thank you! Your details were received."});
});
