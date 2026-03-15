import { z } from "zod";

const linkedinUrlPattern = /^https?:\/\/(www\.)?linkedin\.com\//;
const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\//;

export const createEmployeeSchema = z.object({
  body: z.object({
    employee_id: z.string().max(60).optional().or(z.literal("")),
    name: z.string().min(2).max(100),
    email: z.string().email(),
    linkedin_username: z.string().min(2).max(100).optional().or(z.literal("")),
    linkedin_url: z
      .string()
      .url()
      .regex(linkedinUrlPattern, "Must be a valid LinkedIn URL")
      .optional()
      .or(z.literal("")),
    github_url: z
      .string()
      .url()
      .regex(githubUrlPattern, "Must be a valid GitHub URL")
      .optional()
      .or(z.literal("")),
    department: z.string().max(120).optional().or(z.literal("")),
    current_role: z.string().max(120).optional().or(z.literal("")),
    salary: z.number().min(0).optional(),
    experience: z.number().min(0).optional(),
    join_date: z.string().datetime().optional(),
    performance_score: z.number().min(0).max(100).optional(),
    engagement_score: z.number().min(0).max(100).optional(),
    attendance_score: z.number().min(0).max(100).optional(),
    manager_concern: z.boolean().optional(),
    market_salary: z.number().min(0).optional(),
    resume_updated_at: z.string().datetime().optional(),
    linkedin_updated_at: z.string().datetime().optional()
  }).refine((data) => Boolean(data.linkedin_url || data.linkedin_username), {
    message: "Either linkedin_url or linkedin_username is required",
    path: ["linkedin_username"]
  })
});

export const updateEmployeeSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    employee_id: z.string().max(60).optional().or(z.literal("")),
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    linkedin_username: z.string().min(2).max(100).optional().or(z.literal("")),
    linkedin_url: z
      .string()
      .url()
      .regex(linkedinUrlPattern, "Must be a valid LinkedIn URL")
      .optional()
      .or(z.literal("")),
    github_url: z
      .string()
      .url()
      .regex(githubUrlPattern, "Must be a valid GitHub URL")
      .optional()
      .or(z.literal("")),
    department: z.string().max(120).optional().or(z.literal("")),
    current_role: z.string().max(120).optional().or(z.literal("")),
    salary: z.number().min(0).optional(),
    experience: z.number().min(0).optional(),
    join_date: z.string().datetime().optional(),
    performance_score: z.number().min(0).max(100).optional(),
    engagement_score: z.number().min(0).max(100).optional(),
    attendance_score: z.number().min(0).max(100).optional(),
    manager_concern: z.boolean().optional(),
    market_salary: z.number().min(0).optional(),
    resume_updated_at: z.string().datetime().optional(),
    linkedin_updated_at: z.string().datetime().optional()
  })
});

export const retentionActionSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    action_type: z.enum([
      "salary_increment",
      "promotion_opportunity",
      "retention_discussion",
      "role_adjustment",
      "career_development_plan",
      "other"
    ]),
    notes: z.string().max(1000).optional().or(z.literal(""))
  })
});

export const employeeParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  })
});
