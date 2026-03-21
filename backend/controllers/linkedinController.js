import {
  addRecentLinkedinAnalysis,
  completeLinkedinSearch,
  getLinkedinExtensionHealth,
  getLinkedinSearchStatus,
  getRecentLinkedinAnalysis,
  getLinkedinOAuthUrl,
  importLinkedinCandidates,
  leasePendingLinkedinSearch,
  queueLinkedinSearch,
  recordLinkedinExtensionHeartbeat,
  syncLinkedinCandidate
} from "../services/linkedinService.js";
import env from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { logInfo } from "../utils/logger.js";
import { scoreLinkedinCandidateForJob } from "../services/candidateMatchingService.js";

const normalizeLinkedinAnalyzePayload = async (payload) => {
  const candidate = payload.candidate || payload;
  const analysis = payload.analysis || payload;
  const jobContext = payload.job_context || null;

  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const experience = Number(candidate.experience || 0);

  // Fallback heuristic when extension sends raw candidate only.
  const fallbackScore = Math.max(0, Math.min(100, Math.round(Math.min(skills.length * 12, 70) + Math.min(experience * 6, 30))));
  const fallbackRecommendation = fallbackScore >= 75 ? "Strong Fit" : fallbackScore >= 50 ? "Moderate" : "Low";
  const baseCandidate = {
    name: candidate.name,
    headline: candidate.headline || "",
    location: candidate.location || "",
    skills,
    experience,
    profile_url: candidate.profile_url || candidate.linkedin_url || ""
  };

  let derivedScore = {
    score: Number.isFinite(Number(analysis.score)) ? Number(analysis.score) : fallbackScore,
    recommendation: analysis.recommendation || fallbackRecommendation,
    reason:
      analysis.reason ||
      `Auto-generated from visible profile data: ${skills.length} visible skills and ${experience} years experience.`
  };

  if (jobContext) {
    const aiScore = await scoreLinkedinCandidateForJob(jobContext, baseCandidate);
    derivedScore = {
      score: aiScore.score,
      recommendation: aiScore.recommendation,
      reason: aiScore.reason
    };
  }

  return {
    ...baseCandidate,
    score: derivedScore.score,
    recommendation: derivedScore.recommendation,
    reason: derivedScore.reason,
    requested_role: jobContext?.role || null
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
    if (env.linkedinExtensionApiKey && apiKey !== env.linkedinExtensionApiKey) {
      throw new ApiError(401, "Unauthorized extension request");
    }

    if (!env.linkedinExtensionApiKey && env.nodeEnv !== "production") {
      logInfo("LinkedIn analyze request accepted without API key in non-production", {
        ip: req.ip
      });
    }

    const normalized = await normalizeLinkedinAnalyzePayload(req.validated.body);
    logInfo("LinkedIn analyze profile received", {
      name: normalized.name,
      score: normalized.score,
      skills: normalized.skills?.length || 0
    });
    const saved = addRecentLinkedinAnalysis(normalized);
    logInfo("LinkedIn analyze profile stored", {
      totalStored: getRecentLinkedinAnalysis().length
    });
    return res.status(201).json({ saved: true, candidate: saved });
  } catch (error) {
    return next(error);
  }
};

const verifyExtensionApiKey = (req) => {
  const apiKey = req.headers["x-api-key"];
  if (env.linkedinExtensionApiKey && apiKey !== env.linkedinExtensionApiKey) {
    throw new ApiError(401, "Unauthorized extension request");
  }
};

export const startLinkedinSearchHandler = async (req, res, next) => {
  try {
    const { role, skills, location } = req.validated.body;
    const entry = queueLinkedinSearch({ role, skills, location }, req.user.id);
    const extensionHealth = getLinkedinExtensionHealth();
    return res.status(202).json({
      queued: true,
      request_id: entry.request_id,
      status: entry.status,
      extension_online: extensionHealth.online,
      extension_last_seen_at: extensionHealth.last_seen_at,
      message: extensionHealth.online
        ? "Searching LinkedIn for candidates..."
        : "Search queued. Waiting for LinkedIn extension to connect..."
    });
  } catch (error) {
    return next(error);
  }
};

export const leaseLinkedinSearchHandler = async (req, res, next) => {
  try {
    verifyExtensionApiKey(req);
    recordLinkedinExtensionHeartbeat();
    const nextSearch = leasePendingLinkedinSearch();
    if (!nextSearch) {
      return res.json({ available: false });
    }

    return res.json({
      available: true,
      search: nextSearch
    });
  } catch (error) {
    return next(error);
  }
};

export const completeLinkedinSearchHandler = async (req, res, next) => {
  try {
    verifyExtensionApiKey(req);
    const completed = completeLinkedinSearch({
      requestId: req.validated.body.request_id,
      processedCount: req.validated.body.processed_count,
      error: req.validated.body.error
    });
    return res.json({ completed: true, search: completed });
  } catch (error) {
    return next(error);
  }
};

export const getLinkedinSearchStatusHandler = async (req, res, next) => {
  try {
    const status = getLinkedinSearchStatus(req.params.requestId);
    if (!status) {
      throw new ApiError(404, "Search request not found");
    }
    return res.json({ search: status });
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
