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
