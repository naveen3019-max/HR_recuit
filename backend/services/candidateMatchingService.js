import prisma from "../config/db.js";
import env from "../config/env.js";
import { logError, logInfo } from "../utils/logger.js";

const tokenize = (value) =>
  (value || "")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/i)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeSkills = (skills) => (skills || []).map((skill) => skill.toLowerCase().trim());

const scoreSkills = (requiredSkills, candidateSkills) => {
  if (!requiredSkills.length) return 0;
  const candidateSet = new Set(normalizeSkills(candidateSkills));
  const matched = requiredSkills.filter((skill) => candidateSet.has(skill.toLowerCase().trim())).length;
  return Math.round((matched / requiredSkills.length) * 100);
};

const scoreExperience = (minimumExperience, candidateExperience) => {
  if (minimumExperience <= 0) return 100;
  return Math.min(100, Math.round((candidateExperience / minimumExperience) * 100));
};

const scoreLocation = (jobLocation, candidateLocation) => {
  if (!jobLocation) return 100;
  if (!candidateLocation) return 0;
  return candidateLocation.toLowerCase().includes(jobLocation.toLowerCase()) ? 100 : 0;
};

const fetchGithubSignals = async (githubUrl) => {
  if (!githubUrl) {
    return { github_score: 0, project_score: 0, project_signals: [] };
  }

  const match = githubUrl.match(/github\.com\/([^\/\?#]+)/i);
  const username = match ? match[1] : null;
  if (!username) {
    return { github_score: 0, project_score: 0, project_signals: [] };
  }

  try {
    const headers = { "User-Agent": "HR-CRM-App", Accept: "application/vnd.github.v3+json" };
    if (env.githubToken) {
      headers.Authorization = `token ${env.githubToken}`;
    }

    const [reposRes, eventsRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=20&sort=updated`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=20`, { headers })
    ]);

    const repos = reposRes.ok ? await reposRes.json() : [];
    const events = eventsRes.ok ? await eventsRes.json() : [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEvents = events.filter((event) => new Date(event.created_at) > thirtyDaysAgo).length;
    const recentRepos = repos.filter((repo) => new Date(repo.updated_at) > thirtyDaysAgo);

    return {
      github_score: recentEvents >= 10 ? 100 : recentEvents >= 5 ? 70 : recentEvents > 0 ? 40 : 15,
      project_score: 0,
      project_signals: recentRepos.map((repo) => repo.name)
    };
  } catch (error) {
    logError("Failed to fetch candidate GitHub activity", { error: error.message, githubUrl });
    return { github_score: 0, project_score: 0, project_signals: [] };
  }
};

const scoreProjectRelevance = (job, candidate, githubSignals) => {
  const jobTokens = new Set([
    ...tokenize(job.job_title),
    ...job.required_skills.flatMap((skill) => tokenize(skill)),
    ...tokenize(job.job_description)
  ]);

  const candidateTokens = new Set([
    ...tokenize(candidate.currentRole),
    ...candidate.skills.flatMap((skill) => tokenize(skill)),
    ...tokenize(candidate.summary),
    ...githubSignals.project_signals.flatMap((repo) => tokenize(repo))
  ]);

  if (jobTokens.size === 0 || candidateTokens.size === 0) {
    return 0;
  }

  const overlap = Array.from(jobTokens).filter((token) => candidateTokens.has(token)).length;
  return Math.min(100, Math.round((overlap / jobTokens.size) * 100));
};

const calculateMatchScore = (scoreParts) => Math.round(
  scoreParts.skill_score * 0.4 +
  scoreParts.experience_score * 0.3 +
  scoreParts.location_score * 0.1 +
  scoreParts.github_score * 0.1 +
  scoreParts.project_score * 0.1
);

const buildExplanationPrompt = (job, candidate) => `You are an HR AI assistant. Explain why this candidate fits the role in 2 concise sentences. Do not score the candidate.

Job Role: ${job.job_title}
Required Skills: ${job.required_skills.join(", ")}
Minimum Experience: ${job.minimum_experience} years
Location: ${job.location}
Job Description: ${job.job_description || "Not provided"}

Candidate:
Name: ${candidate.name}
Role: ${candidate.role || "N/A"}
Skills: ${candidate.skills.join(", ")}
Experience: ${candidate.experience_years} years
Location: ${candidate.location || "N/A"}
GitHub: ${candidate.github_url || "N/A"}
Project Signals: ${(candidate.project_signals || []).join(", ") || "None"}

Return ONLY valid JSON:
{
  "analysis": "Candidate fit explanation"
}`;

const generateAiExplanation = async (job, candidate) => {
  if (!env.llmApiUrl || !env.llmApiKey) {
    return `${candidate.name} matches ${job.job_title} based on skill overlap, experience, and profile relevance.`;
  }

  try {
    const baseUrl = env.llmApiUrl.replace(/\/+$/, "");
    const apiUrl = `${baseUrl}/${env.llmModel}:generateContent?key=${env.llmApiKey}`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "Return valid JSON only. No markdown." }]
        },
        contents: [{ parts: [{ text: buildExplanationPrompt(job, candidate) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      logError("Gemini explanation request failed", { status: response.status });
      return `${candidate.name} matches ${job.job_title} based on skill overlap, experience, and profile relevance.`;
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) {
      return `${candidate.name} matches ${job.job_title} based on skill overlap, experience, and profile relevance.`;
    }

    const parsed = JSON.parse(content);
    return parsed.analysis || `${candidate.name} matches ${job.job_title} based on skill overlap, experience, and profile relevance.`;
  } catch (error) {
    logError("Gemini explanation parsing failed", { error: error.message });
    return `${candidate.name} matches ${job.job_title} based on skill overlap, experience, and profile relevance.`;
  }
};

const normalizeLinkedinJobInput = (jobInput = {}) => ({
  job_title: jobInput.role || jobInput.job_title || "LinkedIn Search",
  required_skills: Array.isArray(jobInput.skills)
    ? jobInput.skills
    : Array.isArray(jobInput.required_skills)
      ? jobInput.required_skills
      : [],
  minimum_experience: Number(jobInput.minimum_experience || jobInput.experience_required || 0),
  location: jobInput.location || "",
  job_description: jobInput.job_description || ""
});

const normalizeLinkedinCandidateInput = (candidate = {}) => ({
  name: candidate.name || "Unknown Candidate",
  role: candidate.headline || candidate.current_role || "",
  skills: Array.isArray(candidate.skills) ? candidate.skills : [],
  experience_years: Number(candidate.experience || candidate.experience_years || 0),
  location: candidate.location || "",
  linkedin_url: candidate.profile_url || candidate.linkedin_url || null,
  github_url: candidate.github_url || null,
  project_signals: [],
  summary: candidate.headline || ""
});

export const scoreLinkedinCandidateForJob = async (jobInput, candidate) => {
  const job = normalizeLinkedinJobInput(jobInput);
  const normalizedCandidate = normalizeLinkedinCandidateInput(candidate);
  const requiredSkills = normalizeSkills(job.required_skills);

  const scoreParts = {
    skill_score: scoreSkills(requiredSkills, normalizedCandidate.skills),
    experience_score: scoreExperience(job.minimum_experience, normalizedCandidate.experience_years),
    location_score: scoreLocation(job.location, normalizedCandidate.location),
    github_score: 0,
    project_score: 0
  };

  const matchScore = calculateMatchScore(scoreParts);
  const analysis = await generateAiExplanation(job, normalizedCandidate);

  return {
    score: matchScore,
    recommendation: matchScore >= 75 ? "Strong Fit" : matchScore >= 50 ? "Moderate" : "Low",
    reason: analysis,
    breakdown: scoreParts
  };
};

export const matchCandidatesForJob = async (jobInput) => {
  let candidates = await prisma.candidate.findMany({
    where: { openToWork: true },
    select: {
      id: true,
      name: true,
      email: true,
      currentRole: true,
      skills: true,
      experienceYears: true,
      location: true,
      linkedinUrl: true,
      githubUrl: true,
      summary: true,
      openToWork: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  // Fallback for legacy/imported records where openToWork was not explicitly set.
  if (candidates.length === 0) {
    candidates = await prisma.candidate.findMany({
      where: {
        linkedinUrl: { not: null }
      },
      select: {
        id: true,
        name: true,
        email: true,
        currentRole: true,
        skills: true,
        experienceYears: true,
        location: true,
        linkedinUrl: true,
        githubUrl: true,
        summary: true,
        openToWork: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  const requiredSkills = normalizeSkills(jobInput.required_skills);

  const scoredCandidates = await Promise.all(candidates.map(async (candidate) => {
    const githubSignals = await fetchGithubSignals(candidate.githubUrl);
    const scoreParts = {
      skill_score: scoreSkills(requiredSkills, candidate.skills),
      experience_score: scoreExperience(jobInput.minimum_experience, candidate.experienceYears),
      location_score: scoreLocation(jobInput.location, candidate.location),
      github_score: githubSignals.github_score,
      project_score: 0
    };

    scoreParts.project_score = scoreProjectRelevance(jobInput, candidate, githubSignals);
    const matchScore = calculateMatchScore(scoreParts);

    return {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      role: candidate.currentRole,
      skills: candidate.skills,
      experience_years: candidate.experienceYears,
      location: candidate.location,
      linkedin_url: candidate.linkedinUrl,
      github_url: candidate.githubUrl,
      open_to_work: candidate.openToWork,
      match_score: matchScore,
      score_breakdown: scoreParts,
      project_signals: githubSignals.project_signals
    };
  }));

  scoredCandidates.sort((left, right) => right.match_score - left.match_score);
  const topCandidates = scoredCandidates.slice(0, 5);

  const results = await Promise.all(topCandidates.map(async (candidate) => ({
    ...candidate,
    analysis: await generateAiExplanation(jobInput, candidate)
  })));

  logInfo("Candidate matching completed", {
    jobTitle: jobInput.job_title,
    totalCandidates: candidates.length,
    returnedResults: results.length
  });

  return {
    job_role: jobInput.job_title,
    results
  };
};