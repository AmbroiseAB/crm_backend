import {Router} from "express";
import {getPipelineIntelligence} from "../controllers/pipeline.controller.js";
import {protect} from "../middleware/auth.middleware.js";

const router = Router();
router.use(protect);
router.get("/intelligence", getPipelineIntelligence);

export default router;