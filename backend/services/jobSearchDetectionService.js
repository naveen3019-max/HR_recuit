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

const PLATFORM_LABELS = JOB_PLATFORMS.reduce((acc, p) => {
  acc[p.key] = p.name;
  return acc;
}, {});

const normalizePlatformKey = (value) => {
  if (!value) return null;
  const normalized = String(value).toLowerCase().replace(/\s+/g, "");
  if (normalized === "timejobs" || normalized === "timesjob") return "timesjobs";
  return Object.prototype.hasOwnProperty.call(PLATFORM_LABELS, normalized) ? normalized : null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const extractGithubUsername = (url) => {
  if (!url) return null;
  try {
    const match = url.match(/github\.com\/([^\/\?#]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

// ─── Step 1 — Signal Collection ─────────────────────────────────────────────

const collectLinkedInSignals = async (employee) => {
  const hasProfile = Boolean(employee.linkedin_url);
  const baseSignals = {
    profile_found: hasProfile,
    open_to_work: false,
    recent_profile_update: false,
    headline_change: false,
    verification_source: hasProfile ? "not_verified" : "not_provided"
  };

  if (!hasProfile || !env.linkedinApiToken) {
    return baseSignals;
  }

  try {
    // This endpoint supports enterprise/proxy enrichers that can expose Open-to-Work.
    const baseUrl = env.linkedinApiBaseUrl.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/people?profileUrl=${encodeURIComponent(employee.linkedin_url)}`, {
      headers: {
        Authorization: `Bearer ${env.linkedinApiToken}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return baseSignals;
    }

    const profile = await response.json();
    return {
      ...baseSignals,
      open_to_work: Boolean(profile?.openToWork),
      recent_profile_update: Boolean(profile?.recentProfileUpdate),
      headline_change: Boolean(profile?.headlineChangedRecently),
      verification_source: "linkedin_api"
    };
  } catch (error) {
    logError("LinkedIn enrichment failed", { error: error.message });
    return baseSignals;
  }
};

const collectGitHubSignals = async (githubUrl) => {
  const base = {
    repo_count: 0,
    interview_prep_repo: false,
    leetcode_repo: false,
    system_design_repo: false,
    resume_repo: false,
    interview_prep_names: [],
    leetcode_names: [],
    system_design_names: [],
    resume_names: [],
    activity: null
  };

  const username = extractGithubUsername(githubUrl);
  if (!username) return base;

  try {
    const headers = { "User-Agent": "HR-CRM-App", Accept: "application/vnd.github.v3+json" };
    if (env.githubToken) headers.Authorization = `token ${env.githubToken}`;

    const [profileRes, reposRes, eventsRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=30&sort=updated`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=30`, { headers })
    ]);

    if (!profileRes.ok) return base;

    const profile = await profileRes.json();
    const repos = reposRes.ok ? await reposRes.json() : [];
    const events = eventsRes.ok ? await eventsRes.json() : [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEvents = events.filter((e) => new Date(e.created_at) > thirtyDaysAgo);
    const recentRepos = repos.filter((r) => new Date(r.updated_at) > thirtyDaysAgo);

    const interviewPrep = repos.filter((r) => /interview|prep|mock.?interview/i.test(r.name));
    const leetcode = repos.filter((r) => /leetcode|hackerrank|algo|dsa|coding.?challenge|competitive/i.test(r.name));
    const systemDesign = repos.filter((r) => /system.?design|design.?patterns|architecture.?prep/i.test(r.name));
    const resume = repos.filter((r) => /resume|portfolio|personal.?site|cv/i.test(r.name));

    return {
      repo_count: profile.public_repos || repos.length,
      interview_prep_repo: interviewPrep.length > 0,
      leetcode_repo: leetcode.length > 0,
      system_design_repo: systemDesign.length > 0,
      resume_repo: resume.length > 0,
      interview_prep_names: interviewPrep.map((r) => r.name),
      leetcode_names: leetcode.map((r) => r.name),
      system_design_names: systemDesign.map((r) => r.name),
      resume_names: resume.map((r) => r.name),
      activity: {
        username,
        hireable: profile.hireable,
        bio: profile.bio,
        company: profile.company,
        public_repos: profile.public_repos,
        followers: profile.followers,
        recent_activity_count: recentEvents.length,
        recent_repo_names: recentRepos.slice(0, 10).map((r) => r.name),
        profile_updated: profile.updated_at
      }
    };
  } catch (error) {
    logError("GitHub signal collection error", { error: error.message });
    return base;
  }
};

const collectJobPlatformSignals = async (employee) => {
  const base = {
    signals_detected: false,
    detected_platforms: [],
    verification_source: "not_verified"
  };

  if (!employee.email || !env.jobPlatformLookupApiUrl) {
    return base;
  }

  try {
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (env.jobPlatformLookupApiToken) {
      headers.Authorization = `Bearer ${env.jobPlatformLookupApiToken}`;
    }

    // Expected response shape: { foundPlatforms: ["naukri", "indeed"] }
    const response = await fetch(env.jobPlatformLookupApiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: employee.email })
    });

    if (!response.ok) {
      return base;
    }

    const payload = await response.json();
    const detectedPlatforms = Array.isArray(payload?.foundPlatforms)
      ? payload.foundPlatforms.map(normalizePlatformKey).filter(Boolean)
      : [];

    return {
      signals_detected: detectedPlatforms.length > 0,
      detected_platforms: [...new Set(detectedPlatforms)],
      verification_source: "email_lookup_api"
    };
  } catch (error) {
    logError("Job platform email lookup failed", { error: error.message });
    return base;
  }
};

// ─── Step 2 — Deterministic Risk Scoring Engine ─────────────────────────────

const SCORING_RULES = {
  linkedin: {
    open_to_work: 40,
    recent_profile_update: 15,
    headline_change: 20
  },
  github: {
    interview_prep_repo: 20,
    leetcode_repo: 15,
    system_design_repo: 15,
    resume_repo: 10
  },
  job_platforms: {
    signals_detected: 25
  }
};

const calculateScore = (signals) => {
  let score = 0;

  for (const [key, weight] of Object.entries(SCORING_RULES.linkedin)) {
    if (signals.linkedin[key]) score += weight;
  }
  for (const [key, weight] of Object.entries(SCORING_RULES.github)) {
    if (signals.github[key]) score += weight;
  }
  for (const [key, weight] of Object.entries(SCORING_RULES.job_platforms)) {
    if (signals.job_platforms[key]) score += weight;
  }

  return Math.min(100, score);
};

// ─── Step 3 — Risk Level Classification ─────────────────────────────────────

const classifyRisk = (score) => {
  if (score >= 51) return "HIGH";
  if (score >= 21) return "MEDIUM";
  return "LOW";
};

// ─── Step 4 — Signal Summary ────────────────────────────────────────────────

const buildSignalSummary = (signals) => {
  const detected = [];

  if (signals.linkedin.profile_found) detected.push("Active LinkedIn profile");
  if (signals.linkedin.open_to_work) detected.push("'Open to Work' enabled on LinkedIn");
  if (signals.linkedin.headline_change) detected.push("LinkedIn headline recently changed");
  if (signals.linkedin.recent_profile_update) detected.push("LinkedIn profile updated recently");

  if (signals.github.interview_prep_repo) {
    detected.push(`Interview preparation repositories detected: ${signals.github.interview_prep_names.join(", ")}`);
  }
  if (signals.github.leetcode_repo) {
    detected.push(`LeetCode / competitive coding repositories detected: ${signals.github.leetcode_names.join(", ")}`);
  }
  if (signals.github.system_design_repo) {
    detected.push(`System design preparation repositories detected: ${signals.github.system_design_names.join(", ")}`);
  }
  if (signals.github.resume_repo) {
    detected.push(`Resume or portfolio repositories detected: ${signals.github.resume_names.join(", ")}`);
  }

  if (signals.job_platforms.signals_detected) detected.push("Job platform activity signals detected");
  for (const platformKey of signals.job_platforms.detected_platforms || []) {
    detected.push(`Account detected on ${PLATFORM_LABELS[platformKey]} via email lookup`);
  }

  return detected;
};

// ─── Step 5 — AI Explanation (score is NOT generated by AI) ─────────────────

const buildPrompt = (employee, score, level, signalSummary) => {
  const signalList = signalSummary.length > 0
    ? signalSummary.map((s) => `- ${s}`).join("\n")
    : "- No risk signals detected";

  return `You are an HR AI system. Your ONLY job is to write a professional explanation of the risk analysis result provided below. You must NOT calculate or change the risk score or level.

Employee:
- Name: ${employee.name}
- Email: ${employee.email}
- Role: ${employee.current_role || "Not specified"}

Risk Score: ${score}
Risk Level: ${level}

Detected Signals:
${signalList}

RULES:
- risk_score MUST be exactly ${score}
- risk_level MUST be exactly "${level}"
- Only reference the signals listed above. Do NOT invent any signals.
- For platforms that cannot be verified, use status "no_signals".

Tone guidance:
- LOW: "${employee.name} shows normal professional activity on LinkedIn and GitHub. No indicators of active job searching were detected."
- MEDIUM: Mention the specific detected signals. Note they may indicate preparation for potential opportunities.
- HIGH: Note multiple strong indicators and that the employee may be actively exploring new roles.

Recommendation guidance:
- LOW: "Maintain regular engagement and monitor for major profile changes."
- MEDIUM: "Consider discussing career growth opportunities and internal mobility."
- HIGH: "Schedule a retention discussion and evaluate compensation or role progression."

Return ONLY valid JSON:
{
  "analysis": "Your professional explanation here.",
  "recommendation": "Your HR recommendation here."
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

// ─── Step 6 — Recommendation Engine (deterministic fallback) ────────────────

const RECOMMENDATIONS = {
  LOW: "Maintain regular engagement and monitor for major profile changes.",
  MEDIUM: "Consider discussing career growth opportunities and internal mobility.",
  HIGH: "Schedule a retention discussion and evaluate compensation or role progression."
};

// ─── Build platform profiles for frontend ───────────────────────────────────

const buildPlatformProfiles = (employee, detectedPlatforms = []) => {
  const detectedSet = new Set(detectedPlatforms);
  const profiles = {};
  for (const platform of JOB_PLATFORMS) {
    const isLinkedIn = platform.key === "linkedin";
    profiles[platform.key] = {
      platform: platform.name,
      status: isLinkedIn
        ? (employee.linkedin_url ? "found" : "no_signals")
        : (detectedSet.has(platform.key) ? "found" : "no_signals"),
      profile_url: isLinkedIn ? employee.linkedin_url || null : null
    };
  }
  return profiles;
};

// ─── Main export ────────────────────────────────────────────────────────────

export const analyzeJobSearchRisk = async (employee) => {
  // Step 1 — Collect structured signals
  const linkedInSignals = await collectLinkedInSignals(employee);
  const platformSignals = await collectJobPlatformSignals(employee);
  const signals = {
    linkedin: linkedInSignals,
    github: await collectGitHubSignals(employee.github_url),
    job_platforms: platformSignals
  };

  // Step 2 — Deterministic risk score
  const score = calculateScore(signals);

  // Step 3 — Risk level classification
  const level = classifyRisk(score);

  // Step 4 — Signal summary
  const signalSummary = buildSignalSummary(signals);

  // Step 8 — Debug logging
  logInfo("Signals:", { signals });
  logInfo("Risk score:", { score });
  logInfo("Risk level:", { level });

  // Build platform data for frontend
  const platformProfiles = buildPlatformProfiles(employee, signals.job_platforms.detected_platforms || []);
  const platformsScanned = Object.entries(platformProfiles).reduce((acc, [key, val]) => {
    acc[key] = val.status;
    return acc;
  }, {});
  const platformsFlagged = Object.entries(platformProfiles)
    .filter(([, val]) => val.status === "found")
    .map(([key]) => PLATFORM_LABELS[key]);

  if (signalSummary.some((s) => s.includes("GitHub"))) platformsFlagged.push("GitHub");
  for (const platformKey of signals.job_platforms.detected_platforms || []) {
    if (PLATFORM_LABELS[platformKey]) {
      platformsFlagged.push(PLATFORM_LABELS[platformKey]);
    }
  }

  const riskBreakdown = {
    linkedin_signals: Object.entries(SCORING_RULES.linkedin).reduce(
      (sum, [key, weight]) => sum + (signals.linkedin[key] ? weight : 0), 0
    ),
    github_signals: Object.entries(SCORING_RULES.github).reduce(
      (sum, [key, weight]) => sum + (signals.github[key] ? weight : 0), 0
    ),
    job_platform_signals: Object.entries(SCORING_RULES.job_platforms).reduce(
      (sum, [key, weight]) => sum + (signals.job_platforms[key] ? weight : 0), 0
    ),
    total: score
  };

  // Step 6 — Deterministic fallback result
  const fallback = {
    risk_score: score,
    risk_level: level,
    reason: env.llmApiUrl && env.llmApiKey
      ? "AI analysis temporarily unavailable. Score is based on detected signals."
      : "AI analysis unavailable. Configure LLM API credentials.",
    signals_detected: signalSummary,
    platforms_scanned: platformsScanned,
    platforms_flagged: platformsFlagged,
    platform_profiles: platformProfiles,
    risk_breakdown: riskBreakdown,
    recommendation: env.llmApiUrl && env.llmApiKey
      ? RECOMMENDATIONS[level]
      : "Set up Gemini API keys to enable AI-powered analysis."
  };

  if (!env.llmApiUrl || !env.llmApiKey) {
    return fallback;
  }

  // Step 5 — AI explanation only (score is NEVER overridden)
  try {
    const prompt = buildPrompt(employee, score, level, signalSummary);
    const content = await callGeminiApi(prompt);

    if (!content) return fallback;

    const parsed = JSON.parse(content);

    return {
      risk_score: score,
      risk_level: level,
      reason: parsed.analysis || fallback.reason,
      signals_detected: signalSummary,
      platforms_scanned: platformsScanned,
      platforms_flagged: platformsFlagged,
      platform_profiles: platformProfiles,
      risk_breakdown: riskBreakdown,
      recommendation: parsed.recommendation || RECOMMENDATIONS[level]
    };
  } catch (error) {
    logError("Job search AI analysis error", { error: error.message });
    return fallback;
  }
};
