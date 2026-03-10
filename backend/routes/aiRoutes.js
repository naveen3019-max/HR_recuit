import { Router } from "express";
import { generateCandidateSummaryHandler, generateSummaryById } from "../controllers/aiController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { aiSummarySchema } from "../validators/aiValidator.js";

const router = Router();

router.post("/candidate-summary", protect, authorize("admin", "recruiter"), validate(aiSummarySchema), generateCandidateSummaryHandler);
router.post("/summary/:id", protect, authorize("admin", "recruiter"), generateSummaryById);

export default router;
