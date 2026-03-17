import prisma from "../config/db.js";
import env from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { logError, logInfo } from "../utils/logger.js";
import { fetchLinkedinProfiles } from "./linkedinService.js";

const parseExperienceValue = (experienceText) => {
  if (!experienceText) return 0;
  const numbers = (experienceText.match(/\d+/g) || []).map(Number).filter((n) => !Number.isNaN(n));
  if (numbers.length === 0) return 0;
  return Math.max(...numbers);
};

const normalizeSkillList = (skills) =>
  (skills || []).map((skill) => skill.toLowerCase().trim()).filter(Boolean);

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const scoreRoleSimilarity = (role, candidateRole) => {
  const jobRole = normalizeText(role);
  const currentRole = normalizeText(candidateRole);
  if (!jobRole || !currentRole) return 0;
  if (currentRole.includes(jobRole) || jobRole.includes(currentRole)) return 20;

  const jobTokens = new Set(jobRole.split(/\s+/).filter(Boolean));
  const roleTokens = currentRole.split(/\s+/).filter(Boolean);
  const overlap = roleTokens.filter((token) => jobTokens.has(token)).length;
  return Math.min(20, overlap * 6);
};

const scoreExperienceFit = (expectedText, candidateExperience) => {
  const expectedYears = parseExperienceValue(expectedText);
  if (!expectedYears) return 15;

  const gap = Math.abs(Number(candidateExperience || 0) - expectedYears);
  if (gap <= 1) return 20;
  if (gap <= 2) return 15;
  if (gap <= 3) return 10;
  return 5;
};

const scoreLocationFit = (jobLocation, candidateLocation) => {
  const expected = normalizeText(jobLocation);
  const actual = normalizeText(candidateLocation);
  if (!expected || !actual) return 5;
  return actual.includes(expected) || expected.includes(actual) ? 10 : 0;
};

const computePreRankScore = (jobInput, candidate) => {
  const requiredSkills = normalizeSkillList(jobInput.skills);
  const candidateSkills = new Set(normalizeSkillList(candidate.skills));
  const skillMatches = requiredSkills.filter((skill) => candidateSkills.has(skill)).length;
  const skillScore = requiredSkills.length ? Math.round((skillMatches / requiredSkills.length) * 50) : 25;

  return Math.min(
    100,
    skillScore
      + scoreRoleSimilarity(jobInput.role, candidate.currentRole)
      + scoreExperienceFit(jobInput.experience_required, candidate.experienceYears)
      + scoreLocationFit(jobInput.location, candidate.location)
  );
};

const fallbackMatch = (jobInput, candidate) => {
  const requiredSkills = normalizeSkillList(jobInput.skills);
  const candidateSkills = new Set(normalizeSkillList(candidate.skills));
  const skillMatches = requiredSkills.filter((skill) => candidateSkills.has(skill)).length;
  const skillScore = requiredSkills.length ? Math.round((skillMatches / requiredSkills.length) * 70) : 35;

  const experienceScore = scoreExperienceFit(jobInput.experience_required, candidate.experienceYears);
  const locationScore = scoreLocationFit(jobInput.location, candidate.location);
  const roleScore = scoreRoleSimilarity(jobInput.role, candidate.currentRole);
  const matchScore = Math.max(0, Math.min(100, skillScore + experienceScore + locationScore + roleScore));

  return {
    match_score: matchScore,
    candidate_summary: `${candidate.name} matches ${skillMatches}/${requiredSkills.length || 0} requested skills and has ${candidate.experienceYears} years of experience for ${jobInput.role}.`,
    strengths: (candidate.skills || []).slice(0, 4),
    recommended_role: jobInput.role,
    role_fit: matchScore >= 85 ? "Excellent" : matchScore >= 70 ? "Good" : matchScore >= 55 ? "Moderate" : "Low"
  };
};

