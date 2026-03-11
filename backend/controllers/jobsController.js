import { matchCandidatesForJob } from "../services/candidateMatchingService.js";

export const matchCandidatesHandler = async (req, res, next) => {
  try {
    const results = await matchCandidatesForJob(req.validated.body);
    return res.json(results);
  } catch (error) {
    return next(error);
  }
};