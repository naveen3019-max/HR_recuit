import { useState } from "react";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Star,
  X
} from "lucide-react";
import api from "../services/api";

const scoreColor = (score) => {
  if (score >= 85) return "bg-green-100 text-green-700";
  if (score >= 70) return "bg-blue-100 text-blue-700";
  if (score >= 55) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
};

const CandidateMatching = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [skillInput, setSkillInput] = useState("");
  const [formData, setFormData] = useState({
    job_title: "",
    required_skills: [],
    minimum_experience: 0,
    location: "",
    job_description: ""
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: name === "minimum_experience" ? Number(value) : value
    }));
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (!skill || formData.required_skills.includes(skill)) {
      return;
    }

    setFormData((previous) => ({
      ...previous,
      required_skills: [...previous.required_skills, skill]
    }));
    setSkillInput("");
  };

  const removeSkill = (skill) => {
    setFormData((previous) => ({
      ...previous,
      required_skills: previous.required_skills.filter((item) => item !== skill)
    }));
  };

  const handleSkillKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSkill();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (formData.required_skills.length === 0) {
      setError("Add at least one required skill");
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const { data } = await api.post("/jobs/match-candidates", formData);
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to match candidates");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
          <Sparkles className="h-6 w-6 text-primary-600" />
          Candidate Matching
        </h1>
        <p className="mt-1 text-gray-500">Find the best open-to-work candidates for a job role with weighted AI-assisted matching.</p>
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

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Job Input Form</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Job Title *</label>
              <input type="text" name="job_title" value={formData.job_title} onChange={handleChange} placeholder="Backend Developer" className="input-field" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Required Skills *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  placeholder="Node.js, PostgreSQL, REST APIs"
                  className="input-field flex-1"
                />
                <button type="button" onClick={addSkill} className="btn-primary px-3">Add</button>
              </div>
              {formData.required_skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.required_skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-sm text-primary-700">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Minimum Experience *</label>
                <input type="number" name="minimum_experience" value={formData.minimum_experience} onChange={handleChange} min="0" max="60" className="input-field" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Location *</label>
                <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="Bangalore" className="input-field" required />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Job Description</label>
              <textarea name="job_description" value={formData.job_description} onChange={handleChange} rows={4} placeholder="Optional job description..." className="input-field" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Matching Candidates..." : "Find Top Candidates"}
            </button>
          </form>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Candidates</h2>
          {!results ? (
            <div className="flex min-h-55 flex-col items-center justify-center text-center text-gray-500">
              <Briefcase className="mb-3 h-10 w-10 text-gray-300" />
              <p>Submit a role to rank open-to-work candidates and generate AI fit explanations.</p>
            </div>
          ) : results.results.length === 0 ? (
            <div className="flex min-h-55 flex-col items-center justify-center text-center text-gray-500">
              <AlertCircle className="mb-3 h-10 w-10 text-gray-300" />
              <p>No open-to-work candidates matched this role yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary-50 p-4 text-primary-900">
                <p className="font-semibold">Top {results.results.length} candidates for {results.job_role}</p>
                <p className="mt-1 text-sm text-primary-700">Only candidates marked open to work are considered.</p>
              </div>
              {results.results.map((candidate) => (
                <div key={candidate.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{candidate.name}</h3>
                      <p className="text-sm text-gray-500">{candidate.role || "Role not specified"}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${scoreColor(candidate.match_score)}`}>
                      <Star className="h-3.5 w-3.5" />
                      {candidate.match_score}%
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Open to Work
                    </span>
                    {candidate.location && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        <MapPin className="h-3 w-3" />
                        {candidate.location}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {candidate.skills.map((skill) => (
                      <span key={skill} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    <p className="font-medium text-gray-800">AI Explanation</p>
                    <p className="mt-1 leading-6">{candidate.analysis}</p>
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

export default CandidateMatching;