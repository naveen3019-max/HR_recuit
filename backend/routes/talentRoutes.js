import { Router } from "express";
import {
  talentSearchHandler,
  updateTalentMatchHandler
} from "../controllers/talentController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { talentSearchLimiter } from "../middleware/rateLimitMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  talentMatchParamsSchema,
  talentSearchSchema,
  updateTalentMatchSchema
} from "../validators/talentValidator.js";

const router = Router();

router.use(protect, authorize("admin", "recruiter"));

router.post("/search", talentSearchLimiter, validate(talentSearchSchema), talentSearchHandler);
router.patch(
  "/matches/:id",
  validate(talentMatchParamsSchema),
  validate(updateTalentMatchSchema),
  updateTalentMatchHandler
);

export default router;
