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

const fetchGithubActivity = async (githubUrl) => {
  const username = extractGithubUsername(githubUrl);
  if (!username) return null;

  try {
    const headers = { "User-Agent": "HR-CRM-App", Accept: "application/vnd.github.v3+json" };
    if (env.githubToken) headers["Authorization"] = `token ${env.githubToken}`;

    const [profileRes, reposRes, eventsRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=30&sort=updated`, { headers }),
      fetch(`https://api.github.com/users/${username}/events/public?per_page=30`, { headers })
    ]);

    if (!profileRes.ok) return null;

    const profile = await profileRes.json();
    const repos = reposRes.ok ? await reposRes.json() : [];
    const events = eventsRes.ok ? await eventsRes.json() : [];

    const recentRepos = repos.filter((r) => {
      const updated = new Date(r.updated_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return updated > thirtyDaysAgo;
    });

    const recentEvents = events.length;
    const hasPortfolioUpdates = repos.some(
      (r) => r.name.match(/portfolio|resume|cv|personal/i) &&
        new Date(r.updated_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    return {
      username,
      bio: profile.bio,
      public_repos: profile.public_repos,
      followers: profile.followers,
      recent_activity_count: recentEvents,
      recently_updated_repos: recentRepos.length,
      has_portfolio_updates: hasPortfolioUpdates,
      profile_updated: profile.updated_at
    };
  } catch {
    return null;
  }
};

const buildRiskPrompt = (employee, githubActivity) => {
  const githubSection = githubActivity
    ? `
GitHub Activity Signals:
- Username: ${githubActivity.username}
- Bio: ${githubActivity.bio || "N/A"}
- Public Repos: ${githubActivity.public_repos}
- Followers: ${githubActivity.followers}
- Recent Activity (events in last 30 days): ${githubActivity.recent_activity_count}
- Recently Updated Repos (last 30 days): ${githubActivity.recently_updated_repos}
- Portfolio/Resume/CV repo updated recently: ${githubActivity.has_portfolio_updates ? "YES" : "No"}
- Profile last updated: ${githubActivity.profile_updated}
`
    : "GitHub: Not available or not provided";

  return `You are an HR analytics AI specializing in employee retention risk assessment. Analyze the following employee's public signals to determine if they may be searching for a new job.

EMPLOYEE PROFILE:
Name: ${employee.name}
Email: ${employee.email}
Current Role: ${employee.current_role || "Not specified"}
LinkedIn URL: ${employee.linkedin_url || "Not provided"}

${githubSection}

RISK SIGNALS TO EVALUATE:
1. GitHub portfolio/resume repository updates (strong signal)
2. Increased public activity on GitHub (may indicate skill showcasing)
3. Bio changes mentioning "open to work" or similar
4. New repos related to interview prep, algorithms, etc.
5. Profile updates frequency

SCORING GUIDE:
- 0-3: Low risk - Normal activity patterns
- 4-6: Medium risk - Some signals worth monitoring
- 7-10: High risk - Multiple strong signals detected

Return ONLY valid JSON:
{
  "risk_score": <number 0-10>,
  "risk_level": "<Low | Medium | High>",
  "reason": "<2-3 sentence explanation of the risk assessment based on observed signals>"
}`;
};

export const analyzeEmployeeRisk = async (employee) => {
  if (!env.llmApiUrl || !env.llmApiKey) {
    return {
      risk_score: 0,
      risk_level: "Low",
      reason: "AI analysis unavailable. Configure LLM API credentials to enable risk assessment."
    };
  }

  const githubActivity = await fetchGithubActivity(employee.github_url);
  console.log("Employee risk analysis - GitHub data:", githubActivity
    ? `username=${githubActivity.username}, recent_events=${githubActivity.recent_activity_count}`
    : "null");

  const prompt = buildRiskPrompt(employee, githubActivity);
  const baseUrl = env.llmApiUrl.replace(/\/+$/, "");
  const apiUrl = `${baseUrl}/${env.llmModel}:generateContent?key=${env.llmApiKey}`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "You are an HR analytics expert. Return analysis strictly in valid JSON format. No markdown." }]
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
      console.error("Gemini risk analysis error:", response.status, errText);
      return { risk_score: 0, risk_level: "Low", reason: "AI analysis temporarily unavailable." };
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!content) {
      return { risk_score: 0, risk_level: "Low", reason: "AI returned empty response." };
    }

    const parsed = JSON.parse(content);
    return {
      risk_score: Math.min(10, Math.max(0, Number(parsed.risk_score) || 0)),
      risk_level: ["Low", "Medium", "High"].includes(parsed.risk_level) ? parsed.risk_level : "Low",
      reason: parsed.reason || "Analysis complete."
    };
  } catch (error) {
    console.error("Employee risk analysis error:", error);
    return { risk_score: 0, risk_level: "Low", reason: "Analysis failed due to an error." };
  }
};
