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
  body: z
    .object({
      name: z.string().min(2).max(120).optional(),
      headline: z.string().max(240).optional().or(z.literal("")),
      location: z.string().max(120).optional().or(z.literal("")),
      skills: z.array(z.string().min(1).max(80)).optional().default([]),
      experience: z.coerce.number().min(0).max(60).optional().default(0),
      score: z.coerce.number().min(0).max(100).optional(),
      recommendation: z.enum(["Strong Fit", "Moderate", "Low"]).optional(),
      reason: z.string().max(1000).optional(),
      candidate: z
        .object({
          name: z.string().min(2).max(120),
          headline: z.string().max(240).optional().or(z.literal("")),
          location: z.string().max(120).optional().or(z.literal("")),
          skills: z.array(z.string().min(1).max(80)).optional().default([]),
          experience: z.coerce.number().min(0).max(60).optional().default(0)
        })
        .optional(),
      analysis: z
        .object({
          score: z.coerce.number().min(0).max(100).optional(),
          recommendation: z.enum(["Strong Fit", "Moderate", "Low"]).optional(),
          reason: z.string().max(1000).optional()
        })
        .optional()
    })
    .superRefine((body, ctx) => {
      if (!body.name && !body.candidate?.name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Candidate name is required",
          path: ["name"]
        });
      }
    })
});
