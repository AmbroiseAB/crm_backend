import {Router} from "express";
import {
  listUsers,
  inviteUser,
  updateUserRole,
  setUserActive,
  getOrgSettings,
  updateOrgSettings,
  teamView,
} from "../controllers/admin.controller.js";
import {protect} from "../middleware/auth.middleware.js";
import {authorize} from "../middleware/authorize.middleware.js";

const router = Router();
router.use(protect);

// Team view is visible to managers too; everything else is admin-only.
router.get("/team", authorize("admin", "manager"), teamView);

router.get("/users", authorize("admin"), listUsers);
router.post("/users", authorize("admin"), inviteUser);
router.patch("/users/:id/role", authorize("admin"), updateUserRole);
router.patch("/users/:id/active", authorize("admin"), setUserActive);

router.get("/org", authorize("admin"), getOrgSettings);
router.patch("/org", authorize("admin"), updateOrgSettings);

export default router;
