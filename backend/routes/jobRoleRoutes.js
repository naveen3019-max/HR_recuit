import { Router } from "express";
import {
  createJobRoleHandler,
  listJobRolesHandler,
  getJobRoleByIdHandler,
  getRecommendationsHandler
} from "../controllers/jobRoleController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  createJobRoleSchema,
  jobRoleParamsSchema
} from "../validators/jobRoleValidator.js";

const router = Router();

router.use(protect, authorize("admin", "recruiter"));

router.post("/", validate(createJobRoleSchema), createJobRoleHandler);
router.get("/", listJobRolesHandler);
router.get("/:id", validate(jobRoleParamsSchema), getJobRoleByIdHandler);
router.post("/:id/recommendations", validate(jobRoleParamsSchema), getRecommendationsHandler);

export default router;
