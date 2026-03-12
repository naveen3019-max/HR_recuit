import prisma from "../config/db.js";
import env from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { logError, logInfo } from "../utils/logger.js";

const parseExperienceValue = (experienceText) => {
  if (!experienceText) return 0;
  const numbers = (experienceText.match(/\d+/g) || []).map(Number).filter((n) => !Number.isNaN(n));
  if (numbers.length === 0) return 0;
  return Math.max(...numbers);
};

const normalizeSkillList = (skills) => (skills || []).map((skill) => skill.toLowerCase().trim()).filter(Boolean);

const fallbackMatch = (jobInput, candidate) => {
  const requiredSkills = normalizeSkillList(jobInput.skills);
  const candidateSkills = new Set(normalizeSkillList(candidate.skills));
  const skillMatches = requiredSkills.filter((skill) => candidateSkills.has(skill)).length;
  const skillScore = requiredSkills.length ? Math.round((skillMatches / requiredSkills.length) * 70) : 35;

  const expectedExperience = parseExperienceValue(jobInput.experience_required);
  const experienceScore = expectedExperience
    ? Math.min(20, Math.round((candidate.experienceYears / expectedExperience) * 20))
    : 15;

  const locationScore = jobInput.location && candidate.location
    ? (candidate.location.toLowerCase().includes(jobInput.location.toLowerCase()) ? 10 : 0)
    : 5;

  const matchScore = Math.max(0, Math.min(100, skillScore + experienceScore + locationScore));

  return {
    match_score: matchScore,
    summary: `${candidate.name} matches ${skillMatches}/${requiredSkills.length || 0} requested skills and has ${candidate.experienceYears} years of experience.`,
    strengths: candidate.skills.slice(0, 4),
    recommended_role: jobInput.role,
    role_fit: matchScore >= 85 ? "Excellent" : matchScore >= 70 ? "Good" : matchScore >= 55 ? "Moderate" : "Low"
  };
};

const buildTalentPrompt = (jobInput, candidate) => {
  return `You are an AI recruiting assistant. Evaluate candidate fit using only professional profile data.\nDo NOT infer private behavior or surveillance patterns.\n\nJOB DESCRIPTION:\n- Role: ${jobInput.role}\n- Experience Required: ${jobInput.experience_required || "Not specified"}\n- Location: ${jobInput.location || "Not specified"}\n- Skills: ${(jobInput.skills || []).join(", ") || "Not specified"}\n- Industry: ${jobInput.industry || "Not specified"}\n- Additional Requirements: ${jobInput.additional_requirements || "Not specified"}\n\nCANDIDATE PROFILE:\n- Name: ${candidate.name}\n- Current Role: ${candidate.currentRole || "Not specified"}\n- Experience (years): ${candidate.experienceYears}\n- Skills: ${(candidate.skills || []).join(", ") || "Not specified"}\n- Location: ${candidate.location || "Not specified"}\n- LinkedIn URL: ${candidate.linkedinUrl || "Not provided"}\n- Summary: ${candidate.summary || "Not provided"}\n\nReturn ONLY valid JSON in this exact schema:\n{\n  "match_score": 0,\n  "summary": "",\n  "strengths": [],\n  "recommended_role": "",\n  "role_fit": ""\n}\n\nRules:\n- match_score must be an integer from 0 to 100\n- summary must be <= 280 characters and recruiter-friendly\n- strengths must contain 2-5 concise bullet-like strings\n- recommended_role should be role-oriented and concise\n- role_fit should be one of: Excellent, Good, Moderate, Low`; 
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
      summary: String(parsed.summary || "").slice(0, 280),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5).map((item) => String(item)) : [],
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
  summary: record.summary,
  strengths: record.strengths,
  recommended_role: record.recommendedRole,
  role_fit: record.roleFit,
  match_score: record.matchScore,
  shortlisted: record.shortlisted,
  exported: record.exported,
  notes: record.notes,
  skills: record.candidate.skills
});

export const runTalentSearch = async (jobInput, recruiterId) => {
  const candidates = await prisma.candidate.findMany({
    where: {
      openToWork: true
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
    },
    orderBy: { createdAt: "desc" },
    take: 40
  });

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
      total_candidates: 0,
      results: []
    };
  }

  const evaluated = await Promise.all(
    candidates.map(async (candidate) => {
      const aiResult = await callGeminiForTalentMatch(jobInput, candidate);
      return {
        candidateId: candidate.id,
        matchScore: aiResult.match_score,
        summary: aiResult.summary || `${candidate.name} is a potential match for ${jobInput.role}.`,
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
    orderBy: [{ matchScore: "desc" }, { createdAt: "asc" }]
  });

  logInfo("Talent search completed", {
    searchId: searchRecord.id,
    recruiterId,
    role: jobInput.role,
    totalCandidates: ranked.length
  });

  return {
    search_id: searchRecord.id,
    role: jobInput.role,
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
