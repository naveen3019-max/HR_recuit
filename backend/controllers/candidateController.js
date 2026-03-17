import {
  createCandidate,
  deleteCandidate,
  getCandidateById,
  listCandidates,
  updateCandidate,
  updateCandidateStage
} from "../services/candidateService.js";

export const createCandidateHandler = async (req, res, next) => {
  try {
    const candidate = await createCandidate(req.validated.body, req.user.id);
    return res.status(201).json(candidate);
  } catch (error) {
    return next(error);
  }
};

export const listCandidatesHandler = async (req, res, next) => {
  try {
    const candidates = await listCandidates(req.validated.query);
    return res.json(candidates);
  } catch (error) {
    return next(error);
  }
};

export const getCandidateByIdHandler = async (req, res, next) => {
  try {
    const candidate = await getCandidateById(req.validated.params.id);
    return res.json(candidate);
  } catch (error) {
    return next(error);
  }
};

export const updateCandidateHandler = async (req, res, next) => {
  try {
    const candidate = await updateCandidate(req.validated.params.id, req.validated.body, req.user.id);
    return res.json(candidate);
  } catch (error) {
    return next(error);
  }
};

export const deleteCandidateHandler = async (req, res, next) => {
  try {
    await deleteCandidate(req.validated.params.id, req.user.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

export const updateCandidateStageHandler = async (req, res, next) => {
  try {
    const candidate = await updateCandidateStage(
      req.validated.params.id,
      req.validated.body.recruitment_stage,
      req.user.id
    );
    return res.json(candidate);
  } catch (error) {
    return next(error);
  }
};

export const addLinkedinCandidateHandler = async (req, res, next) => {
  try {
    const payload = req.validated.body;
    const candidate = await createCandidate(
      {
        name: payload.name,
        email: "",
        phone: "",
        linkedin_url: "",
        github_url: "",
        current_company: "",
        current_role: payload.headline || "",
        experience_years: payload.experience,
        skills: payload.skills || [],
        education: "",
        location: payload.location || "",
        open_to_work: true,
        notes: payload.score ? `Imported from LinkedIn analysis with score ${payload.score}` : "Imported from LinkedIn analysis",
        recruitment_stage: "Applied"
      },
      req.user.id
    );

    return res.status(201).json(candidate);
  } catch (error) {
    return next(error);
  }
};
