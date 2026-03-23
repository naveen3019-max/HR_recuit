import env from "../config/env.js";
import { logError, logInfo } from "../utils/logger.js";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 25;
let githubWindowStart = Date.now();
let githubWindowCount = 0;

const normalizeSkill = (value) => String(value || "").trim().toLowerCase();

const isGithubRateLimited = () => {
  const now = Date.now();
  if (now - githubWindowStart > RATE_LIMIT_WINDOW_MS) {
    githubWindowStart = now;
    githubWindowCount = 0;
  }

  githubWindowCount += 1;
  return githubWindowCount > MAX_REQUESTS_PER_WINDOW;
};

export const fetchGithubCandidates = async (skill) => {
  const normalizedSkill = normalizeSkill(skill);
  if (!normalizedSkill) {
    return [];
  }

  if (isGithubRateLimited()) {
    logInfo("GitHub source temporarily rate-limited", {
      skill: normalizedSkill,
      windowRequests: githubWindowCount
    });
    return [];
  }

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "hr-recruit-global-search"
  };

  if (env.githubToken) {
    headers.Authorization = `Bearer ${env.githubToken}`;
  }

  try {
    const query = encodeURIComponent(`${normalizedSkill}+followers:>1`);
    const response = await fetch(`https://api.github.com/search/users?q=${query}&per_page=8`, {
      headers
    });

    if (!response.ok) {
      logError("GitHub search API failed", {
        status: response.status,
        skill: normalizedSkill
      });
      return [];
    }

    const body = await response.json();
    const users = Array.isArray(body.items) ? body.items : [];

    return users.map((user) => ({
      name: user.login,
      headline: "Software Developer (GitHub)",
      location: "Global",
      skills: [normalizedSkill],
      experience: 2,
      source: "GitHub",
      profileUrl: user.html_url
    }));
  } catch (error) {
    logError("GitHub source failed", {
      error: error.message,
      skill: normalizedSkill
    });
    return [];
  }
};
