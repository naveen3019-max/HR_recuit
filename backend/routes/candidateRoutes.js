import { Router } from "express";
import {
  createCandidateHandler,
  deleteCandidateHandler,
  getCandidateByIdHandler,
  listCandidatesHandler,
  updateCandidateHandler,
  updateCandidateStageHandler
} from "../controllers/candidateController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  candidateParamsSchema,
  createCandidateSchema,
  listCandidatesSchema,
  stageUpdateSchema,
  updateCandidateSchema
} from "../validators/candidateValidator.js";

const router = Router();

router.use(protect);

router.post("/", authorize("admin", "recruiter"), validate(createCandidateSchema), createCandidateHandler);
router.get("/", authorize("admin", "recruiter"), validate(listCandidatesSchema), listCandidatesHandler);
router.get("/:id", authorize("admin", "recruiter"), validate(candidateParamsSchema), getCandidateByIdHandler);
router.put("/:id", authorize("admin", "recruiter"), validate(candidateParamsSchema), validate(updateCandidateSchema), updateCandidateHandler);
router.delete("/:id", authorize("admin"), validate(candidateParamsSchema), deleteCandidateHandler);
router.put("/:id/stage", authorize("admin", "recruiter"), validate(stageUpdateSchema), updateCandidateStageHandler);

export default router;
