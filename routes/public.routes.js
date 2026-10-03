import {Router} from "express";
import {getPublicForm, submitPublicLead} from "../controllers/public.controller.js";

// Unauthenticated routes: the shareable lead-capture form. No `protect` here —
// the token in the URL is what ties a submission to an account.
const router = Router();

router.get("/leads/:token", getPublicForm);
router.post("/leads/:token", submitPublicLead);

export default router;
