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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentRepos = repos.filter((r) => new Date(r.updated_at) > thirtyDaysAgo);

    const recentEvents = events.length;
    const hasPortfolioUpdates = repos.some(
      (r) => r.name.match(/portfolio|resume|cv|personal/i) &&
        new Date(r.updated_at) > thirtyDaysAgo
    );

    const interviewPrepRepos = repos.filter(
      (r) => r.name.match(/interview|leetcode|hackerrank|algo|dsa|coding.?challenge|prep/i) &&
        new Date(r.updated_at) > thirtyDaysAgo
    ).map((r) => r.name);

    const recentRepoNames = recentRepos.slice(0, 10).map((r) => `${r.name} (${r.language || "N/A"})`);

    return {
      username,
      bio: profile.bio,
      public_repos: profile.public_repos,
      followers: profile.followers,
      recent_activity_count: recentEvents,
      recently_updated_repos: recentRepos.length,
      recent_repo_names: recentRepoNames,
      has_portfolio_updates: hasPortfolioUpdates,
      interview_prep_repos: interviewPrepRepos,
      profile_updated: profile.updated_at,
      hireable: profile.hireable,
      company: profile.company
    };
  } catch {
    return null;
  }
};

const buildRiskPrompt = (employee, githubActivity) => {
  const githubSection = githubActivity
    ? `GitHub Signals:
- Username: ${githubActivity.username}
- Bio: ${githubActivity.bio || "N/A"}
- Company listed: ${githubActivity.company || "N/A"}
- Hireable flag: ${githubActivity.hireable ? "YES (Open to opportunities)" : "No / Not set"}
- Public Repos: ${githubActivity.public_repos}
- Followers: ${githubActivity.followers}
- Recent public events (last 30 days): ${githubActivity.recent_activity_count}
- Recently updated repos (last 30 days): ${githubActivity.recently_updated_repos}
- Recent repo names: ${githubActivity.recent_repo_names.join(", ") || "None"}
- Portfolio/Resume/CV repo updated recently: ${githubActivity.has_portfolio_updates ? "YES" : "No"}
- Interview prep repos updated recently: ${githubActivity.interview_prep_repos.length > 0 ? githubActivity.interview_prep_repos.join(", ") : "None detected"}
- Profile last updated: ${githubActivity.profile_updated}`
    : "GitHub Signals:\nNot available or not provided";

  return `You are an AI HR intelligence assistant helping companies understand employee career signals.

Your task is to analyze whether an employee might be actively searching for a new job or preparing for new opportunities.

Use the information collected from professional platforms such as LinkedIn, GitHub, and email signals.

Employee Information:
Name: ${employee.name}
Email: ${employee.email}
Current Role: ${employee.current_role || "Not specified"}
LinkedIn Profile: ${employee.linkedin_url || "Not provided"}
GitHub Profile: ${employee.github_url || "Not provided"}

Signals Collected:

LinkedIn Signals:
LinkedIn URL provided: ${employee.linkedin_url ? "Yes" : "No"}
(Note: Analyze based on URL presence and any metadata available)

${githubSection}

Email Signals:
Domain: ${employee.email.split("@")[1] || "N/A"}
(Note: Consider if using personal email for professional updates)

Analyze the signals and determine if the employee shows signs of job-search behavior.

Consider factors such as:
- LinkedIn profile updates
- "Open to Work" signals
- New skills added or resume updates
- Increased GitHub activity
- Repositories related to interview preparation (leetcode, algorithms, DSA, coding challenges)
- Portfolio or resume repository updates
- Professional networking behavior
- Hireable flag on GitHub
- Bio mentioning availability or job seeking

SCORING GUIDE:
- 0-30: LOW risk — No clear job-search signals, normal activity
- 31-70: MEDIUM risk — Some preparation signals exist worth monitoring
- 71-100: HIGH risk — Strong indicators (interview prep repos, open to work, portfolio updates, hireable flag)

Return ONLY valid JSON:
{
  "risk_score": <number 0-100>,
  "risk_level": "<LOW | MEDIUM | HIGH>",
  "signals_detected": ["list each important signal detected as a short string"],
  "analysis": "<2-3 sentence concise professional explanation of reasoning>",
  "recommendation": "<1-2 sentence suggested action for HR>"
}`;
};

export const analyzeEmployeeRisk = async (employee) => {
  if (!env.llmApiUrl || !env.llmApiKey) {
    return {
      risk_score: 0,
      risk_level: "LOW",
      reason: "AI analysis unavailable. Configure LLM API credentials to enable risk assessment.",
      signals_detected: [],
      recommendation: "Set up Gemini API keys to enable AI-powered risk analysis."
    };
  }

  const githubActivity = await fetchGithubActivity(employee.github_url);
  console.log("Employee risk analysis - GitHub data:", githubActivity
    ? `username=${githubActivity.username}, recent_events=${githubActivity.recent_activity_count}, interview_repos=${githubActivity.interview_prep_repos.length}`
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
          parts: [{ text: "You are an AI HR intelligence assistant. Return analysis strictly in valid JSON format. No markdown. Be concise and professional." }]
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
      return { risk_score: 0, risk_level: "LOW", reason: "AI analysis temporarily unavailable.", signals_detected: [], recommendation: "" };
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!content) {
      return { risk_score: 0, risk_level: "LOW", reason: "AI returned empty response.", signals_detected: [], recommendation: "" };
    }

    const parsed = JSON.parse(content);
    const score = Math.min(100, Math.max(0, Number(parsed.risk_score) || 0));
    const validLevels = ["LOW", "MEDIUM", "HIGH"];
    const level = validLevels.includes(parsed.risk_level?.toUpperCase())
      ? parsed.risk_level.toUpperCase()
      : score >= 71 ? "HIGH" : score >= 31 ? "MEDIUM" : "LOW";

    return {
      risk_score: score,
      risk_level: level,
      reason: parsed.analysis || parsed.reason || "Analysis complete.",
      signals_detected: Array.isArray(parsed.signals_detected) ? parsed.signals_detected : [],
      recommendation: parsed.recommendation || ""
    };
  } catch (error) {
    console.error("Employee risk analysis error:", error);
    return { risk_score: 0, risk_level: "LOW", reason: "Analysis failed due to an error.", signals_detected: [], recommendation: "" };
  }
};
