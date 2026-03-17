import { z } from "zod";

export const linkedinImportProfileSchema = z.object({
  body: z.object({
    recruiterAccessToken: z.string().min(10),
    profileIds: z.array(z.string()).min(1)
  })
});

export const linkedinSyncCandidateSchema = z.object({
  body: z.object({
    recruiterAccessToken: z.string().min(10),
    candidateId: z.coerce.number().int().positive(),
    profileId: z.string().min(1)
  })
});

export const linkedinAnalyzeProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    headline: z.string().max(240).optional().or(z.literal("")),
    location: z.string().max(120).optional().or(z.literal("")),
    skills: z.array(z.string().min(1).max(80)).optional().default([]),
    experience: z.coerce.number().min(0).max(60).optional().default(0),
    score: z.coerce.number().min(0).max(100),
    recommendation: z.enum(["Strong Fit", "Moderate", "Low"]),
    reason: z.string().min(1).max(1000)
  })
});
