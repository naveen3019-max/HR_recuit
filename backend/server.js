import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import env from "./config/env.js";
import prisma from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import linkedinRoutes from "./routes/linkedinRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import jobRoleRoutes from "./routes/jobRoleRoutes.js";
import jobsRoutes from "./routes/jobsRoutes.js";
import talentRoutes from "./routes/talentRoutes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { aiLimiter, apiLimiter } from "./middleware/rateLimitMiddleware.js";
import { logError, logInfo } from "./utils/logger.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
const allowedOrigins = (env.frontendUrl || "http://localhost:5173")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));
app.use("/api", apiLimiter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "hr-recruitment-crm" });
});

app.use("/api/auth", authRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/linkedin", linkedinRoutes);
app.use("/api/ai", aiLimiter, aiRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/job-roles", jobRoleRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/talent", talentRoutes);

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  try {
    await prisma.$connect();
    app.listen(env.port, () => {
      logInfo("Backend server started", { port: env.port, env: env.nodeEnv });
    });
  } catch (error) {
    logError("Failed to start server", { error: error.message });
    process.exit(1);
  }
};

start();
