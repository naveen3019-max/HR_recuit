import { useState, useEffect } from "react";
import {
  Briefcase,
  Plus,
  Loader2,
  AlertCircle,
  Brain,
  X,
  Trophy,
  Star,
  ChevronRight,
  Search
} from "lucide-react";
import api from "../services/api";

const scoreColor = (score) => {
  if (score >= 90) return "text-green-700 bg-green-100";
  if (score >= 70) return "text-blue-700 bg-blue-100";
  if (score >= 50) return "text-yellow-700 bg-yellow-100";
  return "text-gray-700 bg-gray-100";
};

const JobRoleMatching = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    required_skills: [],
    experience_required: 0,
    description: ""
  });

  const fetchRoles = async () => {
    try {
      const { data } = await api.get("/job-roles");
      setRoles(data);
    } catch {
      setError("Failed to load job roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === "experience_required" ? Number(value) : value }));
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !formData.required_skills.includes(skill)) {
      setFormData((prev) => ({ ...prev, required_skills: [...prev.required_skills, skill] }));
      setSkillInput("");
    }
  };

  const removeSkill = (skill) => {
    setFormData((prev) => ({
      ...prev,
      required_skills: prev.required_skills.filter((s) => s !== skill)
    }));
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.required_skills.length === 0) {
      setError("Add at least one required skill");
      return;
    }
    setFormLoading(true);
    setError(null);
    try {
      await api.post("/job-roles", formData);
      setFormData({ title: "", required_skills: [], experience_required: 0, description: "" });
      setShowForm(false);
      await fetchRoles();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create job role");
    } finally {
      setFormLoading(false);
    }
  };

  const getRecommendations = async (role) => {
    setSelectedRole(role);
    setMatchLoading(true);
    setRecommendations(null);
    try {
      const { data } = await api.post(`/job-roles/${role.id}/recommendations`);
      setRecommendations(data);
    } catch {
      setError("Failed to generate recommendations");
    } finally {
      setMatchLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-500">Loading job roles...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary-600" />
            Job Role Matching
          </h1>
          <p className="text-gray-500 mt-1">AI-powered candidate recommendations for open roles</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Job Role
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 text-red-700 mb-6">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Create Job Role Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Job Role</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="e.g. Senior Backend Developer" className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Required Skills *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    placeholder="Type a skill and press Enter"
                    className="input-field flex-1"
                  />
                  <button type="button" onClick={addSkill} className="btn-primary px-3">Add</button>
                </div>
                {formData.required_skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.required_skills.map((skill) => (
                      <span key={skill} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-sm">
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience Required (years)</label>
                <input type="number" name="experience_required" value={formData.experience_required} onChange={handleChange} min="0" max="60" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Job role description..." className="input-field" />
              </div>
              <button type="submit" disabled={formLoading} className="w-full btn-primary py-2.5">
                {formLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create Role"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Roles List */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Roles</h2>
          {roles.length === 0 ? (
            <div className="card p-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No job roles yet. Create your first role to start matching.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedRole?.id === role.id ? "ring-2 ring-primary-500" : ""
                  }`}
                  onClick={() => getRecommendations(role)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 truncate">{role.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {role.experience_required}+ years experience
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {role.required_skills.slice(0, 5).map((skill) => (
                          <span key={skill} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {skill}
                          </span>
                        ))}
                        {role.required_skills.length > 5 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                            +{role.required_skills.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommendations Panel */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Search className="w-5 h-5" /> AI Recommendations
          </h2>
          {!selectedRole ? (
            <div className="card p-12 text-center">
              <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Select a job role to see AI-generated candidate recommendations</p>
            </div>
          ) : matchLoading ? (
            <div className="card p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-3" />
              <p className="text-gray-500">AI is matching candidates to <strong>{selectedRole.title}</strong>...</p>
            </div>
          ) : recommendations ? (
            <div>
              <div className="card p-4 mb-4 bg-primary-50 border-primary-200">
                <h3 className="font-semibold text-primary-900">
                  Top matches for: {recommendations.job_role}
                </h3>
                <p className="text-sm text-primary-700 mt-1">
                  {recommendations.top_candidates.length} candidate{recommendations.top_candidates.length !== 1 ? "s" : ""} evaluated
                </p>
              </div>
              {recommendations.top_candidates.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-gray-500">No candidates found. Add candidates first.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.top_candidates.map((candidate, index) => (
                    <div key={candidate.id || index} className="card p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm">
                          {index === 0 ? <Trophy className="w-4 h-4 text-yellow-500" /> : index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">{candidate.name}</h4>
                          {candidate.explanation && (
                            <p className="text-sm text-gray-500 mt-0.5">{candidate.explanation}</p>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${scoreColor(candidate.match_score)}`}>
                          <Star className="w-3.5 h-3.5" />
                          {candidate.match_score}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default JobRoleMatching;
