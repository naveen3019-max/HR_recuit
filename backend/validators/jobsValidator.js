import { z } from "zod";

export const matchCandidatesSchema = z.object({
  body: z.object({
    job_title: z.string().min(2).max(200),
    required_skills: z.array(z.string().min(1)).min(1),
    minimum_experience: z.number().min(0).max(60),
    location: z.string().min(2).max(120),
    job_description: z.string().max(4000).optional().or(z.literal(""))
  })
});