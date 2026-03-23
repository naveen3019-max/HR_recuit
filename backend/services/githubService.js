import env from "../config/env.js";
import { logError, logInfo } from "../utils/logger.js";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 25;
let githubWindowStart = Date.now();
let githubWindowCount = 0;

const normalizeSkill = (value) => String(value || "").trim().toLowerCase();

const extractRepoSkills = (repos = []) => {
  const skills = new Set();

  for (const repo of repos) {
    if (repo?.language) {
      skills.add(normalizeSkill(repo.language));
    }

    const topics = Array.isArray(repo?.topics) ? repo.topics : [];
    for (const topic of topics) {
      skills.add(normalizeSkill(topic));
    }
  }

  return Array.from(skills).filter(Boolean).slice(0, 12);
};

const estimateExperienceYears = (profile, repos) => {
  const createdAt = profile?.created_at ? new Date(profile.created_at) : null;
  const accountYears = createdAt ? Math.max(1, Math.round((Date.now() - createdAt.getTime()) / (365 * 24 * 60 * 60 * 1000))) : 1;
  const repoCount = Array.isArray(repos) ? repos.length : 0;

  if (repoCount >= 30) return Math.max(6, accountYears);
  if (repoCount >= 15) return Math.max(4, Math.min(8, accountYears));
  if (repoCount >= 8) return Math.max(3, Math.min(6, accountYears));
  return Math.max(2, Math.min(5, accountYears));
};

const buildCandidateFromGithub = (user, profile, repos, seedSkill) => {
  const extractedSkills = extractRepoSkills(repos);
  if (seedSkill) {
    extractedSkills.unshift(normalizeSkill(seedSkill));
  }

  const uniqueSkills = Array.from(new Set(extractedSkills)).filter(Boolean);
  const headline = profile?.bio?.trim() || "Software Developer (GitHub)";

  return {
    name: profile?.name || user.login,
    headline,
    location: profile?.location || "Global",
    skills: uniqueSkills.length ? uniqueSkills : [normalizeSkill(seedSkill)],
    experience: estimateExperienceYears(profile, repos),
    source: "GitHub",
    profileUrl: user.html_url
  };
};

const isGithubRateLimited = () => {
  const now = Date.now();
  if (now - githubWindowStart > RATE_LIMIT_WINDOW_MS) {
    githubWindowStart = now;
    githubWindowCount = 0;
  }

  githubWindowCount += 1;
  return githubWindowCount > MAX_REQUESTS_PER_WINDOW;
};

export const fetchGithubCandidates = async (skill, location = "") => {
  const normalizedSkill = normalizeSkill(skill);
  if (!normalizedSkill) {
    return [];
  }

  const normalizedLocation = String(location || "").trim();

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
    // Incorporate location if present
    const locationQuery = normalizedLocation ? ` location:"${normalizedLocation}"` : "";

    // 1st Pass: Specifically target developers looking for jobs using common bio tags
    const jobSeekingQuery = encodeURIComponent(`"${normalizedSkill}" followers:>1 "open to work" in:bio type:user`) + (normalizedLocation ? `+location:${encodeURIComponent('"' + normalizedLocation + '"')}` : "");
    
    let response = await fetch(`https://api.github.com/search/users?q=${jobSeekingQuery}&per_page=8`, {
      headers
    });
    
    let body = response.ok ? await response.json() : null;
    let users = Array.isArray(body?.items) ? body.items : [];

    // Fallback if no specific "open to work" candidates found in that location
    if (users.length === 0) {
      logInfo("No explicit job seekers found, falling back to broader search", { skill: normalizedSkill, location: normalizedLocation });
      const baseQuery = encodeURIComponent(`"${normalizedSkill}" followers:>1 in:bio type:user`) + (normalizedLocation ? `+location:${encodeURIComponent('"' + normalizedLocation + '"')}` : "");
      response = await fetch(`https://api.github.com/search/users?q=${baseQuery}&per_page=8`, { headers });
      
      if (!response.ok) {
        logError("GitHub search API failed", {
          status: response.status,
          skill: normalizedSkill
        });
        return [];
      }

      body = await response.json();
      users = Array.isArray(body?.items) ? body.items : [];
    }



    const enriched = await Promise.all(
      users.slice(0, 8).map(async (user) => {
        try {
          const [profileResponse, reposResponse] = await Promise.all([
            fetch(`https://api.github.com/users/${encodeURIComponent(user.login)}`, { headers }),
            fetch(`https://api.github.com/users/${encodeURIComponent(user.login)}/repos?per_page=20&sort=updated`, {
              headers
            })
          ]);

          const profile = profileResponse.ok ? await profileResponse.json() : null;
          const repos = reposResponse.ok ? await reposResponse.json() : [];
          return buildCandidateFromGithub(user, profile, Array.isArray(repos) ? repos : [], normalizedSkill);
        } catch {
          return {
            name: user.login,
            headline: "Software Developer (GitHub)",
            location: "Global",
            skills: [normalizedSkill],
            experience: 2,
            source: "GitHub",
            profileUrl: user.html_url
          };
        }
      })
    );

    return enriched;
  } catch (error) {
    logError("GitHub source failed", {
      error: error.message,
      skill: normalizedSkill
    });
    return [];
  }
};
