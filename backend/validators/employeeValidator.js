import { z } from "zod";

const linkedinUrlPattern = /^https?:\/\/(www\.)?linkedin\.com\//;
const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\//;

export const createEmployeeSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
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
    current_role: z.string().max(120).optional().or(z.literal("")),
    salary: z.number().min(0).optional()
  })
});

export const updateEmployeeSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
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
    current_role: z.string().max(120).optional().or(z.literal("")),
    salary: z.number().min(0).optional()
  })
});

export const employeeParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  })
});
