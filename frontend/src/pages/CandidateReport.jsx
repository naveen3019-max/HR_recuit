import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Linkedin,
  Github,
  MapPin,
  Briefcase,
  Calendar,
  Brain,
  Code,
  Star,
  Target,
  TrendingUp,
  Activity,
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertTriangle,
  User,
  Award,
  Users,
  GitFork,
  Zap,
} from "lucide-react";
import api from "../services/api";

const CandidateReport = () => {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const fetchCandidate = async () => {
    try {
      const { data } = await api.get(`/candidates/${id}`);
      setCandidate(data);
      setLoading(false);
    } catch (err) {
      setError("Failed to load candidate");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidate();
  }, [id]);

  const handleReanalyze = async () => {
    setAnalyzing(true);
    try {
      await api.post(`/ai/summary/${id}`);
      await fetchCandidate();
    } catch (err) {
      console.error("Reanalysis failed:", err);
    }
    setAnalyzing(false);
  };

  const parseAIReport = (aiSummary) => {
    const defaultReport = {
      candidate_score: null,
      overview: "",
      skills: [],
      github_analysis: "",
      experience_level: "",
      strengths: [],
      concerns: [],
      recommended_roles: [],
      recruiter_summary: "",
      _github_stats: null,
    };
    if (!aiSummary) return defaultReport;
    try {
      const parsed = typeof aiSummary === "string" ? JSON.parse(aiSummary) : aiSummary;
      return { ...defaultReport, ...parsed };
    } catch {
      return { ...defaultReport, overview: aiSummary, recruiter_summary: aiSummary };
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-400", bar: "bg-emerald-500" };
    if (score >= 6) return { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-400", bar: "bg-blue-500" };
    if (score >= 4) return { bg: "bg-yellow-50", text: "text-yellow-700", ring: "ring-yellow-400", bar: "bg-yellow-500" };
    return { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-400", bar: "bg-red-500" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 mb-4">{error}</p>
        <Link to="/candidates" className="btn-secondary">Back to Candidates</Link>
      </div>
    );
  }

  const aiSummary = candidate?.ai_summary || candidate?.aiSummary;
  const candidateSkills = candidate?.skills || [];
  const hasReport = !!aiSummary;
  const report = parseAIReport(aiSummary);
  const displaySkills = report.skills?.length > 0 ? report.skills : candidateSkills;
  const score = report.candidate_score;
  const scoreColors = score != null ? getScoreColor(score) : null;
  const stats = report._github_stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/candidates" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Candidate Intelligence Report</h1>
          <p className="text-sm text-gray-500">AI-powered analysis and insights</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 sm:gap-6">
          <div className="flex items-start gap-4">
            {/* Avatar + Score badge */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 sm:w-20 sm:h-20 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-semibold">
                {candidate?.name?.charAt(0).toUpperCase() || "?"}
              </div>
              {score != null && (
                <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full ${scoreColors.bg} ${scoreColors.text} ring-2 ${scoreColors.ring} flex items-center justify-center text-xs font-bold`}>
                  {score.toFixed(1)}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900">{candidate?.name}</h2>
              <p className="text-gray-500 mt-1">
                {candidate?.current_role || candidate?.currentRole || "Candidate"}
                {(candidate?.current_company || candidate?.currentCompany) && (
                  <span> at {candidate?.current_company || candidate?.currentCompany}</span>
                )}
              </p>

              {report.experience_level && (
                <span className="inline-flex items-center mt-2 px-3 py-1 text-sm font-medium bg-purple-100 text-purple-700 rounded-full">
                  <Award className="w-4 h-4 mr-1" />
                  {report.experience_level}
                </span>
              )}

              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3">
                {candidate?.email && (
                  <a href={`mailto:${candidate.email}`} className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 hover:text-primary-600 transition-colors">
                    <Mail className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate max-w-40 sm:max-w-none">{candidate.email}</span>
                  </a>
                )}
                {candidate?.location && (
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />{candidate.location}
                  </span>
                )}
                {candidate?.experience_years > 0 && (
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <Briefcase className="w-4 h-4" />{candidate.experience_years} years exp
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                {candidate?.linkedin_url && (
                  <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    <Linkedin className="w-4 h-4" />LinkedIn<ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {candidate?.github_url && (
                  <a href={candidate.github_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    <Github className="w-4 h-4" />GitHub<ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button onClick={handleReanalyze} disabled={analyzing} className="btn-secondary w-full md:w-auto text-sm px-3 py-2">
              {analyzing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" />Re-analyze</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* AI Analysis Section */}
      {hasReport ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">

            {/* 1. Candidate Score */}
            {score != null && (
              <div className={`card p-6 ${scoreColors.bg} border border-opacity-30`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">AI Candidate Score</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-5xl font-bold ${scoreColors.text}`}>{score.toFixed(1)}</span>
                      <span className="text-xl text-gray-400 font-medium">/ 10</span>
                    </div>
                  </div>
                  <div className={`p-4 rounded-2xl ${scoreColors.text} bg-white bg-opacity-70`}>
                    <Zap className="w-8 h-8" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-white bg-opacity-60 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full ${scoreColors.bar} transition-all duration-700`} style={{ width: `${(score / 10) * 100}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* 2. Recruiter Summary */}
            {report.recruiter_summary && (
              <div className="card p-6 bg-linear-to-r from-primary-50 to-purple-50 border-primary-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-white shadow-sm">
                    <User className="w-5 h-5 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Recruiter Summary</h3>
                </div>
                <p className="text-gray-700 leading-relaxed">{report.recruiter_summary}</p>
              </div>
            )}

            {/* 3. Candidate Overview */}
            {report.overview && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                    <Brain className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Candidate Overview</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">{report.overview}</p>
              </div>
            )}

            {/* 4. Recommended Roles */}
            {report.recommended_roles?.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                    <Target className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Recommended Roles</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {report.recommended_roles.map((role, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                      <TrendingUp className="w-3.5 h-3.5" />{role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Skills Detected */}
            {displaySkills.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                    <Code className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Skills Detected</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {displaySkills.map((skill, i) => (
                    <span key={i} className="px-3 py-1.5 text-sm font-medium bg-primary-50 text-primary-700 rounded-lg">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 6. GitHub Analysis */}
            {(report.github_analysis || stats) && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">GitHub Analysis</h3>
                </div>

                {report.github_analysis && report.github_analysis !== "GitHub analysis not available" && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-5">{report.github_analysis}</p>
                )}

                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                        <GitFork className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wide">Repos</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900">{stats.repository_count ?? "—"}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-yellow-500 mb-1">
                        <Star className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wide">Stars</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900">{stats.total_stars ?? "—"}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-blue-500 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wide">Followers</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900">{stats.followers ?? "—"}</p>
                    </div>

                    {stats.primary_languages?.length > 0 && (
                      <div className="col-span-2 sm:col-span-3 bg-indigo-50 rounded-xl p-3">
                        <p className="text-xs uppercase tracking-wide text-indigo-400 mb-2">Top Languages</p>
                        <div className="flex flex-wrap gap-1.5">
                          {stats.primary_languages.map((lang, i) => (
                            <span key={i} className="px-2 py-0.5 text-xs font-medium bg-white text-indigo-700 rounded-md border border-indigo-100">{lang}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {stats.most_starred_repo && (
                      <div className="col-span-2 sm:col-span-3 bg-amber-50 rounded-xl p-3">
                        <p className="text-xs uppercase tracking-wide text-amber-500 mb-1">Top Project</p>
                        <p className="font-semibold text-gray-800">{stats.most_starred_repo.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {stats.most_starred_repo.language || "N/A"} &middot; ⭐ {stats.most_starred_repo.stars} stars
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 7. Key Strengths */}
            {report.strengths?.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-green-100 text-green-600">
                    <Star className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Key Strengths</h3>
                </div>
                <div className="space-y-3">
                  {report.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 shrink-0" />
                      <span className="text-gray-700">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. Potential Concerns */}
            {report.concerns?.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Potential Concerns</h3>
                </div>
                <div className="space-y-3">
                  {report.concerns.map((c, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 shrink-0" />
                      <span className="text-gray-700">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* 9. Experience Level */}
            {report.experience_level && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                    <Award className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Experience Level</h3>
                </div>
                <div className="text-center py-4">
                  <span className="inline-flex items-center px-4 py-2 text-lg font-semibold bg-indigo-50 text-indigo-700 rounded-xl">
                    {report.experience_level}
                  </span>
                </div>
              </div>
            )}

            {/* Pipeline Status */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary-100 text-primary-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Pipeline Status</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Stage</span>
                  <span className="px-3 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full">
                    {candidate?.recruitment_stage?.replace("_", " ") || "Applied"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Added</span>
                  <span className="text-sm text-gray-700">
                    {candidate?.created_at ? new Date(candidate.created_at).toLocaleDateString() : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 text-gray-400 rounded-full mb-4">
            <Brain className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No AI Analysis Yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Click the button below to generate an AI-powered analysis of this candidate's profile, skills, and potential role fit.
          </p>
          <button onClick={handleReanalyze} disabled={analyzing} className="btn-primary">
            {analyzing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating Report...</>
            ) : (
              <><Brain className="w-4 h-4 mr-2" />Generate AI Report</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default CandidateReport;
