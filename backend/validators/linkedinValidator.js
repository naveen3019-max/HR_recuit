import { z } from "zod";

export const linkedinStartSearchSchema = z.object({
  body: z.object({
    role: z.string().min(2).max(120),
    skills: z.array(z.string().min(1).max(80)).min(1).max(20),
    location: z.string().min(2).max(120)
  })
});

export const linkedinSearchCompleteSchema = z.object({
  body: z.object({
    request_id: z.string().uuid(),
    processed_count: z.coerce.number().int().min(0).max(50).optional().default(0),
    error: z.string().max(500).optional().default("")
  })
});

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
        .optional(),
      job_context: z
        .object({
          role: z.string().min(2).max(120),
          skills: z.array(z.string().min(1).max(80)).optional().default([]),
          location: z.string().max(120).optional().default(""),
          experience_required: z.coerce.number().min(0).max(60).optional().default(0)
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
