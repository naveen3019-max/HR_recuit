import { z } from "zod";

export const talentSearchSchema = z.object({
  body: z.object({
    role: z.string().min(2).max(200),
    experience_required: z.string().min(1).max(120),
    location: z.string().min(1).max(120),
    skills: z.array(z.string().min(1).max(80)).min(1),
    industry: z.string().min(1).max(120),
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
