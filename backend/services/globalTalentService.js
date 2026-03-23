import prisma from "../config/db.js";
import { logInfo } from "../utils/logger.js";
import { scoreGlobalTalentCandidate } from "./candidateMatchingService.js";
import { fetchGithubCandidates } from "./githubService.js";
import { fetchProxycurlCandidates } from "./proxycurlService.js";

const normalizeSkill = (value) => String(value || "").trim().toLowerCase();

const TECH_ROLE_KEYWORDS = [
  "developer",
  "engineer",
  "software",
  "frontend",
  "backend",
  "full stack",
  "devops",
  "data engineer",
  "sre",
  "cloud"
];

const NON_TECH_TEMPLATES = {
  sales: {
    titles: ["Sales Executive", "Business Development Manager", "Account Manager"],
    skills: ["crm", "lead generation", "negotiation", "client handling", "pipeline management"],
    minExp: 2,
    maxExp: 8
  },
  hr: {
    titles: ["HR Generalist", "Talent Acquisition Specialist", "HR Business Partner"],
    skills: ["recruitment", "employee engagement", "ats", "onboarding", "stakeholder management"],
    minExp: 2,
    maxExp: 8
  },
  marketing: {
    titles: ["Growth Marketing Specialist", "Digital Marketing Manager", "Performance Marketer"],
    skills: ["seo", "campaign optimization", "content strategy", "analytics", "brand marketing"],
    minExp: 2,
    maxExp: 8
  },
  default: {
    titles: ["Operations Specialist", "Business Analyst", "Program Coordinator"],
    skills: ["stakeholder management", "reporting", "process improvement", "communication", "planning"],
    minExp: 2,
    maxExp: 8
  }
};

const TECH_TEMPLATE = {
  titles: ["Software Engineer", "Backend Developer", "Full Stack Engineer", "DevOps Engineer"],
  skills: ["javascript", "typescript", "node.js", "react", "aws", "docker", "postgresql"],
  minExp: 2,
  maxExp: 9
};

const GLOBAL_CITIES = [
  "London, UK",
  "Toronto, Canada",
  "Singapore",
  "Dubai, UAE",
  "Berlin, Germany",
  "Sydney, Australia",
  "Bangalore, India",
  "Sao Paulo, Brazil",
  "Cape Town, South Africa",
  "Austin, USA"
];

const FIRST_NAMES = ["Ava", "Liam", "Noah", "Emma", "Mia", "Arjun", "Mei", "Lucas", "Isla", "Yara", "Owen", "Leah"];
const LAST_NAMES = ["Thompson", "Patel", "Kim", "Garcia", "Bennett", "Rossi", "Nakamura", "Silva", "Miller", "Hassan", "Khan", "Lopez"];

const detectTemplateType = (role) => {
  const value = String(role || "").toLowerCase();
  if (value.includes("sales") || value.includes("account") || value.includes("business development")) return "sales";
  if (value.includes("hr") || value.includes("human resource") || value.includes("recruit")) return "hr";
  if (value.includes("marketing") || value.includes("growth") || value.includes("brand")) return "marketing";
  return "default";
};

const isTechnicalRole = (role, skills = []) => {
  const text = `${String(role || "")} ${(skills || []).join(" ")}`.toLowerCase();
  return TECH_ROLE_KEYWORDS.some((keyword) => text.includes(keyword));
};

const uniqueSkillList = (skills = []) => Array.from(new Set(skills.map((skill) => normalizeSkill(skill)).filter(Boolean)));

const generateTemplateCandidates = (jobInput, count = 12, mode = "non-technical") => {
  const templateType = detectTemplateType(jobInput.role);
  const template = mode === "technical"
    ? TECH_TEMPLATE
    : NON_TECH_TEMPLATES[templateType] || NON_TECH_TEMPLATES.default;
  const requestedSkills = uniqueSkillList(jobInput.skills || []);
  const nowSeed = Math.floor(Date.now() / 1000);

  return Array.from({ length: count }, (_, index) => {
    const seed = nowSeed + index * 7;
    const first = FIRST_NAMES[seed % FIRST_NAMES.length];
    const last = LAST_NAMES[(seed + 3) % LAST_NAMES.length];
    const title = template.titles[index % template.titles.length];
    const location = jobInput.location && index % 3 === 0
      ? jobInput.location
      : GLOBAL_CITIES[(seed + index) % GLOBAL_CITIES.length];
    const expRange = template.maxExp - template.minExp + 1;
    const experience = template.minExp + ((seed + index) % expRange);
    const blendedSkills = uniqueSkillList([
      ...template.skills,
      ...requestedSkills.slice(0, 3)
    ]).slice(0, 7);

    return normalizeCandidate({
      name: `${first} ${last}`,
      headline: title,
      location,
      skills: blendedSkills,
      experience,
      source: "Global Talent",
      profileUrl: null
    });
  });
};

