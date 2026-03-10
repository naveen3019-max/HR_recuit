import { z } from "zod";

export const aiSummarySchema = z.object({
  body: z.object({
    candidateId: z.coerce.number().int().positive().optional(),
    name: z.string().min(2),
    skills: z.array(z.string()).default([]),
    experience_years: z.number().min(0).max(60),
    education: z.string().optional().or(z.literal("")),
    location: z.string().optional().or(z.literal(""))
  })
});
