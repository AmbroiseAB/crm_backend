import {User} from "../models/User.js";
import {slugify} from "../utils/scope.js";

/**
 * Org-level helpers shared by auth (registration), admin (settings) and the
 * public web-to-lead flow.
 *
 * An "org" is not a separate collection — it is simply the admin/owner User,
 * whose `org` points at itself and whose `orgSettings` hold the workspace
 * name, public form slug, and auto-assignment configuration.
 */

/** Find a slug not already used by another org owner. Appends -2, -3, … on clash. */
export const ensureUniqueSlug = async (base, {excludeUserId = null} = {}) => {
  const root = slugify(base) || "team";
  let candidate = root;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await User.exists({"orgSettings.slug": candidate, ...(excludeUserId ? {_id: {$ne: excludeUserId}} : {})})) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

/**
 * Round-robin the next active agent in an org (falls back to managers, then the
 * owner) and persist the advanced cursor on the owner. Returns an ObjectId.
 */
export const pickRoundRobinAssignee = async (orgOwner) => {
  const org = orgOwner.org || orgOwner._id;
  const agents = await User.find({org, active: true, role: "agent"}).select("_id").sort({createdAt: 1}).lean();
  const pool = agents.length ? agents : await User.find({org, active: true, role: {$in: ["agent", "manager"]}}).select("_id").sort({createdAt: 1}).lean();
  if (!pool.length) return orgOwner._id;
  const cursor = orgOwner.orgSettings?.roundRobinCursor || 0;
  const chosen = pool[cursor % pool.length];
  await User.updateOne({_id: orgOwner._id}, {$set: {"orgSettings.roundRobinCursor": (cursor + 1) % pool.length}});
  return chosen._id;
};
