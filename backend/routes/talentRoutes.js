import { Router } from "express";
import {
  globalTalentSearchHandler,
  talentSearchHandler,
  updateTalentMatchHandler
} from "../controllers/talentController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { talentSearchLimiter } from "../middleware/rateLimitMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  globalTalentSearchSchema,
  talentMatchParamsSchema,
  talentSearchSchema,
  updateTalentMatchSchema
} from "../validators/talentValidator.js";

const router = Router();

router.use(protect, authorize("admin", "recruiter"));

router.post("/search", talentSearchLimiter, validate(talentSearchSchema), talentSearchHandler);
router.post("/global-search", talentSearchLimiter, validate(globalTalentSearchSchema), globalTalentSearchHandler);
router.patch(
  "/matches/:id",
  validate(talentMatchParamsSchema),
  validate(updateTalentMatchSchema),
  updateTalentMatchHandler
);

export default router;
