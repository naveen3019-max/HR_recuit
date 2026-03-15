import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, Briefcase, Loader2, Plus, Save, ShieldAlert, Users } from "lucide-react";
import api from "../services/api";

const riskBadge = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700"
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

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId),
    [employees, selectedEmployeeId]
  );

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

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          {employees.map((employee) => (
            <div key={employee.id} className="card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskBadge[employee.risk_level] || riskBadge.LOW}`}>
                      {employee.risk_level || "LOW"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{employee.department || "No department"} - {employee.current_role || "No role"}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {employee.employee_id || `EMP-${employee.id}`}</span>
                    <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Exp: {employee.experience ?? 0}y</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <p className="text-sm text-gray-500">Risk Score</p>
                  <p className="text-2xl font-semibold text-gray-900">{employee.risk_score ?? 0}%</p>
                  <button className="btn-primary" onClick={() => runAttritionAnalysis(employee.id)} disabled={analyzingId === employee.id}>
                    {analyzingId === employee.id ? "Analyzing..." : "Analyze Attrition"}
                  </button>
                  <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700" onClick={() => loadActions(employee.id)}>
                    View Actions
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Detected Reasons</p>
                  {employee.signals_detected?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-gray-700">
                      {employee.signals_detected.map((signal) => <li key={signal}>{signal}</li>)}
                    </ul>
                  ) : <p className="mt-2 text-sm text-gray-500">No reasons detected yet.</p>}
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">AI Analysis & Recommendation</p>
                  <p className="mt-2 text-sm text-gray-700">{employee.risk_reason || "Run analysis to generate explanation."}</p>
                  <p className="mt-2 text-sm font-medium text-gray-800">{employee.recommendation || "No recommendation available."}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        <aside className="card p-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <ShieldAlert className="h-4 w-4 text-primary-600" /> Retention Action Log
          </h3>
          {!selectedEmployee ? (
            <p className="mt-3 text-sm text-gray-500">Select an employee and click "View Actions".</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-gray-600">Employee: <span className="font-medium text-gray-900">{selectedEmployee.name}</span></p>
              <form className="mt-3 space-y-3" onSubmit={submitAction}>
                <select className="input-field" value={actionType} onChange={(event) => setActionType(event.target.value)}>
                  {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <textarea className="input-field min-h-24" placeholder="Notes" value={actionNotes} onChange={(event) => setActionNotes(event.target.value)} />
                <button className="btn-primary w-full" disabled={savingAction}>
                  {savingAction ? "Saving..." : "Log Action"}
                </button>
              </form>

              <div className="mt-4 space-y-2">
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
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default AttritionDashboard;
