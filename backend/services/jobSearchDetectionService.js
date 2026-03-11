import env from "../config/env.js";
import { logError, logInfo } from "../utils/logger.js";

// ─── STEP 1: LinkedIn Identity Extraction ───────────────────────────────────

const extractLinkedInUsername = (url) => {
  if (!url) return null;
  try {
    const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

const extractLinkedInIdentity = (employee) => {
  const username = extractLinkedInUsername(employee.linkedin_url);
  return {
    name: employee.name,
    headline: employee.current_role || "",
    role: employee.current_role || "",
    location: "",
    skills: [],
    linkedin_username: username,
    linkedin_url: employee.linkedin_url
  };
};

// ─── STEP 2: Job Platform Discovery Engine ──────────────────────────────────

const JOB_PLATFORMS = [
  { key: "naukri", name: "Naukri", patterns: ["{name} {role} naukri profile", "{name} naukri resume"] },
  { key: "indeed", name: "Indeed", patterns: ["{name} {role} indeed resume", "{name} indeed profile"] },
  { key: "glassdoor", name: "Glassdoor", patterns: ["{name} {role} glassdoor profile"] },
  { key: "monster", name: "Monster", patterns: ["{name} {role} monster profile"] },
  { key: "shine", name: "Shine", patterns: ["{name} {role} shine profile"] },
  { key: "timesjobs", name: "TimesJobs", patterns: ["{name} {role} timesjobs profile"] }
];

const buildSearchQueries = (identity) => {
  const queries = {};
  for (const platform of JOB_PLATFORMS) {
    queries[platform.key] = platform.patterns.map((p) =>
      p.replace("{name}", identity.name)
        .replace("{role}", identity.role)
        .replace("{location}", identity.location)
    );
  }
  return queries;
};

const discoverPlatformProfiles = (identity) => {
  const searchQueries = buildSearchQueries(identity);

  // Build simulated discovery results based on available identity data.
  // In production, this would use a search API (e.g., Google Custom Search).
  const discovered = {};
  for (const platform of JOB_PLATFORMS) {
    discovered[platform.key] = {
      platform: platform.name,
      search_queries: searchQueries[platform.key],
      profile_url: null,
      discovered: false
    };
  }

  return discovered;
};

// ─── STEP 3: Signal Detection ────────────────────────────────────────────────

const detectLinkedInSignals = (employee) => {
  const signals = [];

  if (employee.linkedin_url) {
    signals.push({ signal: "LinkedIn profile provided", weight: 5, platform: "LinkedIn" });
  }

  // LinkedIn URL presence and username patterns can indicate active profile
  const username = extractLinkedInUsername(employee.linkedin_url);
  if (username) {
    signals.push({ signal: "Active LinkedIn profile URL", weight: 5, platform: "LinkedIn" });
  }

  return signals;
};

const detectGitHubSignals = async (githubUrl) => {
  if (!githubUrl) return { signals: [], activity: null };

  const username = extractGithubUsername(githubUrl);
  if (!username) return { signals: [], activity: null };

  try {
    const headers = { "User-Agent": "HR-CRM-App", Accept: "application/vnd.github.v3+json" };
    if (env.githubToken) headers["Authorization"] = `token ${env.githubToken}`;

    const [profileRes, reposRes, eventsRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=30&sort=updated`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=30`, { headers })
    ]);

    if (!profileRes.ok) return { signals: [], activity: null };

    const profile = await profileRes.json();
    const repos = reposRes.ok ? await reposRes.json() : [];
    const events = eventsRes.ok ? await eventsRes.json() : [];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const signals = [];

    // Hireable flag
    if (profile.hireable) {
      signals.push({ signal: "GitHub hireable flag enabled", weight: 40, platform: "GitHub" });
    }

    // Interview prep repos
    const interviewPrepRepos = repos.filter(
      (r) => r.name.match(/interview|leetcode|hackerrank|algo|dsa|coding.?challenge|prep|system.?design/i) &&
        new Date(r.updated_at) > thirtyDaysAgo
    );
    if (interviewPrepRepos.length > 0) {
      signals.push({
        signal: `Interview prep repos active: ${interviewPrepRepos.map((r) => r.name).join(", ")}`,
        weight: 10,
        platform: "GitHub"
      });
    }

    // Portfolio/Resume updates
    const portfolioRepos = repos.filter(
      (r) => r.name.match(/portfolio|resume|cv|personal.?site|personal.?website/i) &&
        new Date(r.updated_at) > thirtyDaysAgo
    );
    if (portfolioRepos.length > 0) {
      signals.push({
        signal: `Portfolio/Resume repos updated: ${portfolioRepos.map((r) => r.name).join(", ")}`,
        weight: 10,
        platform: "GitHub"
      });
    }

    // Sudden spike in activity
    const recentEvents = events.filter((e) => new Date(e.created_at) > thirtyDaysAgo);
    if (recentEvents.length > 20) {
      signals.push({ signal: "Sudden spike in GitHub coding activity", weight: 10, platform: "GitHub" });
    }

    // Bio mentioning availability
    if (profile.bio && /looking|seeking|open to|available|hire me/i.test(profile.bio)) {
      signals.push({ signal: "GitHub bio mentions availability/job seeking", weight: 25, platform: "GitHub" });
    }

    const recentRepos = repos.filter((r) => new Date(r.updated_at) > thirtyDaysAgo);
    const recentRepoNames = recentRepos.slice(0, 10).map((r) => `${r.name} (${r.language || "N/A"})`);

    const activity = {
      username,
      bio: profile.bio,
      public_repos: profile.public_repos,
      followers: profile.followers,
      recent_activity_count: recentEvents.length,
      recently_updated_repos: recentRepos.length,
      recent_repo_names: recentRepoNames,
      has_portfolio_updates: portfolioRepos.length > 0,
      interview_prep_repos: interviewPrepRepos.map((r) => r.name),
      profile_updated: profile.updated_at,
      hireable: profile.hireable,
      company: profile.company
    };

    return { signals, activity };
  } catch (err) {
    logError("GitHub signal detection error", { error: err.message });
    return { signals: [], activity: null };
  }
};

