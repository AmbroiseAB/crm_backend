import { Router } from "express";
import {
  aiStatus,
  leadSummary,
  generateEmailDraft,
  nextBestAction,
  salesInsights,
  getAIResults,
} from "../controllers/ai.controller.js"
import { protect } from "../middleware/auth.middleware.js";

const router = Router();
router.use(protect);

router.get("/status", aiStatus);
router.get("/results", getAIResults);
router.post("/lead-summary", leadSummary);
router.post("/generate-email", generateEmailDraft);
router.post("/next-best-action", nextBestAction);
router.post("/sales-insights", salesInsights);

export default router; 