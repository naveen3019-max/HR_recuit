import prisma from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

const derivePlatformsScanned = (platformProfiles) => {
  if (!platformProfiles || typeof platformProfiles !== "object") {
    return {};
  }

  return Object.entries(platformProfiles).reduce((accumulator, [key, value]) => {
    accumulator[key] = value?.status || "not_scanned";
    return accumulator;
  }, {});
};

const normalizeEmployee = (emp) => ({
  id: emp.id,
  employee_id: emp.employeeCode,
  name: emp.name,
  email: emp.email,
  linkedin_username: emp.linkedinUsername,
  linkedin_url: emp.linkedinUrl,
  github_url: emp.githubUrl,
  department: emp.department,
  current_role: emp.currentRole,
  salary: emp.salary,
  experience: emp.experience,
  join_date: emp.joinDate,
  performance_score: emp.performanceScore,
  engagement_score: emp.engagementScore,
  attendance_score: emp.attendanceScore,
  manager_concern: emp.managerConcern,
  market_salary: emp.marketSalary,
  resume_updated_at: emp.resumeUpdatedAt,
  linkedin_updated_at: emp.linkedinUpdatedAt,
  risk_score: emp.riskScore,
  risk_level: emp.riskLevel,
  risk_reason: emp.riskReason,
  signals_detected: emp.signalsDetected || [],
  platforms_flagged: emp.platformsFlagged || [],
  platform_profiles: emp.platformProfiles || {},
  platforms_scanned: derivePlatformsScanned(emp.platformProfiles),
  risk_breakdown: emp.riskBreakdown || null,
  recommendation: emp.recommendation,
  created_at: emp.createdAt,
  updated_at: emp.updatedAt
});

export const createEmployee = async (payload) => {
  const linkedinUrl = payload.linkedin_url
    || (payload.linkedin_username ? `https://www.linkedin.com/in/${payload.linkedin_username}` : null);

  const employee = await prisma.employee.create({
    data: {
      employeeCode: payload.employee_id || null,
      name: payload.name,
      email: payload.email,
      linkedinUsername: payload.linkedin_username || null,
      linkedinUrl,
      githubUrl: payload.github_url || null,
      department: payload.department || null,
      currentRole: payload.current_role || null,
      salary: payload.salary || null,
      experience: payload.experience || null,
      joinDate: payload.join_date ? new Date(payload.join_date) : null,
      performanceScore: payload.performance_score || null,
      engagementScore: payload.engagement_score || null,
      attendanceScore: payload.attendance_score || null,
      managerConcern: payload.manager_concern || false,
      marketSalary: payload.market_salary || null,
      resumeUpdatedAt: payload.resume_updated_at ? new Date(payload.resume_updated_at) : null,
      linkedinUpdatedAt: payload.linkedin_updated_at ? new Date(payload.linkedin_updated_at) : null
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

  const linkedinUrl = payload.linkedin_url !== undefined
    ? (payload.linkedin_url || (payload.linkedin_username ? `https://www.linkedin.com/in/${payload.linkedin_username}` : null))
    : undefined;

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...(payload.employee_id !== undefined && { employeeCode: payload.employee_id || null }),
      ...(payload.name && { name: payload.name }),
      ...(payload.email && { email: payload.email }),
      ...(payload.linkedin_username !== undefined && { linkedinUsername: payload.linkedin_username || null }),
      ...(linkedinUrl !== undefined && { linkedinUrl }),
      ...(payload.github_url !== undefined && { githubUrl: payload.github_url || null }),
      ...(payload.department !== undefined && { department: payload.department || null }),
      ...(payload.current_role !== undefined && { currentRole: payload.current_role || null }),
      ...(payload.salary !== undefined && { salary: payload.salary }),
      ...(payload.experience !== undefined && { experience: payload.experience }),
      ...(payload.join_date !== undefined && { joinDate: payload.join_date ? new Date(payload.join_date) : null }),
      ...(payload.performance_score !== undefined && { performanceScore: payload.performance_score }),
      ...(payload.engagement_score !== undefined && { engagementScore: payload.engagement_score }),
      ...(payload.attendance_score !== undefined && { attendanceScore: payload.attendance_score }),
      ...(payload.manager_concern !== undefined && { managerConcern: payload.manager_concern }),
      ...(payload.market_salary !== undefined && { marketSalary: payload.market_salary }),
      ...(payload.resume_updated_at !== undefined && { resumeUpdatedAt: payload.resume_updated_at ? new Date(payload.resume_updated_at) : null }),
      ...(payload.linkedin_updated_at !== undefined && { linkedinUpdatedAt: payload.linkedin_updated_at ? new Date(payload.linkedin_updated_at) : null })
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
      riskBreakdown: riskData.risk_breakdown || undefined,
      recommendation: riskData.recommendation || null
    }
  });
  return normalizeEmployee(employee);
};
