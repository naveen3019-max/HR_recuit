import { z } from "zod";

export const talentSearchSchema = z.object({
  body: z.object({
    role: z.string().min(2).max(200),
    experience_required: z.string().max(120).optional().or(z.literal("")),
    location: z.string().max(120).optional().or(z.literal("")),
    skills: z.array(z.string().min(1).max(80)).default([]),
    industry: z.string().max(120).optional().or(z.literal("")),
    additional_requirements: z.string().max(2000).optional().or(z.literal(""))
  })
});

export const talentMatchParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  })
});

export const updateTalentMatchSchema = z.object({
  body: z
    .object({
      shortlisted: z.boolean().optional(),
      exported: z.boolean().optional(),
      notes: z.string().max(1000).optional().or(z.literal(""))
    })
    .refine(
      (value) => value.shortlisted !== undefined || value.exported !== undefined || value.notes !== undefined,
      { message: "At least one field is required" }
    )
});
