import env from "../config/env.js";
import prisma from "../config/db.js";
import { logError } from "../utils/logger.js";

const JOB_PLATFORM_KEYS = ["naukri", "indeed", "glassdoor", "monster", "shine", "timesjobs"];

const normalizePlatformKey = (value) => {
  if (!value) return null;
  const normalized = String(value).toLowerCase().replace(/\s+/g, "");
  if (normalized === "timejobs" || normalized === "timesjob") return "timesjobs";
  return JOB_PLATFORM_KEYS.includes(normalized) ? normalized : null;
};

const fetchLinkedInSignals = async (linkedinUrl) => {
  const base = {
    open_to_work: false,
    linkedin_recent_update: false,
    verification_source: linkedinUrl ? "not_verified" : "not_provided"
  };

  if (!linkedinUrl || !env.linkedinApiToken) return base;

  try {
    const apiBase = env.linkedinApiBaseUrl.replace(/\/+$/, "");
    const response = await fetch(`${apiBase}/people?profileUrl=${encodeURIComponent(linkedinUrl)}`, {
      headers: {
        Authorization: `Bearer ${env.linkedinApiToken}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) return base;

    const profile = await response.json();
    return {
      open_to_work: Boolean(profile?.openToWork),
      linkedin_recent_update: Boolean(profile?.recentProfileUpdate),
      verification_source: "linkedin_api"
    };
  } catch (error) {
    logError("Attrition LinkedIn enrichment failed", { error: error.message });
    return base;
  }
};

const fetchJobPlatformSignals = async (email) => {
  const base = {
    job_platform_account_detected: false,
    detected_platforms: [],
    verification_source: "not_verified"
  };

  if (!email || !env.jobPlatformLookupApiUrl) return base;

  try {
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (env.jobPlatformLookupApiToken) {
      headers.Authorization = `Bearer ${env.jobPlatformLookupApiToken}`;
    }

    const response = await fetch(env.jobPlatformLookupApiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ email })
    });

    if (!response.ok) return base;

    const payload = await response.json();
    const detected = Array.isArray(payload?.foundPlatforms)
      ? payload.foundPlatforms.map(normalizePlatformKey).filter(Boolean)
      : [];

    return {
      job_platform_account_detected: detected.length > 0,
      detected_platforms: [...new Set(detected)],
      verification_source: "email_lookup_api"
    };
  } catch (error) {
    logError("Attrition job platform lookup failed", { error: error.message });
    return base;
  }
};

const RISK_THRESHOLDS = {
  LOW_MAX: 40,
  MEDIUM_MAX: 70
};

const RECOMMENDATIONS = {
  LOW: "Career development plan and periodic check-ins.",
  MEDIUM: "Retention discussion and career development plan.",
  HIGH: "Salary increment, promotion opportunity, and immediate retention discussion."
};

const detectSignalFlags = async (employee) => {
  const [linkedInSignals, jobPlatformSignals] = await Promise.all([
    fetchLinkedInSignals(employee.linkedin_url),
    fetchJobPlatformSignals(employee.email)
  ]);

  const lowEngagement = typeof employee.engagement_score === "number" && employee.engagement_score < 50;
  const lowPerformance = typeof employee.performance_score === "number" && employee.performance_score < 60;
  const attendanceConcern = typeof employee.attendance_score === "number" && employee.attendance_score < 60;
  const managerConcern = Boolean(employee.manager_concern);
  const salaryBelowMarket = typeof employee.salary === "number"
    && typeof employee.market_salary === "number"
    && employee.salary < employee.market_salary;
  const lessThanOneYearExp = typeof employee.experience === "number" && employee.experience < 1;

  return {
    linkedin_profile_found: Boolean(employee.linkedin_url),
    linkedin_open_to_work: linkedInSignals.open_to_work,
    linkedin_recent_update: linkedInSignals.linkedin_recent_update,
    job_platform_account_detected: jobPlatformSignals.job_platform_account_detected,
    detected_job_platforms: jobPlatformSignals.detected_platforms,
    linkedin_verification_source: linkedInSignals.verification_source,
    job_platform_verification_source: jobPlatformSignals.verification_source,
    low_engagement_score: lowEngagement,
    low_performance_score: lowPerformance,
    attendance_concern: attendanceConcern,
    manager_concern: managerConcern,
    salary_below_market: salaryBelowMarket,
    experience_less_than_one_year: lessThanOneYearExp
  };
};

const computeScore = (flags) => {
  let score = 0;

  if (flags.linkedin_open_to_work) score += 30;
  if (flags.linkedin_recent_update) score += 10;
  if (flags.job_platform_account_detected) score += 20;
  if (flags.low_engagement_score) score += 30;
  if (flags.low_performance_score) score += 20;
  if (flags.attendance_concern) score += 15;
  if (flags.manager_concern) score += 15;
  if (flags.salary_below_market) score += 25;
  if (flags.experience_less_than_one_year) score += 10;

  return Math.min(100, score);
};

const classifyRisk = (score) => {
  if (score <= RISK_THRESHOLDS.LOW_MAX) return "LOW";
  if (score <= RISK_THRESHOLDS.MEDIUM_MAX) return "MEDIUM";
  return "HIGH";
};

const buildDetectedSignals = (flags) => {
  const signals = [];

  if (flags.linkedin_profile_found) {
    signals.push("LinkedIn profile available");
  }
  if (flags.linkedin_open_to_work) {
    signals.push("LinkedIn Open to Work is enabled");
  }
  if (flags.linkedin_recent_update) {
    signals.push("LinkedIn profile updated recently");
  }
  if (flags.job_platform_account_detected) {
    signals.push(`Account detected on job platforms: ${(flags.detected_job_platforms || []).join(", ")}`);
  }
  if (flags.low_engagement_score) {
    signals.push("Low engagement score (<50)");
  }
  if (flags.low_performance_score) {
    signals.push("Low performance score (<60)");
  }
  if (flags.attendance_concern) {
    signals.push("Attendance concern detected (<60)");
  }
  if (flags.manager_concern) {
    signals.push("Manager concern flagged");
  }
  if (flags.salary_below_market) {
    signals.push("Salary below market average");
  }
  if (flags.experience_less_than_one_year) {
    signals.push("Experience less than 1 year");
  }

  return signals;
};

const buildPrompt = ({ employee, score, level, detectedSignals }) => {
  const signalLines = detectedSignals.length > 0
    ? detectedSignals.map((signal) => `- ${signal}`).join("\n")
    : "- No signals detected";

  return `You are an HR AI assistant.

Your task is ONLY to explain attrition risk in professional language.
Do NOT calculate, change, or infer a different score/level.

Employee:
- Name: ${employee.name}
- Department: ${employee.department || "Not specified"}
- Role: ${employee.current_role || "Not specified"}
- Email: ${employee.email}

Deterministic Risk Result:
- Risk Score: ${score}
- Risk Level: ${level}

Detected Signals:
${signalLines}

Rules:
- Use only listed signals.
- Do not invent new reasons.
- Keep the explanation concise and HR professional.

Return valid JSON only:
{
  "analysis": "...",
  "recommendation": "..."
}`;
};

const callGemini = async (prompt) => {
  if (!env.llmApiUrl || !env.llmApiKey) return null;

  const baseUrl = env.llmApiUrl.replace(/\/+$/, "");
  const apiUrl = `${baseUrl}/${env.llmModel}:generateContent?key=${env.llmApiKey}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: "Return JSON only. Do not add markdown." }]
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
    logError("Gemini attrition analysis error", { status: response.status, body });
    return null;
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return content ? JSON.parse(content) : null;
};

export const analyzeAttritionRisk = async (employee) => {
  const flags = await detectSignalFlags(employee);

  const score = computeScore(flags);
  const level = classifyRisk(score);
  const detectedSignals = buildDetectedSignals(flags);

  console.log("Signals:", flags);
  console.log("Risk score:", score);
  console.log("Risk level:", level);

  const recommendation = RECOMMENDATIONS[level];

  const externalVerificationUnavailable =
    flags.linkedin_verification_source === "not_verified"
    && flags.job_platform_verification_source === "not_verified";

  const zeroScoreAnalysis = externalVerificationUnavailable
    ? `${employee.name} currently has no internal risk indicators (engagement/performance/attendance/manager concern/experience). LinkedIn and job-platform verification APIs are not configured, so external job-search signals could not be validated.`
    : `${employee.name} currently has no active attrition risk indicators from the available verified data.`;

  const fallback = {
    risk_score: score,
    risk_level: level,
    signals_detected: detectedSignals,
    analysis: score === 0
      ? zeroScoreAnalysis
      : level === "LOW"
        ? `${employee.name} shows stable engagement with no strong attrition indicators right now.`
      : level === "MEDIUM"
        ? `${employee.name} shows moderate attrition indicators that should be discussed proactively.`
        : `${employee.name} shows multiple strong attrition signals and may be at high risk of leaving.`,
    recommendation,
    signal_flags: flags
  };

  if (!env.llmApiUrl || !env.llmApiKey) {
    return fallback;
  }

  try {
    const ai = await callGemini(buildPrompt({ employee, score, level, detectedSignals }));
    return {
      ...fallback,
      analysis: ai?.analysis || fallback.analysis,
      recommendation: ai?.recommendation || recommendation
    };
  } catch (error) {
    logError("Attrition AI explanation error", { error: error.message });
    return fallback;
  }
};

export const persistAttritionRisk = async ({ employeeId, hrId, result }) => {
  const attrition = await prisma.attritionRisk.upsert({
    where: { employeeId },
    update: {
      riskScore: result.risk_score,
      riskLevel: result.risk_level,
      reasons: result.signals_detected,
      aiExplanation: result.analysis,
      recommendation: result.recommendation,
      lastCalculated: new Date()
    },
    create: {
      employeeId,
      riskScore: result.risk_score,
      riskLevel: result.risk_level,
      reasons: result.signals_detected,
      aiExplanation: result.analysis,
      recommendation: result.recommendation,
      lastCalculated: new Date()
    }
  });

  if (result.signals_detected.length > 0) {
    await prisma.employeeSignal.createMany({
      data: result.signals_detected.map((signal) => ({
        employeeId,
        signalType: signal.toLowerCase().replace(/\s+/g, "_"),
        signalValue: "true",
        detectedDate: new Date()
      }))
    });
  }

  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      riskScore: result.risk_score,
      riskLevel: result.risk_level,
      riskReason: result.analysis,
      recommendation: result.recommendation,
      signalsDetected: result.signals_detected,
      riskBreakdown: {
        attrition_signals: result.signal_flags,
        total: result.risk_score
      }
    }
  });

  if (hrId && ["MEDIUM", "HIGH"].includes(result.risk_level)) {
    await prisma.retentionAction.create({
      data: {
        employeeId,
        hrId,
        actionType: "ai_alert",
        notes: `AI alert generated. Risk level: ${result.risk_level}. Recommended action: ${result.recommendation}`,
        date: new Date()
      }
    });
  }

  return attrition;
};

export const listAttritionRisks = async () => {
  return prisma.attritionRisk.findMany({
    include: {
      employee: true
    },
    orderBy: [{ riskScore: "desc" }, { lastCalculated: "desc" }]
  });
};

export const listRetentionActions = async (employeeId) => {
  return prisma.retentionAction.findMany({
    where: { employeeId },
    include: { hr: { select: { id: true, name: true, email: true } } },
    orderBy: { date: "desc" }
  });
};

export const createRetentionAction = async ({ employeeId, hrId, actionType, notes }) => {
  return prisma.retentionAction.create({
    data: {
      employeeId,
      hrId,
      actionType,
      notes,
      date: new Date()
    },
    include: { hr: { select: { id: true, name: true, email: true } } }
  });
};
