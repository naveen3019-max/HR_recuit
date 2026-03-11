import { Router } from "express";
import { matchCandidatesHandler } from "../controllers/jobsController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { candidateMatchingLimiter } from "../middleware/rateLimitMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { matchCandidatesSchema } from "../validators/jobsValidator.js";

const router = Router();

router.use(protect, authorize("admin", "recruiter"));

router.post("/match-candidates", candidateMatchingLimiter, validate(matchCandidatesSchema), matchCandidatesHandler);

export default router;