const extractGithubUsername = (url) => {
  if (!url) return null;
  try {
    const match = url.match(/github\.com\/([^\/\?#]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

// ─── STEP 4: Risk Scoring Engine ─────────────────────────────────────────────

const SCORING_WEIGHTS = {
  linkedin_open_to_work: 40,
  resume_updated_job_platform: 25,
  profile_updated_recently: 10,
  recruiter_connections_increased: 10,
  github_interview_prep: 10
};

const calculateRiskScore = (signals) => {
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = Math.min(100, totalWeight);

  let level;
  if (score >= 61) level = "HIGH";
  else if (score >= 31) level = "MEDIUM";
  else level = "LOW";

  return { score, level };
};

// ─── STEP 5: AI Analysis ────────────────────────────────────────────────────

const buildJobSearchPrompt = (employee, signals, githubActivity, platformDiscovery) => {
  const signalList = signals.length > 0
    ? signals.map((s) => `- [${s.platform}] ${s.signal} (weight: ${s.weight})`).join("\n")
    : "- No strong signals detected";

  const githubSection = githubActivity
    ? `GitHub Activity:
- Username: ${githubActivity.username}
- Bio: ${githubActivity.bio || "N/A"}
- Company: ${githubActivity.company || "N/A"}
- Hireable flag: ${githubActivity.hireable ? "YES" : "No / Not set"}
- Public repos: ${githubActivity.public_repos}
- Followers: ${githubActivity.followers}
- Recent events (30 days): ${githubActivity.recent_activity_count}
- Recently updated repos: ${githubActivity.recently_updated_repos}
- Recent repo names: ${githubActivity.recent_repo_names.join(", ") || "None"}
- Portfolio/Resume updated: ${githubActivity.has_portfolio_updates ? "YES" : "No"}
- Interview prep repos: ${githubActivity.interview_prep_repos.length > 0 ? githubActivity.interview_prep_repos.join(", ") : "None"}
- Profile last updated: ${githubActivity.profile_updated}`
    : "GitHub Activity: Not available (no GitHub URL provided)";

  const platformSection = Object.values(platformDiscovery)
    .map((p) => `- ${p.platform}: ${p.discovered ? `Profile found at ${p.profile_url}` : "No profile discovered"}`)
    .join("\n");

  return `You are an advanced AI HR intelligence system specializing in employee job-search detection.

Your task is to analyze multiple signals across job platforms and professional networks to determine if this employee is actively searching for a new job.

═══════════════════════════════════
EMPLOYEE INFORMATION
═══════════════════════════════════
Name: ${employee.name}
Email: ${employee.email}
Current Role: ${employee.current_role || "Not specified"}
LinkedIn: ${employee.linkedin_url || "Not provided"}
GitHub: ${employee.github_url || "Not provided"}

═══════════════════════════════════
DETECTED SIGNALS
═══════════════════════════════════
${signalList}

═══════════════════════════════════
JOB PLATFORM DISCOVERY
═══════════════════════════════════
${platformSection}

═══════════════════════════════════
${githubSection}
═══════════════════════════════════

ANALYSIS INSTRUCTIONS:
1. Evaluate each signal's importance relative to job-search behavior
2. Consider the combination of signals — multiple weak signals together can indicate stronger intent
3. LinkedIn "Open to Work" or hireable flags are very strong indicators
4. Resume/profile updates on job platforms (Naukri, Indeed, etc.) are strong indicators
5. Interview preparation repos on GitHub are moderate indicators
6. Consider the employee's role when evaluating GitHub signals (more relevant for tech roles)
7. Sudden spikes in professional activity across platforms suggest active job searching

RISK SCORING:
- 0–30: LOW — No clear job-search signals, normal professional activity
- 31–60: MEDIUM — Some preparation signals exist, worth monitoring
- 61–100: HIGH — Strong indicators of active job searching

Return ONLY valid JSON:
{
  "risk_score": <number 0-100>,
  "risk_level": "<LOW | MEDIUM | HIGH>",
  "signals_detected": ["list each signal as a concise string"],
  "platforms_flagged": ["list platform names where signals were found"],
  "analysis": "<2-3 sentence professional explanation>",
  "recommendation": "<1-2 sentence actionable HR suggestion>"
}`;
};

const callGeminiAPI = async (prompt) => {
  const baseUrl = env.llmApiUrl.replace(/\/+$/, "");
  const apiUrl = `${baseUrl}/${env.llmModel}:generateContent?key=${env.llmApiKey}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: "You are an AI HR intelligence system. Return analysis strictly in valid JSON format. No markdown, no code fences. Be concise and professional." }]
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
    logError("Gemini job search analysis error", { status: response.status, body: errText });
    return null;
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
};

// ─── Main Export: Full Job Search Detection ──────────────────────────────────

export const analyzeJobSearchRisk = async (employee) => {
  const fallback = {
    risk_score: 0,
    risk_level: "LOW",
    reason: "AI analysis unavailable. Configure LLM API credentials.",
    signals_detected: [],
    platforms_flagged: [],
    recommendation: "Set up Gemini API keys to enable AI-powered analysis.",
    platform_profiles: {}
  };

  if (!env.llmApiUrl || !env.llmApiKey) return fallback;

  // Step 1: Extract LinkedIn identity
  const identity = extractLinkedInIdentity(employee);

  // Step 2: Discover job platform profiles
  const platformDiscovery = discoverPlatformProfiles(identity);

  // Step 3: Detect signals
  const linkedInSignals = detectLinkedInSignals(employee);
  const { signals: githubSignals, activity: githubActivity } = await detectGitHubSignals(employee.github_url);
  const allSignals = [...linkedInSignals, ...githubSignals];

  logInfo("Job search detection signals", {
    employee: employee.name,
    signal_count: allSignals.length,
    github: githubActivity ? `${githubActivity.username}` : "N/A"
  });

  // Step 4: Calculate weighted score
  const { score: weightedScore, level: weightedLevel } = calculateRiskScore(allSignals);

  // Step 5: AI analysis
  const prompt = buildJobSearchPrompt(employee, allSignals, githubActivity, platformDiscovery);

  try {
    const content = await callGeminiAPI(prompt);
    if (!content) {
      return {
        ...fallback,
        risk_score: weightedScore,
        risk_level: weightedLevel,
        reason: "AI analysis temporarily unavailable. Score is based on weighted signals.",
        signals_detected: allSignals.map((s) => s.signal)
      };
    }

    const parsed = JSON.parse(content);
    const score = Math.min(100, Math.max(0, Number(parsed.risk_score) || 0));
    const validLevels = ["LOW", "MEDIUM", "HIGH"];
    const level = validLevels.includes(parsed.risk_level?.toUpperCase())
      ? parsed.risk_level.toUpperCase()
      : score >= 61 ? "HIGH" : score >= 31 ? "MEDIUM" : "LOW";

    return {
      risk_score: score,
      risk_level: level,
      reason: parsed.analysis || "Analysis complete.",
      signals_detected: Array.isArray(parsed.signals_detected) ? parsed.signals_detected : allSignals.map((s) => s.signal),
      platforms_flagged: Array.isArray(parsed.platforms_flagged) ? parsed.platforms_flagged : [],
      recommendation: parsed.recommendation || "",
      platform_profiles: platformDiscovery
    };
  } catch (error) {
    logError("Job search AI analysis error", { error: error.message });
    return {
      risk_score: weightedScore,
      risk_level: weightedLevel,
      reason: "AI analysis failed. Score based on weighted signal detection.",
      signals_detected: allSignals.map((s) => s.signal),
      platforms_flagged: [],
      recommendation: "",
      platform_profiles: platformDiscovery
    };
  }
};
