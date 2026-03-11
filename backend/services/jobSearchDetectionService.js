import env from "../config/env.js";
import { logError, logInfo } from "../utils/logger.js";

const JOB_PLATFORMS = [
  { key: "linkedin", name: "LinkedIn" },
  { key: "naukri", name: "Naukri" },
  { key: "indeed", name: "Indeed" },
  { key: "glassdoor", name: "Glassdoor" },
  { key: "monster", name: "Monster" },
  { key: "shine", name: "Shine" },
  { key: "timesjobs", name: "TimesJobs" }
];

const PLATFORM_LABELS = JOB_PLATFORMS.reduce((accumulator, platform) => {
  accumulator[platform.key] = platform.name;
  return accumulator;
}, {});

const extractLinkedInUsername = (url) => {
  if (!url) return null;
  try {
    const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
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

const extractLinkedInIdentity = (employee) => ({
  name: employee.name,
  role: employee.current_role || "",
  location: "",
  linkedin_username: extractLinkedInUsername(employee.linkedin_url),
  linkedin_url: employee.linkedin_url
});

const buildSearchQueries = (identity, platformKey) => {
  const base = `${identity.name} ${identity.role}`.trim();
  const queries = {
    linkedin: [`${base} linkedin profile`],
    naukri: [`${base} naukri profile`, `${base} naukri resume`],
    indeed: [`${base} indeed resume`, `${base} indeed profile`],
    glassdoor: [`${base} glassdoor profile`],
    monster: [`${base} monster profile`],
    shine: [`${base} shine profile`],
    timesjobs: [`${base} timesjobs profile`]
  };

  return queries[platformKey] || [];
};

const buildPlatformProfiles = (identity) => {
  const profiles = {};

  for (const platform of JOB_PLATFORMS) {
    const isLinkedIn = platform.key === "linkedin";
    profiles[platform.key] = {
      platform: platform.name,
      status: isLinkedIn && identity.linkedin_url ? "found" : "no_signals",
      profile_url: isLinkedIn ? identity.linkedin_url || null : null,
      search_queries: buildSearchQueries(identity, platform.key)
    };
  }

  return profiles;
};

const detectLinkedInSignals = (employee, platformProfiles) => {
  const signals = [];
  const linkedInProfile = platformProfiles.linkedin;

  if (linkedInProfile?.status === "found") {
    // Active profile is neutral — not a risk signal
    signals.push({
      signal: "Active LinkedIn profile",
      weight: 0,
      platform: "LinkedIn",
      category: "linkedin_signals"
    });
  }

  if (employee.current_role && employee.linkedin_url) {
    signals.push({
      signal: "Regular professional activity",
      weight: 0,
      platform: "LinkedIn",
      category: "linkedin_signals"
    });
  }

  // These signals would normally come from an enrichment API.
  // For now we accept them via the AI analysis pass.

  return signals;
};

const detectGitHubSignals = async (githubUrl) => {
  if (!githubUrl) return { signals: [], activity: null };

  const username = extractGithubUsername(githubUrl);
  if (!username) return { signals: [], activity: null };

  try {
    const headers = { "User-Agent": "HR-CRM-App", Accept: "application/vnd.github.v3+json" };
    if (env.githubToken) headers.Authorization = `token ${env.githubToken}`;

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
    const recentEvents = events.filter((event) => new Date(event.created_at) > thirtyDaysAgo);
    const recentRepos = repos.filter((repo) => new Date(repo.updated_at) > thirtyDaysAgo);
    const interviewPrepRepos = repos.filter((repo) =>
      /interview|prep|mock.?interview/i.test(repo.name)
    );
    const leetcodeRepos = repos.filter((repo) =>
      /leetcode|hackerrank|algo|dsa|coding.?challenge|competitive/i.test(repo.name)
    );
    const systemDesignRepos = repos.filter((repo) =>
      /system.?design|design.?patterns|architecture.?prep/i.test(repo.name)
    );
    const resumePortfolioRepos = repos.filter((repo) =>
      /resume|portfolio|personal.?site|cv/i.test(repo.name)
    );

    const signals = [];

    if (interviewPrepRepos.length > 0) {
      signals.push({
        signal: `Interview preparation repositories detected: ${interviewPrepRepos.map((repo) => repo.name).join(", ")}`,
        weight: 20,
        platform: "GitHub",
        category: "github_signals"
      });
    }

    if (leetcodeRepos.length > 0) {
      signals.push({
        signal: `LeetCode / competitive coding repositories detected: ${leetcodeRepos.map((repo) => repo.name).join(", ")}`,
        weight: 15,
        platform: "GitHub",
        category: "github_signals"
      });
    }

    if (systemDesignRepos.length > 0) {
      signals.push({
        signal: `System design preparation repositories detected: ${systemDesignRepos.map((repo) => repo.name).join(", ")}`,
        weight: 15,
        platform: "GitHub",
        category: "github_signals"
      });
    }

    if (resumePortfolioRepos.length > 0) {
      signals.push({
        signal: `Resume or portfolio repositories detected: ${resumePortfolioRepos.map((repo) => repo.name).join(", ")}`,
        weight: 10,
        platform: "GitHub",
        category: "github_signals"
      });
    }

    const activity = {
      username,
      hireable: profile.hireable,
      bio: profile.bio,
      company: profile.company,
      public_repos: profile.public_repos,
      followers: profile.followers,
      recent_activity_count: recentEvents.length,
      recent_repo_names: recentRepos.slice(0, 10).map((repo) => repo.name),
      interview_prep_repos: interviewPrepRepos.map((repo) => repo.name),
      profile_updated: profile.updated_at
    };

    return { signals, activity };
  } catch (error) {
    logError("GitHub signal detection error", { error: error.message });
    return { signals: [], activity: null };
  }
};

const detectPlatformSignals = (platformProfiles) => {
  const signals = [];

  for (const [platformKey, platformProfile] of Object.entries(platformProfiles)) {
    if (platformKey === "linkedin") continue;

    if (platformProfile.status === "found") {
      signals.push({
        signal: `${platformProfile.platform} profile detected`,
        weight: 0,
        platform: platformProfile.platform,
        category: "job_platform_signals"
      });
    }
  }

  return signals;
};

const calculateRiskBreakdown = (signals) => {
  const breakdown = {
    linkedin_signals: 0,
    github_signals: 0,
    job_platform_signals: 0
  };

  for (const signal of signals) {
    breakdown[signal.category] = (breakdown[signal.category] || 0) + signal.weight;
  }

  breakdown.total = Math.min(100, Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  return breakdown;
};

const calculateRiskLevel = (score) => {
  if (score >= 51) return "HIGH";
  if (score >= 21) return "MEDIUM";
  return "LOW";
};

const buildPrompt = (employee, signals, platformProfiles, githubActivity, riskBreakdown) => {
  const signalList = signals.filter((s) => s.weight > 0).length > 0
    ? signals.filter((s) => s.weight > 0).map((signal) => `- [${signal.platform}] ${signal.signal} (+${signal.weight})`).join("\n")
    : "- No risk signals detected";


  const githubSummary = githubActivity
    ? `GitHub Summary:\n- Username: ${githubActivity.username}\n- Hireable flag: ${githubActivity.hireable ? "Yes" : "No"}\n- Recent activity count: ${githubActivity.recent_activity_count}\n- Interview prep repos: ${githubActivity.interview_prep_repos.join(", ") || "None"}\n- Recent repos: ${githubActivity.recent_repo_names.join(", ") || "None"}`
    : "GitHub Summary:\n- Not available";

  const riskLevel = calculateRiskLevel(riskBreakdown.total);

  return `You are an HR AI system generating a structured job-search risk report.

Employee:
- Name: ${employee.name}
- Email: ${employee.email}
- Role: ${employee.current_role || "Not specified"}
- LinkedIn URL: ${employee.linkedin_url}
- GitHub URL: ${employee.github_url || "Not provided"}

Signals Detected:
${signalList}

Risk Score Breakdown:
- LinkedIn signals: ${riskBreakdown.linkedin_signals}
- GitHub signals: ${riskBreakdown.github_signals}
- Job platform signals: ${riskBreakdown.job_platform_signals}
- Total: ${riskBreakdown.total}
- Risk Level: ${riskLevel}

${githubSummary}

IMPORTANT RULES:
- Your risk_score MUST equal ${riskBreakdown.total} and risk_level MUST be "${riskLevel}".
- Only reference signals that were actually detected above.
- For platforms we cannot verify (Naukri, Indeed, Glassdoor, Monster, Shine, TimesJobs), use status "no_signals" instead of "not_found".
- LinkedIn status should be "found" if a URL exists, otherwise "no_signals".

Analysis tone by risk level:
- LOW: "[Name] shows normal professional activity. No indicators of active job searching were detected."
- MEDIUM: Mention the specific detected signals and note they may indicate preparation for potential job opportunities.
- HIGH: Note multiple strong job-search indicators and that the employee may be actively exploring new opportunities.

Recommendation by risk level:
- LOW: "Maintain regular engagement and monitor for major profile updates."
- MEDIUM: "Consider discussing career growth opportunities and internal mobility."
- HIGH: "Schedule a retention discussion and evaluate compensation or role progression."

Return ONLY valid JSON using this exact shape:
{
  "risk_score": ${riskBreakdown.total},
  "risk_level": "${riskLevel}",
  "platforms_scanned": {
    "linkedin": "found",
    "naukri": "no_signals",
    "indeed": "no_signals",
    "glassdoor": "no_signals",
    "monster": "no_signals",
    "shine": "no_signals",
    "timesjobs": "no_signals"
  },
  "signals_detected": ["list only actually detected signals here"],
  "analysis": "Professional explanation referencing only detected signals.",
  "recommendation": "Actionable HR guidance based on risk level."
}`;
};

const callGeminiApi = async (prompt) => {
  const baseUrl = env.llmApiUrl.replace(/\/+$/, "");
  const apiUrl = `${baseUrl}/${env.llmModel}:generateContent?key=${env.llmApiKey}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: "Return valid JSON only. No markdown. No code fences. Be concise and professional." }]
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    logError("Gemini job search analysis error", { status: response.status, body });
    return null;
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
};

const getPlatformsScanned = (platformProfiles) => Object.entries(platformProfiles).reduce((accumulator, [key, value]) => {
  accumulator[key] = value.status;
  return accumulator;
}, {});

const getPlatformsFlagged = (platformProfiles, signals) => {
  const flagged = new Set();

  Object.entries(platformProfiles).forEach(([key, value]) => {
    if (value.status === "found") {
      flagged.add(PLATFORM_LABELS[key]);
    }
  });

  signals.forEach((signal) => {
    if (signal.weight > 0) {
      flagged.add(signal.platform);
    }
  });

  return Array.from(flagged);
};

export const analyzeJobSearchRisk = async (employee) => {
  const identity = extractLinkedInIdentity(employee);
  const platformProfiles = buildPlatformProfiles(identity);
  const linkedInSignals = detectLinkedInSignals(employee, platformProfiles);
  const { signals: githubSignals, activity: githubActivity } = await detectGitHubSignals(employee.github_url);
  const platformSignals = detectPlatformSignals(platformProfiles);
  const allSignals = [...linkedInSignals, ...githubSignals, ...platformSignals];
  const riskBreakdown = calculateRiskBreakdown(allSignals);
  const platformsScanned = getPlatformsScanned(platformProfiles);
  const platformsFlagged = getPlatformsFlagged(platformProfiles, allSignals);

  logInfo("Job search detection summary", {
    employee: employee.email,
    totalSignals: allSignals.length,
    riskScore: riskBreakdown.total,
    platformsFlagged
  });

  const riskLevel = calculateRiskLevel(riskBreakdown.total);
  const fallbackRecommendations = {
    LOW: "Maintain regular engagement and monitor for major profile updates.",
    MEDIUM: "Consider discussing career growth opportunities and internal mobility.",
    HIGH: "Schedule a retention discussion and evaluate compensation or role progression."
  };

  const fallback = {
    risk_score: riskBreakdown.total,
    risk_level: riskLevel,
    reason: env.llmApiUrl && env.llmApiKey
      ? "AI analysis temporarily unavailable. Score is based on detected signals."
      : "AI analysis unavailable. Configure LLM API credentials.",
    signals_detected: allSignals.filter((s) => s.weight > 0).map((s) => s.signal),
    platforms_scanned: platformsScanned,
    platforms_flagged: platformsFlagged,
    platform_profiles: platformProfiles,
    risk_breakdown: riskBreakdown,
    recommendation: env.llmApiUrl && env.llmApiKey
      ? fallbackRecommendations[riskLevel]
      : "Set up Gemini API keys to enable AI-powered analysis."
  };

  if (!env.llmApiUrl || !env.llmApiKey) {
    return fallback;
  }

  try {
    const prompt = buildPrompt(employee, allSignals, platformProfiles, githubActivity, riskBreakdown);
    const content = await callGeminiApi(prompt);

    if (!content) {
      return fallback;
    }

    const parsed = JSON.parse(content);
    // Enforce the deterministic score — AI cannot override the signal-based calculation
    const score = riskBreakdown.total;
    const level = calculateRiskLevel(score);

    return {
      risk_score: score,
      risk_level: level,
      reason: parsed.analysis || fallback.reason,
      signals_detected: Array.isArray(parsed.signals_detected) ? parsed.signals_detected : fallback.signals_detected,
      platforms_scanned: parsed.platforms_scanned && typeof parsed.platforms_scanned === "object"
        ? { ...platformsScanned, ...parsed.platforms_scanned }
        : platformsScanned,
      platforms_flagged: platformsFlagged,
      platform_profiles: Object.entries(platformProfiles).reduce((accumulator, [key, value]) => {
        accumulator[key] = {
          ...value,
          status: parsed.platforms_scanned?.[key] || value.status
        };
        return accumulator;
      }, {}),
      risk_breakdown: { ...riskBreakdown, total: score },
      recommendation: parsed.recommendation || fallback.recommendation
    };
  } catch (error) {
    logError("Job search AI analysis error", { error: error.message });
    return fallback;
  }
};
