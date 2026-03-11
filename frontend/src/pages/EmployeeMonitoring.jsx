import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Brain,
  Briefcase,
  CheckCircle2,
  Github,
  Globe,
  Lightbulb,
  Linkedin,
  Loader2,
  Mail,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  Zap
} from "lucide-react";
import api from "../services/api";

const riskColors = {
  HIGH: { bg: "bg-red-50", text: "text-red-700", badge: "bg-red-100 text-red-700", icon: ShieldAlert },
  MEDIUM: { bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700", icon: Shield },
  LOW: { bg: "bg-green-50", text: "text-green-700", badge: "bg-green-100 text-green-700", icon: ShieldCheck }
};

const platformOrder = ["linkedin", "naukri", "indeed", "glassdoor", "monster", "shine", "timesjobs"];
const platformLabels = {
  linkedin: "LinkedIn",
  naukri: "Naukri",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  monster: "Monster",
  shine: "Shine",
  timesjobs: "TimesJobs"
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatStatus = (status) => {
  if (status === "found") return "Profile Found";
  if (status === "not_found") return "No Profile Detected";
  return "Not Scanned";
};

const getPlatformEntries = (employee) => {
  const source = employee.platform_profiles && Object.keys(employee.platform_profiles).length > 0
    ? employee.platform_profiles
    : Object.entries(employee.platforms_scanned || {}).reduce((accumulator, [key, status]) => {
        accumulator[key] = {
          platform: platformLabels[key] || key,
          status,
          profile_url: null
        };
        return accumulator;
      }, {});

  return platformOrder.map((key) => ({
    key,
    platform: source[key]?.platform || platformLabels[key],
    status: source[key]?.status || employee.platforms_scanned?.[key] || "not_scanned",
    profile_url: source[key]?.profile_url || null
  }));
};

const EmployeeMonitoring = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [jobSearchId, setJobSearchId] = useState(null);
  const [scanProgress, setScanProgress] = useState({});
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
    } catch {
      setError("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
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
      setEmployees((previous) => previous.map((employee) => (employee.id === id ? data : employee)));
    } catch {
      setError("Risk analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  const analyzeJobSearch = async (id) => {
    setJobSearchId(id);
    setError(null);
    setScanProgress((previous) => ({ ...previous, [id]: [] }));

    try {
      for (const platformKey of platformOrder) {
        await sleep(220);
        setScanProgress((previous) => ({
          ...previous,
          [id]: [...(previous[id] || []), platformKey]
        }));
      }

      const { data } = await api.post(`/employees/analyze-job-risk/${id}`);
      setEmployees((previous) => previous.map((employee) => (employee.id === id ? data : employee)));
    } catch {
      setError("Job search detection failed");
    } finally {
      setJobSearchId(null);
      setTimeout(() => {
        setScanProgress((previous) => {
          const next = { ...previous };
          delete next[id];
          return next;
        });
      }, 400);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-500">Loading employees...</span>
      </div>
    );
  }

  const highRisk = employees.filter((employee) => employee.risk_level === "HIGH").length;
  const mediumRisk = employees.filter((employee) => employee.risk_level === "MEDIUM").length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <Activity className="h-6 w-6 text-primary-600" />
            Employee Monitoring
          </h1>
          <p className="mt-1 text-gray-500">AI-powered job search risk detection across professional platforms</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Employee
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
            <User className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{employees.length}</p>
            <p className="text-sm text-gray-500">Total Employees</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
            <ShieldAlert className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-red-700">{highRisk}</p>
            <p className="text-sm text-gray-500">High Risk</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
            <Shield className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-yellow-700">{mediumRisk}</p>
            <p className="text-sm text-gray-500">Medium Risk</p>
          </div>
        </div>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Add Employee</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" className="input-field pl-10" required />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="john@company.com" className="input-field pl-10" required />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Current Role</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input type="text" name="current_role" value={formData.current_role} onChange={handleChange} placeholder="Software Engineer" className="input-field pl-10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">LinkedIn URL *</label>
                  <div className="relative">
                    <Linkedin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input type="url" name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} placeholder="https://linkedin.com/in/..." className="input-field pl-10" required />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">GitHub URL</label>
                  <div className="relative">
                    <Github className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input type="url" name="github_url" value={formData.github_url} onChange={handleChange} placeholder="https://github.com/..." className="input-field pl-10" />
                  </div>
                </div>
              </div>
              <button type="submit" disabled={formLoading} className="btn-primary w-full py-2.5">
                {formLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Add Employee"}
              </button>
            </form>
          </div>
        </div>
      )}

      {employees.length === 0 ? (
        <div className="card p-12 text-center">
          <User className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">No employees added yet. Add your first employee to start monitoring.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {employees.map((employee) => {
            const risk = riskColors[employee.risk_level] || riskColors.LOW;
            const RiskIcon = risk.icon;
            const isAnalyzing = analyzingId === employee.id;
            const isSearching = jobSearchId === employee.id;
            const completedPlatforms = scanProgress[employee.id] || [];
            const platformEntries = getPlatformEntries(employee);
            const riskBreakdown = employee.risk_breakdown || {
              linkedin_signals: 0,
              github_signals: 0,
              job_platform_signals: 0,
              total: employee.risk_score || 0
            };

            return (
              <div key={employee.id} className="card p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
                      {employee.risk_level && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${risk.badge}`}>
                          <RiskIcon className="h-3 w-3" />
                          {employee.risk_level}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{employee.current_role || "No role specified"}</p>
                    <p className="text-sm text-gray-400">{employee.email}</p>
                    <div className="mt-2 flex items-center gap-3">
                      {employee.linkedin_url && (
                        <a href={employee.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                      {employee.github_url && (
                        <a href={employee.github_url} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-gray-800">
                          <Github className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <button
                      onClick={() => analyzeJobSearch(employee.id)}
                      disabled={isSearching || isAnalyzing}
                      className="btn-primary flex items-center gap-2 whitespace-nowrap text-sm"
                    >
                      {isSearching ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Detecting...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" /> Detect Job Search
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => analyzeRisk(employee.id)}
                      disabled={isAnalyzing || isSearching}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...
                        </>
                      ) : (
                        <>
                          <Brain className="h-3.5 w-3.5" /> Quick Risk
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <section className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">1. Employee Overview</p>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-400" /> {employee.name}</div>
                      <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-gray-400" /> {employee.current_role || "No role specified"}</div>
                      <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-400" /> {employee.email}</div>
                    </div>
                  </section>

                  <section className={`rounded-xl border border-transparent p-4 ${risk.bg}`}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">2. Risk Score</p>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className={`text-4xl font-bold ${risk.text}`}>{employee.risk_score ?? 0}</p>
                        <p className="text-xs text-gray-500">Total Risk Score / 100</p>
                      </div>
                      {employee.risk_level && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${risk.badge}`}>
                          <RiskIcon className="h-3.5 w-3.5" />
                          {employee.risk_level}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between text-gray-600">
                        <span>LinkedIn signals</span>
                        <span className="font-semibold">+{riskBreakdown.linkedin_signals || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <span>GitHub activity spike</span>
                        <span className="font-semibold">+{riskBreakdown.github_signals || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <span>Job platform profiles</span>
                        <span className="font-semibold">+{riskBreakdown.job_platform_signals || 0}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-current/10 pt-2 font-semibold text-gray-800">
                        <span>Total Risk Score</span>
                        <span>{riskBreakdown.total || 0} / 100</span>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-gray-100 p-4 lg:col-span-2">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">3. Job Platform Scan</p>
                    {isSearching && (
                      <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                        <div className="mb-2 flex items-center gap-2 font-medium">
                          <Loader2 className="h-4 w-4 animate-spin" /> Scanning professional platforms...
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {platformOrder.map((platformKey) => {
                            const completed = completedPlatforms.includes(platformKey);
                            return (
                              <div key={platformKey} className="flex items-center gap-2 rounded-md bg-white/80 px-3 py-2">
                                {completed ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                                <span>{platformLabels[platformKey]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {platformEntries.map((platform) => (
                        <div key={platform.key} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-800">
                            <Globe className="h-4 w-4 text-gray-400" />
                            {platform.platform}
                          </div>
                          <p className={`text-sm ${platform.status === "found" ? "text-green-700" : "text-gray-500"}`}>
                            {formatStatus(platform.status)}
                          </p>
                          {platform.profile_url && (
                            <a href={platform.profile_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-blue-600 hover:text-blue-800">
                              {platform.profile_url}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-gray-100 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">4. Platforms Flagged</p>
                    {employee.platforms_flagged?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {employee.platforms_flagged.map((platform) => (
                          <span key={platform} className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                            <Globe className="h-3 w-3" />
                            {platform}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No platforms flagged yet.</p>
                    )}
                  </section>

                  <section className="rounded-xl border border-gray-100 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">5. Signals Detected</p>
                    {employee.signals_detected?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {employee.signals_detected.map((signal) => (
                          <span key={signal} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${risk.badge}`}>
                            <Zap className="h-3 w-3" />
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No signals detected yet.</p>
                    )}
                  </section>

                  <section className={`rounded-xl border border-transparent p-4 lg:col-span-2 ${risk.bg}`}>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">6. AI Analysis</p>
                    <p className={`text-sm leading-6 ${risk.text}`}>
                      {employee.risk_reason || "Run job search detection to generate AI reasoning."}
                    </p>
                  </section>

                  <section className="rounded-xl border border-gray-100 p-4 lg:col-span-2">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">7. Recommendation</p>
                    {employee.recommendation ? (
                      <div className="flex items-start gap-2 text-sm text-gray-700">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <p>{employee.recommendation}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No recommendation available yet.</p>
                    )}
                  </section>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeMonitoring;
