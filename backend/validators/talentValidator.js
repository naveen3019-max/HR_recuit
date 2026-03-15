import { z } from "zod";

const sourceEnum = z.enum(["database", "linkedin"]);

export const talentSearchSchema = z.object({
  body: z
    .object({
      source: sourceEnum.default("database"),
      recruiter_access_token: z.string().min(10).optional().or(z.literal("")),
      linkedin_profile_ids: z.array(z.string().min(1)).optional().default([]),
      role: z.string().min(2).max(200),
      experience_required: z.string().max(120).optional().or(z.literal("")),
      location: z.string().max(120).optional().or(z.literal("")),
      skills: z.array(z.string().min(1).max(80)).default([]),
      industry: z.string().max(120).optional().or(z.literal("")),
      additional_requirements: z.string().max(2000).optional().or(z.literal(""))
    })
    .superRefine((value, ctx) => {
      if (value.source !== "linkedin") return;

      if (!value.recruiter_access_token) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "recruiter_access_token is required for LinkedIn source",
          path: ["recruiter_access_token"]
        });
      }

      if (!Array.isArray(value.linkedin_profile_ids) || value.linkedin_profile_ids.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "linkedin_profile_ids must contain at least one profile ID for LinkedIn source",
          path: ["linkedin_profile_ids"]
        });
      }
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
