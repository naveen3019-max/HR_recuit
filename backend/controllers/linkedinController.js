import {
  addRecentLinkedinAnalysis,
  getRecentLinkedinAnalysis,
  getLinkedinOAuthUrl,
  importLinkedinCandidates,
  syncLinkedinCandidate
} from "../services/linkedinService.js";
import env from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

const normalizeLinkedinAnalyzePayload = (payload) => {
  const candidate = payload.candidate || payload;
  const analysis = payload.analysis || payload;

  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const experience = Number(candidate.experience || 0);

  // Fallback heuristic when extension sends raw candidate only.
  const fallbackScore = Math.max(0, Math.min(100, Math.round(Math.min(skills.length * 12, 70) + Math.min(experience * 6, 30))));
  const fallbackRecommendation = fallbackScore >= 75 ? "Strong Fit" : fallbackScore >= 50 ? "Moderate" : "Low";

  return {
    name: candidate.name,
    headline: candidate.headline || "",
    location: candidate.location || "",
    skills,
    experience,
    score: Number.isFinite(Number(analysis.score)) ? Number(analysis.score) : fallbackScore,
    recommendation: analysis.recommendation || fallbackRecommendation,
    reason:
      analysis.reason ||
      `Auto-generated from visible profile data: ${skills.length} visible skills and ${experience} years experience.`
  };
};

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

    const normalized = normalizeLinkedinAnalyzePayload(req.validated.body);
    const saved = addRecentLinkedinAnalysis(normalized);
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
