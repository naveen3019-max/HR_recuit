import { useState, useEffect } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Loader2,
  AlertCircle,
  Brain,
  User,
  Mail,
  Linkedin,
  Github,
  Briefcase,
  X,
  Activity,
  Lightbulb,
  Zap,
  Search,
  Globe
} from "lucide-react";
import api from "../services/api";

const riskColors = {
  HIGH: { bg: "bg-red-50", text: "text-red-700", badge: "bg-red-100 text-red-700", icon: ShieldAlert },
  MEDIUM: { bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700", icon: Shield },
  LOW: { bg: "bg-green-50", text: "text-green-700", badge: "bg-green-100 text-green-700", icon: ShieldCheck }
};

const EmployeeMonitoring = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [jobSearchId, setJobSearchId] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    linkedin_url: "",
    github_url: "",
    current_role: "",
    salary: ""
  });

  const fetchEmployees = async () => {
    try {
      const { data } = await api.get("/employees");
      setEmployees(data);
    } catch (err) {
      setError("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        linkedin_url: formData.linkedin_url,
        github_url: formData.github_url || undefined,
        current_role: formData.current_role || undefined,
        salary: formData.salary ? Number(formData.salary) : undefined
      };
      await api.post("/employees", payload);
      setFormData({ name: "", email: "", linkedin_url: "", github_url: "", current_role: "", salary: "" });
      setShowForm(false);
      await fetchEmployees();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add employee");
    } finally {
      setFormLoading(false);
    }
  };

  const analyzeRisk = async (id) => {
    setAnalyzingId(id);
    try {
      const { data } = await api.post(`/employees/analyze-risk/${id}`);
      setEmployees((prev) => prev.map((e) => (e.id === id ? data : e)));
    } catch (err) {
      setError("Risk analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  const analyzeJobSearch = async (id) => {
    setJobSearchId(id);
    try {
      const { data } = await api.post(`/employees/analyze-job-risk/${id}`);
      setEmployees((prev) => prev.map((e) => (e.id === id ? data : e)));
    } catch (err) {
      setError("Job search detection failed");
    } finally {
      setJobSearchId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-500">Loading employees...</span>
      </div>
    );
  }

  const highRisk = employees.filter((e) => e.risk_level === "HIGH").length;
  const mediumRisk = employees.filter((e) => e.risk_level === "MEDIUM").length;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary-600" />
            Employee Monitoring
          </h1>
          <p className="text-gray-500 mt-1">AI-powered job search risk detection</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{employees.length}</p>
            <p className="text-sm text-gray-500">Total Employees</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-red-700">{highRisk}</p>
            <p className="text-sm text-gray-500">High Risk</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-yellow-700">{mediumRisk}</p>
            <p className="text-sm text-gray-500">Medium Risk</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 text-red-700 mb-6">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Add Employee Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Employee</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" className="input-field pl-10" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="john@company.com" className="input-field pl-10" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Role</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" name="current_role" value={formData.current_role} onChange={handleChange} placeholder="Software Engineer" className="input-field pl-10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL *</label>
                  <div className="relative">
                    <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="url" name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} placeholder="https://linkedin.com/in/..." className="input-field pl-10" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GitHub URL</label>
                  <div className="relative">
                    <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="url" name="github_url" value={formData.github_url} onChange={handleChange} placeholder="https://github.com/..." className="input-field pl-10" />
                  </div>
                </div>
              </div>
              <button type="submit" disabled={formLoading} className="w-full btn-primary py-2.5">
                {formLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Add Employee"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Employee List */}
      {employees.length === 0 ? (
        <div className="card p-12 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No employees added yet. Add your first employee to start monitoring.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {employees.map((emp) => {
            const risk = riskColors[emp.risk_level] || riskColors.LOW;
            const RiskIcon = risk.icon;
            const isAnalyzing = analyzingId === emp.id;
            const isSearching = jobSearchId === emp.id;

            return (
              <div key={emp.id} className="card p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Employee Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{emp.name}</h3>
                      {emp.risk_level && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${risk.badge}`}>
                          <RiskIcon className="w-3 h-3" />
                          {emp.risk_level}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{emp.current_role || "No role specified"}</p>
                    <p className="text-sm text-gray-400">{emp.email}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {emp.linkedin_url && (
                        <a href={emp.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                          <Linkedin className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {emp.github_url && (
                        <a href={emp.github_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700">
                          <Github className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Risk Score & Actions */}
                  <div className="flex items-center gap-3">
                    {emp.risk_score !== null && emp.risk_score !== undefined && (
                      <div className="text-center">
                        <p className={`text-3xl font-bold ${risk.text}`}>{emp.risk_score}</p>
                        <p className="text-xs text-gray-500">/ 100</p>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => analyzeJobSearch(emp.id)}
                        disabled={isSearching || isAnalyzing}
                        className="btn-primary flex items-center gap-2 whitespace-nowrap text-sm"
                      >
                        {isSearching ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Detecting...</>
                        ) : (
                          <><Search className="w-4 h-4" /> Detect Job Search</>
                        )}
                      </button>
                      <button
                        onClick={() => analyzeRisk(emp.id)}
                        disabled={isAnalyzing || isSearching}
                        className="flex items-center gap-2 whitespace-nowrap text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        {isAnalyzing ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                        ) : (
                          <><Brain className="w-3.5 h-3.5" /> Quick Risk</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Analysis Section */}
                {emp.risk_reason && (
                  <div className={`mt-4 p-4 rounded-lg ${risk.bg} space-y-3`}>
                    <p className={`text-sm ${risk.text}`}>
                      <strong>AI Analysis:</strong> {emp.risk_reason}
                    </p>

                    {/* Platforms Flagged */}
                    {emp.platforms_flagged && emp.platforms_flagged.length > 0 && (
                      <div>
                        <p className={`text-xs font-semibold ${risk.text} flex items-center gap-1 mb-1.5`}>
                          <Globe className="w-3 h-3" /> Platforms Flagged
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {emp.platforms_flagged.map((platform, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                              <Globe className="w-2.5 h-2.5" />
                              {platform}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Signals Detected */}
                    {emp.signals_detected && emp.signals_detected.length > 0 && (
                      <div>
                        <p className={`text-xs font-semibold ${risk.text} flex items-center gap-1 mb-1.5`}>
                          <Zap className="w-3 h-3" /> Signals Detected
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {emp.signals_detected.map((signal, idx) => (
                            <span key={idx} className={`inline-block px-2 py-0.5 rounded text-xs ${risk.badge}`}>
                              {signal}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendation */}
                    {emp.recommendation && (
                      <div className="flex items-start gap-2 pt-2 border-t border-current/10">
                        <Lightbulb className={`w-4 h-4 shrink-0 mt-0.5 ${risk.text}`} />
                        <p className={`text-sm ${risk.text}`}>
                          <strong>Recommendation:</strong> {emp.recommendation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeMonitoring;
