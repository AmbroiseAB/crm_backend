import {Contact} from "../models/Contact.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {normalizeEmail, normalizeName, validateEmail, validateName, validatePhone} from "../utils/validation.js";
import {buildScope} from "../utils/scope.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const editableContactFields = ["name", "email", "phone", "phoneCountry", "company", "title", "tags", "notes", "favorite"];
const normalizeContact = (body) => {
  const updates = Object.fromEntries(editableContactFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
  if (updates.name !== undefined) { updates.name = normalizeName(updates.name); const error = validateName(updates.name, "Contact name"); if (error) throw new ApiError(400, error); }
  if (updates.email !== undefined) { updates.email = normalizeEmail(updates.email); const error = validateEmail(updates.email); if (error) throw new ApiError(400, error); }
  if (updates.phone !== undefined) { updates.phone = typeof updates.phone === "string" ? updates.phone.trim() : updates.phone; const error = validatePhone(updates.phone, updates.phoneCountry); if (error) throw new ApiError(400, error); }
  return updates;
};

export const getContacts = asyncHandler(async (req, res) => {
  const {search, tag} = req.query;
  const filter = buildScope(req);

  if (tag) filter.tags = tag;
  if (search) {
    const rx = new RegExp(escapeRegex(search.slice(0, 100)), "i");
    filter.$or = [{name: rx}, {email: rx}, {company: rx}];
  }

  const contacts = await Contact.find(filter).sort({favorite: -1, name: 1});
  res.json({success: true, count: contacts.length, contacts});
});

export const getContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findOne({_id: req.params.id, ...buildScope(req)});
  if (!contact) throw new ApiError(404, "Contact not found");
  res.json({success: true, contact});
});

export const createContact = asyncHandler(async (req, res) => {
  const assignedTo = req.body.assignedTo && (req.user.role === "admin" || req.user.role === "manager")
    ? req.body.assignedTo
    : req.user._id;
  const contact = await Contact.create({...normalizeContact(req.body), owner: req.user._id, org: req.user.org, assignedTo});
  res.status(201).json({success: true, contact});
});

export const updateContact = asyncHandler(async (req, res) => {
  const updates = normalizeContact(req.body);
  const contact = await Contact.findOneAndUpdate(
    {_id: req.params.id, ...buildScope(req)},
    updates,
    {new: true, runValidators: true},
  );
  if (!contact) throw new ApiError(404, "Contact not found");
  res.json({success: true, contact});
});

export const deleteContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findOneAndDelete({
    _id: req.params.id,
    ...buildScope(req),
  });
  if (!contact) throw new ApiError(404, "Contact not found");
  res.json({success: true, message: "Contact deleted"});
});
