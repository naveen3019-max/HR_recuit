import { z } from "zod";

const stageEnum = z.enum(["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"]);

export const createCandidateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().min(7).max(30).optional().or(z.literal("")),
    linkedin_url: z.string().url().optional().or(z.literal("")),
    github_url: z.string().url().optional().or(z.literal("")),
    current_company: z.string().max(120).optional().or(z.literal("")),
    current_role: z.string().max(120).optional().or(z.literal("")),
    experience_years: z.number().min(0).max(60),
    skills: z.array(z.string()).default([]),
    education: z.string().optional().or(z.literal("")),
    location: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
    recruitment_stage: stageEnum.optional()
  })
});

export const updateCandidateSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().min(7).max(30).optional().or(z.literal("")),
    linkedin_url: z.string().url().optional().or(z.literal("")),
    github_url: z.string().url().optional().or(z.literal("")),
    current_company: z.string().max(120).optional().or(z.literal("")),
    current_role: z.string().max(120).optional().or(z.literal("")),
    experience_years: z.number().min(0).max(60).optional(),
    skills: z.array(z.string()).optional(),
    education: z.string().optional().or(z.literal("")),
    location: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal(""))
  })
});

export const candidateParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  })
});

export const stageUpdateSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    recruitment_stage: stageEnum
  })
});

export const listCandidatesSchema = z.object({
  query: z.object({
    skills: z.string().optional(),
    experienceMin: z.coerce.number().optional(),
    experienceMax: z.coerce.number().optional(),
    location: z.string().optional(),
    email: z.string().optional(),
    linkedin: z.string().optional(),
    stage: stageEnum.optional(),
    search: z.string().optional()
  })
});