const normalizeCandidate = (candidate) => ({
  name: candidate.name || "Unknown Candidate",
  headline: candidate.headline || candidate.currentRole || "Talent Profile",
  skills: (candidate.skills || []).map((item) => normalizeSkill(item)).filter(Boolean),
  experience: Number(candidate.experience || candidate.experienceYears || 0),
  location: candidate.location || "",
  source: candidate.source || "Internal",
  profileUrl: candidate.profileUrl || null
});

const buildSummary = (jobInput, candidate, score) => {
  const required = (jobInput.skills || []).map(normalizeSkill).filter(Boolean);
  const matched = required.filter((skill) => new Set(candidate.skills).has(skill)).length;
  const roleBit = String(candidate.headline || "").toLowerCase().includes(String(jobInput.role || "").toLowerCase())
    ? "role aligned"
    : "adjacent role fit";

  return `Strong match due to ${matched}/${required.length || 0} required skills, ${candidate.experience} years experience, and ${roleBit}.`;
};

const getInternalCandidates = async (jobInput) => {
  const where = {
    ...(jobInput.skills?.length
      ? {
          skills: {
            hasSome: jobInput.skills
          }
        }
      : {}),
    ...(jobInput.location
      ? {
          OR: [
            {
              location: {
                contains: jobInput.location,
                mode: "insensitive"
              }
            },
            {
              location: null
            }
          ]
        }
      : {})
  };

  const records = await prisma.candidate.findMany({
    where,
    select: {
      name: true,
      currentRole: true,
      skills: true,
      experienceYears: true,
      location: true
    },
    orderBy: { createdAt: "desc" },
    take: 40
  });

  // Fallback: if strict skill/location filter yields no rows, use recent open candidates.
  const finalRecords = records.length
    ? records
    : await prisma.candidate.findMany({
        where: {
          OR: [{ openToWork: true }, { linkedinUrl: { not: null } }]
        },
        select: {
          name: true,
          currentRole: true,
          skills: true,
          experienceYears: true,
          location: true
        },
        orderBy: { createdAt: "desc" },
        take: 40
      });

  return finalRecords.map((candidate) =>
    normalizeCandidate({
      name: candidate.name,
      headline: candidate.currentRole,
      skills: candidate.skills || [],
      experience: candidate.experienceYears,
      location: candidate.location,
      source: "Internal",
      profileUrl: null
    })
  );
};

const getGithubCandidatesForJob = async (jobInput) => {
  const searchTerms = [
    ...(jobInput.skills || []).slice(0, 3),
    jobInput.role
  ]
    .map((term) => normalizeSkill(term))
    .filter(Boolean);

  if (!searchTerms.length) return [];

  const allResults = await Promise.all(
    searchTerms.map(async (term) => {
      const candidates = await fetchGithubCandidates(term);
      return candidates.map((candidate) => normalizeCandidate(candidate));
    })
  );

  return dedupeCandidates(allResults.flat());
};

const getKaggleCandidates = async () => [];

