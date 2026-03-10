import { Router } from "express";
import {
	getLinkedinAuthUrl,
	importCandidatesFromLinkedin,
	syncCandidateFromLinkedin
} from "../controllers/linkedinController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
	linkedinImportProfileSchema,
	linkedinSyncCandidateSchema
} from "../validators/linkedinValidator.js";

const router = Router();

router.get("/oauth-url", protect, authorize("admin", "recruiter"), getLinkedinAuthUrl);
router.post("/import-profile", protect, authorize("admin", "recruiter"), validate(linkedinImportProfileSchema), importCandidatesFromLinkedin);
router.post("/sync-candidate", protect, authorize("admin", "recruiter"), validate(linkedinSyncCandidateSchema), syncCandidateFromLinkedin);

export default router;
