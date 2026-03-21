import {
  runTalentSearch,
  updateTalentSearchMatch
} from "../services/talentSearchService.js";
import { runGlobalTalentSearch } from "../services/globalTalentService.js";

export const talentSearchHandler = async (req, res, next) => {
  try {
    const result = await runTalentSearch(req.validated.body, req.user.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const updateTalentMatchHandler = async (req, res, next) => {
  try {
    const result = await updateTalentSearchMatch(req.validated.params.id, req.validated.body, req.user.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const globalTalentSearchHandler = async (req, res, next) => {
  try {
    const result = await runGlobalTalentSearch(req.validated.body, req.user.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};
