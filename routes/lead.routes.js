import {Router} from "express";
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  reorderLeads,
  createInteraction,
  getInteractions,
  updateNextAction,
  completeNextAction,
} from "../controllers/lead.controller.js";
import {updateQualification} from "../controllers/lead.controller.js";
import {getStageHistory} from "../controllers/pipeline.controller.js";
import {protect} from "../middleware/auth.middleware.js";

const router = Router();

router.use(protect);

router.patch("/reorder", reorderLeads);
router.route("/:id/interactions").get(getInteractions).post(createInteraction);
router.patch("/:id/next-action", updateNextAction);
router.post("/:id/next-action/complete", completeNextAction);
router.get("/:id/stage-history", getStageHistory);
router.patch("/:id/qualification", updateQualification);
router.route("/").get(getLeads).post(createLead);
router.route("/:id").get(getLead).put(updateLead).delete(deleteLead);

export default router;