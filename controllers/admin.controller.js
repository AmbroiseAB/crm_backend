import crypto from "node:crypto";
import {User} from "../models/User.js";
import {Lead} from "../models/Lead.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {normalizeEmail, normalizeName, validateEmail, validateName} from "../utils/validation.js";
import {ensureUniqueSlug} from "../services/org.service.js";

const ROLES = ["admin", "manager", "agent"];

const toTeamUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
  isOwner: String(user._id) === String(user.org),
  createdAt: user.createdAt,
});

/** A temporary password guaranteed to satisfy the password policy. */
const generateTempPassword = () => `Inv-${crypto.randomBytes(5).toString("hex")}A9!`;

// ── Users ────────────────────────────────────────────────────────────────
export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({org: req.user.org}).sort({createdAt: 1});
  res.json({success: true, count: users.length, users: users.map(toTeamUser)});
});

export const inviteUser = asyncHandler(async (req, res) => {
  const {name, email, role = "agent"} = req.body;
  if (!ROLES.includes(role)) throw new ApiError(400, "Invalid role");

  const normalizedName = normalizeName(name);
  const normalizedEmail = normalizeEmail(email);
  const nameError = validateName(normalizedName);
  const emailError = validateEmail(normalizedEmail, true);
  if (nameError || emailError) throw new ApiError(400, nameError || emailError);

  if (await User.findOne({email: normalizedEmail})) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const tempPassword = generateTempPassword();
  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    password: tempPassword,
    role,
    org: req.user.org,
    active: true,
  });

  // No email infra in this app — return the temp password once so the admin
  // can share it. The invited user changes it from Settings after first login.
  res.status(201).json({success: true, user: toTeamUser(user), tempPassword});
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const {role} = req.body;
  if (!ROLES.includes(role)) throw new ApiError(400, "Invalid role");
  if (String(req.params.id) === String(req.user._id)) throw new ApiError(400, "You cannot change your own role");

  const user = await User.findOne({_id: req.params.id, org: req.user.org});
  if (!user) throw new ApiError(404, "User not found");
  if (String(user._id) === String(user.org)) throw new ApiError(400, "The organization owner's role cannot be changed");

  user.role = role;
  await user.save();
  res.json({success: true, user: toTeamUser(user)});
});

export const setUserActive = asyncHandler(async (req, res) => {
  const {active} = req.body;
  if (typeof active !== "boolean") throw new ApiError(400, "active must be a boolean");
  if (String(req.params.id) === String(req.user._id)) throw new ApiError(400, "You cannot deactivate your own account");

  const user = await User.findOne({_id: req.params.id, org: req.user.org});
  if (!user) throw new ApiError(404, "User not found");
  if (String(user._id) === String(user.org)) throw new ApiError(400, "The organization owner cannot be deactivated");

  user.active = active;
  await user.save();
  res.json({success: true, user: toTeamUser(user)});
});

// ── Org settings ───────────────────────────────────────────────────────────
const toOrgSettings = (owner) => ({
  name: owner.orgSettings?.name || owner.company || owner.name,
  slug: owner.orgSettings?.slug || null,
  autoAssign: Boolean(owner.orgSettings?.autoAssign),
});

const orgOwner = async (req) =>
  String(req.user._id) === String(req.user.org) ? req.user : await User.findById(req.user.org);

export const getOrgSettings = asyncHandler(async (req, res) => {
  const owner = await orgOwner(req);
  if (!owner) throw new ApiError(404, "Organization not found");
  res.json({success: true, orgSettings: toOrgSettings(owner)});
});

export const updateOrgSettings = asyncHandler(async (req, res) => {
  const owner = await orgOwner(req);
  if (!owner) throw new ApiError(404, "Organization not found");
  const {name, slug, autoAssign} = req.body;

  owner.orgSettings = owner.orgSettings || {};
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) throw new ApiError(400, "Organization name must be 2-100 characters");
    owner.orgSettings.name = name.trim();
  }
  if (slug !== undefined) {
    owner.orgSettings.slug = await ensureUniqueSlug(slug || name || owner.orgSettings.name || owner.name, {excludeUserId: owner._id});
  }
  if (autoAssign !== undefined) {
    if (typeof autoAssign !== "boolean") throw new ApiError(400, "autoAssign must be a boolean");
    owner.orgSettings.autoAssign = autoAssign;
  }
  await owner.save();
  res.json({success: true, orgSettings: toOrgSettings(owner)});
});

// ── Team view (admin + manager) ──────────────────────────────────────────────
export const teamView = asyncHandler(async (req, res) => {
  const [members, leads] = await Promise.all([
    User.find({org: req.user.org, active: true}).select("name email role").sort({createdAt: 1}).lean(),
    Lead.find({org: req.user.org}).select("assignedTo status value").lean(),
  ]);

  const stats = new Map();
  const ensure = (id) => {
    const key = id ? String(id) : "unassigned";
    if (!stats.has(key)) stats.set(key, {total: 0, won: 0, lost: 0, open: 0, wonValue: 0, pipelineValue: 0});
    return stats.get(key);
  };

  for (const lead of leads) {
    const bucket = ensure(lead.assignedTo);
    bucket.total += 1;
    const value = Number(lead.value) || 0;
    if (lead.status === "Won") { bucket.won += 1; bucket.wonValue += value; }
    else if (lead.status === "Lost") bucket.lost += 1;
    else { bucket.open += 1; bucket.pipelineValue += value; }
  }

  const rows = members.map((member) => {
    const bucket = ensure(member._id);
    const closed = bucket.won + bucket.lost;
    return {
      id: member._id,
      name: member.name,
      email: member.email,
      role: member.role,
      ...bucket,
      conversionRate: closed ? Math.round((bucket.won / closed) * 100) : 0,
    };
  });

  const unassigned = stats.get("unassigned");
  res.json({success: true, team: rows, unassigned: unassigned || {total: 0, won: 0, lost: 0, open: 0, wonValue: 0, pipelineValue: 0}});
});
