import {User} from "../models/User.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {generateToken} from "../utils/generateToken.js";
import {normalizeEmail, normalizeName, validateEmail, validateName, validatePassword} from "../utils/validation.js";
import {ensureUniqueSlug} from "../services/org.service.js";

const toClientUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  company: user.company,
  createdAt: user.createdAt,
  role: user.role,
  org: user.org,
  active: user.active,
  // Only the org owner carries meaningful settings; harmless for others.
  orgSettings: user.orgSettings
    ? {name: user.orgSettings.name, slug: user.orgSettings.slug, autoAssign: user.orgSettings.autoAssign}
    : undefined,
});

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, company } = req.body;

  const normalizedName = normalizeName(name);
  const normalizedEmail = normalizeEmail(email);
  const nameError = validateName(normalizedName);
  const emailError = validateEmail(normalizedEmail, true);
  const passwordError = validatePassword(password);
  if (nameError || emailError || passwordError) throw new ApiError(400, nameError || emailError || passwordError);

  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    throw new ApiError(400, "An account with this email already exists");
  }

  const companyName = typeof company === "string" ? company.trim() : "";
  const user = await User.create({ name: normalizedName, email: normalizedEmail, password, company: companyName });

  // Every self-registration starts a new workspace: the user is its admin and
  // its org points at itself. This keeps the solo-admin flow identical.
  user.role = "admin";
  user.org = user._id;
  user.active = true;
  user.orgSettings = {
    name: companyName || normalizedName,
    slug: await ensureUniqueSlug(companyName || normalizedName),
    autoAssign: false,
    roundRobinCursor: 0,
  };
  await user.save();

  res.status(201).json({
    success: true,
    token: generateToken(user._id),
    user: toClientUser(user),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const normalizedEmail = normalizeEmail(email);
  const emailError = validateEmail(normalizedEmail, true);
  if (emailError || typeof password !== "string" || !password) throw new ApiError(400, emailError || "Password is required");

  const user = await User.findOne({ email: normalizedEmail }).select("+password");
  if (!user || !(await user.matchPassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  res.json({
    success: true,
    token: generateToken(user._id),
    user: toClientUser(user),
  });
}); 

export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: toClientUser(req.user) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, company, password, currentPassword } = req.body;
  const user = req.user;

  if (name !== undefined) {
    const normalizedName = normalizeName(name);
    const nameError = validateName(normalizedName);
    if (nameError) throw new ApiError(400, nameError);
    user.name = normalizedName;
  }
  if (company !== undefined) {
    if (typeof company !== "string" || company.trim().length > 200) throw new ApiError(400, "Company must be 200 characters or fewer");
    user.company = company.trim();
  }
  if (password !== undefined) {
    // Changing a password requires proving ownership of the account by
    // supplying the current one — the stored hash is not loaded by `protect`
    // (password has select:false), so re-read it here.
    if (typeof currentPassword !== "string" || !currentPassword) {
      throw new ApiError(400, "Your current password is required to set a new one");
    }
    const passwordError = validatePassword(password);
    if (passwordError) throw new ApiError(400, passwordError);

    const withHash = await User.findById(user._id).select("+password");
    if (!withHash || !(await withHash.matchPassword(currentPassword))) {
      throw new ApiError(401, "Your current password is incorrect");
    }
    if (await withHash.matchPassword(password)) {
      throw new ApiError(400, "Your new password must be different from your current one");
    }
    user.password = password;
  }

  await user.save();
  res.json({ success: true, user: toClientUser(user) });
});
