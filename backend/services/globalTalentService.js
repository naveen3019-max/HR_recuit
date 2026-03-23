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

  // Fallback: if strict skill/location filter yields no rows, use recent open candidates.
  const finalRecords = records.length
    ? records
    : await prisma.candidate.findMany({
        where: {
          OR: [{ openToWork: true }, { linkedinUrl: { not: null } }]
        },
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

  return finalRecords.map((candidate) =>
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
  const searchTerms = [
    ...(jobInput.skills || []).slice(0, 3),
    jobInput.role
  ]
    .map((term) => normalizeSkill(term))
    .filter(Boolean);

  if (!searchTerms.length) return [];

  const allResults = await Promise.all(
    searchTerms.map(async (term) => {
      const candidates = await fetchGithubCandidates(term);
      return candidates.map((candidate) => normalizeCandidate(candidate));
    })
  );

  return dedupeCandidates(allResults.flat());
};

const getKaggleCandidates = async () => [];

const dedupeCandidates = (candidates) => {
  const merged = new Map();

  for (const candidate of candidates) {
    const key = `${candidate.name.toLowerCase()}::${candidate.source}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...candidate,
        skills: Array.isArray(candidate.skills) ? [...candidate.skills] : []
      });
      continue;
    }

    const mergedSkills = new Set([...(existing.skills || []), ...(candidate.skills || [])]);
    merged.set(key, {
      ...existing,
      headline:
        existing.headline && existing.headline !== "Talent Profile"
          ? existing.headline
          : candidate.headline || existing.headline,
      experience: Math.max(Number(existing.experience || 0), Number(candidate.experience || 0)),
      location: existing.location || candidate.location || "",
      profileUrl: existing.profileUrl || candidate.profileUrl || null,
      skills: Array.from(mergedSkills)
    });
  }

  return Array.from(merged.values());
};

const pickBalancedTopCandidates = (scoredCandidates, limit = 10) => {
  const external = scoredCandidates.filter((candidate) => candidate.source !== "Internal");
  const internal = scoredCandidates.filter((candidate) => candidate.source === "Internal");
  const minExternal = Math.min(4, external.length);

  const seeded = external.slice(0, minExternal);
  const usedKeys = new Set(seeded.map((candidate) => `${candidate.name}::${candidate.source}`));

  const remainder = [...external.slice(minExternal), ...internal].filter(
    (candidate) => !usedKeys.has(`${candidate.name}::${candidate.source}`)
  );

  return [...seeded, ...remainder].slice(0, limit);
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
    .filter((candidate) => candidate.score >= 25)
    .sort((a, b) => b.score - a.score);

  const ranked = pickBalancedTopCandidates(scored, 10).map((candidate) => ({
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
    message: ranked.length === 0
      ? "No real-time candidates found for the current filters. Try broader skills/role or add internal candidates."
      : "Global candidates fetched in real time.",
    diversity_sources: Array.from(new Set(ranked.map((item) => item.source))),
    results: ranked
  };
};
