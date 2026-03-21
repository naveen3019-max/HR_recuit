import axios from "axios";
import { randomUUID } from "crypto";
import env from "../config/env.js";
import prisma from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

const recentLinkedinAnalysis = [];
const MAX_RECENT_ANALYSIS = 50;
const pendingLinkedinSearches = [];
const SEARCH_LEASE_MS = 90 * 1000;
const PENDING_SEARCH_TTL_MS = 2 * 60 * 1000;
const MAX_QUEUE_SIZE = 30;
const EXTENSION_HEARTBEAT_TTL_MS = 2 * 60 * 1000;
let lastExtensionHeartbeatAt = null;

const mapLinkedinProfileToCandidate = (profile, options = {}) => {
  const { openToWork = true } = options;
  return {
    name: profile.fullName || `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
    phone: profile.phoneNumber || null,
    linkedinUrl: profile.profileUrl || null,
    githubUrl: profile.githubUrl || null,
    email: profile.emailAddress || null,
    currentCompany: profile.currentCompany || null,
    currentRole: profile.currentRole || null,
    skills: profile.skills || [],
    experienceYears: profile.experienceYears || 0,
    education: profile.education || null,
    location: profile.location || null,
    resumeUrl: profile.resumeUrl || null,
    openToWork
  };
};

export const getLinkedinOAuthUrl = () => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.linkedinClientId || "",
    redirect_uri: env.linkedinRedirectUri || "",
    scope: "r_liteprofile r_emailaddress"
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
};

export const fetchLinkedinProfiles = async (recruiterAccessToken, profileIds) => {
  const requests = profileIds.map((profileId) =>
    axios.get(`${env.linkedinApiBaseUrl}/people/(id:${profileId})`, {
      headers: {
        Authorization: `Bearer ${recruiterAccessToken}`
      }
    })
  );

  const responses = await Promise.allSettled(requests);

  const profiles = responses
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value.data);

  if (profiles.length === 0) {
    throw new ApiError(502, "Failed to fetch profiles from LinkedIn. Verify access token and profile IDs.");
  }

  return profiles;
};

export const importLinkedinCandidates = async ({ recruiterAccessToken, profileIds }, userId) => {
  const profiles = await fetchLinkedinProfiles(recruiterAccessToken, profileIds);
  const defaultStage = await prisma.recruitmentStage.findUnique({ where: { name: "Applied" } });

  const imported = [];

  for (const profile of profiles) {
    const candidateData = mapLinkedinProfileToCandidate(profile, { openToWork: true });

    const candidate = await prisma.candidate.create({
      data: {
        ...candidateData,
        stageId: defaultStage.id
      },
      include: {
        stage: true
      }
    });

    await prisma.activityLog.create({
      data: {
        action: "LINKEDIN_IMPORT",
        userId,
        candidateId: candidate.id,
        metadata: { profileId: profile.id }
      }
    });

    imported.push(candidate);
  }

  return imported.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    linkedin_url: candidate.linkedinUrl,
    recruitment_stage: candidate.stage.name
  }));
};

export const syncLinkedinCandidate = async ({ recruiterAccessToken, candidateId, profileId }, userId) => {
  const [profile] = await fetchLinkedinProfiles(recruiterAccessToken, [profileId]);

  if (!profile) {
    throw new ApiError(502, "Unable to fetch profile from LinkedIn RSC API");
  }

  const existing = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!existing) {
    throw new ApiError(404, "Candidate not found");
  }

  const candidate = await prisma.candidate.update({
    where: { id: candidateId },
    // Keep existing flag if recruiter has set it manually.
    data: mapLinkedinProfileToCandidate(profile, { openToWork: existing.openToWork }),
    include: { stage: true }
  });

  await prisma.activityLog.create({
    data: {
      action: "LINKEDIN_SYNC",
      userId,
      candidateId,
      metadata: { profileId }
    }
  });

  return {
    id: candidate.id,
    name: candidate.name,
    linkedin_url: candidate.linkedinUrl,
    recruitment_stage: candidate.stage.name
  };
};

export const addRecentLinkedinAnalysis = (entry) => {
  recentLinkedinAnalysis.unshift({
    ...entry,
    analyzed_at: new Date().toISOString()
  });

  if (recentLinkedinAnalysis.length > MAX_RECENT_ANALYSIS) {
    recentLinkedinAnalysis.length = MAX_RECENT_ANALYSIS;
  }

  return recentLinkedinAnalysis[0];
};

export const getRecentLinkedinAnalysis = () => {
  return [...recentLinkedinAnalysis];
};

const sanitizeKeyword = (value) => String(value || "").trim().replace(/\s+/g, " ");

const buildLinkedinSearchQuery = ({ role, skills = [], location }) => {
  const rolePart = sanitizeKeyword(role);
  const locationPart = sanitizeKeyword(location);
  const skillsPart = (skills || [])
    .map((skill) => sanitizeKeyword(skill))
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");

  return [rolePart, skillsPart, locationPart].filter(Boolean).join(" ");
};

export const queueLinkedinSearch = ({ role, skills, location }, requestedBy) => {
  if (pendingLinkedinSearches.length >= MAX_QUEUE_SIZE) {
    throw new ApiError(429, "LinkedIn automation queue is full. Please retry shortly.");
  }

  const query = buildLinkedinSearchQuery({ role, skills, location });
  const requestId = randomUUID();

  const entry = {
    request_id: requestId,
    query,
    search_url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`,
    role,
    skills,
    location,
    status: "pending",
    requested_by: requestedBy,
    created_at: new Date().toISOString(),
    leased_until: null,
    started_at: null,
    completed_at: null,
    processed_count: 0
  };

  pendingLinkedinSearches.unshift(entry);
  return entry;
};

