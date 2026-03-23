import prisma from "../config/db.js";
import { logError, logInfo } from "../utils/logger.js";
import { scoreGlobalTalentCandidate } from "./candidateMatchingService.js";
import { fetchGithubCandidates } from "./githubService.js";

const normalizeSkill = (value) => String(value || "").trim().toLowerCase();

const normalizeCandidate = (candidate) => ({
  name: candidate.name || "Unknown Candidate",
  headline: candidate.headline || candidate.currentRole || "Talent Profile",
  skills: (candidate.skills || []).map((item) => normalizeSkill(item)).filter(Boolean),
  experience: Number(candidate.experience || candidate.experienceYears || 0),
  location: candidate.location || "",
  source: candidate.source || "Internal",
  profileUrl: candidate.profileUrl || null
});

const buildSummary = (jobInput, candidate, score) => {
  const required = (jobInput.skills || []).map(normalizeSkill).filter(Boolean);
  const matched = required.filter((skill) => new Set(candidate.skills).has(skill)).length;
  const roleBit = String(candidate.headline || "").toLowerCase().includes(String(jobInput.role || "").toLowerCase())
    ? "role aligned"
    : "adjacent role fit";

  return `Strong match due to ${matched}/${required.length || 0} required skills, ${candidate.experience} years experience, and ${roleBit}.`;
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
      source: "Internal",
      profileUrl: null
    })
  );
};

const getGithubCandidatesForJob = async (jobInput) => {
  const firstSkill = (jobInput.skills || []).find((skill) => normalizeSkill(skill));
  if (!firstSkill) return [];

  const githubCandidates = await fetchGithubCandidates(firstSkill);
  return githubCandidates.map((candidate) => normalizeCandidate(candidate));
};

const getKaggleCandidates = async () => [];

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
    getGithubCandidatesForJob(jobInput),
    getKaggleCandidates(jobInput)
  ]);

  const internalCandidates = internalResult.status === "fulfilled" ? internalResult.value : [];
  const githubCandidates = githubResult.status === "fulfilled" ? githubResult.value : [];
  const kaggleCandidates = kaggleResult.status === "fulfilled" ? kaggleResult.value : [];

  const combined = dedupeCandidates([...internalCandidates, ...githubCandidates, ...kaggleCandidates]);

  const scored = combined
    .map((candidate) => {
      const score = scoreGlobalTalentCandidate(jobInput, candidate);
      return {
        name: candidate.name,
        headline: candidate.headline,
        location: candidate.location || jobInput.location || "Global",
        score,
        summary: buildSummary(jobInput, candidate, score),
        source: candidate.source,
        profileUrl: candidate.profileUrl || null
      };
    })
    .sort((a, b) => b.score - a.score);

  const ranked = scored.slice(0, 10).map((candidate) => ({
    name: candidate.name,
    headline: candidate.headline,
    location: candidate.location,
    score: candidate.score,
    summary: candidate.summary,
    source: candidate.source,
    profileUrl: candidate.profileUrl
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
