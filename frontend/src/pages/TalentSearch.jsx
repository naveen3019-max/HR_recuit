import { useMemo, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  Download,
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
  if (score >= 85) return "bg-green-100 text-green-700";
  if (score >= 70) return "bg-blue-100 text-blue-700";
  if (score >= 55) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
};

const TalentSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
  const [skillInput, setSkillInput] = useState("");
  const [savingMatchId, setSavingMatchId] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [formData, setFormData] = useState({
    role: "",
    experience_required: "",
    location: "",
    skills: [],
    industry: "",
    additional_requirements: ""
  });

  const hasResults = useMemo(() => results.length > 0, [results]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (!skill || formData.skills.includes(skill)) {
      return;
    }

    setFormData((previous) => ({
      ...previous,
      skills: [...previous.skills, skill]
    }));
    setSkillInput("");
  };

  const removeSkill = (skillToRemove) => {
    setFormData((previous) => ({
      ...previous,
      skills: previous.skills.filter((skill) => skill !== skillToRemove)
    }));
  };

  const handleSkillKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSkill();
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data } = await api.post("/talent/search", formData);
      setResults(data.results || []);
      setSearchMeta({
        search_id: data.search_id,
        role: data.role,
        total_candidates: data.total_candidates,
        searched_at: data.searched_at
      });

      const draftSeed = {};
      (data.results || []).forEach((item) => {
        draftSeed[item.match_id] = item.notes || "";
      });
      setNoteDrafts(draftSeed);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to search talent");
    } finally {
      setLoading(false);
    }
  };

  const updateMatch = async (matchId, payload) => {
    setSavingMatchId(matchId);
    try {
      const { data } = await api.patch(`/talent/matches/${matchId}`, payload);
      setResults((previous) => previous.map((item) => (item.match_id === matchId ? data : item)));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update candidate action");
    } finally {
      setSavingMatchId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
          <Sparkles className="h-6 w-6 text-primary-600" />
          Talent Search
        </h1>
        <p className="mt-1 text-gray-500">
          Describe a role and get AI-ranked open-to-work candidates from recruiter-imported profiles.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Job Description Input</h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Role *</label>
              <input
                type="text"
                name="role"
                value={formData.role}
                onChange={handleChange}
                placeholder="Backend Developer"
                className="input-field"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Experience</label>
                <input
                  type="text"
                  name="experience_required"
                  value={formData.experience_required}
                  onChange={handleChange}
                  placeholder="3-5 years"
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Bangalore"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Skills</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  placeholder="Node.js, AWS, PostgreSQL"
                  className="input-field flex-1"
                />
                <button type="button" onClick={addSkill} className="btn-primary px-3">
                  Add
                </button>
              </div>
              {formData.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-sm text-primary-700"
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Industry</label>
              <input
                type="text"
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                placeholder="SaaS"
                className="input-field"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Additional Requirements</label>
              <textarea
                name="additional_requirements"
                value={formData.additional_requirements}
                onChange={handleChange}
                rows={3}
                placeholder="API design, microservices, distributed systems..."
                className="input-field"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Searching Candidates..." : "Search Candidates"}
            </button>
          </form>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Ranked Candidates</h2>

          {!hasResults && !loading ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-center text-gray-500">
              <Briefcase className="mb-3 h-10 w-10 text-gray-300" />
              <p>Run a search to see AI-ranked open-to-work candidates.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {searchMeta && (
                <div className="rounded-xl bg-primary-50 p-4 text-primary-900">
                  <p className="font-semibold">{searchMeta.total_candidates} candidates ranked for {searchMeta.role}</p>
                  <p className="mt-1 text-sm text-primary-700">Search ID: {searchMeta.search_id}</p>
                </div>
              )}

              {results.map((candidate) => (
                <div key={candidate.match_id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{candidate.candidate_name}</h3>
                      <p className="text-sm text-gray-500">{candidate.current_role || "Role not specified"}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${scorePill(candidate.match_score)}`}>
                      <Star className="h-3.5 w-3.5" />
                      {candidate.match_score}%
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                    <p className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {candidate.location || "Location not specified"}
                    </p>
                    <p>Experience: {candidate.experience_years} years</p>
                    <p>Role Fit: {candidate.role_fit || "Not specified"}</p>
                    <p>Recommended Role: {candidate.recommended_role || "N/A"}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {candidate.skills?.map((skill) => (
                      <span key={skill} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    <p className="font-medium text-gray-800">AI Summary</p>
                    <p className="mt-1 leading-6">{candidate.summary}</p>
                    {candidate.strengths?.length > 0 && (
                      <p className="mt-2 text-xs text-gray-500">Strengths: {candidate.strengths.join(", ")}</p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={savingMatchId === candidate.match_id}
                      onClick={() => updateMatch(candidate.match_id, { shortlisted: !candidate.shortlisted })}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                        candidate.shortlisted
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      <UserCheck className="h-4 w-4" />
                      {candidate.shortlisted ? "Shortlisted" : "Shortlist"}
                    </button>

                    <button
                      type="button"
                      disabled={savingMatchId === candidate.match_id}
                      onClick={() => updateMatch(candidate.match_id, { exported: true })}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                        candidate.exported
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      <Download className="h-4 w-4" />
                      {candidate.exported ? "Exported" : "Export"}
                    </button>

                    {candidate.linkedin_url && (
                      <a
                        href={candidate.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        LinkedIn Profile
                      </a>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <textarea
                      value={noteDrafts[candidate.match_id] || ""}
                      onChange={(event) =>
                        setNoteDrafts((previous) => ({
                          ...previous,
                          [candidate.match_id]: event.target.value
                        }))
                      }
                      placeholder="Add recruiter notes..."
                      className="input-field min-h-20"
                    />
                    <button
                      type="button"
                      disabled={savingMatchId === candidate.match_id}
                      onClick={() => updateMatch(candidate.match_id, { notes: noteDrafts[candidate.match_id] || "" })}
                      className="btn-secondary h-fit"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TalentSearch;
