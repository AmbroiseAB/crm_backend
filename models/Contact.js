import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    org: {type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null},
    assignedTo: {type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null},
    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {type: String, trim: true, lowercase: true, default:"", maxlength: 254},
    phone: {type: String, trim: true, default:""},
    phoneCountry: {type: String, trim: true, uppercase: true, default: "CM", maxlength: 2},
    company: {type: String, trim: true, default:""},
    title: {type: String, trim: true, default:"", maxlength: 100},
    tags: [{type: String, trim: true, maxlength: 50}],
    notes: {type: String, trim: true, default:"", maxlength: 5000},
    favorite: {type: Boolean, default: false},
  },
  {timestamps: true},
);

contactSchema.index({name: "text", email: "text", company: "text"});

export const Contact = mongoose.model("Contact", contactSchema);