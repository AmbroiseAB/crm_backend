/**
 * Multi-actor scoping helpers.
 *
 * Every record carries `org` (the workspace owner's User id) plus `owner`
 * (the creator, kept for audit) and — where relevant — `assignedTo`.
 *
 * Visibility rules:
 *   - admin & manager  → see every record in their org
 *   - agent            → see only records assigned to them (or that they own,
 *                         for resources without an assignee such as Notes)
 *
 * A lone admin (org === self, everything assigned to self) therefore sees all
 * of their own records exactly as before the multi-actor upgrade.
 */

/** Filter for resources that have an `assignedTo` field (Lead, Task, Contact). */
export const buildScope = (req, {agentField = "assignedTo"} = {}) => {
  const filter = {org: req.user.org};
  if (req.user.role === "agent") filter[agentField] = req.user._id;
  return filter;
};

/** Filter for resources scoped by creator for agents (Note). */
export const ownerScope = (req) => {
  const filter = {org: req.user.org};
  if (req.user.role === "agent") filter.owner = req.user._id;
  return filter;
};

/** True when the user may see/act on the whole org (not restricted to assignments). */
export const seesWholeOrg = (user) => user.role === "admin" || user.role === "manager";

/** Build a url-safe org slug from arbitrary text. */
export const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
