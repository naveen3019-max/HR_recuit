import prisma from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

const normalizeCandidate = (candidate) => ({
  id: candidate.id,
  name: candidate.name,
  email: candidate.email,
  phone: candidate.phone,
  linkedin_url: candidate.linkedinUrl,
  github_url: candidate.githubUrl,
  current_company: candidate.currentCompany,
  current_role: candidate.currentRole,
  skills: candidate.skills,
  experience_years: candidate.experienceYears,
  education: candidate.education,
  location: candidate.location,
  resume_url: candidate.resumeUrl,
  notes: candidate.notes?.[0]?.note || "",
  recruitment_stage: candidate.stage?.name,
  ai_summary: candidate.summary || "",
  created_at: candidate.createdAt,
  updated_at: candidate.updatedAt
});

const getStageByName = async (stageName) => {
  const stage = await prisma.recruitmentStage.findUnique({ where: { name: stageName } });
  if (!stage) {
    throw new ApiError(400, "Invalid recruitment stage");
  }
  return stage;
};

export const createCandidate = async (payload, userId) => {
  const stage = await getStageByName(payload.recruitment_stage || "Applied");

  const candidate = await prisma.candidate.create({
    data: {
      name: payload.name,
      email: payload.email || null,
      phone: payload.phone || null,
      linkedinUrl: payload.linkedin_url || null,
      githubUrl: payload.github_url || null,
      currentCompany: payload.current_company || null,
      currentRole: payload.current_role || null,
      skills: payload.skills,
      experienceYears: payload.experience_years,
      education: payload.education || null,
      location: payload.location || null,
      resumeUrl: payload.resume_url || null,
      stageId: stage.id,
      notes: payload.notes
        ? {
            create: {
              note: payload.notes,
              userId
            }
          }
        : undefined,
      activityLog: {
        create: {
          action: "CANDIDATE_CREATED",
          metadata: { source: "manual" },
          userId
        }
      }
    },
    include: {
      stage: true,
      notes: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return normalizeCandidate(candidate);
};

export const listCandidates = async (filters) => {
  const where = {
    AND: []
  };

  if (filters.search) {
    where.AND.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { linkedinUrl: { contains: filters.search, mode: "insensitive" } }
      ]
    });
  }

  if (filters.location) {
    where.AND.push({ location: { contains: filters.location, mode: "insensitive" } });
  }

  if (filters.email) {
    where.AND.push({ email: { contains: filters.email, mode: "insensitive" } });
  }

  if (filters.linkedin) {
    where.AND.push({ linkedinUrl: { contains: filters.linkedin, mode: "insensitive" } });
  }

  if (filters.experienceMin !== undefined) {
    where.AND.push({ experienceYears: { gte: Number(filters.experienceMin) } });
  }

  if (filters.experienceMax !== undefined) {
    where.AND.push({ experienceYears: { lte: Number(filters.experienceMax) } });
  }

  if (filters.skills) {
    const skillList = filters.skills.split(",").map((item) => item.trim()).filter(Boolean);
    if (skillList.length > 0) {
      where.AND.push({
        OR: skillList.map((skill) => ({
          skills: { has: skill }
        }))
      });
    }
  }

  if (filters.stage) {
    where.AND.push({ stage: { name: filters.stage } });
  }

  if (where.AND.length === 0) {
    delete where.AND;
  }

  const candidates = await prisma.candidate.findMany({
    where,
    include: {
      stage: true,
      notes: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return candidates.map(normalizeCandidate);
};

export const getCandidateById = async (candidateId) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      stage: true,
      notes: {
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: "desc" }
      },
      activityLog: {
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!candidate) {
    throw new ApiError(404, "Candidate not found");
  }

  return {
    ...normalizeCandidate(candidate),
    all_notes: candidate.notes.map((note) => ({
      id: note.id,
      note: note.note,
      created_at: note.createdAt,
      created_by: note.user
    })),
    activity_timeline: candidate.activityLog.map((item) => ({
      id: item.id,
      action: item.action,
      metadata: item.metadata,
      created_at: item.createdAt,
      actor: item.user ? { id: item.user.id, name: item.user.name, email: item.user.email } : null
    }))
  };
};

export const updateCandidate = async (candidateId, payload, userId) => {
  const existing = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!existing) {
    throw new ApiError(404, "Candidate not found");
  }

  const candidate = await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      name: payload.name,
      phone: payload.phone,
      linkedinUrl: payload.linkedin_url,
      githubUrl: payload.github_url,
      email: payload.email,
      currentCompany: payload.current_company,
      currentRole: payload.current_role,
      skills: payload.skills,
      experienceYears: payload.experience_years,
      education: payload.education,
      location: payload.location,
      resumeUrl: payload.resume_url,
      notes: payload.notes
        ? {
            create: {
              note: payload.notes,
              userId
            }
          }
        : undefined
    },
    include: {
      stage: true,
      notes: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  await prisma.activityLog.create({
    data: {
      action: "CANDIDATE_UPDATED",
      candidateId,
      userId,
      metadata: { updatedFields: Object.keys(payload) }
    }
  });

  if (payload.notes) {
    await prisma.activityLog.create({
      data: {
        action: "CANDIDATE_NOTE_ADDED",
        candidateId,
        userId,
        metadata: { notePreview: payload.notes.slice(0, 120) }
      }
    });
  }

  return normalizeCandidate(candidate);
};

export const deleteCandidate = async (candidateId, userId) => {
  const existing = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!existing) {
    throw new ApiError(404, "Candidate not found");
  }

  await prisma.candidate.delete({ where: { id: candidateId } });
  await prisma.activityLog.create({
    data: {
      action: "CANDIDATE_DELETED",
      userId,
      metadata: { candidateId }
    }
  });
};

export const updateCandidateStage = async (candidateId, stageName, userId) => {
  const stage = await getStageByName(stageName);

  const candidate = await prisma.candidate.update({
    where: { id: candidateId },
    data: { stageId: stage.id },
    include: {
      stage: true,
      notes: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  await prisma.activityLog.create({
    data: {
      action: "CANDIDATE_STAGE_UPDATED",
      candidateId,
      userId,
      metadata: { stage: stageName }
    }
  });

  return normalizeCandidate(candidate);
};
