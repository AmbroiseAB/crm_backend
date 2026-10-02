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
    // ── Multi-actor fields (additive) ──────────────────────────────────
    role: {
      type: String,
      enum: ["admin", "manager", "agent"],
      default: "admin",
      index: true,
    },
    // The workspace/account owner this user belongs to. For an admin, org = self.
    org: {type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null},
    active: {type: Boolean, default: true},
    // Org-level settings — only meaningful on the org owner (admin) document.
    orgSettings: {
      name: {type: String, trim: true, default: ""},
      slug: {type: String, trim: true, lowercase: true, default: null},
      autoAssign: {type: Boolean, default: false},
      roundRobinCursor: {type: Number, default: 0},
    },
  },
  {timestamps: true}
);

// Unique across org owners only. A partial filter (not sparse) is required
// because non-owners store slug=null explicitly, and a sparse unique index
// would still index those nulls and collide. Partial indexes only string slugs.
userSchema.index(
  {"orgSettings.slug": 1},
  {unique: true, partialFilterExpression: {"orgSettings.slug": {$type: "string"}}},
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