import { Router } from "express";
import {
  createEmployeeHandler,
  listEmployeesHandler,
  getEmployeeByIdHandler,
  analyzeRiskHandler,
  analyzeJobSearchHandler
} from "../controllers/employeeController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { employeeAnalysisLimiter } from "../middleware/rateLimitMiddleware.js";
import {
  createEmployeeSchema,
  employeeParamsSchema
} from "../validators/employeeValidator.js";

const router = Router();

router.use(protect, authorize("admin", "recruiter"));

router.post("/", validate(createEmployeeSchema), createEmployeeHandler);
router.get("/", listEmployeesHandler);
router.get("/:id", validate(employeeParamsSchema), getEmployeeByIdHandler);
router.post("/analyze-risk/:id", employeeAnalysisLimiter, validate(employeeParamsSchema), analyzeRiskHandler);
router.post("/analyze-job-risk/:id", employeeAnalysisLimiter, validate(employeeParamsSchema), analyzeJobSearchHandler);

export default router;
