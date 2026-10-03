import {Router} from "express";
import {
  register,
  login,
  getMe,
  updateProfile,
  getPublicLink,
} from "../controllers/auth.controller.js";
import {protect} from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.get("/public-link", protect, getPublicLink);

export default router;