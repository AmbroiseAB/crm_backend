import {ApiError} from "./ApiError.js";

/**
 * Tiny dependency-free, in-memory, per-key sliding-window rate limiter.
 *
 * Good enough for a small-business CRM's public form (one process). For a
 * multi-instance deployment swap this for a shared store — the middleware
 * contract stays the same.
 *
 *   app.use("/api/public", rateLimit({windowMs: 60_000, max: 10}))
 */
export const rateLimit = ({windowMs = 60_000, max = 10, message} = {}) => {
  const hits = new Map(); // key -> number[] (timestamps within the window)

  // Opportunistic cleanup so the map doesn't grow unbounded.
  const sweep = (now) => {
    for (const [key, times] of hits) {
      const fresh = times.filter((t) => now - t < windowMs);
      if (fresh.length) hits.set(key, fresh);
      else hits.delete(key);
    }
  };

  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 5000) sweep(now);
    const key = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return next(new ApiError(429, message || "Too many requests. Please try again in a moment."));
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
};
