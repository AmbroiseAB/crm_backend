import {parsePhoneNumberFromString} from "libphonenumber-js";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
export const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u;
export const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z\d])\S{8,128}$/u;

export const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : value;
export const normalizeName = (value) => typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : value;

export const validateName = (value, label = "Name") => {
  const name = normalizeName(value);
  if (!name) return `${label} is required`;
  if (name.length < 2) return `${label} must be at least 2 characters`;
  if (name.length > 100) return `${label} cannot exceed 100 characters`;
  if (!NAME_PATTERN.test(name)) return `${label} may contain letters, spaces, apostrophes, hyphens, and periods only`;
  return null;
};

export const validateEmail = (value, required = false) => {
  const email = normalizeEmail(value);
  if (!email) return required ? "Email is required" : null;
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return "Please provide a valid email address";
  return null;
};

export const validatePassword = (value) => {
  if (typeof value !== "string" || !value) return "Password is required";
  if (!PASSWORD_PATTERN.test(value)) return "Password must be 8-128 characters and include uppercase, lowercase, number, and special character";
  return null;
};

export const validatePhone = (value, country) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return "Please provide a valid phone number";
  try {
    const parsed = parsePhoneNumberFromString(value.trim(), country || undefined);
    return parsed?.isValid() ? null : "Please provide a valid phone number for the selected country";
  } catch {
    return "Please provide a valid phone number for the selected country";
  }
};