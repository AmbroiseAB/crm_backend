import {ApiError} from "../utils/ApiError.js";

/**
 * Role gate. Runs AFTER `protect` (which populates req.user). 403s when the
 * authenticated user's role is not in the allowed list.
 *
 *   router.patch("/:id/assign", protect, authorize("admin", "manager"), handler)
 */
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, "Not authorized"));
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, "You do not have permission to perform this action"));
  }
  next();
};
