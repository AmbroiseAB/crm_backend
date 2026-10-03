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

// Realistic pipeline for Infonova Consulting SARL (Yaoundé): Cameroonian SMEs and
// entrepreneurs asking for the firm's real services — networks, cybersecurity,
// video surveillance, cloud, web/mobile development, ERP, graphic design and IT
// training. All deal values are in XAF (FCFA).
const leadsData = [
  // ── New ──────────────────────────────────────────────────────────────
  {name: "Pascaline Ngo Bell", company: "Boulangerie La Pascaline", email: "contact@boulangerie-pascaline.cm", phone: "+237 6 99 10 22 01", status: "New", priority: "Medium", source: "Website", value: 850000, notes: "Wants a point-of-sale setup with two CCTV cameras for the shop front.", nextAction: "Call to schedule an on-site survey", nextActionDueAt: fromNow(1, 10)},
  {name: "Alain Fotso", company: "Pharmacie du Centre", email: "pharmacie.centre@gmail.com", phone: "+237 6 94 55 18 77", status: "New", priority: "High", source: "Referral", value: 1600000, notes: "Needs a small office network and a yearly IT support contract.", nextAction: "Send IT support contract options", nextActionDueAt: fromNow(2, 11), qualificationStatus: "QUALIFIED", buyingIntent: "MEDIUM", decisionMakerIdentified: true, budgetKnown: false, timelineKnown: false, needIdentified: true},
  {name: "Chantal Mbia", company: "Cabinet Médical Essos", email: "cabinet.essos@gmail.com", phone: "+237 6 77 40 09 12", status: "New", priority: "Low", source: "Social", value: 1200000, notes: "Interested in a website with online appointment booking. Still comparing prices."},
  {name: "Ibrahim Saidou", company: "Quincaillerie Mvan", email: "quincaillerie.mvan@gmail.com", phone: "+237 6 90 33 44 55", status: "New", priority: "Medium", source: "Cold Outreach", value: 700000, notes: "Looking for simple stock and invoicing software for the hardware store."},
  {name: "Pauline Ze", company: "École Bilingue La Semence", email: "direction@ecole-lasemence.cm", phone: "+237 6 98 71 20 34", status: "New", priority: "Low", source: "Event", value: 2300000, notes: "Met at an SME forum; wants a 15-station computer lab plus Office training for staff."},

  // ── Qualified ────────────────────────────────────────────────────────
  {name: "Serge Onana", company: "Hôtel Mont Fébé Palace", email: "technique@hotel-montfebe.cm", phone: "+237 6 99 02 88 10", status: "Qualified", priority: "High", source: "Referral", value: 6800000, notes: "Video surveillance upgrade plus guest WiFi across three floors. Budget approved.", nextAction: "Send the revised surveillance + WiFi plan", nextActionDueAt: fromNow(1, 11), qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},
  {name: "Marthe Abena", company: "Agro Négoce Mfoundi", email: "dg@agronegoce-mfoundi.cm", phone: "+237 6 95 60 41 23", status: "Qualified", priority: "High", source: "Referral", value: 9500000, notes: "ERP to cover stock, invoicing and supplier payments across two warehouses.", nextAction: "Call about the ERP discovery workshop", nextActionDueAt: fromNow(0, 14), qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: false, needIdentified: true},
  {name: "Jean-Claude Fouda", company: "Microfinance Akwa", email: "si@microfinance-akwa.cm", phone: "+237 6 91 77 30 08", status: "Qualified", priority: "Medium", source: "Website", value: 4200000, notes: "Requested a cybersecurity audit after a phishing incident.", qualificationStatus: "QUALIFIED", buyingIntent: "MEDIUM", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: false, needIdentified: true},
  {name: "Rodrigue Tchakounté", company: "Supermarché Score Mvog-Mbi", email: "gestion@score-mvogmbi.cm", phone: "+237 6 78 12 90 45", status: "Qualified", priority: "Medium", source: "Cold Outreach", value: 3100000, notes: "Wants CCTV coverage and a reliable in-store network. Needs the quote this month.", nextAction: "Confirm camera count after the site visit", nextActionDueAt: fromNow(3, 9), qualificationStatus: "QUALIFIED", buyingIntent: "MEDIUM", decisionMakerIdentified: false, budgetKnown: true, timelineKnown: true, needIdentified: true},

  // ── Proposal ─────────────────────────────────────────────────────────
  {name: "Nadège Eyenga", company: "Clinique Odontologique du Lac", email: "gerance@clinique-du-lac.cm", phone: "+237 6 99 44 51 72", status: "Proposal", priority: "High", source: "Referral", value: 5400000, notes: "Proposal sent for a patient booking web & mobile app.", nextAction: "Follow up on the app proposal", nextActionDueAt: ago(1, 15), qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},
  {name: "Emmanuel Njike", company: "Transit Logistics Douala", email: "it@transit-logistics.cm", phone: "+237 6 90 18 63 27", status: "Proposal", priority: "High", source: "Event", value: 11800000, notes: "Multi-site network infrastructure linking the Douala and Yaoundé offices.", nextAction: "Schedule the technical validation meeting", nextActionDueAt: fromNow(5, 10), qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},
  {name: "Brigitte Manga", company: "Imprimerie Saint Paul", email: "contact@imprimerie-saintpaul.cm", phone: "+237 6 77 09 55 14", status: "Proposal", priority: "Medium", source: "Website", value: 1900000, notes: "Brand refresh (graphic design) plus a catalogue website.", qualificationStatus: "QUALIFIED", buyingIntent: "MEDIUM", decisionMakerIdentified: true, budgetKnown: false, timelineKnown: true, needIdentified: true},
  {name: "Thomas Bikoï", company: "Groupe Scolaire Les Lauréats", email: "administration@gs-laureats.cm", phone: "+237 6 98 30 76 51", status: "Proposal", priority: "Low", source: "Social", value: 1350000, notes: "A full-stack web development cohort for 18 students. Awaiting the board review.", qualificationStatus: "QUALIFIED", buyingIntent: "LOW", decisionMakerIdentified: false, budgetKnown: false, timelineKnown: false, needIdentified: true},

  // ── Won ──────────────────────────────────────────────────────────────
  {name: "Yves Kamga", company: "Restaurant Le Foufou", email: "contact@lefoufou.cm", phone: "+237 6 99 81 40 66", status: "Won", priority: "Medium", source: "Website", value: 1150000, notes: "Won: website, hosting and local SEO package delivered.", qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},
  {name: "Linda Essono", company: "Studio Photo Lumière", email: "studio.lumiere@gmail.com", phone: "+237 6 94 22 17 88", status: "Won", priority: "Low", source: "Social", value: 450000, notes: "Won: logo and full visual identity package.", qualificationStatus: "QUALIFIED", buyingIntent: "MEDIUM", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},
  {name: "Paul Atangana", company: "ONG Santé Pour Tous", email: "operations@sante-pourtous.cm", phone: "+237 6 90 50 33 19", status: "Won", priority: "High", source: "Referral", value: 2800000, notes: "Won: annual IT maintenance and support contract for 40 workstations.", qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true},

  // ── Lost ─────────────────────────────────────────────────────────────
  {name: "Sandrine Owona", company: "Boutique Mode Élégance", email: "mode.elegance@gmail.com", phone: "+237 6 77 66 10 29", status: "Lost", priority: "Low", source: "Social", value: 350000, notes: "Lost: chose a freelance developer with a cheaper quote.", qualificationStatus: "QUALIFIED", buyingIntent: "LOW", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: false, needIdentified: true},
  {name: "Moussa Hamadou", company: "Entreprise BTP Sahel", email: "projets@btp-sahel.cm", phone: "+237 6 95 12 47 80", status: "Lost", priority: "High", source: "Cold Outreach", value: 7600000, notes: "Lost: infrastructure project postponed after a budget freeze.", qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: false, timelineKnown: false, needIdentified: true},

  // ── Qualified stage, still gathering information ───────────────────────
  {name: "Georges Mballa", company: "Cabinet Fiduciaire Conseil", email: "contact@fiduciaire-conseil.cm", phone: "+237 6 98 04 61 35", status: "Qualified", priority: "Medium", source: "Public Form", value: 1500000, notes: "Wants cloud backup and an email migration. Needs internal approval first.", qualificationStatus: "UNQUALIFIED", buyingIntent: null, decisionMakerIdentified: false, budgetKnown: false, timelineKnown: false, needIdentified: false},
];

