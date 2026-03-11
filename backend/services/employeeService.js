import prisma from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

const normalizeEmployee = (emp) => ({
  id: emp.id,
  name: emp.name,
  email: emp.email,
  linkedin_url: emp.linkedinUrl,
  github_url: emp.githubUrl,
  current_role: emp.currentRole,
  salary: emp.salary,
  risk_score: emp.riskScore,
  risk_level: emp.riskLevel,
  risk_reason: emp.riskReason,
  signals_detected: emp.signalsDetected || [],
  platforms_flagged: emp.platformsFlagged || [],
  platform_profiles: emp.platformProfiles || {},
  recommendation: emp.recommendation,
  created_at: emp.createdAt,
  updated_at: emp.updatedAt
});

export const createEmployee = async (payload) => {
  const employee = await prisma.employee.create({
    data: {
      name: payload.name,
      email: payload.email,
      linkedinUrl: payload.linkedin_url,
      githubUrl: payload.github_url || null,
      currentRole: payload.current_role || null,
      salary: payload.salary || null
    }
  });
  return normalizeEmployee(employee);
};

export const listEmployees = async () => {
  const employees = await prisma.employee.findMany({
    orderBy: { createdAt: "desc" }
  });
  return employees.map(normalizeEmployee);
};

export const getEmployeeById = async (id) => {
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw new ApiError(404, "Employee not found");
  return normalizeEmployee(employee);
};

export const updateEmployee = async (id, payload) => {
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Employee not found");

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...(payload.name && { name: payload.name }),
      ...(payload.email && { email: payload.email }),
      ...(payload.linkedin_url !== undefined && { linkedinUrl: payload.linkedin_url || null }),
      ...(payload.github_url !== undefined && { githubUrl: payload.github_url || null }),
      ...(payload.current_role !== undefined && { currentRole: payload.current_role || null }),
      ...(payload.salary !== undefined && { salary: payload.salary })
    }
  });
  return normalizeEmployee(employee);
};

export const updateEmployeeRisk = async (id, riskData) => {
  const employee = await prisma.employee.update({
    where: { id },
    data: {
      riskScore: riskData.risk_score,
      riskLevel: riskData.risk_level,
      riskReason: riskData.reason,
      signalsDetected: riskData.signals_detected || [],
      platformsFlagged: riskData.platforms_flagged || [],
      platformProfiles: riskData.platform_profiles || undefined,
      recommendation: riskData.recommendation || null
    }
  });
  return normalizeEmployee(employee);
};