const buildTalentPrompt = (jobInput, candidate) => {
  return `You are an AI recruiting assistant. Evaluate candidate fit using only professional profile data.
Do NOT infer private behavior or surveillance patterns.

JOB DESCRIPTION:
- Role: ${jobInput.role}
- Experience Required: ${jobInput.experience_required || "Not specified"}
- Location: ${jobInput.location || "Not specified"}
- Skills: ${(jobInput.skills || []).join(", ") || "Not specified"}
- Industry: ${jobInput.industry || "Not specified"}
- Additional Requirements: ${jobInput.additional_requirements || "Not specified"}

CANDIDATE PROFILE:
- Name: ${candidate.name}
- Current Role: ${candidate.currentRole || "Not specified"}
- Experience (years): ${candidate.experienceYears}
- Skills: ${(candidate.skills || []).join(", ") || "Not specified"}
- Location: ${candidate.location || "Not specified"}
- LinkedIn URL: ${candidate.linkedinUrl || "Not provided"}
- Summary: ${candidate.summary || "Not provided"}

Analyze skill match, experience match, and role relevance.
Return ONLY valid JSON in this exact schema:
{
  "match_score": 0,
  "candidate_summary": "",
  "strengths": [],
  "recommended_role": "",
  "role_fit": ""
}

Rules:
- match_score must be an integer from 0 to 100
- candidate_summary must be <= 280 characters and recruiter-friendly
- strengths must contain 2-5 concise bullet-like strings
- recommended_role should be role-oriented and concise
- role_fit should be one of: Excellent, Good, Moderate, Low`;
};

const callGeminiForTalentMatch = async (jobInput, candidate) => {
  if (!env.llmApiUrl || !env.llmApiKey) {
    return fallbackMatch(jobInput, candidate);
  }

  const apiUrl = `${env.llmApiUrl.replace(/\/+$/, "")}/${env.llmModel}:generateContent?key=${env.llmApiKey}`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: "You are an expert AI talent sourcer. Return strictly valid JSON only."
            }
          ]
        },
        contents: [{ parts: [{ text: buildTalentPrompt(jobInput, candidate) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      logError("Talent match Gemini request failed", {
        status: response.status,
        candidateId: candidate.id
      });
      return fallbackMatch(jobInput, candidate);
    }

    const responseBody = await response.json();
    const content = responseBody?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) {
      return fallbackMatch(jobInput, candidate);
    }

    const parsed = JSON.parse(content);
    const safeScore = Math.max(0, Math.min(100, Math.round(Number(parsed.match_score) || 0)));

    return {
      match_score: safeScore,
      candidate_summary: String(parsed.candidate_summary || parsed.summary || "").slice(0, 280),
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.slice(0, 5).map((item) => String(item))
        : [],
      recommended_role: String(parsed.recommended_role || jobInput.role || ""),
      role_fit: ["Excellent", "Good", "Moderate", "Low"].includes(parsed.role_fit)
        ? parsed.role_fit
        : safeScore >= 85
          ? "Excellent"
          : safeScore >= 70
            ? "Good"
            : safeScore >= 55
              ? "Moderate"
              : "Low"
    };
  } catch (error) {
    logError("Talent match Gemini parsing failed", {
      error: error.message,
      candidateId: candidate.id
    });
    return fallbackMatch(jobInput, candidate);
  }
};

const mapTalentMatch = (record) => ({
  match_id: record.id,
  candidate_id: record.candidate.id,
  candidate_name: record.candidate.name,
  current_role: record.candidate.currentRole,
  experience_years: record.candidate.experienceYears,
  location: record.candidate.location,
  linkedin_url: record.candidate.linkedinUrl,
  candidate_summary: record.summary,
  match_score: record.matchScore,
  strengths: record.strengths,
  recommended_role: record.recommendedRole,
  role_fit: record.roleFit,
  shortlisted: record.shortlisted,
  saved: record.exported,
  notes: record.notes,
  skills: record.candidate.skills
});

