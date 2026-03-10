import {
  getLinkedinOAuthUrl,
  importLinkedinCandidates,
  syncLinkedinCandidate
} from "../services/linkedinService.js";

export const getLinkedinAuthUrl = async (req, res, next) => {
  try {
    const authUrl = getLinkedinOAuthUrl();
    return res.json({ auth_url: authUrl });
  } catch (error) {
    return next(error);
  }
};

export const importCandidatesFromLinkedin = async (req, res, next) => {
  try {
    const imported = await importLinkedinCandidates(req.validated.body, req.user.id);
    return res.status(201).json({ imported_count: imported.length, candidates: imported });
  } catch (error) {
    return next(error);
  }
};

export const syncCandidateFromLinkedin = async (req, res, next) => {
  try {
    const syncedCandidate = await syncLinkedinCandidate(req.validated.body, req.user.id);
    return res.json({ synced: true, candidate: syncedCandidate });
  } catch (error) {
    return next(error);
  }
};
