import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import { notFound, errorHandler } from "./middleware/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import leadRoutes from "./routes/lead.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import noteRoutes from "./routes/note.routes.js";
import taskRoutes from "./routes/task.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import actionCenterRoutes from "./routes/action-center.routes.js";
import pipelineRoutes from "./routes/pipeline.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import publicRoutes from "./routes/public.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();

const configuredClientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const isAllowedOrigin = (origin) => {
  if (!origin || origin === configuredClientUrl) return true;
  if (process.env.NODE_ENV === "production") return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin) ? origin || true : false),
  credentials: true,
}));
app.use(express.json({limit: "1mb"}));
app.use(express.urlencoded({extended: true}));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

app.get("/api/health", (req, res) =>
  res.json({success: true, status: "ok", service: "Infonova CRM API"}),
);
// Public (unauthenticated) web-to-lead endpoints.
app.use("/api/public", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/action-center", actionCenterRoutes);
app.use("/api/pipeline", pipelineRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