const mapLinkedinProfileToCandidateData = (profile) => ({
  name: profile.fullName || `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "LinkedIn Candidate",
  email: profile.emailAddress || null,
  currentCompany: profile.currentCompany || null,
  currentRole: profile.currentRole || null,
  skills: Array.isArray(profile.skills) ? profile.skills : [],
  experienceYears: Number(profile.experienceYears || 0),
  education: profile.education || null,
  location: profile.location || null,
  linkedinUrl: profile.profileUrl || null,
  summary: profile.summary || null,
  openToWork: true
});

const persistLinkedinProfiles = async (profiles, recruiterId) => {
  if (!profiles.length) return [];

  const defaultStage = await prisma.recruitmentStage.findUnique({ where: { name: "Applied" } });
  if (!defaultStage) {
    throw new ApiError(500, "Default recruitment stage not found");
  }

  const candidates = [];

  for (const profile of profiles) {
    const mapped = mapLinkedinProfileToCandidateData(profile);
    const lookup = mapped.linkedinUrl
      ? { linkedinUrl: mapped.linkedinUrl }
      : mapped.email
        ? { email: mapped.email }
        : null;

    const existing = lookup
      ? await prisma.candidate.findFirst({
          where: lookup,
          select: { id: true }
        })
      : null;

    const candidate = existing
      ? await prisma.candidate.update({
          where: { id: existing.id },
          data: {
            ...mapped,
            stageId: defaultStage.id
          },
          select: {
            id: true,
            name: true,
            currentRole: true,
            experienceYears: true,
            skills: true,
            location: true,
            linkedinUrl: true,
            summary: true
          }
        })
      : await prisma.candidate.create({
          data: {
            ...mapped,
            stageId: defaultStage.id
          },
          select: {
            id: true,
            name: true,
            currentRole: true,
            experienceYears: true,
            skills: true,
            location: true,
            linkedinUrl: true,
            summary: true
          }
        });

    await prisma.activityLog.create({
      data: {
        action: existing ? "LINKEDIN_SYNC" : "LINKEDIN_IMPORT",
        userId: recruiterId,
        candidateId: candidate.id,
        metadata: {
          source: "talent_search",
          profileId: profile.id || null
        }
      }
    });

    candidates.push(candidate);
  }

  return candidates;
};

export const runTalentSearch = async (jobInput, recruiterId) => {
  const profiles = await fetchLinkedinProfiles(
    jobInput.recruiter_access_token,
    jobInput.linkedin_profile_ids || []
  );
  const candidates = await persistLinkedinProfiles(profiles, recruiterId);
  const source = "linkedin";

  const searchRecord = await prisma.talentSearch.create({
    data: {
      recruiterId,
      role: jobInput.role,
      experienceRequired: jobInput.experience_required || null,
      location: jobInput.location || null,
      skills: jobInput.skills || [],
      industry: jobInput.industry || null,
      additionalRequirements: jobInput.additional_requirements || null
    }
  });

  if (candidates.length === 0) {
    return {
      search_id: searchRecord.id,
      role: jobInput.role,
      source,
      total_candidates: 0,
      searched_at: searchRecord.createdAt,
      results: []
    };
  }

  const preRankedCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      preRankScore: computePreRankScore(jobInput, candidate)
    }))
    .sort((a, b) => b.preRankScore - a.preRankScore)
    .slice(0, 30);

  const evaluated = await Promise.all(
    preRankedCandidates.map(async (candidate) => {
      const aiResult = await callGeminiForTalentMatch(jobInput, candidate);
      return {
        candidateId: candidate.id,
        matchScore: aiResult.match_score,
        summary: aiResult.candidate_summary || `${candidate.name} is a potential match for ${jobInput.role}.`,
        strengths: aiResult.strengths || [],
        recommendedRole: aiResult.recommended_role || jobInput.role,
        roleFit: aiResult.role_fit || null
      };
    })
  );

  await prisma.$transaction(
    evaluated.map((item) =>
      prisma.talentSearchMatch.create({
        data: {
          talentSearchId: searchRecord.id,
          candidateId: item.candidateId,
          matchScore: item.matchScore,
          summary: item.summary,
          strengths: item.strengths,
          recommendedRole: item.recommendedRole,
          roleFit: item.roleFit
        }
      })
    )
  );

  const ranked = await prisma.talentSearchMatch.findMany({
    where: { talentSearchId: searchRecord.id },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          currentRole: true,
          experienceYears: true,
          location: true,
          linkedinUrl: true,
          skills: true
        }
      }
    },
    orderBy: [{ matchScore: "desc" }, { createdAt: "asc" }],
    take: 10
  });

  logInfo("Talent search completed", {
    searchId: searchRecord.id,
    recruiterId,
    source,
    role: jobInput.role,
    totalCandidates: ranked.length
  });

  return {
    search_id: searchRecord.id,
    role: jobInput.role,
    source,
    total_candidates: ranked.length,
    searched_at: searchRecord.createdAt,
    results: ranked.map(mapTalentMatch)
  };
};

export const updateTalentSearchMatch = async (matchId, payload, recruiterId) => {
  const existing = await prisma.talentSearchMatch.findFirst({
    where: {
      id: matchId,
      talentSearch: {
        recruiterId
      }
    },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          currentRole: true,
          experienceYears: true,
          location: true,
          linkedinUrl: true,
          skills: true
        }
      }
    }
  });

  if (!existing) {
    throw new ApiError(404, "Talent match not found");
  }

  const updated = await prisma.talentSearchMatch.update({
    where: { id: matchId },
    data: {
      shortlisted: payload.shortlisted,
      exported: payload.exported,
      notes: payload.notes
    },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          currentRole: true,
          experienceYears: true,
          location: true,
          linkedinUrl: true,
          skills: true
        }
      }
    }
  });

  return mapTalentMatch(updated);
};
