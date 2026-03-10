import env from "../config/env.js";

const extractGithubUsername = (url) => {
  if (!url) return null;
  try {
    const match = url.match(/github\.com\/([^\/\?#]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

const fetchGithubData = async (githubUrl) => {
  const username = extractGithubUsername(githubUrl);
  if (!username) return null;

  try {
    const headers = { "User-Agent": "HR-CRM-App", Accept: "application/vnd.github.v3+json" };
    if (env.githubToken) headers["Authorization"] = `token ${env.githubToken}`;

    const [profileRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=stars`, { headers })
    ]);

    if (!profileRes.ok) return null;

    const profile = await profileRes.json();
    const repos = reposRes.ok ? await reposRes.json() : [];
    const ownRepos = repos.filter((r) => !r.fork);

    // Aggregate language stats
    const languages = {};
    for (const repo of ownRepos) {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
      }
    }
    const primaryLanguages = Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang);

    // Total stars across all own repos
    const totalStars = ownRepos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

    // Most starred repo
    const mostStarredRepo = ownRepos.sort((a, b) => b.stargazers_count - a.stargazers_count)[0];

    // Top 5 repos by stars for context
    const topRepos = ownRepos.slice(0, 5).map((r) => ({
      name: r.name,
      language: r.language || "N/A",
      description: r.description || "No description",
      stars: r.stargazers_count,
      forks: r.forks_count
    }));

    return {
      username,
      name: profile.name,
      bio: profile.bio,
      repository_count: profile.public_repos,
      followers: profile.followers,
      following: profile.following,
      company: profile.company,
      location: profile.location,
      primary_languages: primaryLanguages,
      total_stars: totalStars,
      most_starred_repo: mostStarredRepo
        ? { name: mostStarredRepo.name, stars: mostStarredRepo.stargazers_count, language: mostStarredRepo.language }
        : null,
      top_repos: topRepos,
      account_created: profile.created_at?.split("T")[0]
    };
  } catch {
    return null;
  }
};

const fallbackSummary = ({ name, skills, experience_years }) => {
  const topSkills = Array.isArray(skills) && skills.length > 0 ? skills.slice(0, 4) : ["General Skills"];
  return JSON.stringify({
    candidate_score: 5.0,
    overview: `${name} is a professional with ${experience_years || 0} years of experience.`,
    skills: topSkills,
    github_analysis: "GitHub analysis not available",
    experience_level: experience_years >= 7 ? "Senior" : experience_years >= 3 ? "Mid-Level" : "Junior",
    strengths: topSkills,
    concerns: ["Limited information available for comprehensive analysis"],
    recommended_roles: ["Software Developer"],
    recruiter_summary: `${name} has ${experience_years || 0} years of experience.`
  });
};

const buildAnalysisPrompt = (candidate, githubData) => {
  const githubSection = githubData
    ? `
GitHub Profile Metrics (Live Data):
- Username: ${githubData.username}
- Display Name: ${githubData.name || "N/A"}
- Bio: ${githubData.bio || "N/A"}
- Repositories: ${githubData.repository_count}
- Followers: ${githubData.followers.toLocaleString()} | Following: ${githubData.following}
- Total Stars Earned: ${githubData.total_stars.toLocaleString()}
- Primary Languages: ${githubData.primary_languages.slice(0, 6).join(", ") || "N/A"}
- Most Starred Project: ${githubData.most_starred_repo ? `${githubData.most_starred_repo.name} (â­${githubData.most_starred_repo.stars}, ${githubData.most_starred_repo.language || "N/A"})` : "N/A"}
- Top Repositories:
${githubData.top_repos.map((r) => `  â€¢ ${r.name} (${r.language}) â€” ${r.description} [â­${r.stars}, ðŸ´${r.forks}]`).join("\n") || "  None"}
- Account Created: ${githubData.account_created || "N/A"}
`
    : `GitHub Profile URL: ${candidate.github_url || "Not provided"}`;

  return `You are a senior technical recruiter with deep engineering expertise. Analyze the following candidate using all available signals and return a structured JSON assessment.

CANDIDATE PROFILE:
Name: ${candidate.name}
Email: ${candidate.email || "Not provided"}
LinkedIn: ${candidate.linkedin_url || "Not provided"}
Stated Experience: ${candidate.experience_years || 0} years (treat as a hint only â€” use GitHub signals as primary evidence)
Skills (self-reported): ${Array.isArray(candidate.skills) && candidate.skills.length ? candidate.skills.join(", ") : "Not specified"}
Location: ${candidate.location || "Not specified"}
Current Role: ${candidate.current_role || "Not specified"}
Current Company: ${candidate.current_company || "Not specified"}

${githubSection}

INSTRUCTIONS:
1. Determine experience level based primarily on GitHub signals (followers, total stars, project impact, repo maturity) â€” NOT the stated years. Ignore stated years if GitHub signals indicate otherwise.
   - Junior: beginner projects, few stars, basic languages
   - Mid-Level: solid portfolio, some stars, multiple languages, moderate followers
   - Senior: strong portfolio, 100+ stars or 100+ followers, complex projects, architectural work
   - Principal / Distinguished: open source leadership, 1000+ stars, 500+ followers, domain authority

2. Score the candidate 0.0â€“10.0 based on:
   - Technical depth (languages, complexity)
   - Project impact (stars, forks, real-world utility)
   - GitHub activity (repos, followers, contribution quality)
   - Architectural/leadership signals

3. List recommended roles as a clean array of strings (no paragraphs).

4. Group detected skills by category in the skills array. Each item should be a plain skill string.

5. Be factual, concise, and recruiter-friendly.

Return ONLY valid JSON using this exact structure:

{
  "candidate_score": <number 0.0-10.0>,
  "overview": "<2-3 sentence professional summary>",
  "skills": ["skill1", "skill2", ...],
  "github_analysis": "<factual paragraph using the live metrics above>",
  "experience_level": "<Junior | Mid-Level | Senior | Principal / Distinguished>",
  "strengths": ["strength1", "strength2", ...],
  "concerns": ["concern1", ...],
  "recommended_roles": ["Role 1", "Role 2", "Role 3"],
  "recruiter_summary": "<1-2 sentence TL;DR for HR>"
}`;
};

export const generateCandidateSummary = async (candidateInput) => {
  if (!env.llmApiUrl || !env.llmApiKey) {
    return fallbackSummary(candidateInput);
  }

  const githubData = await fetchGithubData(candidateInput.github_url);
  console.log("GitHub data fetched:", githubData
    ? `username=${githubData.username}, repos=${githubData.repository_count}, stars=${githubData.total_stars}, followers=${githubData.followers}`
    : "null (no GitHub URL or fetch failed)");
  console.log("Calling Gemini API with model:", env.llmModel);

  const prompt = buildAnalysisPrompt(candidateInput, githubData);

  try {
    const response = await fetch(`${env.llmApiUrl}/${env.llmModel}:generateContent?key=${env.llmApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "You are an expert recruiting analyst. Return your analysis strictly in valid JSON format. Do not include markdown code blocks or any other formatting." }]
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return fallbackSummary(candidateInput);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!content) {
      console.error("Gemini returned empty content. Full response:", JSON.stringify(data));
      return fallbackSummary(candidateInput);
    }

    try {
      const parsed = JSON.parse(content);
      // Attach live github stats for display
      if (githubData) {
        parsed._github_stats = {
          repository_count: githubData.repository_count,
          followers: githubData.followers,
          following: githubData.following,
          primary_languages: githubData.primary_languages.slice(0, 5),
          total_stars: githubData.total_stars,
          most_starred_repo: githubData.most_starred_repo
        };
      }
      return JSON.stringify(parsed);
    } catch {
      return JSON.stringify({
        candidate_score: 5.0,
        overview: content,
        skills: candidateInput.skills || [],
        github_analysis: "Analysis pending",
        experience_level: "Mid-Level",
        strengths: [],
        concerns: [],
        recommended_roles: [],
        recruiter_summary: content
      });
    }
  } catch (error) {
    console.error("AI analysis error:", error);
    return fallbackSummary(candidateInput);
  }
};
