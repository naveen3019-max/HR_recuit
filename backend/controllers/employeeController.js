import {
  createEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
  updateEmployeeRisk
} from "../services/employeeService.js";
import { analyzeEmployeeRisk } from "../services/employeeRiskService.js";
import { analyzeJobSearchRisk } from "../services/jobSearchDetectionService.js";
import {
  analyzeAttritionRisk,
  createRetentionAction,
  listAttritionRisks,
  listRetentionActions,
  persistAttritionRisk
} from "../services/attritionRiskService.js";

export const createEmployeeHandler = async (req, res, next) => {
  try {
    const employee = await createEmployee(req.validated.body);
    return res.status(201).json(employee);
  } catch (error) {
    return next(error);
  }
};

export const listEmployeesHandler = async (req, res, next) => {
  try {
    const employees = await listEmployees();
    return res.json(employees);
  } catch (error) {
    return next(error);
  }
};

export const getEmployeeByIdHandler = async (req, res, next) => {
  try {
    const employee = await getEmployeeById(req.validated.params.id);
    return res.json(employee);
  } catch (error) {
    return next(error);
  }
};

export const analyzeRiskHandler = async (req, res, next) => {
  try {
    const employee = await getEmployeeById(req.validated.params.id);
    const riskResult = await analyzeEmployeeRisk(employee);
    const updated = await updateEmployeeRisk(employee.id, riskResult);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
};

export const analyzeJobSearchHandler = async (req, res, next) => {
  try {
    const employee = await getEmployeeById(req.validated.params.id);
    const riskResult = await analyzeJobSearchRisk(employee);
    const updated = await updateEmployeeRisk(employee.id, riskResult);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
};

export const analyzeAttritionRiskHandler = async (req, res, next) => {
  try {
    const employee = await getEmployeeById(req.validated.params.id);
    const result = await analyzeAttritionRisk(employee);
    await persistAttritionRisk({
      employeeId: employee.id,
      hrId: req.user?.id,
      result
    });

    const updated = await getEmployeeById(employee.id);
    return res.json({
      ...updated,
      attrition: {
        risk_score: result.risk_score,
        risk_level: result.risk_level,
        analysis: result.analysis,
        recommendation: result.recommendation,
        signals_detected: result.signals_detected
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const listAttritionRisksHandler = async (req, res, next) => {
  try {
    const risks = await listAttritionRisks();
    const normalized = risks.map((item) => ({
      employee_id: item.employee.employeeCode,
      linkedin_username: item.employee.linkedinUsername,
      employee_db_id: item.employee.id,
      name: item.employee.name,
      department: item.employee.department,
      role: item.employee.currentRole,
      risk_score: item.riskScore,
      risk_level: item.riskLevel,
      reasons_detected: item.reasons,
      recommendation: item.recommendation,
      analysis: item.aiExplanation,
      last_calculated: item.lastCalculated
    }));
    return res.json(normalized);
  } catch (error) {
    return next(error);
  }
};

export const listRetentionActionsHandler = async (req, res, next) => {
  try {
    const actions = await listRetentionActions(req.validated.params.id);
    return res.json(actions.map((item) => ({
      action_id: item.id,
      employee_id: item.employeeId,
      hr_id: item.hrId,
      hr_name: item.hr?.name || null,
      action_type: item.actionType,
      notes: item.notes,
      date: item.date
    })));
  } catch (error) {
    return next(error);
  }
};

export const createRetentionActionHandler = async (req, res, next) => {
  try {
    const action = await createRetentionAction({
      employeeId: req.validated.params.id,
      hrId: req.user?.id,
      actionType: req.validated.body.action_type,
      notes: req.validated.body.notes || null
    });

    return res.status(201).json({
      action_id: action.id,
      employee_id: action.employeeId,
      hr_id: action.hrId,
      hr_name: action.hr?.name || null,
      action_type: action.actionType,
      notes: action.notes,
      date: action.date
    });
  } catch (error) {
    return next(error);
  }
};
