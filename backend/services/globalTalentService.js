import prisma from "../config/db.js";
import env from "../config/env.js";
import { logError, logInfo } from "../utils/logger.js";
import { scoreGlobalCandidateProfile } from "./candidateMatchingService.js";

const normalizeSkill = (value) => String(value || "").trim().toLowerCase();

const normalizeCandidate = (candidate) => ({
  name: candidate.name || "Unknown Candidate",
  headline: candidate.headline || candidate.currentRole || "Talent Profile",
  skills: (candidate.skills || []).map((item) => normalizeSkill(item)).filter(Boolean),
  experience: Number(candidate.experience || candidate.experienceYears || 0),
  location: candidate.location || "",
  source: candidate.source || "Internal"
});

const isLocationMatch = (requestedLocation, candidateLocation) => {
  const wanted = normalizeSkill(requestedLocation);
  const actual = normalizeSkill(candidateLocation);
  if (!wanted) return true;
  if (!actual) return false;
  return actual.includes(wanted) || wanted.includes(actual);
};

const buildSummary = (jobInput, candidate, score) => {
  const required = (jobInput.skills || []).map(normalizeSkill).filter(Boolean);
  const matched = required.filter((skill) => new Set(candidate.skills).has(skill)).length;
  const locationBit = jobInput.location
    ? candidate.location.toLowerCase().includes(String(jobInput.location).toLowerCase())
      ? "location aligned"
      : "remote/global location"
    : "global availability";

  return `Strong match due to ${matched}/${required.length || 0} core skills, ${candidate.experience} years experience, and ${locationBit}.`;
};

const getInternalCandidates = async (jobInput) => {
  const where = {
    ...(jobInput.skills?.length
      ? {
          skills: {
            hasSome: jobInput.skills
          }
        }
      : {}),
    ...(jobInput.location
      ? {
          OR: [
            {
              location: {
                contains: jobInput.location,
                mode: "insensitive"
              }
            },
            {
              location: null
            }
          ]
        }
      : {})
  };

  const records = await prisma.candidate.findMany({
    where,
    select: {
      name: true,
      currentRole: true,
      skills: true,
      experienceYears: true,
      location: true
    },
    orderBy: { createdAt: "desc" },
    take: 40
  });

  return records.map((candidate) =>
    normalizeCandidate({
      name: candidate.name,
      headline: candidate.currentRole,
      skills: candidate.skills || [],
      experience: candidate.experienceYears,
      location: candidate.location,
      source: "Internal"
    })
  );
};

const extractRepoSkills = (repos) => {
  const skills = new Set();
  for (const repo of repos || []) {
    if (repo?.language) {
      skills.add(normalizeSkill(repo.language));
    }
    for (const topic of repo?.topics || []) {
      skills.add(normalizeSkill(topic));
    }
  }
  return Array.from(skills).filter(Boolean).slice(0, 10);
};

const getGithubCandidates = async (jobInput) => {
  const queryParts = [jobInput.role, ...(jobInput.skills || []).slice(0, 3)].filter(Boolean);
  const query = encodeURIComponent(queryParts.join(" ") || "developer");
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "hr-recruit-global-search"
  };

  if (env.githubToken) {
    headers.Authorization = `Bearer ${env.githubToken}`;
  }

  try {
    // Add a timestamp salt to avoid stale proxy caches and improve freshness.
    const cacheSalt = Math.floor(Date.now() / (60 * 1000));
    const userSearchResponse = await fetch(`https://api.github.com/search/users?q=${query}+in:bio&per_page=8&page=1&sort=followers&order=desc&_=${cacheSalt}`, {
      headers
    });

    if (!userSearchResponse.ok) {
      logError("GitHub user search failed", { status: userSearchResponse.status });
      return [];
    }

    const userSearchBody = await userSearchResponse.json();
    const users = Array.isArray(userSearchBody.items) ? userSearchBody.items : [];

    const profiles = await Promise.all(
      users.slice(0, 8).map(async (user) => {
        try {
          const [profileResponse, reposResponse] = await Promise.all([
            fetch(`https://api.github.com/users/${encodeURIComponent(user.login)}`, { headers }),
            fetch(`https://api.github.com/users/${encodeURIComponent(user.login)}/repos?per_page=12&sort=updated`, {
              headers
            })
          ]);

          if (!profileResponse.ok) return null;
          const profile = await profileResponse.json();
          const repos = reposResponse.ok ? await reposResponse.json() : [];

          return normalizeCandidate({
            name: profile.name || user.login,
            headline: profile.bio || "Open-source developer",
            skills: extractRepoSkills(repos),
            experience: profile.public_repos >= 30 ? 8 : profile.public_repos >= 15 ? 5 : 3,
            location: profile.location || "Global",
            source: "GitHub"
          });
        } catch {
          return null;
        }
      })
    );

    return profiles.filter(Boolean);
  } catch (error) {
    logError("GitHub candidate aggregation failed", { error: error.message });
    return [];
  }
};

const getKaggleCandidates = async () => {
  // Real-time mode: only return live data sources. Kaggle public profile API is optional and disabled by default.
  return [];
};

// Removed buildFallbackGlobalCandidates function as it is no longer needed.

const dedupeCandidates = (candidates) => {
  const seen = new Set();
  const output = [];

  for (const candidate of candidates) {
    const key = `${candidate.name.toLowerCase()}::${candidate.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }

  return output;
};

export const runGlobalTalentSearch = async (jobInput, recruiterId) => {
  const [internalResult, githubResult, kaggleResult] = await Promise.allSettled([
    getInternalCandidates(jobInput),
    getGithubCandidates(jobInput),
    getKaggleCandidates(jobInput)
  ]);

  const internalCandidates = internalResult.status === "fulfilled" ? internalResult.value : [];
  const githubCandidates = githubResult.status === "fulfilled" ? githubResult.value : [];
  const kaggleCandidates = kaggleResult.status === "fulfilled" ? kaggleResult.value : [];

  const combined = dedupeCandidates([...internalCandidates, ...githubCandidates, ...kaggleCandidates]);

  const scored = combined
    .map((candidate) => {
      const score = scoreGlobalCandidateProfile(jobInput, candidate);
      return {
        name: candidate.name,
        headline: candidate.headline,
        location: candidate.location || jobInput.location || "Global",
        score,
        summary: buildSummary(jobInput, candidate, score),
        source: candidate.source,
        location_match: isLocationMatch(jobInput.location, candidate.location)
      };
    })
    .sort((a, b) => b.score - a.score);

  const rankedByLocation = jobInput.location
    ? [...scored].sort((a, b) => Number(b.location_match) - Number(a.location_match) || b.score - a.score)
    : scored;

  const ranked = rankedByLocation.slice(0, 10).map((candidate) => ({
    name: candidate.name,
    headline: candidate.headline,
    location: candidate.location,
    score: candidate.score,
    summary: candidate.summary,
    source: candidate.source
  }));

  logInfo("Global talent discovery completed", {
    recruiterId,
    role: jobInput.role,
    liveCount: combined.length,
    totalCollected: combined.length,
    returned: ranked.length
  });

  return {
    role: jobInput.role,
    total_candidates: ranked.length,
    searched_at: new Date().toISOString(),
    realtime_only: true,
    diversity_sources: Array.from(new Set(ranked.map((item) => item.source))),
    results: ranked
  };
};
