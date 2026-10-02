import {Router} from "express";
import {getPublicOrg, submitPublicLead} from "../controllers/public.controller.js";
import {rateLimit} from "../utils/rateLimit.js";

// PUBLIC routes — no `protect`. Mounted at /api/public before the authed routes.
const router = Router();

// Fetch org branding for the form (lightly limited to deter scraping).
router.get("/orgs/:orgSlug", rateLimit({windowMs: 60_000, max: 60}), getPublicOrg);

// Lead submission — tighter limit per IP.
router.post("/leads/:orgSlug", rateLimit({windowMs: 60_000, max: 8, message: "Too many submissions. Please try again shortly."}), submitPublicLead);

export default router;
