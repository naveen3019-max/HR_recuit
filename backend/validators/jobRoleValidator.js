import { z } from "zod";

export const createJobRoleSchema = z.object({
  body: z.object({
    title: z.string().min(2).max(200),
    required_skills: z.array(z.string().min(1)).min(1),
    experience_required: z.number().int().min(0).max(60).default(0),
    description: z.string().max(2000).optional().or(z.literal(""))
  })
});

export const updateJobRoleSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    title: z.string().min(2).max(200).optional(),
    required_skills: z.array(z.string().min(1)).min(1).optional(),
    experience_required: z.number().int().min(0).max(60).optional(),
    description: z.string().max(2000).optional().or(z.literal(""))
  })
});

export const jobRoleParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  })
});
