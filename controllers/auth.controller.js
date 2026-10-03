import crypto from "node:crypto";
import {User} from "../models/User.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {generateToken} from "../utils/generateToken.js";
import {normalizeEmail, normalizeName, validateEmail, validateName, validatePassword} from "../utils/validation.js";

const toClientUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  company: user.company,
  createdAt: user.createdAt,
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

  const user = await User.create({ name: normalizedName, email: normalizedEmail, password, company: typeof company === "string" ? company.trim() : "" });

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
    // Changing the password requires the current one, so a hijacked session can't silently reset it.
    if (typeof currentPassword !== "string" || !currentPassword) throw new ApiError(400, "Current password is required to set a new password");
    const withPassword = await User.findById(user._id).select("+password");
    if (!withPassword || !(await withPassword.matchPassword(currentPassword))) {
      throw new ApiError(401, "Current password is incorrect");
    }
    const passwordError = validatePassword(password);
    if (passwordError) throw new ApiError(400, passwordError);
    user.password = password;
  }

  await user.save();
  res.json({ success: true, user: toClientUser(user) });
});

// Returns the account's shareable public lead-capture token, generating one on
// first request. The frontend builds the full URL from this token.
export const getPublicLink = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user.publicToken) {
    user.publicToken = crypto.randomBytes(16).toString("hex");
    await user.save();
  }
  res.json({ success: true, token: user.publicToken });
});
