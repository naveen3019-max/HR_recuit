import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarDays,
  Gauge,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users
} from "lucide-react";
import api from "../services/api";

const riskBadge = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700"
};

const riskTheme = {
  HIGH: {
    score: "text-red-600",
    ring: "#dc2626",
    chip: "bg-red-50 text-red-700 border-red-100"
  },
  MEDIUM: {
    score: "text-amber-600",
    ring: "#d97706",
    chip: "bg-amber-50 text-amber-700 border-amber-100"
  },
  LOW: {
    score: "text-emerald-600",
    ring: "#059669",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-100"
  }
};

const defaultActions = [
  "Understand employee concerns and career expectations.",
  "Define career path and development goals.",
  "Provide mentoring and support from manager.",
  "Track progress over the next 30 days."
];

const actionBlueprint = [
  { title: "Conduct one-on-one discussion", icon: MessageCircle },
  { title: "Create retention plan", icon: TrendingUp },
  { title: "Address performance concerns", icon: Target },
  { title: "Monitor engagement", icon: UserCheck }
];

const toTitleCase = (value = "") => value
  .split(" ")
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(" ");

const parseRecommendedActions = (recommendation) => {
  if (!recommendation) return defaultActions;
  const clean = recommendation
    .split(/\n|\.|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (clean.length >= 3) {
    return clean.slice(0, 4);
  }

  return defaultActions;
};

const buildAttritionReport = (employee) => {
  const name = employee.name || "N/A";
  const role = employee.current_role || "N/A";
  const experience = typeof employee.experience === "number" ? `${employee.experience} years` : "N/A";
  const riskLevel = (employee.risk_level || "LOW").toUpperCase();
  const riskScore = Number.isFinite(employee.risk_score) ? Math.round(employee.risk_score) : 0;
  const signals = Array.isArray(employee.signals_detected) && employee.signals_detected.length
    ? employee.signals_detected
    : ["No strong attrition signals detected from currently available data"];
  const analysis = employee.risk_reason || "No analysis available. Run Analyze Attrition.";
  const actions = parseRecommendedActions(employee.recommendation);

  return {
    summary: {
      name,
      role,
      experience,
      riskLevel,
      riskScore
    },
    signals,
    analysis,
    actions
  };
};

const actionOptions = [
  { value: "salary_increment", label: "Salary Increment" },
  { value: "promotion_opportunity", label: "Promotion Opportunity" },
  { value: "retention_discussion", label: "Retention Discussion" },
  { value: "role_adjustment", label: "Role Adjustment" },
  { value: "career_development_plan", label: "Career Development Plan" },
  { value: "other", label: "Other" }
];

const emptyEmployeeForm = {
  employee_id: "",
  name: "",
  email: "",
  department: "",
  current_role: "",
  salary: "",
  experience: "",
  performance_score: "",
  engagement_score: "",
  attendance_score: "",
  manager_concern: false,
  linkedin_url: "",
  github_url: ""
};

const AttritionDashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
  const [submittingEmployee, setSubmittingEmployee] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [actions, setActions] = useState([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [actionType, setActionType] = useState("retention_discussion");
  const [actionNotes, setActionNotes] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const [error, setError] = useState("");

  const fetchEmployees = async () => {
    const { data } = await api.get("/employees");
    setEmployees(data);
  };

  const fetchRisks = async () => {
    const { data } = await api.get("/employees/attrition-risks");
    setRisks(data);
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([fetchEmployees(), fetchRisks()]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load attrition dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const selectedEmployee = useMemo(() => {
    if (employees.length === 0) return null;
    return employees.find((employee) => employee.id === selectedEmployeeId) || employees[0];
  }, [employees, selectedEmployeeId]);

  const loadActions = async (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setLoadingActions(true);
    try {
      const { data } = await api.get(`/employees/${employeeId}/retention-actions`);
      setActions(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load retention actions.");
    } finally {
      setLoadingActions(false);
    }
  };

  const onEmployeeField = (event) => {
    const { name, value, type, checked } = event.target;
    setEmployeeForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const submitEmployee = async (event) => {
    event.preventDefault();
    setSubmittingEmployee(true);
    setError("");
    try {
      await api.post("/employees", {
        employee_id: employeeForm.employee_id || undefined,
        name: employeeForm.name,
        email: employeeForm.email,
        department: employeeForm.department || undefined,
        current_role: employeeForm.current_role || undefined,
        salary: employeeForm.salary ? Number(employeeForm.salary) : undefined,
        experience: employeeForm.experience ? Number(employeeForm.experience) : undefined,
        performance_score: employeeForm.performance_score ? Number(employeeForm.performance_score) : undefined,
        engagement_score: employeeForm.engagement_score ? Number(employeeForm.engagement_score) : undefined,
        attendance_score: employeeForm.attendance_score ? Number(employeeForm.attendance_score) : undefined,
        market_salary: employeeForm.salary ? Number(employeeForm.salary) : undefined,
        manager_concern: Boolean(employeeForm.manager_concern),
        linkedin_url: employeeForm.linkedin_url,
        github_url: employeeForm.github_url || undefined
      });

      setShowEmployeeForm(false);
      setEmployeeForm(emptyEmployeeForm);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create employee.");
    } finally {
      setSubmittingEmployee(false);
    }
  };

  const runAttritionAnalysis = async (employeeId) => {
    setAnalyzingId(employeeId);
    setError("");
    try {
      const { data } = await api.post(`/employees/analyze-attrition/${employeeId}`);
      setEmployees((prev) => prev.map((employee) => (employee.id === employeeId ? data : employee)));
      await fetchRisks();
      if (selectedEmployeeId === employeeId) {
        await loadActions(employeeId);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to analyze attrition risk.");
    } finally {
      setAnalyzingId(null);
    }
  };

  const submitAction = async (event) => {
    event.preventDefault();
    if (!selectedEmployeeId) return;

    setSavingAction(true);
    setError("");
    try {
      await api.post(`/employees/${selectedEmployeeId}/retention-actions`, {
        action_type: actionType,
        notes: actionNotes || undefined
      });
      setActionNotes("");
      await loadActions(selectedEmployeeId);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save retention action.");
    } finally {
      setSavingAction(false);
    }
  };

  const highCount = risks.filter((risk) => risk.risk_level === "HIGH").length;
  const mediumCount = risks.filter((risk) => risk.risk_level === "MEDIUM").length;
  const activeEmployee = selectedEmployee;
  const activeReport = activeEmployee ? buildAttritionReport(activeEmployee) : null;
  const activeTheme = activeReport ? (riskTheme[activeReport.summary.riskLevel] || riskTheme.LOW) : riskTheme.LOW;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading attrition dashboard...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <BarChart3 className="h-6 w-6 text-primary-600" />
            Employee Attrition Detection
          </h1>
          <p className="mt-1 text-sm text-gray-500">AI-assisted attrition alerts with deterministic risk scoring and HR retention logging.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowEmployeeForm(true)}>
          <Plus className="h-4 w-4" /> Add Employee
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Employees</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{employees.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">High Risk</p>
          <p className="mt-1 text-2xl font-semibold text-red-700">{highCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Medium Risk</p>
          <p className="mt-1 text-2xl font-semibold text-yellow-700">{mediumCount}</p>
        </div>
      </div>

      {showEmployeeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Add Employee Data</h2>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitEmployee}>
              <input className="input-field" name="employee_id" value={employeeForm.employee_id} onChange={onEmployeeField} placeholder="Employee ID" />
              <input className="input-field" name="name" value={employeeForm.name} onChange={onEmployeeField} placeholder="Name" required />
              <input className="input-field" name="email" value={employeeForm.email} onChange={onEmployeeField} placeholder="Email" type="email" required />
              <input className="input-field" name="department" value={employeeForm.department} onChange={onEmployeeField} placeholder="Department" />
              <input className="input-field" name="current_role" value={employeeForm.current_role} onChange={onEmployeeField} placeholder="Role" />
              <input className="input-field" name="salary" value={employeeForm.salary} onChange={onEmployeeField} placeholder="Current Salary" type="number" min="0" />
              <input className="input-field" name="experience" value={employeeForm.experience} onChange={onEmployeeField} placeholder="Experience (years)" type="number" min="0" step="0.1" />
              <input className="input-field" name="performance_score" value={employeeForm.performance_score} onChange={onEmployeeField} placeholder="Performance Score (0-100)" type="number" min="0" max="100" />
              <input className="input-field" name="engagement_score" value={employeeForm.engagement_score} onChange={onEmployeeField} placeholder="Engagement Score (0-100)" type="number" min="0" max="100" />
              <input className="input-field" name="attendance_score" value={employeeForm.attendance_score} onChange={onEmployeeField} placeholder="Attendance Score (0-100)" type="number" min="0" max="100" />
              <input className="input-field sm:col-span-2" name="linkedin_url" value={employeeForm.linkedin_url} onChange={onEmployeeField} placeholder="LinkedIn URL" required />
              <input className="input-field sm:col-span-2" name="github_url" value={employeeForm.github_url} onChange={onEmployeeField} placeholder="GitHub URL (optional)" />
              <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="manager_concern" checked={employeeForm.manager_concern} onChange={onEmployeeField} />
                Manager concern flagged
              </label>
              <div className="sm:col-span-2 flex justify-end gap-3">
                <button type="button" className="rounded-lg border border-gray-200 px-4 py-2 text-sm" onClick={() => setShowEmployeeForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex items-center gap-2" disabled={submittingEmployee}>
                  {submittingEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {employees.length === 0 ? (
        <div className="card rounded-2xl p-10 text-center text-gray-500">
          <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          Add your first employee to start attrition analytics.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {employees.map((employee) => {
              const isActive = employee.id === activeEmployee?.id;
              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${isActive ? "border-primary-300 bg-primary-50" : "border-gray-100 bg-white hover:border-gray-200"}`}
                >
                  <p className="text-sm font-semibold text-gray-900">{employee.name}</p>
                  <p className="mt-1 text-xs text-gray-500">{employee.current_role || "No role"}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${riskBadge[employee.risk_level] || riskBadge.LOW}`}>
                      {(employee.risk_level || "LOW").toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-gray-600">{Math.round(employee.risk_score || 0)}%</span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeEmployee && activeReport && (
            <>
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Employee Attrition Intelligence</p>
                    <h2 className="mt-2 text-2xl font-semibold text-gray-900">{activeReport.summary.name}</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5">
                        <Briefcase className="h-4 w-4 text-gray-500" /> {activeReport.summary.role}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5">
                        <CalendarDays className="h-4 w-4 text-gray-500" /> {activeReport.summary.experience}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${riskBadge[activeReport.summary.riskLevel] || riskBadge.LOW}`}>
                        {toTitleCase(activeReport.summary.riskLevel)} Risk
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="relative h-28 w-28 rounded-full p-2" style={{ background: `conic-gradient(${activeTheme.ring} ${Math.max(0, Math.min(100, activeReport.summary.riskScore)) * 3.6}deg, #e5e7eb 0deg)` }}>
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
                        <div className="text-center">
                          <p className={`text-2xl font-bold ${activeTheme.score}`}>{activeReport.summary.riskScore}%</p>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Risk Score</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        className="btn-primary"
                        onClick={() => runAttritionAnalysis(activeEmployee.id)}
                        disabled={analyzingId === activeEmployee.id}
                      >
                        {analyzingId === activeEmployee.id ? "Analyzing..." : "Analyze Attrition"}
                      </button>
                      <button
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        onClick={() => loadActions(activeEmployee.id)}
                      >
                        View Actions
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Risk Signals</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeReport.signals.map((signal) => (
                      <span key={signal} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${activeTheme.chip}`}>
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    <Sparkles className="h-4 w-4 text-primary-600" /> AI Attrition Insight
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-gray-700">{activeReport.analysis}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Recommended HR Actions</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {actionBlueprint.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="mb-2 inline-flex rounded-lg bg-white p-2 shadow-sm ring-1 ring-gray-100">
                          <Icon className="h-4 w-4 text-primary-600" />
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-600">{activeReport.actions[idx] || defaultActions[idx]}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  <Gauge className="h-4 w-4 text-primary-600" /> Optional Analytics
                </h3>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {[
                    { label: "Engagement Score", value: Number(activeEmployee.engagement_score || 0) },
                    { label: "Performance Score", value: Number(activeEmployee.performance_score || 0) },
                    { label: "Attendance Score", value: Number(activeEmployee.attendance_score || 0) }
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-gray-100 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{item.value} / 100</p>
                      <div className="mt-2 h-2 rounded-full bg-gray-100">
                        <div
                          className={`h-2 rounded-full ${item.value < 50 ? "bg-red-500" : item.value < 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.max(0, Math.min(100, item.value))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <ShieldAlert className="h-4 w-4 text-primary-600" /> Retention Action Log
                </h3>
                <p className="mt-2 text-sm text-gray-600">Employee: <span className="font-medium text-gray-900">{activeEmployee.name}</span></p>
                <form className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_auto]" onSubmit={submitAction}>
                  <select className="input-field" value={actionType} onChange={(event) => setActionType(event.target.value)}>
                    {actionOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <textarea className="input-field min-h-24" placeholder="Notes" value={actionNotes} onChange={(event) => setActionNotes(event.target.value)} />
                  <button className="btn-primary h-fit" disabled={savingAction}>
                    {savingAction ? "Saving..." : "Log Action"}
                  </button>
                </form>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {loadingActions ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading actions...</div>
                  ) : actions.length === 0 ? (
                    <p className="text-sm text-gray-500">No actions logged yet.</p>
                  ) : (
                    actions.map((action) => (
                      <div key={action.action_id} className="rounded-lg border border-gray-100 p-3">
                        <p className="text-sm font-medium text-gray-900">{action.action_type.replace(/_/g, " ")}</p>
                        <p className="text-xs text-gray-500">{new Date(action.date).toLocaleString()}</p>
                        {action.notes && <p className="mt-1 text-sm text-gray-700">{action.notes}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AttritionDashboard;
