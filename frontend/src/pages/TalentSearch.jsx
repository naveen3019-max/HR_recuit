import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Briefcase,
  Filter,
  Loader2,
  MapPin,
  Save,
  Search,
  Sparkles,
  Star,
  UserCheck,
  X
} from "lucide-react";
import api from "../services/api";

const scorePill = (score) => {
  if (score >= 85) return "bg-emerald-100 text-emerald-700";
  if (score >= 70) return "bg-sky-100 text-sky-700";
  if (score >= 55) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};

const TalentSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
  const [savingMatchId, setSavingMatchId] = useState(null);

  const [formData, setFormData] = useState({
    recruiter_access_token: "",
    linkedin_profile_ids: [],
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        recruiter_access_token: formData.recruiter_access_token,
        linkedin_profile_ids: formData.linkedin_profile_ids.map((id) => id.trim()).filter(Boolean)
      };

      const { data } = await api.post("/talent/search", payload);
      setResults(data.results || []);
      setSearchMeta({
        search_id: data.search_id,
        source: data.source,
        role: data.role,
        total_candidates: data.total_candidates,
        searched_at: data.searched_at
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to search talent");
    } finally {
      setLoading(false);
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
      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
              <Sparkles className="h-6 w-6 text-primary-600" />
              Talent Search
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Fetch candidates directly from backend using LinkedIn Developer API credentials.
            </p>
          </div>
          {searchMeta && (
            <div className="rounded-xl bg-primary-50 px-4 py-3 text-right text-primary-800">
              <p className="text-sm font-semibold">Top {searchMeta.total_candidates} candidates</p>
              <p className="text-xs">Search ID: {searchMeta.search_id}</p>
              <p className="text-xs">Source: LinkedIn API</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
            <button type="button" onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSearch} className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">LinkedIn Recruiter Access Token</label>
            <input
              type="password"
              name="recruiter_access_token"
              value={formData.recruiter_access_token}
              onChange={handleChange}
              placeholder="Paste LinkedIn developer access token"
              className="input-field"
              required
            />
            <p className="mt-1 text-xs text-gray-500">Paste LinkedIn developer access token</p>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">LinkedIn Profile IDs</label>
            <textarea
              value={formData.linkedin_profile_ids.join("\n")}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  linkedin_profile_ids: event.target.value
                    .split(/[\n,]/)
                    .map((id) => id.trim())
                    .filter(Boolean)
                }))
              }
              rows={4}
              placeholder="Enter profile IDs, one per line"
              className="input-field"
              required
            />
          </div>

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={loading || !formData.recruiter_access_token || formData.linkedin_profile_ids.length === 0}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Fetching..." : "Fetch from Backend"}
            </button>
          </div>
        </form>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Ranked Candidate Results</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.minScore}
              onChange={(event) => setFilters((prev) => ({ ...prev, minScore: event.target.value }))}
              placeholder="Min score"
              className="input-field w-28"
            />
            <input
              type="text"
              value={filters.location}
              onChange={(event) => setFilters((prev) => ({ ...prev, location: event.target.value }))}
              placeholder="Location"
              className="input-field w-36"
            />
            <input
              type="text"
              value={filters.skill}
              onChange={(event) => setFilters((prev) => ({ ...prev, skill: event.target.value }))}
              placeholder="Skill"
              className="input-field w-32"
            />
          </div>
        </div>

        {filteredResults.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center text-gray-500">
            <Briefcase className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm">No candidates to display. Run a search or adjust filters.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredResults.map((candidate) => (
              <article key={candidate.match_id} className="rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{candidate.candidate_name}</h3>
                    <p className="mt-0.5 text-sm text-gray-500">{candidate.current_role || "Role not specified"}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${scorePill(candidate.match_score)}`}>
                    <Star className="h-3.5 w-3.5" />
                    {candidate.match_score}%
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <p>Experience: {candidate.experience_years} years</p>
                  <p className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {candidate.location || "N/A"}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(candidate.skills || []).slice(0, 6).map((skill) => (
                    <span key={`${candidate.match_id}-${skill}`} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="mt-3 rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">AI Summary</p>
                  <p className="mt-1 text-sm text-gray-700">{candidate.candidate_summary}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/candidates/${candidate.candidate_id}`} className="btn-secondary px-3 py-2 text-sm">
                    View Profile
                  </Link>

                  <button
                    type="button"
                    onClick={() => updateMatch(candidate.match_id, { shortlisted: !candidate.shortlisted })}
                    disabled={savingMatchId === candidate.match_id}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                      candidate.shortlisted
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    <UserCheck className="h-4 w-4" />
                    {candidate.shortlisted ? "Shortlisted" : "Shortlist Candidate"}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateMatch(candidate.match_id, { exported: !candidate.saved })}
                    disabled={savingMatchId === candidate.match_id}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                      candidate.saved
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    <Save className="h-4 w-4" />
                    {candidate.saved ? "Saved" : "Save Candidate"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default TalentSearch;
