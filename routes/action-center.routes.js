import {Router} from "express";
import {getActionCenter} from "../controllers/action-center.controller.js";
import {protect} from "../middleware/auth.middleware.js";

const router = Router();
router.use(protect);
router.get("/", getActionCenter);

export default router;