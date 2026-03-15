import { Router } from "express";
import {
  createEmployeeHandler,
  listEmployeesHandler,
  getEmployeeByIdHandler,
  analyzeRiskHandler,
  analyzeJobSearchHandler,
  analyzeAttritionRiskHandler,
  listAttritionRisksHandler,
  listRetentionActionsHandler,
  createRetentionActionHandler
} from "../controllers/employeeController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { employeeAnalysisLimiter } from "../middleware/rateLimitMiddleware.js";
import {
  createEmployeeSchema,
  employeeParamsSchema,
  retentionActionSchema
} from "../validators/employeeValidator.js";

const router = Router();

router.use(protect, authorize("admin", "recruiter"));

router.post("/", validate(createEmployeeSchema), createEmployeeHandler);
router.get("/", listEmployeesHandler);
router.get("/attrition-risks", listAttritionRisksHandler);
router.post("/analyze-attrition/:id", employeeAnalysisLimiter, validate(employeeParamsSchema), analyzeAttritionRiskHandler);
router.get("/:id/retention-actions", validate(employeeParamsSchema), listRetentionActionsHandler);
router.post("/:id/retention-actions", validate(retentionActionSchema), createRetentionActionHandler);
router.get("/:id", validate(employeeParamsSchema), getEmployeeByIdHandler);
router.post("/analyze-risk/:id", employeeAnalysisLimiter, validate(employeeParamsSchema), analyzeRiskHandler);
router.post("/analyze-job-risk/:id", employeeAnalysisLimiter, validate(employeeParamsSchema), analyzeJobSearchHandler);

export default router;
