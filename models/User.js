import mongoose from "mongoose";
import bcrypt from "bcryptjs"
import {EMAIL_PATTERN, NAME_PATTERN, PASSWORD_PATTERN} from "../utils/validation.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
      match: [NAME_PATTERN, "Name contains invalid characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email cannot exceed 254 characters"],
      match: [EMAIL_PATTERN, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
      maxlength: [128, "Password cannot exceed 128 characters"],
      match: [PASSWORD_PATTERN, "Password must be 8-128 characters and include uppercase, lowercase, number, and special character"],
    },
    company: {type: String, trim: true, default: ""},
    // Opaque token used in the shareable public lead-capture link. Generated
    // lazily (see auth.controller getPublicLink); sparse so existing users stay null.
    publicToken: {type: String, unique: true, sparse: true, index: true},
  },
  {timestamps: true}
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = function(entered) {
  return bcrypt.compare(entered, this.password);
};

export const User = mongoose.model("User",userSchema);