const journeys = {
  "Hôtel Mont Fébé Palace": [[-18, "New"], [-16, "Qualified"]],
  "Microfinance Akwa": [[-30, "New"], [-26, "Qualified"]],
  "Clinique Odontologique du Lac": [[-30, "New"], [-26, "Qualified"], [-18, "Proposal"]],
  "Restaurant Le Foufou": [[-42, "New"], [-38, "Qualified"], [-28, "Proposal"], [-18, "Won"]],
  "Boutique Mode Élégance": [[-28, "New"], [-22, "Lost"]],
  "ONG Santé Pour Tous": [[-24, "New"], [-20, "Qualified"], [-12, "Proposal"], [-5, "Won"]],
  "Entreprise BTP Sahel": [[-35, "New"], [-30, "Qualified"], [-20, "Lost"]],
};

const interactionTemplates = [
  ["CALL", "Call", "OUTBOUND", "CONNECTED", "Discussed the requirements and confirmed the project timeline."],
  ["WHATSAPP", "WhatsApp", "INBOUND", "REPLIED", "Client asked for the revised quotation."],
  ["EMAIL", "Email", "OUTBOUND", "QUOTE_SENT", "Sent the service quotation for review."],
  ["MEETING", "Meeting", "OUTBOUND", "MEETING_BOOKED", "On-site assessment completed with the client's team."],
  ["NOTE", "Note", "OUTBOUND", "OTHER", "Decision expected after the client's internal meeting."],
];

