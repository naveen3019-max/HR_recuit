import prisma from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

const normalizeJobRole = (role) => ({
  id: role.id,
  title: role.title,
  required_skills: role.requiredSkills,
  experience_required: role.experienceRequired,
  description: role.description,
  created_at: role.createdAt,
  updated_at: role.updatedAt
});

export const createJobRole = async (payload) => {
  const role = await prisma.jobRole.create({
    data: {
      title: payload.title,
      requiredSkills: payload.required_skills,
      experienceRequired: payload.experience_required || 0,
      description: payload.description || null
    }
  });
  return normalizeJobRole(role);
};

export const listJobRoles = async () => {
  const roles = await prisma.jobRole.findMany({
    orderBy: { createdAt: "desc" }
  });
  return roles.map(normalizeJobRole);
};

export const getJobRoleById = async (id) => {
  const role = await prisma.jobRole.findUnique({ where: { id } });
  if (!role) throw new ApiError(404, "Job role not found");
  return normalizeJobRole(role);
};