export const leasePendingLinkedinSearch = () => {
  const now = Date.now();
  const candidate = pendingLinkedinSearches.find((entry) => {
    if (entry.status === "pending") return true;
    if (entry.status === "processing" && entry.leased_until && new Date(entry.leased_until).getTime() < now) {
      return true;
    }
    return false;
  });

  if (!candidate) {
    return null;
  }

  candidate.status = "processing";
  candidate.started_at = candidate.started_at || new Date().toISOString();
  candidate.leased_until = new Date(now + SEARCH_LEASE_MS).toISOString();
  return { ...candidate };
};

export const recordLinkedinExtensionHeartbeat = () => {
  lastExtensionHeartbeatAt = new Date().toISOString();
};

export const getLinkedinExtensionHealth = () => {
  if (!lastExtensionHeartbeatAt) {
    return {
      online: false,
      last_seen_at: null
    };
  }

  const isOnline = Date.now() - new Date(lastExtensionHeartbeatAt).getTime() <= EXTENSION_HEARTBEAT_TTL_MS;
  return {
    online: isOnline,
    last_seen_at: lastExtensionHeartbeatAt
  };
};

export const completeLinkedinSearch = ({ requestId, processedCount = 0, error = "" }) => {
  const existing = pendingLinkedinSearches.find((entry) => entry.request_id === requestId);
  if (!existing) {
    throw new ApiError(404, "Search request not found");
  }

  existing.status = error ? "failed" : "completed";
  existing.completed_at = new Date().toISOString();
  existing.processed_count = Number(processedCount || 0);
  existing.error = error || null;
  existing.leased_until = null;
  return { ...existing };
};

export const getLinkedinSearchStatus = (requestId) => {
  const existing = pendingLinkedinSearches.find((entry) => entry.request_id === requestId);
  if (!existing) {
    return null;
  }

  const now = Date.now();
  const createdAtMs = new Date(existing.created_at).getTime();
  const leaseMs = existing.leased_until ? new Date(existing.leased_until).getTime() : null;

  if (existing.status === "pending" && now - createdAtMs > PENDING_SEARCH_TTL_MS) {
    existing.status = "failed";
    existing.error = "LinkedIn extension appears offline. Check extension backend URL/API key and keep browser open.";
    existing.completed_at = new Date().toISOString();
  }

  if (existing.status === "processing" && leaseMs && now > leaseMs) {
    existing.status = "failed";
    existing.error = "LinkedIn extension processing timed out. Verify extension permissions and service worker logs.";
    existing.completed_at = new Date().toISOString();
    existing.leased_until = null;
  }

  return { ...existing };
};
