import {Note} from "../models/Note.js";
import {Lead} from "../models/Lead.js";
import {Contact} from "../models/Contact.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
const editableNoteFields = ["content", "lead", "contact", "pinned"];

const validateNoteLinks = async ({leadId, contactId, owner}) => {
  if (leadId && !(await Lead.exists({_id: leadId, owner}))) {
    throw new ApiError(404, "Lead not found");
  }
  if (contactId && !(await Contact.exists({_id: contactId, owner}))) {
    throw new ApiError(404, "Contact not found");
  }
};

export const getNotes = asyncHandler(async (req, res) => {
  const {lead, contact, search} = req.query;
  const filter = {owner: req.user._id};
  if (lead) filter.lead = lead;
  if (contact) filter.contact = contact;
  if (search) filter.content = new RegExp(search, "i");

  const notes = await Note.find(filter)
    .sort({pin: -1, createdAt: -1})
    .populate("lead", "name company")
    .populate("contact", "name company");
  res.json({success: true, count: notes.length, notes});
});

export const createNote = asyncHandler(async (req, res) => {
  const {content, lead, contact, pinned} = req.body;
  if (typeof content !== "string" || !content.trim()) throw new ApiError(400, "Note content is required");
  if (content.trim().length > 10000) throw new ApiError(400, "Note content cannot exceed 10000 characters");
  await validateNoteLinks({leadId: lead, contactId: contact, owner: req.user._id});

  const note = await Note.create({
    owner: req.user._id,
    content: content.trim(),
    lead: lead || null,
    contact: contact || null,
    pinned: Boolean(pinned),
  });
  res.status(201).json({success: true, note});
});

export const updateNote = asyncHandler(async (req, res) => {
  const updates = Object.fromEntries(editableNoteFields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
  if (updates.content !== undefined) {
    if (typeof updates.content !== "string" || !updates.content.trim()) throw new ApiError(400, "Note content is required");
    if (updates.content.trim().length > 10000) throw new ApiError(400, "Note content cannot exceed 10000 characters");
    updates.content = updates.content.trim();
  }
  await validateNoteLinks({leadId: updates.lead, contactId: updates.contact, owner: req.user._id});
  const note = await Note.findOneAndUpdate(
    {_id: req.params.id, owner: req.user._id},
    updates,
    {new: true, runValidators: true},
  );
  if (!note) throw new ApiError(404, "Note not found");
  res.json({success: true, note});
});

export const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({_id: req.params.id, owner: req.user._id});
  if (!note) throw new ApiError(404, "Note not found");
  res.json({success: true, message: "Note deleted"});
});