import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: "AI request limit exceeded. Please retry in an hour."
  }
});

export const employeeAnalysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Analysis rate limit exceeded. Please retry in 15 minutes."
  }
});

export const candidateMatchingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: {
    success: false,
    message: "Candidate matching limit exceeded. Please retry in 15 minutes."
  }
});

export const talentSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: "Talent search limit exceeded. Please retry in 15 minutes."
  }
});

export const linkedinAnalysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: {
    success: false,
    message: "LinkedIn analysis limit exceeded. Please retry in 15 minutes."
  }
});
