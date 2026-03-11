import {
  createEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
  updateEmployeeRisk
} from "../services/employeeService.js";
import { analyzeEmployeeRisk } from "../services/employeeRiskService.js";
import { analyzeJobSearchRisk } from "../services/jobSearchDetectionService.js";

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
