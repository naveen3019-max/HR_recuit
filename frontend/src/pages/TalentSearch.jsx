import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Briefcase, Filter, Loader2, MapPin, Save, Star, UserCheck, X } from "lucide-react";
import api from "../services/api";

const scorePill = (score) => {
  if (score >= 85) return "bg-emerald-100 text-emerald-700";
  if (score >= 70) return "bg-sky-100 text-sky-700";
  if (score >= 55) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};

const TalentSearch = () => {
  const [loading, setLoading] = useState(false);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState("");
  const [error, setError] = useState(null);
  const [linkedinError, setLinkedinError] = useState(null);
  const [linkedinLoading, setLinkedinLoading] = useState(true);
  const [linkedinSaveLoading, setLinkedinSaveLoading] = useState(null);
  const [linkedinCandidates, setLinkedinCandidates] = useState([]);
  const [linkedinMatches, setLinkedinMatches] = useState([]);
  const [linkedinSearchActive, setLinkedinSearchActive] = useState(false);
  const [linkedinSearchMessage, setLinkedinSearchMessage] = useState("Waiting to start");
  const [searchRequestId, setSearchRequestId] = useState(null);
  const [results, setResults] = useState([]);
  const [savingMatchId, setSavingMatchId] = useState(null);
  const [skillInput, setSkillInput] = useState("");
  const [lastGlobalPayload, setLastGlobalPayload] = useState(null);

  const [formData, setFormData] = useState({
    role: "",
    experience_required: "",
    location: "",
    skills: [],
    industry: "",
    additional_requirements: ""
  });

  const [filters, setFilters] = useState({
    minScore: 0,
    location: "",
    skill: ""
  });

  const getPreparedSkills = () => {
    const typed = skillInput.trim();
    const merged = typed ? [...formData.skills, typed] : [...formData.skills];
    return Array.from(new Set(merged.map((skill) => skill.trim()).filter(Boolean)));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (!skill || formData.skills.includes(skill)) return;
    setFormData((prev) => ({ ...prev, skills: [...prev.skills, skill] }));
    setSkillInput("");
  };

  const removeSkill = (skillToRemove) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove)
    }));
  };

  const handleSkillKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSkill();
    }
  };

  const loadLinkedinCandidates = async () => {
    setLinkedinLoading(true);
    setLinkedinError(null);
    try {
      const { data } = await api.get("/linkedin/recent-analysis");
      const candidates = data?.candidates || [];
      setLinkedinCandidates(candidates);
      setLinkedinMatches(candidates);
      if (candidates.length > 0) {
        setLinkedinSearchMessage("LinkedIn candidates received");
      }
    } catch (err) {
      setLinkedinError(err.response?.data?.message || "Failed to load LinkedIn analysis");
    } finally {
      setLinkedinLoading(false);
    }
  };

  useEffect(() => {
    loadLinkedinCandidates();
  }, []);

  const pollerRef = useRef(null);
  const statusPollerRef = useRef(null);

  const startLinkedinPolling = () => {
    if (pollerRef.current) return;
    pollerRef.current = setInterval(() => {
      loadLinkedinCandidates();
    }, 5000);
  };

  const stopLinkedinPolling = () => {
    if (!pollerRef.current) return;
    clearInterval(pollerRef.current);
    pollerRef.current = null;
  };

  const stopStatusPolling = () => {
    if (!statusPollerRef.current) return;
    clearInterval(statusPollerRef.current);
    statusPollerRef.current = null;
  };

  const loadLinkedinSearchStatus = async (requestId) => {
    if (!requestId) return;

    try {
      const { data } = await api.get(`/linkedin/search-status/${requestId}`);
      const search = data?.search;
      if (!search) return;

      if (search.status === "pending") {
        setLinkedinSearchMessage("Queued for extension processing...");
      }

      if (search.status === "processing") {
        setLinkedinSearchMessage("Searching LinkedIn for candidates...");
      }

      if (search.status === "completed") {
        setLinkedinSearchMessage(`Search complete: ${search.processed_count || 0} profile(s) processed`);
        setLinkedinSearchActive(false);
        setLinkedinLoading(false);
        stopStatusPolling();
      }

      if (search.status === "failed") {
        setLinkedinError(search.error || "LinkedIn background search failed");
        setLinkedinSearchActive(false);
        setLinkedinLoading(false);
        stopStatusPolling();
      }
    } catch {
      // Keep polling silently; recent-analysis polling still updates cards.
    }
  };

  const startStatusPolling = (requestId) => {
    if (!requestId) return;
    stopStatusPolling();
    loadLinkedinSearchStatus(requestId);
    statusPollerRef.current = setInterval(() => {
      loadLinkedinSearchStatus(requestId);
    }, 5000);
  };

  useEffect(() => {
    return () => {
      stopLinkedinPolling();
      stopStatusPolling();
    };
  }, []);

  const handleSearch = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    setLinkedinError(null);
    setLinkedinSearchMessage("Searching LinkedIn for candidates...");

    try {
      const payload = {
        role: formData.role.trim(),
        skills: getPreparedSkills(),
        location: formData.location.trim()
      };

      const { data } = await api.post("/linkedin/start-search", payload);
      setSearchRequestId(data.request_id || null);
      setLinkedinSearchActive(true);
      setLinkedinLoading(true);
      startLinkedinPolling();
      startStatusPolling(data.request_id || null);
      setLinkedinSearchMessage(data.message || "Searching LinkedIn for candidates...");
      if (data.extension_online === false) {
        setLinkedinError("LinkedIn extension is offline. Open Chrome extension and verify backend URL/API key.");
      }
    } catch (err) {
      setLinkedinError(err.response?.data?.message || "Failed to start LinkedIn background search");
      setLinkedinSearchActive(false);
      stopLinkedinPolling();
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalSearch = async (event) => {
    event.preventDefault();
    setError(null);
    setGlobalSearching(true);
    setGlobalLoadingMessage("Scanning global talent...");
    let analyzingTimer;

    try {
      const payload = {
        role: formData.role.trim(),
        skills: getPreparedSkills(),
        location: formData.location.trim(),
        experience_required: Number(formData.experience_required.match(/\d+/)?.[0] || 0)
      };
      setLastGlobalPayload(payload);

      analyzingTimer = setTimeout(() => {
        setGlobalLoadingMessage("AI analyzing candidates...");
      }, 900);

      const { data } = await api.post("/talent/global-search", payload);
      clearTimeout(analyzingTimer);

      const normalized = (data?.results || []).map((item, index) => ({
        name: item.name,
        headline: item.headline,
        location: item.location || "Global",
        score: Number(item.score || 0),
        recommendation: item.score >= 75 ? "Strong Fit" : item.score >= 50 ? "Moderate" : "Low",
        reason: item.summary,
        source: item.source || "Global Talent",
        profile_url: item.profileUrl || null,
        globalId: `${item.name}-${item.source}-${index}`
      }));

      setLinkedinMatches(normalized);
      setLinkedinCandidates(normalized);
      setResults([]);
      setLinkedinSearchActive(false);
      stopLinkedinPolling();
      stopStatusPolling();
      setLinkedinSearchMessage(data?.message || "Global talent search completed");
    } catch (err) {
      if (analyzingTimer) clearTimeout(analyzingTimer);
      setError(err.response?.data?.message || "Global search failed. Please retry.");
    } finally {
      if (analyzingTimer) clearTimeout(analyzingTimer);
      setGlobalSearching(false);
      setGlobalLoadingMessage("");
    }
  };

  const refreshGlobalSearch = async () => {
    if (!lastGlobalPayload) return;
    setError(null);
    setGlobalSearching(true);
    setGlobalLoadingMessage("Scanning global talent...");

    try {
      const { data } = await api.post("/talent/global-search", lastGlobalPayload);
      const normalized = (data?.results || []).map((item, index) => ({
        name: item.name,
        headline: item.headline,
        location: item.location || "Global",
        score: Number(item.score || 0),
        recommendation: item.score >= 75 ? "Strong Fit" : item.score >= 50 ? "Moderate" : "Low",
        reason: item.summary,
        source: item.source || "Global Talent",
        profile_url: item.profileUrl || null,
        globalId: `${item.name}-${item.source}-${index}`
      }));

      setLinkedinMatches(normalized);
      setLinkedinCandidates(normalized);
      setLinkedinSearchMessage(data?.message || "Global talent search refreshed");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to refresh global search.");
    } finally {
      setGlobalSearching(false);
      setGlobalLoadingMessage("");
    }
  };

  const updateMatch = async (matchId, payload) => {
    setSavingMatchId(matchId);
    setError(null);
    try {
      const { data } = await api.patch(`/talent/matches/${matchId}`, payload);
      setResults((prev) => prev.map((item) => (item.match_id === matchId ? data : item)));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update candidate action");
    } finally {
      setSavingMatchId(null);
    }
  };

  const saveLinkedinCandidate = async (candidate, index) => {
    setLinkedinSaveLoading(index);
    setLinkedinError(null);
    try {
      await api.post("/candidates/add", {
        name: candidate.name,
        headline: candidate.headline,
        location: candidate.location,
        skills: candidate.skills || [],
        experience: Number(candidate.experience || 0),
        score: Number(candidate.score || 0)
      });
    } catch (err) {
      setLinkedinError(err.response?.data?.message || "Failed to save candidate");
    } finally {
      setLinkedinSaveLoading(null);
    }
  };

  const filteredResults = useMemo(() => {
    return results.filter((candidate) => {
      if (candidate.match_score < Number(filters.minScore || 0)) return false;

      if (filters.location.trim()) {
        const candidateLocation = String(candidate.location || "").toLowerCase();
        if (!candidateLocation.includes(filters.location.trim().toLowerCase())) {
          return false;
        }
      }

      if (filters.skill.trim()) {
        const wantedSkill = filters.skill.trim().toLowerCase();
        const hasSkill = (candidate.skills || []).some((skill) => String(skill).toLowerCase().includes(wantedSkill));
        if (!hasSkill) return false;
      }

      return true;
    });
  }, [results, filters]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-6 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-300">AI Recruitment</p>
            <h1 className="mt-2 text-3xl font-semibold">Global Talent Discovery Engine 🌍</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-200">
              Search real global candidates from public sources and internal talent, then rank them with AI.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <button
              type="button"
              onClick={handleGlobalSearch}
              disabled={globalSearching || getPreparedSkills().length === 0 || !formData.role.trim()}
              className="btn-primary px-6 py-3 text-sm"
            >
              {globalSearching ? "Searching Global Talent..." : "Find Global Talent 🌍"}
            </button>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  linkedinLoading
                    ? "bg-yellow-300 animate-pulse"
                    : linkedinMatches.length > 0
                      ? "bg-emerald-400"
                      : "bg-slate-400"
                }`}
              />
              <span>
                {linkedinLoading
                  ? "Scanning global talent..."
                  : linkedinMatches.length > 0
                    ? "Candidates found"
                    : linkedinSearchMessage}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_1.9fr]">
          <form id="talent-search-form" onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
              <input
                type="text"
                name="role"
                value={formData.role}
                onChange={handleChange}
                placeholder="Backend Developer"
                className="input-field rounded-xl"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Skills</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  placeholder="Node.js, AWS"
                  className="input-field rounded-xl"
                />
                <button type="button" onClick={addSkill} className="btn-secondary px-4">
                  Add
                </button>
              </div>
              {formData.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700"
                    >
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Bangalore"
                className="input-field rounded-xl"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Experience Required</label>
              <input
                type="text"
                name="experience_required"
                value={formData.experience_required}
                onChange={handleChange}
                placeholder="3-5 years"
                className="input-field rounded-xl"
                required
              />
            </div>

            {globalSearching && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-medium text-sky-700">
                {globalLoadingMessage || "Scanning global talent..."}
              </div>
            )}
          </form>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Global Talent Results</h2>
                <p className="text-sm text-gray-500">AI-ranked candidates aggregated across internal and global sources.</p>
              </div>
              <button type="button" onClick={refreshGlobalSearch} className="btn-secondary px-3 py-2 text-xs" disabled={!lastGlobalPayload || globalSearching}>
                Refresh
              </button>
            </div>

            {linkedinError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {linkedinError}
              </div>
            )}

            {linkedinLoading ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing profiles... candidates will appear shortly
              </div>
            ) : linkedinMatches.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                {linkedinSearchActive ? "Searching talent sources..." : "Use Find Global Talent to discover candidates worldwide"}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {linkedinMatches.map((candidate, index) => (
                  <article
                    key={candidate.globalId || `${candidate.name}-${index}`}
                    className={`rounded-2xl border bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                      index < 3 ? "border-emerald-200 ring-1 ring-emerald-100" : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{candidate.name}</h3>
                        <p className="mt-1 text-sm text-gray-500">{candidate.headline || "Headline not available"}</p>
                        <p className="mt-2 text-xs text-gray-500">{candidate.location || "Location not provided"}</p>
                        {candidate.source && (
                          <span className="mt-2 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                            Source: {candidate.source}
                          </span>
                        )}
                      </div>
                      <div className={`rounded-2xl px-3 py-2 text-center ${scorePill(Number(candidate.score || 0))}`}>
                        <p className="text-xl font-extrabold leading-none">{Number(candidate.score || 0)}%</p>
                        <p className="mt-1 text-[11px] font-semibold">Match</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                      <p className="font-semibold text-gray-900">{candidate.recommendation}</p>
                      <p className="mt-1 max-h-10 overflow-hidden text-xs text-gray-600">{candidate.reason}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {candidate.linkedin_url || candidate.profile_url ? (
                        <a
                          href={candidate.linkedin_url || candidate.profile_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary px-3 py-2 text-xs"
                        >
                          View Profile
                        </a>
                      ) : (
                        <span className="btn-secondary px-3 py-2 text-xs opacity-60">View Profile</span>
                      )}
                      <button
                        type="button"
                        onClick={() => saveLinkedinCandidate(candidate, index)}
                        disabled={linkedinSaveLoading === index || candidate.source !== "Internal"}
                        className="btn-primary px-3 py-2 text-xs"
                      >
                        {linkedinSaveLoading === index ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span className="ml-2">{candidate.source === "Internal" ? "Save Candidate" : "Imported"}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      
    </div>
  );
};

export default TalentSearch;
