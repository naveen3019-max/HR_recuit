import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, 
  Mail, 
  Linkedin, 
  Github, 
  Brain,
  Loader2,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import api from "../services/api";

const AddCandidate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    linkedin_url: "",
    github_url: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAnalyzing(false);
    setError(null);

    try {
      // Create candidate
      const candidateData = {
        name: formData.name,
        email: formData.email,
        linkedin_url: formData.linkedin_url || undefined,
        github_url: formData.github_url || undefined,
        skills: [],
        experience_years: 0,
        location: "",
      };

      const { data: candidate } = await api.post("/candidates", candidateData);
      
      // Trigger AI analysis
      setAnalyzing(true);
      try {
        await api.post(`/ai/summary/${candidate.id}`);
      } catch (aiError) {
        // AI analysis is optional, continue even if it fails
        console.warn("AI analysis failed:", aiError);
      }
      
      setSuccess(true);
      setAnalyzing(false);
      
      // Redirect to candidate report after a brief delay
      setTimeout(() => {
        navigate(`/candidates/${candidate.id}`);
      }, 1500);
      
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add candidate");
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const isValid = formData.name.trim() && formData.email.trim();

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Page Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 text-primary-600 rounded-2xl mb-4">
          <Brain className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Add New Candidate</h1>
        <p className="mt-2 text-gray-500">
          Enter candidate information and let AI analyze their profile
        </p>
      </div>

      {/* Form Card */}
      <div className="card p-5 sm:p-8">
        {success ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Candidate Added Successfully!
            </h2>
            <p className="text-gray-500">
              Redirecting to the intelligence report...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter candidate's full name"
                  className="input-field pl-12"
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="candidate@example.com"
                  className="input-field pl-12"
                  required
                />
              </div>
            </div>

            {/* LinkedIn Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LinkedIn Profile URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Linkedin className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  name="linkedin_url"
                  value={formData.linkedin_url}
                  onChange={handleChange}
                  placeholder="https://linkedin.com/in/username"
                  className="input-field pl-12"
                />
              </div>
            </div>

            {/* GitHub Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Profile URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Github className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  name="github_url"
                  value={formData.github_url}
                  onChange={handleChange}
                  placeholder="https://github.com/username"
                  className="input-field pl-12"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-gray-400">
                  AI will analyze all provided information
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full btn-primary py-4"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {analyzing ? "Analyzing with AI..." : "Creating Candidate..."}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Brain className="w-5 h-5" />
                  Analyze Candidate
                </span>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Helper Text */}
      <p className="text-center text-sm text-gray-400 mt-6">
        Our AI will analyze LinkedIn activity, GitHub contributions, and resume to generate a comprehensive candidate report.
      </p>
    </div>
  );
};

export default AddCandidate;
