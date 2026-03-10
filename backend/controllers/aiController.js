import prisma from "../config/db.js";
import { generateCandidateSummary } from "../services/aiService.js";

export const generateCandidateSummaryHandler = async (req, res, next) => {
  try {
    const summary = await generateCandidateSummary(req.validated.body);
    const { candidateId } = req.validated.body;

    if (candidateId) {
      await prisma.candidate.update({
        where: { id: Number(candidateId) },
        data: { summary }
      });
    }

    return res.json({ summary });
  } catch (error) {
    return next(error);
  }
};

export const generateSummaryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Fetch candidate from database
    const candidate = await prisma.candidate.findUnique({
      where: { id: Number(id) }
    });
    
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    // Build candidate object for AI service
    const candidateData = {
      name: candidate.name,
      email: candidate.email,
      linkedin_url: candidate.linkedinUrl,
      github_url: candidate.githubUrl,
      skills: candidate.skills,
      experience_years: candidate.experienceYears,
      location: candidate.location,
      current_role: candidate.currentRole,
      current_company: candidate.currentCompany
    };
    
    const summary = await generateCandidateSummary(candidateData);
    
    // Update candidate with the summary
    await prisma.candidate.update({
      where: { id: Number(id) },
      data: { summary }
    });
    
    return res.json({ summary });
  } catch (error) {
    return next(error);
  }
};
