import {
  createJobRole,
  getJobRoleById,
  listJobRoles
} from "../services/jobRoleService.js";
import { getJobRecommendations } from "../services/jobMatchingService.js";

export const createJobRoleHandler = async (req, res, next) => {
  try {
    const role = await createJobRole(req.validated.body);
    return res.status(201).json(role);
  } catch (error) {
    return next(error);
  }
};

export const listJobRolesHandler = async (req, res, next) => {
  try {
    const roles = await listJobRoles();
    return res.json(roles);
  } catch (error) {
    return next(error);
  }
};

export const getJobRoleByIdHandler = async (req, res, next) => {
  try {
    const role = await getJobRoleById(req.validated.params.id);
    return res.json(role);
  } catch (error) {
    return next(error);
  }
};

export const getRecommendationsHandler = async (req, res, next) => {
  try {
    const role = await getJobRoleById(req.validated.params.id);
    const recommendations = await getJobRecommendations(role);
    return res.json(recommendations);
  } catch (error) {
    return next(error);
  }
};
