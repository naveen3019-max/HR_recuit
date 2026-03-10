import { Router } from "express";
import {
  createEmployeeHandler,
  listEmployeesHandler,
  getEmployeeByIdHandler,
  analyzeRiskHandler
} from "../controllers/employeeController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  createEmployeeSchema,
  employeeParamsSchema
} from "../validators/employeeValidator.js";

const router = Router();

router.use(protect, authorize("admin", "recruiter"));

router.post("/", validate(createEmployeeSchema), createEmployeeHandler);
router.get("/", listEmployeesHandler);
router.get("/:id", validate(employeeParamsSchema), getEmployeeByIdHandler);
router.post("/analyze-risk/:id", validate(employeeParamsSchema), analyzeRiskHandler);

export default router;
