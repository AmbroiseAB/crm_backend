import {Router} from "express";
import {clearNotifications, deleteNotification, getNotifications, markNotificationRead} from "../controllers/notification.controller.js";
import {protect} from "../middleware/auth.middleware.js";

const router = Router();
router.use(protect);
router.get("/", getNotifications);
router.patch("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);
router.delete("/", clearNotifications);

export default router;
