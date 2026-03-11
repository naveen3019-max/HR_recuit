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
      status: isLinkedIn && identity.linkedin_url ? "found" : "not_found",
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
    signals.push({
      signal: "Active LinkedIn profile",
      weight: 10,
      platform: "LinkedIn",
      category: "linkedin_signals"
    });
  }

  if (employee.current_role && employee.linkedin_url) {
    signals.push({
      signal: "LinkedIn profile aligned with current role",
      weight: 0,
      platform: "LinkedIn",
      category: "linkedin_signals"
    });
  }

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
    const interviewPrepRepos = recentRepos.filter((repo) =>
      /interview|leetcode|hackerrank|algo|dsa|coding.?challenge|prep|system.?design/i.test(repo.name)
    );
    const signals = [];

    if (interviewPrepRepos.length > 0) {
      signals.push({
        signal: `Interview preparation repositories detected: ${interviewPrepRepos.map((repo) => repo.name).join(", ")}`,
        weight: 10,
        platform: "GitHub",
        category: "github_signals"
      });
    }

    if (recentEvents.length > 20) {
      signals.push({
        signal: "GitHub activity spike detected",
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
  if (score >= 61) return "HIGH";
  if (score >= 31) return "MEDIUM";
  return "LOW";
};

const buildPrompt = (employee, signals, platformProfiles, githubActivity, riskBreakdown) => {
  const signalList = signals.length > 0
    ? signals.map((signal) => `- [${signal.platform}] ${signal.signal} (+${signal.weight})`).join("\n")
    : "- No strong signals detected";

  const platformScan = JOB_PLATFORMS
    .map((platform) => {
      const result = platformProfiles[platform.key];
      return `- ${platform.name}: ${result?.status || "not_found"}${result?.profile_url ? ` (${result.profile_url})` : ""}`;
    })
    .join("\n");

  const githubSummary = githubActivity
    ? `GitHub Summary:\n- Username: ${githubActivity.username}\n- Hireable flag: ${githubActivity.hireable ? "Yes" : "No"}\n- Recent activity count: ${githubActivity.recent_activity_count}\n- Interview prep repos: ${githubActivity.interview_prep_repos.join(", ") || "None"}\n- Recent repos: ${githubActivity.recent_repo_names.join(", ") || "None"}`
    : "GitHub Summary:\n- Not available";

  return `You are an HR AI system generating a structured job-search risk report.

Employee:
- Name: ${employee.name}
- Email: ${employee.email}
- Role: ${employee.current_role || "Not specified"}
- LinkedIn URL: ${employee.linkedin_url}
- GitHub URL: ${employee.github_url || "Not provided"}

Job Platform Scan:
${platformScan}

Signals Detected:
${signalList}

Risk Score Breakdown:
- LinkedIn signals: ${riskBreakdown.linkedin_signals}
- GitHub signals: ${riskBreakdown.github_signals}
- Job platform signals: ${riskBreakdown.job_platform_signals}
- Total: ${riskBreakdown.total}

${githubSummary}

Return ONLY valid JSON using this exact shape:
{
  "risk_score": 20,
  "risk_level": "LOW",
  "platforms_scanned": {
    "linkedin": "found",
    "naukri": "not_found",
    "indeed": "not_found",
    "glassdoor": "not_found",
    "monster": "not_found",
    "shine": "not_found",
    "timesjobs": "not_found"
  },
  "signals_detected": ["Active LinkedIn profile", "GitHub activity spike"],
  "analysis": "Professional explanation of the risk result.",
  "recommendation": "Actionable HR guidance."
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

  const fallback = {
    risk_score: riskBreakdown.total,
    risk_level: calculateRiskLevel(riskBreakdown.total),
    reason: env.llmApiUrl && env.llmApiKey
      ? "AI analysis temporarily unavailable. Score is based on detected signals."
      : "AI analysis unavailable. Configure LLM API credentials.",
    signals_detected: allSignals.map((signal) => signal.signal),
    platforms_scanned: platformsScanned,
    platforms_flagged: platformsFlagged,
    platform_profiles: platformProfiles,
    risk_breakdown: riskBreakdown,
    recommendation: env.llmApiUrl && env.llmApiKey
      ? "Review the scan results and monitor for repeated changes over time."
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
    const score = Math.min(100, Math.max(0, Number(parsed.risk_score) || riskBreakdown.total));
    const level = ["LOW", "MEDIUM", "HIGH"].includes(parsed.risk_level?.toUpperCase())
      ? parsed.risk_level.toUpperCase()
      : calculateRiskLevel(score);

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
