import axios from "axios";
import env from "../config/env.js";
import prisma from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

const recentLinkedinAnalysis = [];
const MAX_RECENT_ANALYSIS = 50;

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
