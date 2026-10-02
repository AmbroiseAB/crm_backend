/**
 * One-time, idempotent migration to the multi-actor model.
 *
 * Run once after deploying the org/RBAC changes:
 *     cd backend && npm run migrate
 *
 * What it does (only ever filling in MISSING values, so re-running is safe):
 *   - Every existing user  → role "admin", org = self, active = true, and an
 *                            orgSettings block with a unique slug.
 *   - Every Lead/Task/Contact/Note → org = owner.
 *   - Every Lead/Task/Contact      → assignedTo = owner (keeps the creator as
 *                                    the assignee so a lone admin is unchanged).
 *
 * After this runs, a workspace with a single admin behaves exactly as before:
 * admin sees all org records, and all records belong to that admin's org.
 */
import "dotenv/config";
import mongoose from "mongoose";
import {connectDB} from "./config/db.js";
import {User} from "./models/User.js";
import {Lead} from "./models/Lead.js";
import {Task} from "./models/Task.js";
import {Contact} from "./models/Contact.js";
import {Note} from "./models/Note.js";
import {ensureUniqueSlug} from "./services/org.service.js";

const migrateUsers = async () => {
  const users = await User.find({});
  let updated = 0;
  for (const user of users) {
    let dirty = false;
    if (!user.role) { user.role = "admin"; dirty = true; }
    if (!user.org) { user.org = user._id; dirty = true; }
    if (user.active === undefined || user.active === null) { user.active = true; dirty = true; }
    // Only org owners (org === self) need orgSettings/slug.
    const isOwner = String(user.org) === String(user._id);
    if (isOwner && !user.orgSettings?.slug) {
      const base = user.company || user.orgSettings?.name || user.name;
      // eslint-disable-next-line no-await-in-loop
      const slug = await ensureUniqueSlug(base, {excludeUserId: user._id});
      user.orgSettings = {
        name: user.orgSettings?.name || user.company || user.name,
        slug,
        autoAssign: user.orgSettings?.autoAssign ?? false,
        roundRobinCursor: user.orgSettings?.roundRobinCursor ?? 0,
      };
      dirty = true;
    }
    if (dirty) { await user.save(); updated += 1; } // eslint-disable-line no-await-in-loop
  }
  return updated;
};

// For records with an owner, set org/assignedTo = owner where still missing.
const backfillOwned = async (Model, {withAssignee}) => {
  const docs = await Model.find({$or: [{org: null}, {org: {$exists: false}}, ...(withAssignee ? [{assignedTo: null}, {assignedTo: {$exists: false}}] : [])]}).select("_id owner org assignedTo");
  const ops = docs.map((doc) => {
    const set = {};
    if (!doc.org) set.org = doc.owner;
    if (withAssignee && !doc.assignedTo) set.assignedTo = doc.owner;
    return Object.keys(set).length ? {updateOne: {filter: {_id: doc._id}, update: {$set: set}}} : null;
  }).filter(Boolean);
  if (ops.length) await Model.bulkWrite(ops);
  return ops.length;
};

const run = async () => {
  await connectDB();
  const users = await migrateUsers();
  const leads = await backfillOwned(Lead, {withAssignee: true});
  const tasks = await backfillOwned(Task, {withAssignee: true});
  const contacts = await backfillOwned(Contact, {withAssignee: true});
  const notes = await backfillOwned(Note, {withAssignee: false});
  console.log(`Migration complete: ${users} users, ${leads} leads, ${tasks} tasks, ${contacts} contacts, ${notes} notes updated.`);
};

run()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