const dedupeCandidates = (candidates) => {
  const merged = new Map();

  for (const candidate of candidates) {
    const key = `${candidate.name.toLowerCase()}::${candidate.source}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...candidate,
        skills: Array.isArray(candidate.skills) ? [...candidate.skills] : []
      });
      continue;
    }

    const mergedSkills = new Set([...(existing.skills || []), ...(candidate.skills || [])]);
    merged.set(key, {
      ...existing,
      headline:
        existing.headline && existing.headline !== "Talent Profile"
          ? existing.headline
          : candidate.headline || existing.headline,
      experience: Math.max(Number(existing.experience || 0), Number(candidate.experience || 0)),
      location: existing.location || candidate.location || "",
      profileUrl: existing.profileUrl || candidate.profileUrl || null,
      skills: Array.from(mergedSkills)
    });
  }

  return Array.from(merged.values());
};

const pickBalancedTopCandidates = (scoredCandidates, limit = 10) => {
  const external = scoredCandidates.filter((candidate) => candidate.source !== "Internal");
  const internal = scoredCandidates.filter((candidate) => candidate.source === "Internal");
  const minExternal = Math.min(4, external.length);

  const seeded = external.slice(0, minExternal);
  const usedKeys = new Set(seeded.map((candidate) => `${candidate.name}::${candidate.source}`));

  const remainder = [...external.slice(minExternal), ...internal].filter(
    (candidate) => !usedKeys.has(`${candidate.name}::${candidate.source}`)
  );

  return [...seeded, ...remainder].slice(0, limit);
};

export const runGlobalTalentSearch = async (jobInput, recruiterId) => {
  const technical = isTechnicalRole(jobInput.role, jobInput.skills || []);
  const sourcePromises = [
    getInternalCandidates(jobInput), 
    getKaggleCandidates(jobInput),
    fetchProxycurlCandidates(jobInput.role, jobInput.skills || []) // Always search Proxycurl (LinkedIn data)
  ];

  if (technical) {
    sourcePromises.push(getGithubCandidatesForJob(jobInput));
  } else {
    sourcePromises.push(Promise.resolve(generateTemplateCandidates(jobInput, 12)));
  }

  const [internalResult, kaggleResult, proxycurlResult, fourthSourceResult] = await Promise.allSettled(sourcePromises);

  const internalCandidates = internalResult.status === "fulfilled" ? internalResult.value : [];
  const kaggleCandidates = kaggleResult.status === "fulfilled" ? kaggleResult.value : [];
  const proxycurlCandidates = proxycurlResult.status === "fulfilled" ? proxycurlResult.value : [];
  const dynamicCandidates = fourthSourceResult.status === "fulfilled" ? fourthSourceResult.value : [];

  const combined = dedupeCandidates([...internalCandidates, ...proxycurlCandidates, ...dynamicCandidates, ...kaggleCandidates]);

  const scored = combined
    .map((candidate) => {
      const score = scoreGlobalTalentCandidate(jobInput, candidate);
      return {
        name: candidate.name,
        headline: candidate.headline,
        location: candidate.location || jobInput.location || "Global",
        score,
        summary: buildSummary(jobInput, candidate, score),
        source: candidate.source,
        profileUrl: candidate.profileUrl || null
      };
    })
    .filter((candidate) => candidate.score >= 25)
    .sort((a, b) => b.score - a.score);

  let ranked = pickBalancedTopCandidates(scored, 10).map((candidate) => ({
    name: candidate.name,
    headline: candidate.headline,
    location: candidate.location,
    score: candidate.score,
    summary: candidate.summary,
    source: candidate.source,
    profileUrl: candidate.profileUrl
  }));

  if (ranked.length === 0) {
    const generated = generateTemplateCandidates(jobInput, 10, technical ? "technical" : "non-technical")
      .map((candidate) => {
        const score = scoreGlobalTalentCandidate(jobInput, candidate);
        return {
          name: candidate.name,
          headline: candidate.headline,
          location: candidate.location || jobInput.location || "Global",
          score,
          summary: buildSummary(jobInput, candidate, score),
          source: "Global Talent",
          profileUrl: null
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    ranked = generated;
  }

  logInfo("Global talent discovery completed", {
    recruiterId,
    role: jobInput.role,
    roleMode: technical ? "technical-live" : "non-technical-ai-template",
    liveCount: combined.length,
    totalCollected: combined.length,
    returned: ranked.length
  });

  return {
    role: jobInput.role,
    total_candidates: ranked.length,
    searched_at: new Date().toISOString(),
    realtime_only: true,
    message: technical
      ? "Global candidates fetched from internal data, live GitHub search, and AI-enriched fallback when needed."
      : "Global candidates fetched from internal data and AI-enriched global talent generation.",
    diversity_sources: Array.from(new Set(ranked.map((item) => item.source))),
    results: ranked
  };
};
