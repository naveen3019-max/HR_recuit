import { Router } from "express";
import {
  analyzeLinkedinProfileHandler,
  completeLinkedinSearchHandler,
  getLinkedinSearchStatusHandler,
  getRecentLinkedinAnalysisHandler,
	leaseLinkedinSearchHandler,
	getLinkedinAuthUrl,
	importCandidatesFromLinkedin,
	startLinkedinSearchHandler,
	syncCandidateFromLinkedin
} from "../controllers/linkedinController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { linkedinAnalysisLimiter, talentSearchLimiter } from "../middleware/rateLimitMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  linkedinAnalyzeProfileSchema,
	linkedinSearchCompleteSchema,
	linkedinStartSearchSchema,
	linkedinImportProfileSchema,
	linkedinSyncCandidateSchema
} from "../validators/linkedinValidator.js";

const router = Router();

router.post(
	"/start-search",
	protect,
	authorize("admin", "recruiter"),
	talentSearchLimiter,
	validate(linkedinStartSearchSchema),
	startLinkedinSearchHandler
);

router.get("/pending-search", linkedinAnalysisLimiter, leaseLinkedinSearchHandler);

router.post(
	"/search-complete",
	linkedinAnalysisLimiter,
	validate(linkedinSearchCompleteSchema),
	completeLinkedinSearchHandler
);

router.get("/search-status/:requestId", protect, authorize("admin", "recruiter"), getLinkedinSearchStatusHandler);

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
