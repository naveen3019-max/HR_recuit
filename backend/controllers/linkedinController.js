import {
  addRecentLinkedinAnalysis,
  getRecentLinkedinAnalysis,
  getLinkedinOAuthUrl,
  importLinkedinCandidates,
  syncLinkedinCandidate
} from "../services/linkedinService.js";
import env from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

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

export const analyzeLinkedinProfileHandler = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!env.linkedinExtensionApiKey || apiKey !== env.linkedinExtensionApiKey) {
      throw new ApiError(401, "Unauthorized extension request");
    }

    const saved = addRecentLinkedinAnalysis(req.validated.body);
    return res.status(201).json({ saved: true, candidate: saved });
  } catch (error) {
    return next(error);
  }
};

export const getRecentLinkedinAnalysisHandler = async (req, res, next) => {
  try {
    const candidates = getRecentLinkedinAnalysis();
    return res.json({ candidates });
  } catch (error) {
    return next(error);
  }
};
