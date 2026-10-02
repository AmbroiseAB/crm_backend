import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {connectDB} from "./config/db.js";
import {User} from "./models/User.js";
import {Lead} from "./models/Lead.js";
import {Contact} from "./models/Contact.js";
import {Note} from "./models/Note.js";
import {Task} from "./models/Task.js";
import {Interaction} from "./models/Interaction.js";
import {StageHistory} from "./models/StageHistory.js";
import {Notification} from "./models/Notification.js";

const DAY = 24 * 60 * 60 * 1000;
const ago = (days, hour = 10) => {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
};
const fromNow = (days, hour = 10) => {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const leadsData = [
  {name: "Amina Njoya", company: "Mboa Cloud Services", email: "procurement@mboa-cloud.test", phone: "+237 690 000 101", status: "New", priority: "High", source: "Website", value: 4200000, notes: "Requested a cloud migration assessment.", nextAction: "Call procurement about the discovery brief", nextActionDueAt: fromNow(0, 14), qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: false, needIdentified: true},
  {name: "Etienne Mbarga", company: "Sahel Freight Network", email: "operations@sahel-freight.test", phone: "+237 690 000 102", status: "New", priority: "Medium", source: "Referral", value: 850000, notes: "New referral from a Douala logistics partner."},
  {name: "Grace Tanyi", company: "Buea Learning Hub", email: "director@buea-learning.test", phone: "+237 690 000 103", status: "New", priority: "Low", source: "Social", value: 180000, notes: "No response yet; compare with education pricing."},
  {name: "Mireille Fombad", company: "Kumba Fresh Market", email: "owner@kumba-fresh.test", phone: "+237 690 000 104", status: "New", priority: "Medium", source: "Event", value: 300000, notes: "Met at a local retail owners forum."},
  {name: "Boris Ekani", company: "Littoral Buildworks", email: "projects@littoral-buildworks.test", phone: "+237 690 000 105", status: "Qualified", priority: "High", source: "Referral", value: 12500000, notes: "Budget approved for procurement workflow.", nextAction: "Send revised implementation plan", nextActionDueAt: fromNow(1, 11), qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},
  {name: "Nora Atangana", company: "Centreline Clinics", email: "admin@centreline-clinics.test", phone: "+237 690 000 106", status: "Qualified", priority: "Medium", source: "Website", value: 2400000, notes: "Needs appointment and patient follow-up workflow.", qualificationStatus: "QUALIFIED", buyingIntent: "MEDIUM", decisionMakerIdentified: false, budgetKnown: true, timelineKnown: false, needIdentified: true},
  {name: "Pauline Etoa", company: "Green Valley Agro", email: "commercial@green-valley-agro.test", phone: "+237 690 000 107", status: "Qualified", priority: "Low", source: "Cold Outreach", value: 700000, notes: "Interested but timing is uncertain.", qualificationStatus: "QUALIFIED", buyingIntent: "LOW", decisionMakerIdentified: false, budgetKnown: false, timelineKnown: false, needIdentified: true},
  {name: "Simon Tchoumi", company: "Nexa Telecom Partners", email: "sales@nexa-telecom.test", phone: "+237 690 000 108", status: "Qualified", priority: "High", source: "Website", value: 6800000, notes: "Regional sales team wants shared visibility.", nextAction: "Confirm technical requirements", nextActionDueAt: fromNow(3, 9), qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: false, timelineKnown: true, needIdentified: true},
  {name: "Clarisse Wamba", company: "Douala Trade Finance", email: "relationship@douala-trade-finance.test", phone: "+237 690 000 109", status: "Proposal", priority: "High", source: "Referral", value: 9200000, notes: "Proposal sent to the finance committee.", nextAction: "Follow up on proposal review", nextActionDueAt: ago(1, 15), qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},
  {name: "David Nkem", company: "Mount Cameroon Security", email: "operations@mount-cameroon-security.test", phone: "+237 690 000 110", status: "Proposal", priority: "Medium", source: "Event", value: 3600000, notes: "Asked for a phased rollout quotation.", nextAction: "Call operations about phased pricing", nextActionDueAt: fromNow(1, 16), qualificationStatus: "QUALIFIED", buyingIntent: "MEDIUM", decisionMakerIdentified: true, budgetKnown: false, timelineKnown: true, needIdentified: true},
  {name: "Blaise Nono", company: "Wouri Hospitality Group", email: "commercial@wouri-hospitality.test", phone: "+237 690 000 111", status: "Proposal", priority: "Low", source: "Website", value: 1100000, notes: "Proposal has not been reviewed yet.", qualificationStatus: "QUALIFIED", buyingIntent: "LOW", decisionMakerIdentified: false, budgetKnown: false, timelineKnown: false, needIdentified: true},
  {name: "Ruth Manka", company: "Atlas Manufacturing Cameroon", email: "procurement@atlas-mfg.test", phone: "+237 690 000 112", status: "Proposal", priority: "High", source: "Cold Outreach", value: 18500000, notes: "Large account with a formal procurement cycle.", nextAction: "Schedule procurement committee follow-up", nextActionDueAt: fromNow(5, 10), qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},
  {name: "Jean-Paul Mvondo", company: "UrbanNest Realty", email: "director@urbannest-realty.test", phone: "+237 690 000 113", status: "Won", priority: "High", source: "Referral", value: 5400000, notes: "Won after property enquiry pilot.", qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},
  {name: "Sophie Essomba", company: "Kivu Professional Services", email: "hello@kivu-professional.test", phone: "+237 690 000 114", status: "Won", priority: "Medium", source: "Website", value: 1500000, notes: "Converted after a short implementation cycle.", qualificationStatus: "QUALIFIED", buyingIntent: "MEDIUM", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},
  {name: "Moussa Bello", company: "Northern Route Transport", email: "fleet@northern-route.test", phone: "+237 690 000 115", status: "Won", priority: "Low", source: "Event", value: 900000, notes: "Won with a small fleet package.", qualificationStatus: "QUALIFIED", buyingIntent: "MEDIUM", decisionMakerIdentified: true, budgetKnown: false, timelineKnown: true, needIdentified: true},
  {name: "Carine Fofung", company: "Bamenda Retail Cooperative", email: "manager@bamenda-retail.test", phone: "+237 690 000 116", status: "Lost", priority: "Medium", source: "Social", value: 2100000, notes: "Lost to an incumbent after budget review.", qualificationStatus: "QUALIFIED", buyingIntent: "MEDIUM", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},
  {name: "Hervé Ngassa", company: "Coastal Energy Services", email: "commercial@coastal-energy.test", phone: "+237 690 000 117", status: "Lost", priority: "High", source: "Cold Outreach", value: 10200000, notes: "Project postponed with no decision date.", qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: false, timelineKnown: false, needIdentified: true},
  {name: "Lucie Abena", company: "Equator Health Supplies", email: "sales@equator-health.test", phone: "+237 690 000 118", status: "Lost", priority: "Low", source: "Referral", value: 450000, notes: "Requirements did not match the current package.", qualificationStatus: "DISQUALIFIED", buyingIntent: "LOW", decisionMakerIdentified: false, budgetKnown: false, timelineKnown: false, needIdentified: false},
  {name: "Felix Tita", company: "Savanna Advisory", email: "partner@savanna-advisory.test", phone: "+237 690 000 119", status: "Qualified", priority: "Medium", source: "Website", value: 1250000, notes: "Needs internal approval before next step.", qualificationStatus: "UNQUALIFIED", buyingIntent: null, decisionMakerIdentified: false, budgetKnown: false, timelineKnown: false, needIdentified: false},
];

const journeys = {
  "Littoral Buildworks": [[-18, "New"], [-16, "Qualified"]],
  "Douala Trade Finance": [[-30, "New"], [-26, "Qualified"], [-18, "Proposal"]],
  "UrbanNest Realty": [[-42, "New"], [-38, "Qualified"], [-28, "Proposal"], [-18, "Won"]],
  "Bamenda Retail Cooperative": [[-28, "New"], [-22, "Lost"]],
  "Northern Route Transport": [[-24, "New"], [-20, "Qualified"], [-12, "Proposal"], [-5, "Won"]],
  "Hervé Ngassa": [[-35, "New"], [-30, "Qualified"], [-20, "Lost"]],
};

const interactionTemplates = [
  ["CALL", "Call", "OUTBOUND", "CONNECTED", "Discussed the client's requirements and confirmed the decision timeline."],
  ["WHATSAPP", "WhatsApp", "INBOUND", "REPLIED", "Client requested the revised quotation."],
  ["EMAIL", "Email", "OUTBOUND", "QUOTE_SENT", "Quotation sent to procurement for review."],
  ["MEETING", "Meeting", "OUTBOUND", "MEETING_BOOKED", "Product demonstration completed with the operations team."],
  ["NOTE", "Note", "OUTBOUND", "OTHER", "Decision expected after the internal management meeting."],
];

async function seed() {
  await connectDB();
  const password = await bcrypt.hash("InfonovaSeed2026!", 10);
  const user = await User.findOneAndUpdate(
    {email: "demo@infonova.test"},
    {name: "Demo Sales Manager", email: "demo@infonova.test", password, company: "Infonova Demo Business", role: "admin", active: true},
    {upsert: true, new: true, setDefaultsOnInsert: true},
  );
  const owner = user._id;
  // Make the demo user a self-owned org admin so the multi-actor scoping works.
  user.org = owner;
  user.orgSettings = {name: "Infonova Demo Business", slug: "infonova-demo", autoAssign: false, roundRobinCursor: 0};
  await user.save();
  await Promise.all([
    Lead.deleteMany({owner}), Contact.deleteMany({owner}), Note.deleteMany({owner}), Task.deleteMany({owner}),
    Notification.deleteMany({owner}),
  ]);
  const contacts = await Contact.insertMany([
    {owner, org: owner, assignedTo: owner, name: "Nadia Fomo", email: "nadia@mboa-cloud.test", phone: "+237 690 001 201", company: "Mboa Cloud Services", title: "Procurement Lead", tags: ["technology", "priority"]},
    {owner, org: owner, assignedTo: owner, name: "Armand Taku", email: "armand@littoral-buildworks.test", phone: "+237 690 001 202", company: "Littoral Buildworks", title: "Projects Director", tags: ["construction"]},
    {owner, org: owner, assignedTo: owner, name: "Mireille Kengne", email: "mireille@centreline-clinics.test", phone: "+237 690 001 203", company: "Centreline Clinics", title: "Clinic Administrator", tags: ["healthcare"]},
    {owner, org: owner, assignedTo: owner, name: "Patrick Ewane", email: "patrick@urbannest-realty.test", phone: "+237 690 001 204", company: "UrbanNest Realty", title: "Managing Director", tags: ["real-estate", "won"]},
  ]);
  const leads = await Lead.insertMany(leadsData.map((lead) => ({
    ...lead,
    owner,
    org: owner,
    assignedTo: owner,
    createdAt: ago(Math.abs(journeys[lead.company]?.[0]?.[0] ?? -1), 9),
  })));
  const leadByCompany = new Map(leads.map((lead) => [lead.company, lead]));
  const histories = [];
  for (const lead of leads) {
    const path = journeys[lead.company] || [[-Math.max(1, Math.round((Date.now() - lead.createdAt.getTime()) / DAY)), "New"]];
    for (let index = 0; index < path.length; index += 1) {
      histories.push({leadId: lead._id, changedBy: owner, fromStage: index ? path[index - 1][1] : null, toStage: path[index][1], changedAt: ago(Math.abs(path[index][0]), 10 + index)});
    }
  }
  await StageHistory.insertMany(histories);

  const interactions = [];
  for (const company of ["Douala Trade Finance", "UrbanNest Realty", "Northern Route Transport", "Littoral Buildworks", "Mboa Cloud Services"]) {
    const lead = leadByCompany.get(company);
    const count = company === "UrbanNest Realty" ? 11 : company === "Douala Trade Finance" ? 4 : 2;
    for (let index = 0; index < count; index += 1) {
      const template = interactionTemplates[index % interactionTemplates.length];
      interactions.push({leadId: lead._id, createdBy: owner, type: template[0], channel: template[0], direction: template[2], outcome: template[3], summary: template[4], timestamp: ago(Math.max(1, 25 - index * 2), 9 + (index % 5))});
    }
  }
  await Interaction.insertMany(interactions);
  await Interaction.insertMany([
    {leadId: leadByCompany.get("Sahel Freight Network")._id, createdBy: owner, type: "NOTE", channel: "NOTE", summary: "Referral received and awaiting first response.", timestamp: ago(1)},
    {leadId: leadByCompany.get("Bamenda Retail Cooperative")._id, createdBy: owner, type: "CALL", channel: "CALL", direction: "OUTBOUND", outcome: "LOST", summary: "Client selected an incumbent provider after budget review.", timestamp: ago(7)},
  ]);

  await Note.insertMany([
    {owner, org: owner, lead: leadByCompany.get("Mboa Cloud Services")._id, content: "Discovery brief should cover data residency, migration timing, and support hours.", pinned: true},
    {owner, org: owner, lead: leadByCompany.get("Douala Trade Finance")._id, content: "Decision expected after the finance committee review.", pinned: true},
    {owner, org: owner, contact: contacts[2]._id, content: "Clinic administrator prefers a phased rollout after the current quarter.", pinned: false},
    {owner, org: owner, content: "Keep the next Action Center review focused on overdue proposals.", pinned: false},
  ]);
  await Notification.create({owner, type: "AI_INSIGHT", title: "AI pipeline insight", message: "Several active opportunities need a dated next action to keep the pipeline moving.", details: "Review the Action Center before the next sales block.", fingerprint: "seed:ai-insight:pipeline"});

  const taskSpecs = [
    ["Mboa Cloud Services", "Call procurement about the discovery brief", fromNow(0, 14), "High", "Pending"],
    ["Littoral Buildworks", "Send revised implementation plan", fromNow(1, 11), "High", "Pending"],
    ["Douala Trade Finance", "Follow up on proposal review", ago(1, 15), "High", "Pending"],
    ["UrbanNest Realty", "Send onboarding summary", ago(8), "Medium", "Completed"],
    ["Northern Route Transport", "Confirm renewal contact", fromNow(7), "Low", "Pending"],
  ];
  const tasks = await Task.insertMany(taskSpecs.map(([company, title, dueDate, priority, status]) => ({owner, org: owner, assignedTo: owner, relatedLead: leadByCompany.get(company)._id, title, dueDate, priority, status, isNextAction: Boolean(leadByCompany.get(company).nextAction), completedAt: status === "Completed" ? ago(7) : null})));
  for (const task of tasks) {
    const lead = leads.find((candidate) => String(candidate._id) === String(task.relatedLead));
    if (lead && lead.nextAction) {
      lead.nextActionTask = task._id;
      await lead.save();
    }
  }
  console.log(`Seeded ${leads.length} leads, ${contacts.length} contacts, ${interactions.length + 2} interactions, ${tasks.length} tasks for demo@infonova.test`);
  console.log("Demo password: InfonovaSeed2026!");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.connection.close();
});
