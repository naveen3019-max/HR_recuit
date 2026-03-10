import prisma from "../config/db.js";
import env from "../config/env.js";

const buildMatchingPrompt = (jobRole, candidates) => {
  const candidateList = candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.name}
   Skills: ${c.skills.length ? c.skills.join(", ") : "Not specified"}
   Experience: ${c.experienceYears} years
   Current Role: ${c.currentRole || "N/A"}
   GitHub: ${c.githubUrl || "N/A"}
   Summary: ${c.summary ? c.summary.substring(0, 200) : "No AI summary"}`
    )
    .join("\n\n");

  return `You are a senior technical recruiter AI. Match candidates to a job role and score them.

JOB ROLE:
Title: ${jobRole.title}
Required Skills: ${jobRole.required_skills.join(", ")}
Experience Required: ${jobRole.experience_required}+ years
Description: ${jobRole.description || "Not provided"}

CANDIDATES:
${candidateList}

MATCHING CRITERIA:
1. Skill overlap (most important) — how many required skills does the candidate have?
2. Experience level — meets or exceeds the requirement?
3. Current role relevance — is their current role similar?
4. Overall technical profile strength

SCORING:
- 90-100: Excellent match — most skills match, experience meets/exceeds requirement
- 70-89: Good match — many skills overlap, close on experience
- 50-69: Partial match — some skills match
- Below 50: Weak match

Return ONLY valid JSON with this structure:
{
  "job_role": "${jobRole.title}",
  "top_candidates": [
    {
      "id": <candidate_id>,
      "name": "<name>",
      "match_score": <number 0-100>,
      "explanation": "<1-2 sentence reason for the score>"
    }
  ]
}

Order by match_score descending. Include ALL candidates. Be factual and concise.`;
};

export const getJobRecommendations = async (jobRole) => {
  const candidates = await prisma.candidate.findMany({
    select: {
      id: true,
      name: true,
      skills: true,
      experienceYears: true,
      currentRole: true,
      githubUrl: true,
      summary: true
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  if (candidates.length === 0) {
    return { job_role: jobRole.title, top_candidates: [] };
  }

  if (!env.llmApiUrl || !env.llmApiKey) {
    // Basic skill-matching fallback without AI
    const results = candidates.map((c) => {
      const skillOverlap = c.skills.filter((s) =>
        jobRole.required_skills.some(
          (rs) => rs.toLowerCase() === s.toLowerCase()
        )
      ).length;
      const skillScore = jobRole.required_skills.length > 0
        ? (skillOverlap / jobRole.required_skills.length) * 70
        : 0;
      const expScore = c.experienceYears >= jobRole.experience_required ? 30 : (c.experienceYears / Math.max(jobRole.experience_required, 1)) * 30;
      return {
        id: c.id,
        name: c.name,
        match_score: Math.round(skillScore + expScore),
        explanation: `Matched ${skillOverlap}/${jobRole.required_skills.length} required skills, ${c.experienceYears} years experience.`
      };
    });
    results.sort((a, b) => b.match_score - a.match_score);
    return { job_role: jobRole.title, top_candidates: results.slice(0, 10) };
  }

  const prompt = buildMatchingPrompt(jobRole, candidates);
  const baseUrl = env.llmApiUrl.replace(/\/+$/, "");
  const apiUrl = `${baseUrl}/${env.llmModel}:generateContent?key=${env.llmApiKey}`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "You are a recruiting match-making expert. Return analysis strictly in valid JSON. No markdown." }]
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      console.error("Gemini matching error:", response.status, await response.text());
      return { job_role: jobRole.title, top_candidates: [] };
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) return { job_role: jobRole.title, top_candidates: [] };

    const parsed = JSON.parse(content);
    return {
      job_role: parsed.job_role || jobRole.title,
      top_candidates: (parsed.top_candidates || []).slice(0, 10)
    };
  } catch (error) {
    console.error("Job matching error:", error);
    return { job_role: jobRole.title, top_candidates: [] };
  }
};
