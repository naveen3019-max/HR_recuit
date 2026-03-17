import { Router } from "express";
import {
  analyzeLinkedinProfileHandler,
  getRecentLinkedinAnalysisHandler,
	getLinkedinAuthUrl,
	importCandidatesFromLinkedin,
	syncCandidateFromLinkedin
} from "../controllers/linkedinController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { linkedinAnalysisLimiter } from "../middleware/rateLimitMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  linkedinAnalyzeProfileSchema,
	linkedinImportProfileSchema,
	linkedinSyncCandidateSchema
} from "../validators/linkedinValidator.js";

const router = Router();

router.post(
	"/analyze-profile",
	linkedinAnalysisLimiter,
	validate(linkedinAnalyzeProfileSchema),
	analyzeLinkedinProfileHandler
);

router.get("/oauth-url", protect, authorize("admin", "recruiter"), getLinkedinAuthUrl);
router.get("/recent-analysis", protect, authorize("admin", "recruiter"), getRecentLinkedinAnalysisHandler);
router.post("/import-profile", protect, authorize("admin", "recruiter"), validate(linkedinImportProfileSchema), importCandidatesFromLinkedin);
router.post("/sync-candidate", protect, authorize("admin", "recruiter"), validate(linkedinSyncCandidateSchema), syncCandidateFromLinkedin);

export default router;
