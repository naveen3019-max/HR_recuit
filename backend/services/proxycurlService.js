import env from "../config/env.js";
import { logError, logInfo } from "../utils/logger.js";

/**
 * Service to interact with Proxycurl Employee Search API
 * Documentation: https://nubela.co/proxycurl/docs#people-api-employee-search-api-endpoint
 */
export const fetchProxycurlCandidates = async (jobRole, requiredSkills = []) => {
  if (!env.proxycurlApiKey) {
    logInfo("Proxycurl API key not configured, skipping proxycurl search");
    return [];
  }

  const role = String(jobRole || "").trim();
  if (!role) return [];

  // Build the search query
  // Proxycurl allows querying by current_role_title, skills, etc.
  const params = new URLSearchParams({
    current_role_title: role,
    enrich_profiles: "enrich",
    page_size: "10"
  });

  const headers = {
    "Authorization": `Bearer ${env.proxycurlApiKey}`,
    "Accept": "application/json"
  };

  try {
    const response = await fetch(`https://nubela.co/proxycurl/api/v2/search/employee?${params.toString()}`, {
      headers
    });

    if (!response.ok) {
      logError("Proxycurl API failed", {
        status: response.status,
        role: role
      });
      return [];
    }

    const data = await response.json();
    const employees = Array.isArray(data.employees) ? data.employees : [];

    // Map proxycurl profile data into our unified candidate schema
    return employees.map(emp => {
      const profileInfo = emp.profile || {};
      
      // Extract skills if available, otherwise just use the role
      let skills = [];
      if (Array.isArray(profileInfo.skills) && profileInfo.skills.length > 0) {
        skills = profileInfo.skills.map(s => String(s).toLowerCase()).slice(0, 8);
      } else if (requiredSkills.length > 0) {
        // Fallback: assume they have some requested skills if Proxycurl didn't return them directly
        skills = requiredSkills.slice(0, 3).map(s => String(s).toLowerCase());
      } else {
        skills = [role.toLowerCase()];
      }

      // Calculate experience from experiences array
      let yearsExperience = 3; // Default
      if (Array.isArray(profileInfo.experiences) && profileInfo.experiences.length > 0) {
        try {
          const earliestExp = profileInfo.experiences[profileInfo.experiences.length - 1];
          const startYear = earliestExp.starts_at?.year || new Date().getFullYear() - 3;
          const currentYear = new Date().getFullYear();
          yearsExperience = Math.max(1, currentYear - startYear);
        } catch (e) {
          // Ignore
        }
      }

      return {
        name: profileInfo.full_name || emp.public_identifier || "Professional",
        headline: profileInfo.headline || profileInfo.occupation || emp.title || role,
        location: profileInfo.city || profileInfo.country_full_name || "Global",
        skills: skills,
        experience: Math.min(yearsExperience, 15), // Cap at 15 for sanity
        source: "LinkedIn (Proxycurl)",
        profileUrl: profileInfo.public_profile_url || `https://linkedin.com/in/${emp.public_identifier}`
      };
    });

  } catch (error) {
    logError("Proxycurl source failed", {
      error: error.message,
      role: role
    });
    return [];
  }
};
