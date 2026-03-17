import dotenv from "dotenv";

dotenv.config();

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  linkedinClientId: process.env.LINKEDIN_CLIENT_ID,
  linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  linkedinRedirectUri: process.env.LINKEDIN_REDIRECT_URI,
  linkedinApiBaseUrl: process.env.LINKEDIN_API_BASE_URL || "https://api.linkedin.com/v2",
  linkedinApiToken: process.env.LINKEDIN_API_TOKEN || null,
  linkedinExtensionApiKey: process.env.LINKEDIN_EXTENSION_API_KEY || null,
  jobPlatformLookupApiUrl: process.env.JOB_PLATFORM_LOOKUP_API_URL || null,
  jobPlatformLookupApiToken: process.env.JOB_PLATFORM_LOOKUP_API_TOKEN || null,
  llmApiUrl: (process.env.LLM_API_URL || "").replace(/\/+$/, "") || null,
  llmApiKey: process.env.LLM_API_KEY,
  llmModel: process.env.LLM_MODEL || "gemini-2.5-flash",
  githubToken: process.env.GITHUB_TOKEN || null
};

export default env;