async function seed() {
  await connectDB();
  const password = await bcrypt.hash("Ambroise#4115", 10);
  const user = await User.findOneAndUpdate(
    {email: "ambroiseab11@gmail.com"},
    {name: "Ambroise", email: "ambroiseab11@gmail.com", password, company: "Infonova"},
    {upsert: true, new: true, setDefaultsOnInsert: true},
  );
  const owner = user._id;
  await Promise.all([
    Lead.deleteMany({owner}), Contact.deleteMany({owner}), Note.deleteMany({owner}), Task.deleteMany({owner}),
    Notification.deleteMany({owner}),
  ]);
  const contacts = await Contact.insertMany([
    {owner, name: "Marthe Abena", email: "dg@agronegoce-mfoundi.cm", phone: "+237 6 95 60 41 23", company: "Agro Négoce Mfoundi", title: "Directrice Générale", tags: ["erp", "priority"]},
    {owner, name: "Serge Onana", email: "technique@hotel-montfebe.cm", phone: "+237 6 99 02 88 10", company: "Hôtel Mont Fébé Palace", title: "Responsable Technique", tags: ["infrastructure"]},
    {owner, name: "Nadège Eyenga", email: "gerance@clinique-du-lac.cm", phone: "+237 6 99 44 51 72", company: "Clinique Odontologique du Lac", title: "Gérante", tags: ["healthcare"]},
    {owner, name: "Yves Kamga", email: "contact@lefoufou.cm", phone: "+237 6 99 81 40 66", company: "Restaurant Le Foufou", title: "Propriétaire", tags: ["web", "won"]},
  ]);
  const leads = await Lead.insertMany(leadsData.map((lead) => ({
    ...lead,
    owner,
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
  for (const company of ["Restaurant Le Foufou", "ONG Santé Pour Tous", "Clinique Odontologique du Lac", "Hôtel Mont Fébé Palace", "Agro Négoce Mfoundi"]) {
    const lead = leadByCompany.get(company);
    const count = company === "Restaurant Le Foufou" ? 11 : company === "Clinique Odontologique du Lac" ? 4 : 2;
    for (let index = 0; index < count; index += 1) {
      const template = interactionTemplates[index % interactionTemplates.length];
      interactions.push({leadId: lead._id, createdBy: owner, type: template[0], channel: template[0], direction: template[2], outcome: template[3], summary: template[4], timestamp: ago(Math.max(1, 25 - index * 2), 9 + (index % 5))});
    }
  }
  await Interaction.insertMany(interactions);
  await Interaction.insertMany([
    {leadId: leadByCompany.get("Pharmacie du Centre")._id, createdBy: owner, type: "NOTE", channel: "NOTE", summary: "Referral received; awaiting the first support-contract discussion.", timestamp: ago(1)},
    {leadId: leadByCompany.get("Boutique Mode Élégance")._id, createdBy: owner, type: "CALL", channel: "CALL", direction: "OUTBOUND", outcome: "LOST", summary: "Client chose a freelance developer after comparing quotes.", timestamp: ago(7)},
  ]);

  await Note.insertMany([
    {owner, lead: leadByCompany.get("Agro Négoce Mfoundi")._id, content: "ERP scope should cover stock, invoicing and supplier payments across both warehouses.", pinned: true},
    {owner, lead: leadByCompany.get("Clinique Odontologique du Lac")._id, content: "Decision expected after the clinic's monthly management meeting.", pinned: true},
    {owner, contact: contacts[2]._id, content: "Prefers a phased rollout starting with the patient booking module.", pinned: false},
    {owner, content: "Keep the next Action Center review focused on overdue proposals and pending site surveys.", pinned: false},
  ]);
  await Notification.create({owner, type: "AI_INSIGHT", title: "AI pipeline insight", message: "Several proposals are waiting on a dated follow-up — confirm next steps to keep projects moving.", details: "Review the Action Center before the next client visit."});

  const taskSpecs = [
    ["Agro Négoce Mfoundi", "Call about the ERP discovery workshop", fromNow(0, 14), "High", "Pending"],
    ["Hôtel Mont Fébé Palace", "Send the revised surveillance + WiFi plan", fromNow(1, 11), "High", "Pending"],
    ["Clinique Odontologique du Lac", "Follow up on the app proposal", ago(1, 15), "High", "Pending"],
    ["Restaurant Le Foufou", "Send onboarding and hosting handover", ago(8), "Medium", "Completed"],
    ["ONG Santé Pour Tous", "Confirm the annual maintenance renewal", fromNow(7), "Low", "Pending"],
  ];
  const tasks = await Task.insertMany(taskSpecs.map(([company, title, dueDate, priority, status]) => ({owner, relatedLead: leadByCompany.get(company)._id, title, dueDate, priority, status, isNextAction: Boolean(leadByCompany.get(company).nextAction), completedAt: status === "Completed" ? ago(7) : null})));
  for (const task of tasks) {
    const lead = leads.find((candidate) => String(candidate._id) === String(task.relatedLead));
    if (lead && lead.nextAction) {
      lead.nextActionTask = task._id;
      await lead.save();
    }
  }
  console.log(`Seeded ${leads.length} leads, ${contacts.length} contacts, ${interactions.length + 2} interactions, ${tasks.length} tasks for ambroiseab11@gmail.com`);
  console.log("Demo password: Ambroise#4115");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.connection.close();
});
